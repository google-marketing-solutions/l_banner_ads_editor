/**
 * @license
 * Copyright 2026 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Interactive L-Banner template canvas editor with drag-and-resize bounding
 * boxes, multi-logo management, and live typography controls.
 */

import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  Layout,
  Maximize2,
  Move,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import * as React from 'react';
import {useEffect, useRef, useState} from 'react';

import type {
  AdVariation,
  ExtraLogoAsset,
  GlobalStyleState,
  LogoConfig,
  StateUpdater,
  TemplateConfig,
  TextBoxConfig,
} from '../types';
import {
  DEFAULT_TEMPLATES,
  drawAdFrame,
  preloadLogoImage,
} from '../utils/canvas';
import {
  AVAILABLE_FONTS,
  type FontOption,
  loadCustomFont,
  loadGoogleFont,
  warmUpFontGlyphs,
} from '../utils/fonts';

import {TextAlignmentPopover} from './TextAlignmentPopover';

/** Props for the TemplateEditor component. */
interface TemplateEditorProps {
  readonly template: TemplateConfig;
  readonly onUpdateTemplate: StateUpdater<TemplateConfig>;
  readonly onUpdateGlobalStyle: StateUpdater<GlobalStyleState>;
  readonly selectedVariation: AdVariation;
  readonly onUpdateVariation?: (updated: AdVariation) => void;
  readonly customFonts: readonly FontOption[];
  readonly onAddCustomFont: (font: FontOption) => void;
}

type DragHandleMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface DraggingState {
  readonly boxId: string;
  readonly mode: DragHandleMode;
  readonly startMouseX: number;
  readonly startMouseY: number;
  readonly origX: number;
  readonly origY: number;
  readonly origW: number;
  readonly origH: number;
}

interface TargetBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const COORD_FIELDS: ReadonlyArray<'x' | 'y' | 'width' | 'height'> = [
  'x',
  'y',
  'width',
  'height',
];

function clampBoxesToNewDimensions(
  prevTemplate: TemplateConfig,
  newLWidth: number,
  newLHeight: number,
): Pick<TemplateConfig, 'textBoxes' | 'logo' | 'extraLogos'> {
  const isLeft = prevTemplate.type === 'bottom-left';
  const padding = 20;

  const updatedTextBoxes = prevTemplate.textBoxes.map((box) => {
    const updated = {...box};
    const isSideVerticalBox =
      box.direction === 'vertical' ||
      box.id.includes('left') ||
      box.id.includes('right');

    if (isSideVerticalBox && updated.y < 1080 - prevTemplate.lHeight) {
      const maxW = Math.max(60, newLWidth - padding * 2);
      if (updated.width > maxW) {
        updated.width = maxW;
      }
      if (isLeft) {
        if (updated.x + updated.width > newLWidth - padding) {
          updated.x = Math.max(padding, newLWidth - updated.width - padding);
        }
      } else {
        const rightBarStart = 1920 - newLWidth;
        if (updated.x < rightBarStart + padding) {
          updated.x = rightBarStart + padding;
        }
      }
    }

    if (updated.y >= 1080 - prevTemplate.lHeight - 40) {
      const bottomBarStart = 1080 - newLHeight;
      const maxH = Math.max(40, newLHeight - padding * 2);
      if (updated.height > maxH) {
        updated.height = maxH;
      }
      if (updated.y < bottomBarStart + padding) {
        updated.y = bottomBarStart + padding;
      }
      if (updated.y + updated.height > 1080 - padding) {
        updated.y = Math.max(
          bottomBarStart + padding,
          1080 - updated.height - padding,
        );
      }
    }

    return updated;
  });

  let updatedLogo: LogoConfig | undefined = prevTemplate.logo;
  if (updatedLogo != null) {
    const logoCopy = {...updatedLogo};
    const maxLogoW = Math.max(60, newLWidth - padding * 2);
    const maxLogoH = Math.max(40, newLHeight - padding * 2);
    if (logoCopy.width > maxLogoW) logoCopy.width = maxLogoW;
    if (logoCopy.height > maxLogoH) logoCopy.height = maxLogoH;

    const bottomBarStart = 1080 - newLHeight;
    if (logoCopy.y >= 1080 - prevTemplate.lHeight - 40) {
      logoCopy.y = Math.max(
        bottomBarStart + padding / 2,
        Math.min(1080 - logoCopy.height - padding / 2, logoCopy.y),
      );
    }
    if (isLeft && logoCopy.x < prevTemplate.lWidth) {
      logoCopy.x = Math.max(
        padding,
        Math.min(newLWidth - logoCopy.width - padding, logoCopy.x),
      );
    } else if (!isLeft && logoCopy.x >= 1920 - prevTemplate.lWidth - 40) {
      const rightBarStart = 1920 - newLWidth;
      logoCopy.x = Math.max(
        rightBarStart + padding,
        Math.min(1920 - logoCopy.width - padding, logoCopy.x),
      );
    }
    updatedLogo = logoCopy;
  }

  return {
    textBoxes: updatedTextBoxes,
    logo: updatedLogo,
    extraLogos: prevTemplate.extraLogos,
  };
}

/** Renders the Step 1 interactive L-Banner template editor and preview canvas. */
export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onUpdateTemplate,
  onUpdateGlobalStyle,
  selectedVariation,
  onUpdateVariation,
  customFonts,
  onAddCustomFont,
}): React.ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string>('default');
  const [draggingState, setDraggingState] = useState<DraggingState | null>(
    null,
  );
  const [fontLoadingStatus, setFontLoadingStatus] = useState<string | null>(
    null,
  );
  const [expandedCoords, setExpandedCoords] = useState<Record<string, boolean>>(
    {},
  );
  const [isExtraLogosOpen, setIsExtraLogosOpen] = useState<boolean>(false);

  const toggleCoords = (id: string): void => {
    setExpandedCoords((prev) => ({...prev, [id]: !prev[id]}));
  };

  const allFonts: readonly FontOption[] = [...AVAILABLE_FONTS, ...customFonts];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) return;
    let isCancelled = false;

    const renderCanvas = (): void => {
      if (!isCancelled && canvasRef.current != null) {
        drawAdFrame(canvasRef.current, template, selectedVariation, {
          isPreview: true,
          hoveredBoxId: hoveredBoxId ?? undefined,
          draggedBoxId: draggingState?.boxId,
        });
      }
    };

    renderCanvas();

    const fontsToEnsure = new Set<string>();
    const allTextChars: string[] = [];

    for (const box of template.textBoxes) {
      const f =
        selectedVariation.fontFamilies?.[box.id] ??
        box.defaultFontFamily ??
        'Noto Sans JP';
      fontsToEnsure.add(f);
      const textVal = selectedVariation.texts[box.id] ?? '';
      if (textVal !== '') {
        allTextChars.push(textVal);
      }
    }

    const extraText = allTextChars.join('');

    void Promise.all(
      Array.from(fontsToEnsure).map((f) => warmUpFontGlyphs(f, extraText)),
    ).then(() => {
      renderCanvas();
    });

    return () => {
      isCancelled = true;
    };
  }, [template, selectedVariation, hoveredBoxId, draggingState]);

  const getCanvasCoords = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): {x: number; y: number} => {
    const canvas = canvasRef.current;
    if (canvas == null) return {x: 0, y: 0};
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1920 / rect.width;
    const scaleY = 1080 / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const detectHandle = (
    x: number,
    y: number,
    target: TargetBounds,
    hitRadius = 24,
  ): DragHandleMode | null => {
    if (
      Math.abs(x - target.x) <= hitRadius &&
      Math.abs(y - target.y) <= hitRadius
    ) {
      return 'nw';
    }
    if (
      Math.abs(x - (target.x + target.width)) <= hitRadius &&
      Math.abs(y - target.y) <= hitRadius
    ) {
      return 'ne';
    }
    if (
      Math.abs(x - target.x) <= hitRadius &&
      Math.abs(y - (target.y + target.height)) <= hitRadius
    ) {
      return 'sw';
    }
    if (
      Math.abs(x - (target.x + target.width)) <= hitRadius &&
      Math.abs(y - (target.y + target.height)) <= hitRadius
    ) {
      return 'se';
    }
    if (
      x >= target.x &&
      x <= target.x + target.width &&
      y >= target.y &&
      y <= target.y + target.height
    ) {
      return 'move';
    }
    return null;
  };

  const getCursorForMode = (mode: DragHandleMode | null): string => {
    switch (mode) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'move':
        return 'grab';
      default:
        return 'default';
    }
  };

  const findHitElement = (
    x: number,
    y: number,
  ): {id: string; mode: DragHandleMode; target: TargetBounds} | null => {
    if (template.extraLogos != null && template.extraLogos.length > 0) {
      for (let i = template.extraLogos.length - 1; i >= 0; i--) {
        const extra = template.extraLogos[i];
        const mode = detectHandle(x, y, extra);
        if (mode != null) {
          return {id: extra.id, mode, target: extra};
        }
      }
    }

    if (template.logo != null && template.logo.url !== '') {
      const mode = detectHandle(x, y, template.logo);
      if (mode != null) {
        return {id: '__logo__', mode, target: template.logo};
      }
    }

    for (let i = template.textBoxes.length - 1; i >= 0; i--) {
      const box = template.textBoxes[i];
      const mode = detectHandle(x, y, box);
      if (mode != null) {
        return {id: box.id, mode, target: box};
      }
    }
    return null;
  };

  const handleCanvasMouseDown = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): void => {
    const {x, y} = getCanvasCoords(e);
    const hit = findHitElement(x, y);
    if (hit != null) {
      setDraggingState({
        boxId: hit.id,
        mode: hit.mode,
        startMouseX: x,
        startMouseY: y,
        origX: hit.target.x,
        origY: hit.target.y,
        origW: hit.target.width,
        origH: hit.target.height,
      });
    }
  };

  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): void => {
    const {x, y} = getCanvasCoords(e);

    if (draggingState != null) {
      const dx = x - draggingState.startMouseX;
      const dy = y - draggingState.startMouseY;
      const minW = 60;
      const minH = 40;

      let newX = draggingState.origX;
      let newY = draggingState.origY;
      let newW = draggingState.origW;
      let newH = draggingState.origH;

      if (draggingState.mode === 'move') {
        newX = Math.max(
          0,
          Math.min(1920 - draggingState.origW, draggingState.origX + dx),
        );
        newY = Math.max(
          0,
          Math.min(1080 - draggingState.origH, draggingState.origY + dy),
        );
      } else {
        if (draggingState.mode === 'se') {
          newW = Math.max(
            minW,
            Math.min(1920 - draggingState.origX, draggingState.origW + dx),
          );
          newH = Math.max(
            minH,
            Math.min(1080 - draggingState.origY, draggingState.origH + dy),
          );
        } else if (draggingState.mode === 'sw') {
          const maxDeltaX = draggingState.origW - minW;
          const clampedDx = Math.max(
            -draggingState.origX,
            Math.min(maxDeltaX, dx),
          );
          newX = draggingState.origX + clampedDx;
          newW = draggingState.origW - clampedDx;
          newH = Math.max(
            minH,
            Math.min(1080 - draggingState.origY, draggingState.origH + dy),
          );
        } else if (draggingState.mode === 'ne') {
          newW = Math.max(
            minW,
            Math.min(1920 - draggingState.origX, draggingState.origW + dx),
          );
          const maxDeltaY = draggingState.origH - minH;
          const clampedDy = Math.max(
            -draggingState.origY,
            Math.min(maxDeltaY, dy),
          );
          newY = draggingState.origY + clampedDy;
          newH = draggingState.origH - clampedDy;
        } else if (draggingState.mode === 'nw') {
          const maxDeltaX = draggingState.origW - minW;
          const clampedDx = Math.max(
            -draggingState.origX,
            Math.min(maxDeltaX, dx),
          );
          newX = draggingState.origX + clampedDx;
          newW = draggingState.origW - clampedDx;

          const maxDeltaY = draggingState.origH - minH;
          const clampedDy = Math.max(
            -draggingState.origY,
            Math.min(maxDeltaY, dy),
          );
          newY = draggingState.origY + clampedDy;
          newH = draggingState.origH - clampedDy;
        }
      }

      const finalX = Math.round(newX);
      const finalY = Math.round(newY);
      const finalW = Math.round(newW);
      const finalH = Math.round(newH);

      if (draggingState.boxId === '__logo__') {
        onUpdateTemplate((prev) => {
          if (prev.logo == null) return prev;
          return {
            ...prev,
            logo: {
              ...prev.logo,
              x: finalX,
              y: finalY,
              width: finalW,
              height: finalH,
            },
          };
        });
      } else if (draggingState.boxId.startsWith('extra-logo-')) {
        onUpdateTemplate((prev) => ({
          ...prev,
          extraLogos: (prev.extraLogos ?? []).map((item) =>
            item.id === draggingState.boxId
              ? {
                  ...item,
                  x: finalX,
                  y: finalY,
                  width: finalW,
                  height: finalH,
                }
              : item,
          ),
        }));
      } else {
        onUpdateTemplate((prev) => ({
          ...prev,
          textBoxes: prev.textBoxes.map((b) =>
            b.id === draggingState.boxId
              ? {...b, x: finalX, y: finalY, width: finalW, height: finalH}
              : b,
          ),
        }));
      }
      return;
    }

    const hit = findHitElement(x, y);
    setHoveredBoxId(hit != null ? hit.id : null);
    setHoverCursor(getCursorForMode(hit != null ? hit.mode : null));
  };

  const handleCanvasMouseUp = (): void => {
    setDraggingState(null);
  };

  const handlePresetChange = (presetId: string): void => {
    const found = DEFAULT_TEMPLATES.find((t) => t.id === presetId);
    if (found != null) {
      onUpdateTemplate({
        ...found,
        backgroundColor: template.backgroundColor,
        lWidth: template.lWidth,
        lHeight: template.lHeight,
        logo:
          found.logo != null
            ? {
                ...found.logo,
                url: template.logo?.url ?? found.logo.url,
              }
            : undefined,
        extraLogos: template.extraLogos ?? [],
      });
    }
  };

  const handleBoxChange = (
    boxId: string,
    field: keyof TextBoxConfig,
    value?: string | number,
  ): void => {
    onUpdateTemplate((prev) => ({
      ...prev,
      textBoxes: prev.textBoxes.map((b) =>
        b.id === boxId ? {...b, [field]: value} : b,
      ),
    }));
  };

  const handleAddTextBox = (): void => {
    const newIndex = template.textBoxes.length + 1;
    const newId = `box-custom-${Date.now()}`;
    const isBottomLeft = template.type === 'bottom-left';
    const defaultX = isBottomLeft ? template.lWidth + 60 : 80;
    const defaultY = 1080 - template.lHeight + 40;

    const newBox: TextBoxConfig = {
      id: newId,
      name: `Text Box ${newIndex} (テキスト${newIndex})`,
      x: Math.min(1600, Math.max(20, defaultX)),
      y: Math.min(980, Math.max(20, defaultY)),
      width: 480,
      height: 120,
      fontSize: 48,
      defaultFontFamily: 'Noto Sans JP',
      color: '#FFFFFF',
      direction: 'horizontal',
      align: 'center',
      vAlign: 'middle',
    };

    onUpdateTemplate((prev) => ({
      ...prev,
      textBoxes: [...prev.textBoxes, newBox],
    }));

    if (onUpdateVariation != null) {
      onUpdateVariation({
        ...selectedVariation,
        texts: {
          ...selectedVariation.texts,
          [newId]: `新規テキスト ${newIndex}`,
        },
        fontSizes: {
          ...selectedVariation.fontSizes,
          [newId]: 48,
        },
        fontFamilies: {
          ...(selectedVariation.fontFamilies ?? {}),
          [newId]: 'Noto Sans JP',
        },
      });
    }
  };

  const handleRemoveTextBox = (boxId: string): void => {
    if (template.textBoxes.length <= 1) return;
    onUpdateTemplate((prev) => ({
      ...prev,
      textBoxes: prev.textBoxes.filter((b) => b.id !== boxId),
    }));
  };

  const handleResetLayout = (): void => {
    const defaultMatch =
      DEFAULT_TEMPLATES.find((t) => t.id === template.id) ??
      DEFAULT_TEMPLATES[0];
    onUpdateTemplate({
      ...defaultMatch,
      textBoxes: defaultMatch.textBoxes.map((b) => ({...b})),
      logo: defaultMatch.logo != null ? {...defaultMatch.logo} : undefined,
      extraLogos: [],
    });
    onUpdateGlobalStyle({
      backgroundColor: defaultMatch.backgroundColor,
      lWidth: defaultMatch.lWidth,
      lHeight: defaultMatch.lHeight,
      logoUrl: defaultMatch.logo?.url,
      extraLogos: [],
    });
  };

  const handleLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (file == null) return;

    const objectUrl = URL.createObjectURL(file);
    try {
      await preloadLogoImage(objectUrl);
    } catch (err) {
      console.warn('Logo decode warning:', err);
    }

    const defaultX = template.type === 'bottom-left' ? 40 : 1920 - 380;
    const defaultY = 1080 - 220;

    onUpdateTemplate((prev) => ({
      ...prev,
      logo: {
        url: objectUrl,
        x: prev.logo?.x ?? defaultX,
        y: prev.logo?.y ?? defaultY,
        width: prev.logo?.width ?? 340,
        height: prev.logo?.height ?? 180,
      },
    }));
    onUpdateGlobalStyle((prev) => ({
      ...prev,
      logoUrl: objectUrl,
    }));
  };

  const handleFontSelectionChange = async (
    boxId: string,
    fontValue: string,
  ): Promise<void> => {
    setFontLoadingStatus(`Loading ${fontValue}...`);
    await loadGoogleFont(fontValue);
    handleBoxChange(boxId, 'defaultFontFamily', fontValue);

    if (onUpdateVariation != null) {
      onUpdateVariation({
        ...selectedVariation,
        fontFamilies: {
          ...(selectedVariation.fontFamilies ?? {}),
          [boxId]: fontValue,
        },
      });
    }
    setFontLoadingStatus(null);
  };

  const handleCustomFontUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (file == null) return;
    try {
      setFontLoadingStatus(`Loading font ${file.name}...`);
      const fontFamilyName = await loadCustomFont(file);
      const newFontOption: FontOption = {
        label: `${file.name} (カスタム)`,
        value: fontFamilyName,
        isGoogle: false,
      };
      onAddCustomFont(newFontOption);
      setFontLoadingStatus(`Loaded: ${file.name}`);
      setTimeout(() => {
        setFontLoadingStatus(null);
      }, 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Font load error';
      setFontLoadingStatus(`Error: ${message}`);
    }
    e.target.value = '';
  };

  const handleRemoveLogo = (): void => {
    onUpdateTemplate((prev) => ({
      ...prev,
      logo: prev.logo != null ? {...prev.logo, url: ''} : undefined,
    }));
    onUpdateGlobalStyle((prev) => ({
      ...prev,
      logoUrl: '',
    }));
  };

  const handleAddExtraLogo = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (file == null) return;

    const objectUrl = URL.createObjectURL(file);
    try {
      await preloadLogoImage(objectUrl);
    } catch (err) {
      console.warn('Extra logo decode warning:', err);
    }

    const count = (template.extraLogos?.length ?? 0) + 1;
    const isBottomLeft = template.type === 'bottom-left';
    const defaultX = isBottomLeft
      ? 60 + ((count * 30) % 200)
      : 1920 - 340 - ((count * 30) % 200);
    const defaultY = 1080 - 200;

    const newExtra: ExtraLogoAsset = {
      id: `extra-logo-${Date.now()}`,
      name: `Sub Logo ${count} (${file.name.slice(0, 12)})`,
      url: objectUrl,
      x: defaultX,
      y: defaultY,
      width: 240,
      height: 120,
    };

    onUpdateTemplate((prev) => ({
      ...prev,
      extraLogos: [...(prev.extraLogos ?? []), newExtra],
    }));
    onUpdateGlobalStyle((prev) => ({
      ...prev,
      extraLogos: [...prev.extraLogos, newExtra],
    }));
    setIsExtraLogosOpen(true);
    e.target.value = '';
  };

  const handleUpdateExtraLogo = (
    id: string,
    updates: Partial<ExtraLogoAsset>,
  ): void => {
    onUpdateTemplate((prev) => ({
      ...prev,
      extraLogos: (prev.extraLogos ?? []).map((item) =>
        item.id === id ? {...item, ...updates} : item,
      ),
    }));
    onUpdateGlobalStyle((prev) => ({
      ...prev,
      extraLogos: prev.extraLogos.map((item) =>
        item.id === id ? {...item, ...updates} : item,
      ),
    }));
  };

  const handleRemoveExtraLogo = (id: string): void => {
    onUpdateTemplate((prev) => ({
      ...prev,
      extraLogos: (prev.extraLogos ?? []).filter((item) => item.id !== id),
    }));
    onUpdateGlobalStyle((prev) => ({
      ...prev,
      extraLogos: prev.extraLogos.filter((item) => item.id !== id),
    }));
  };

  const handleLogoNumberChange = (
    field: 'x' | 'y' | 'width' | 'height',
    rawValue: string,
  ): void => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    onUpdateTemplate((prev) => {
      if (prev.logo == null) return prev;
      return {
        ...prev,
        logo: {
          ...prev.logo,
          [field]: Math.max(0, Math.round(parsed)),
        },
      };
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 Columns: Live Preview Canvas */}
      <div className="lg:col-span-7 flex flex-col gap-3 lg:sticky lg:top-24">
        <div className="premium-card p-5 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#24243a] pb-2">
            <div className="flex items-center gap-2">
              <Layout size={16} className="text-accent" />
              <span className="text-sm font-semibold text-white">
                Interactive Canvas Preview (1920 × 1080)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <Move size={12} className="text-rose-400" />
              <span>Drag boxes to move • Drag corners to resize</span>
            </div>
          </div>

          <div className="relative w-full aspect-video bg-[#06060a] rounded-lg overflow-hidden border border-[#2e2e48] shadow-2xl canvas-wrapper">
            <canvas
              ref={canvasRef}
              width={1920}
              height={1080}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              className="w-full h-full object-contain block"
              style={{
                cursor: draggingState != null ? 'grabbing' : hoverCursor,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
            <span>
              Previewing Variation:{' '}
              <strong className="text-white">{selectedVariation.name}</strong>
            </span>
            <span>
              Video Cutout:{' '}
              <strong className="text-rose-400 font-mono">
                {1920 - template.lWidth} × {1080 - template.lHeight} px
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Right 5 Columns: Configuration Controls */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Card 1: L-Banner Shape, Dimensions & Brand Assets */}
        <div className="premium-card p-5 rounded-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#24243a] pb-2.5">
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-white m-0">
                1. L-Banner Layout & Brand Assets
              </h3>
            </div>
            <button
              type="button"
              onClick={handleResetLayout}
              className="btn btn-outline px-2.5 py-1 text-[11px] flex items-center gap-1"
              title="Reset layout to default preset">
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          {/* Preset Selector */}
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_TEMPLATES.map((preset) => {
              const isActive = template.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    handlePresetChange(preset.id);
                  }}
                  className={`p-2.5 rounded-lg border text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-rose-500/15 border-rose-500/50 text-white'
                      : 'bg-[#12121e] border-[#24243a] text-gray-400 hover:text-white'
                  }`}>
                  <Layout
                    size={14}
                    className={isActive ? 'text-rose-400' : ''}
                  />
                  {preset.name}
                </button>
              );
            })}
          </div>

          {/* L-Bar Width / Height & Background Color */}
          <div className="grid grid-cols-3 gap-3 bg-[#12121e]/70 p-3 rounded-lg border border-[#24243a]">
            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                Side Bar Width (px)
              </label>
              <input
                type="number"
                min={200}
                max={960}
                step={10}
                value={template.lWidth}
                onChange={(e) => {
                  const val = Math.max(
                    100,
                    Math.min(1200, Number(e.target.value) || 0),
                  );
                  onUpdateTemplate((prev) => ({
                    ...prev,
                    lWidth: val,
                    ...clampBoxesToNewDimensions(prev, val, prev.lHeight),
                  }));
                  onUpdateGlobalStyle((prev) => ({...prev, lWidth: val}));
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                Bottom Height (px)
              </label>
              <input
                type="number"
                min={120}
                max={540}
                step={10}
                value={template.lHeight}
                onChange={(e) => {
                  const val = Math.max(
                    80,
                    Math.min(600, Number(e.target.value) || 0),
                  );
                  onUpdateTemplate((prev) => ({
                    ...prev,
                    lHeight: val,
                    ...clampBoxesToNewDimensions(prev, prev.lWidth, val),
                  }));
                  onUpdateGlobalStyle((prev) => ({...prev, lHeight: val}));
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                Banner BG Color
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={template.backgroundColor}
                  onChange={(e) => {
                    const color = e.target.value;
                    onUpdateTemplate((prev) => ({
                      ...prev,
                      backgroundColor: color,
                    }));
                    onUpdateGlobalStyle((prev) => ({
                      ...prev,
                      backgroundColor: color,
                    }));
                  }}
                />
                <input
                  type="text"
                  value={template.backgroundColor}
                  onChange={(e) => {
                    const color = e.target.value;
                    onUpdateTemplate((prev) => ({
                      ...prev,
                      backgroundColor: color,
                    }));
                    onUpdateGlobalStyle((prev) => ({
                      ...prev,
                      backgroundColor: color,
                    }));
                  }}
                  className="w-full px-2 py-1.5 text-xs font-mono uppercase"
                />
              </div>
            </div>
          </div>

          {/* Primary Logo Upload & Coordinates */}
          <div className="bg-[#12121e]/70 p-3 rounded-lg border border-[#24243a] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={14} className="text-rose-400" />
                <span className="text-xs font-semibold text-white">
                  Primary Brand Logo (メインロゴ)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {template.logo != null && template.logo.url !== '' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        toggleCoords('__logo__');
                      }}
                      className="btn btn-outline px-2 py-0.5 text-[10px] flex items-center gap-1">
                      <Maximize2 size={10} />
                      {expandedCoords['__logo__'] ? 'Hide Pos' : 'Pos/Size'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="btn btn-outline px-2 py-0.5 text-[10px] text-red-400"
                      title="Remove Primary Logo">
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                void handleLogoUpload(e);
              }}
              className="w-full text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-rose-600 file:text-white hover:file:bg-rose-500 file:cursor-pointer"
            />

            {template.logo != null &&
              template.logo.url !== '' &&
              expandedCoords['__logo__'] && (
                <div className="grid grid-cols-4 gap-2 pt-1 border-t border-[#24243a]/60">
                  {COORD_FIELDS.map((field) => (
                    <div key={field}>
                      <label className="text-[9px] text-gray-400 uppercase block">
                        {field}
                      </label>
                      <input
                        type="number"
                        value={template.logo?.[field] ?? 0}
                        onChange={(e) => {
                          handleLogoNumberChange(field, e.target.value);
                        }}
                        className="w-full px-1.5 py-1 text-[11px] font-mono"
                      />
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Extra Sub-Logos Accordion */}
          <div className="bg-[#12121e]/70 p-3 rounded-lg border border-[#24243a] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsExtraLogosOpen((prev) => !prev);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-200 bg-transparent border-none cursor-pointer p-0">
                {isExtraLogosOpen ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <Layers size={14} className="text-rose-400" />
                <span>
                  Additional Badges / Sub-Logos (
                  {template.extraLogos?.length ?? 0})
                </span>
              </button>

              <label className="btn btn-outline px-2.5 py-1 text-[11px] flex items-center gap-1 cursor-pointer">
                <Plus size={12} /> Add Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    void handleAddExtraLogo(e);
                  }}
                  style={{display: 'none'}}
                />
              </label>
            </div>

            {isExtraLogosOpen &&
              template.extraLogos != null &&
              template.extraLogos.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-[#24243a]">
                  {template.extraLogos.map((extra) => (
                    <div
                      key={extra.id}
                      className="p-2 rounded bg-[#0c0c14] border border-[#24243a] flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={extra.name}
                          onChange={(e) => {
                            handleUpdateExtraLogo(extra.id, {
                              name: e.target.value,
                            });
                          }}
                          className="text-xs font-semibold px-2 py-0.5 w-40"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleRemoveExtraLogo(extra.id);
                          }}
                          className="btn btn-outline p-1 text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {COORD_FIELDS.map((field) => (
                          <div key={field}>
                            <label className="text-[9px] text-gray-500 uppercase block">
                              {field}
                            </label>
                            <input
                              type="number"
                              value={extra[field]}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (Number.isFinite(val)) {
                                  handleUpdateExtraLogo(extra.id, {
                                    [field]: Math.max(0, Math.round(val)),
                                  });
                                }
                              }}
                              className="w-full px-1.5 py-0.5 text-[11px] font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Card 2: Text Boxes & Typography */}
        <div className="premium-card p-5 rounded-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#24243a] pb-2.5">
            <div className="flex items-center gap-2">
              <Type size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-white m-0">
                2. Text Boxes & Japanese Typography ({template.textBoxes.length}
                )
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <label
                className="btn btn-outline px-2.5 py-1 text-[11px] flex items-center gap-1 cursor-pointer"
                title="Upload custom .ttf/.otf/.woff font">
                <Upload size={11} /> Font (.ttf/.otf)
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={(e) => {
                    void handleCustomFontUpload(e);
                  }}
                  style={{display: 'none'}}
                />
              </label>
              <button
                type="button"
                onClick={handleAddTextBox}
                className="btn btn-accent px-2.5 py-1 text-[11px] flex items-center gap-1">
                <Plus size={12} /> Add Box
              </button>
            </div>
          </div>

          {fontLoadingStatus != null && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-1.5">
              {fontLoadingStatus}
            </div>
          )}

          <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-0.5">
            {template.textBoxes.map((box) => {
              const currentText = selectedVariation.texts[box.id] ?? '';
              const currentFont =
                selectedVariation.fontFamilies?.[box.id] ??
                box.defaultFontFamily ??
                'Noto Sans JP';

              return (
                <div
                  key={box.id}
                  onMouseEnter={() => {
                    setHoveredBoxId(box.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredBoxId(null);
                  }}
                  className={`p-3 rounded-lg border transition flex flex-col gap-2.5 ${
                    hoveredBoxId === box.id
                      ? 'bg-[#161624] border-rose-500/50'
                      : 'bg-[#12121e]/70 border-[#24243a]'
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={box.name}
                      onChange={(e) => {
                        handleBoxChange(box.id, 'name', e.target.value);
                      }}
                      className="text-xs font-bold px-2 py-1 flex-grow"
                    />

                    <div className="flex items-center gap-1.5">
                      <TextAlignmentPopover
                        direction={box.direction}
                        align={box.align}
                        vAlign={box.vAlign}
                        onChange={(updates) => {
                          if (updates.direction != null) {
                            handleBoxChange(
                              box.id,
                              'direction',
                              updates.direction,
                            );
                          }
                          if (updates.align != null) {
                            handleBoxChange(box.id, 'align', updates.align);
                          }
                          if (updates.vAlign != null) {
                            handleBoxChange(box.id, 'vAlign', updates.vAlign);
                          }
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          toggleCoords(box.id);
                        }}
                        className="btn btn-outline px-2 py-1 text-[10px]"
                        title="Toggle X/Y/Width/Height coordinates">
                        <Maximize2 size={11} />
                      </button>

                      {template.textBoxes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleRemoveTextBox(box.id);
                          }}
                          className="btn btn-outline px-2 py-1 text-[10px] text-red-400"
                          title="Delete text box">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sample Text Input for Selected Variation */}
                  {onUpdateVariation != null && (
                    <textarea
                      rows={2}
                      value={currentText}
                      placeholder="Enter Japanese or English ad copy..."
                      onChange={(e) => {
                        onUpdateVariation({
                          ...selectedVariation,
                          texts: {
                            ...selectedVariation.texts,
                            [box.id]: e.target.value,
                          },
                        });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs resize-y"
                    />
                  )}

                  {/* Font Family, Size, Color & Max Lines */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <label className="text-[9px] text-gray-400 uppercase block mb-0.5">
                        Font Family
                      </label>
                      <select
                        value={currentFont}
                        onChange={(e) => {
                          void handleFontSelectionChange(
                            box.id,
                            e.target.value,
                          );
                        }}
                        className="w-full px-2 py-1 text-[11px]">
                        {allFonts.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[9px] text-gray-400 uppercase block mb-0.5">
                        Max Size (px)
                      </label>
                      <input
                        type="number"
                        min={16}
                        max={160}
                        value={
                          selectedVariation.fontSizes[box.id] ?? box.fontSize
                        }
                        onChange={(e) => {
                          const size = Math.max(
                            16,
                            Math.min(200, Number(e.target.value) || 40),
                          );
                          handleBoxChange(box.id, 'fontSize', size);
                          if (onUpdateVariation != null) {
                            onUpdateVariation({
                              ...selectedVariation,
                              fontSizes: {
                                ...selectedVariation.fontSizes,
                                [box.id]: size,
                              },
                            });
                          }
                        }}
                        className="w-full px-2 py-1 text-[11px] font-mono"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[9px] text-gray-400 uppercase block mb-0.5">
                        Text Color
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={box.color}
                          onChange={(e) => {
                            handleBoxChange(box.id, 'color', e.target.value);
                          }}
                        />
                        <input
                          type="text"
                          value={box.color}
                          onChange={(e) => {
                            handleBoxChange(box.id, 'color', e.target.value);
                          }}
                          className="w-full px-1.5 py-1 text-[10px] font-mono uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Collapsible X / Y / Width / Height Coordinates */}
                  {expandedCoords[box.id] && (
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#24243a]/60">
                      {COORD_FIELDS.map((coord) => (
                        <div key={coord}>
                          <label className="text-[9px] text-gray-400 uppercase block">
                            {coord} (px)
                          </label>
                          <input
                            type="number"
                            value={box[coord]}
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              if (Number.isFinite(parsed)) {
                                handleBoxChange(
                                  box.id,
                                  coord,
                                  Math.max(0, Math.round(parsed)),
                                );
                              }
                            }}
                            className="w-full px-1.5 py-1 text-[11px] font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
