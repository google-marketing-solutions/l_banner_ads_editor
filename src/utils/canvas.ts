/**
 * @license
 * Copyright 2024 Google LLC.
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
 * HTML5 Canvas 2D rendering engine for 1920x1080 L-Banner layouts, Japanese
 * horizontal and vertical (Tategaki) typography, and video cutout compositing.
 */

import type {AdVariation, TemplateConfig, TextBoxConfig} from '../types';

/** Default presets for Left & Bottom and Right & Bottom L-Banner templates. */
export const DEFAULT_TEMPLATES: readonly TemplateConfig[] = [
  {
    id: 'l-bottom-left',
    name: 'Left & Bottom L-Shape (左+下L字)',
    type: 'bottom-left',
    lWidth: 420,
    lHeight: 240,
    backgroundColor: '#1E293B',
    logo: {
      url: '/test_logo.png',
      x: 40,
      y: 860,
      width: 340,
      height: 190,
    },
    textBoxes: [
      {
        id: 'box-left',
        name: 'Left Vertical Area (左縦スペース)',
        x: 40,
        y: 60,
        width: 340,
        height: 760,
        fontSize: 64,
        defaultFontFamily: 'Noto Sans JP',
        color: '#FFFFFF',
        direction: 'vertical',
        align: 'center',
        vAlign: 'middle',
      },
      {
        id: 'box-bottom-main',
        name: 'Bottom Main Copy (下メインコピー)',
        x: 460,
        y: 860,
        width: 960,
        height: 180,
        fontSize: 56,
        defaultFontFamily: 'Noto Sans JP',
        color: '#FACC15',
        direction: 'horizontal',
        align: 'left',
        vAlign: 'middle',
      },
      {
        id: 'box-bottom-cta',
        name: 'Bottom Right CTA (右下ボタン等)',
        x: 1460,
        y: 870,
        width: 420,
        height: 160,
        fontSize: 44,
        defaultFontFamily: 'Noto Sans JP',
        color: '#FFFFFF',
        direction: 'horizontal',
        align: 'center',
        vAlign: 'middle',
      },
    ],
  },
  {
    id: 'l-bottom-right',
    name: 'Right & Bottom L-Shape (右+下L字)',
    type: 'bottom-right',
    lWidth: 420,
    lHeight: 240,
    backgroundColor: '#0F172A',
    logo: {
      url: '/test_logo.png',
      x: 1540,
      y: 860,
      width: 340,
      height: 190,
    },
    textBoxes: [
      {
        id: 'box-right',
        name: 'Right Vertical Area (右縦スペース)',
        x: 1540,
        y: 60,
        width: 340,
        height: 760,
        fontSize: 64,
        defaultFontFamily: 'Noto Sans JP',
        color: '#FFFFFF',
        direction: 'vertical',
        align: 'center',
        vAlign: 'middle',
      },
      {
        id: 'box-bottom-left',
        name: 'Bottom Main Copy (下メインコピー)',
        x: 60,
        y: 860,
        width: 1420,
        height: 180,
        fontSize: 56,
        defaultFontFamily: 'Noto Sans JP',
        color: '#38BDF8',
        direction: 'horizontal',
        align: 'center',
        vAlign: 'middle',
      },
    ],
  },
];

/** Options for rendering a text block inside a canvas bounding box. */
interface TextRenderOptions {
  readonly text: string;
  readonly box: TextBoxConfig;
  readonly customFontSize?: number;
  readonly customFontFamily?: string;
  readonly isPreview?: boolean;
  readonly isHovered?: boolean;
  readonly isDragged?: boolean;
}

/** Options for drawing interactive hover/drag bounding boxes on the preview. */
export interface ElementBoundsOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly isHovered: boolean;
  readonly isDragged: boolean;
}

/** Video scaling and offset parameters within the L-Banner cutout window. */
export interface VideoTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Interactive preview state for the template editor canvas. */
export interface PreviewRenderState {
  readonly isPreview?: boolean;
  readonly hoveredBoxId?: string;
  readonly draggedBoxId?: string;
  readonly videoElement?: HTMLVideoElement;
  readonly videoTransform?: VideoTransform;
}

const ROTATE_90_CHARS = new Set([
  'ー',
  '−',
  '―',
  '‐',
  '–',
  '—',
  '〜',
  '～',
  '(',
  ')',
  '（',
  '）',
  '[',
  ']',
  '［',
  '］',
  '「',
  '」',
  '『',
  '』',
  '【',
  '】',
  '〈',
  '〉',
  '《',
  '》',
  '〔',
  '〕',
  '｛',
  '｝',
  '{',
  '}',
  '…',
  '‥',
  '：',
  '；',
  ':',
  ';',
  '＝',
  '=',
]);

const PUNCTUATION_TOP_RIGHT_CHARS = new Set(['、', '。', '，', '．', '､', '｡']);

const SMALL_KANA_CHARS = new Set([
  'ぁ',
  'ぃ',
  'ぅ',
  'ぇ',
  'ぉ',
  'っ',
  'ゃ',
  'ゅ',
  'ょ',
  'ゎ',
  'ァ',
  'ィ',
  'ゥ',
  'ェ',
  'ォ',
  'ッ',
  'ャ',
  'ュ',
  'ョ',
  'ヮ',
  'ヵ',
  'ヶ',
]);

const OPEN_BRACKETS = new Set([
  '(',
  '（',
  '[',
  '［',
  '「',
  '『',
  '【',
  '〈',
  '《',
  '〔',
  '｛',
  '{',
]);

const CLOSE_BRACKETS = new Set([
  ')',
  '）',
  ']',
  '］',
  '」',
  '』',
  '】',
  '〉',
  '》',
  '〕',
  '｝',
  '}',
]);

const CENTERED_SYMBOLS = new Set(['・', '･', '！', '？', '!', '?']);

function getVerticalCharAdvanceRatio(char: string): number {
  if (PUNCTUATION_TOP_RIGHT_CHARS.has(char)) return 0.55;
  if (OPEN_BRACKETS.has(char) || CLOSE_BRACKETS.has(char)) return 0.65;
  if (SMALL_KANA_CHARS.has(char)) return 0.82;
  if (CENTERED_SYMBOLS.has(char)) return 0.85;
  return 1.0;
}

interface WrappedLinesOptions {
  readonly maxDimension: number;
  readonly fontSize: number;
  readonly isVertical: boolean;
}

/**
 * Splits a single line of text into wrapped lines that fit within `maxDimension`
 * (width for horizontal text, height for vertical text).
 */
function getWrappedLines(
  ctx: CanvasRenderingContext2D,
  line: string,
  options: WrappedLinesOptions,
): string[] {
  const {maxDimension, fontSize, isVertical} = options;
  if (line === '') return [''];
  const chars = Array.from(line);
  const wrapped: string[] = [];
  let current = '';
  let currentHeight = 0;

  for (const char of chars) {
    const testLine = current + char;
    if (isVertical) {
      const charH = fontSize * getVerticalCharAdvanceRatio(char);
      if (currentHeight + charH > maxDimension && current.length > 0) {
        wrapped.push(current);
        current = char;
        currentHeight = charH;
      } else {
        current = testLine;
        currentHeight += charH;
      }
    } else {
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxDimension && current.length > 0) {
        wrapped.push(current);
        current = char;
      } else {
        current = testLine;
      }
    }
  }
  if (current.length > 0) {
    wrapped.push(current);
  }
  return wrapped;
}

/**
 * Computes the optimal font size (auto-shrinking down to 16px if necessary)
 * and final wrapped lines for a text box.
 */
function calculateOptimalFontAndLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: TextBoxConfig,
  initialFontSize: number,
  fontFamily = 'Noto Sans JP',
): {fontSize: number; lines: string[]} {
  let fontSize = initialFontSize;
  const minFontSize = 16;
  const isVertical = box.direction === 'vertical';
  const maxDimension = isVertical ? box.height : box.width;
  const rawParagraphs = text.split('\n');

  while (fontSize >= minFontSize) {
    ctx.font = `bold ${fontSize}px "${fontFamily}", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
    const allLines: string[] = [];

    for (const para of rawParagraphs) {
      const wrapped = getWrappedLines(ctx, para, {
        maxDimension,
        fontSize,
        isVertical,
      });
      allLines.push(...wrapped);
    }

    const lineStep = fontSize * (isVertical ? 1.35 : 1.25);
    const totalSecondaryDim = allLines.length * lineStep;

    const fitsDimension = isVertical
      ? totalSecondaryDim <= box.width + fontSize * 0.2
      : totalSecondaryDim <= box.height + fontSize * 0.2;

    const fitsMaxLines =
      box.maxLines == null ||
      box.maxLines <= 0 ||
      allLines.length <= box.maxLines;

    if (fitsDimension && fitsMaxLines) {
      return {fontSize, lines: allLines};
    }

    fontSize -= 2;
  }

  ctx.font = `bold ${minFontSize}px "${fontFamily}", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
  const fallbackLines: string[] = [];
  for (const para of rawParagraphs) {
    fallbackLines.push(
      ...getWrappedLines(ctx, para, {
        maxDimension,
        fontSize: minFontSize,
        isVertical,
      }),
    );
  }
  return {fontSize: minFontSize, lines: fallbackLines};
}

/** Draws horizontal text with automatic wrapping and alignment inside a box. */
function drawHorizontalText(
  ctx: CanvasRenderingContext2D,
  options: TextRenderOptions,
): void {
  const {
    text,
    box,
    customFontSize,
    customFontFamily,
    isPreview = false,
    isHovered = false,
    isDragged = false,
  } = options;
  ctx.save();
  const baseFontSize = customFontSize ?? box.fontSize;
  const fontFamily =
    customFontFamily ?? box.defaultFontFamily ?? 'Noto Sans JP';

  const {fontSize, lines} = calculateOptimalFontAndLines(
    ctx,
    text,
    box,
    baseFontSize,
    fontFamily,
  );

  ctx.font = `bold ${fontSize}px "${fontFamily}", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
  ctx.fillStyle = box.color;
  ctx.textBaseline = 'top';

  const lineHeight = fontSize * 1.25;
  const totalHeight = lines.length * lineHeight;

  let startY = box.y;
  if (box.vAlign === 'middle') {
    startY = box.y + (box.height - totalHeight) / 2;
  } else if (box.vAlign === 'bottom') {
    startY = box.y + box.height - totalHeight;
  }

  for (const [index, line] of lines.entries()) {
    const metrics = ctx.measureText(line);
    let drawX = box.x;
    if (box.align === 'center') {
      drawX = box.x + (box.width - metrics.width) / 2;
    } else if (box.align === 'right') {
      drawX = box.x + box.width - metrics.width;
    }

    const drawY = startY + index * lineHeight;
    ctx.fillText(line, drawX, drawY);
  }

  if (isPreview) {
    drawDebugBox(ctx, box, isHovered, isDragged);
  }

  ctx.restore();
}

/**
 * Draws Japanese vertical (Tategaki) text with optical kerning, punctuation
 * quadrant shifts, and 90-degree vowel/bracket rotation.
 */
function drawVerticalText(
  ctx: CanvasRenderingContext2D,
  options: TextRenderOptions,
): void {
  const {
    text,
    box,
    customFontSize,
    customFontFamily,
    isPreview = false,
    isHovered = false,
    isDragged = false,
  } = options;
  ctx.save();
  const baseFontSize = customFontSize ?? box.fontSize;
  const fontFamily =
    customFontFamily ?? box.defaultFontFamily ?? 'Noto Sans JP';

  const {fontSize, lines} = calculateOptimalFontAndLines(
    ctx,
    text,
    box,
    baseFontSize,
    fontFamily,
  );

  ctx.font = `bold ${fontSize}px "${fontFamily}", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
  ctx.fillStyle = box.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const colSpacing = fontSize * 1.35;
  const totalColumnsWidth = lines.length * colSpacing;

  let firstColCenterX = box.x + box.width - colSpacing / 2;
  if (box.align === 'center') {
    const rightEdge = box.x + (box.width + totalColumnsWidth) / 2;
    firstColCenterX = rightEdge - colSpacing / 2;
  } else if (box.align === 'left') {
    const rightEdge = box.x + totalColumnsWidth;
    firstColCenterX = rightEdge - colSpacing / 2;
  }

  for (const [colIndex, line] of lines.entries()) {
    const chars = Array.from(line);
    const charAdvances = chars.map(
      (c) => fontSize * getVerticalCharAdvanceRatio(c),
    );
    const totalColHeight = charAdvances.reduce((sum, h) => sum + h, 0);

    const colCenterX = firstColCenterX - colIndex * colSpacing;

    let currentTopY = box.y;
    if (box.vAlign === 'middle') {
      currentTopY = box.y + (box.height - totalColHeight) / 2;
    } else if (box.vAlign === 'bottom') {
      currentTopY = box.y + box.height - totalColHeight;
    }

    for (const [charIndex, char] of chars.entries()) {
      const advanceH = charAdvances[charIndex];
      const charCenterY = currentTopY + advanceH / 2;
      drawSingleVerticalChar(ctx, char, colCenterX, charCenterY, fontSize);
      currentTopY += advanceH;
    }
  }

  if (isPreview) {
    drawDebugBox(ctx, box, isHovered, isDragged);
  }

  ctx.restore();
}

function drawSingleVerticalChar(
  ctx: CanvasRenderingContext2D,
  char: string,
  centerX: number,
  centerY: number,
  fontSize: number,
): void {
  ctx.save();

  if (ROTATE_90_CHARS.has(char)) {
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(char, 0, 0);
  } else if (PUNCTUATION_TOP_RIGHT_CHARS.has(char)) {
    const offsetX = fontSize * 0.32;
    const offsetY = -fontSize * 0.12;
    ctx.fillText(char, centerX + offsetX, centerY + offsetY);
  } else if (SMALL_KANA_CHARS.has(char)) {
    const offsetX = fontSize * 0.08;
    const offsetY = -fontSize * 0.04;
    ctx.fillText(char, centerX + offsetX, centerY + offsetY);
  } else {
    ctx.fillText(char, centerX, centerY);
  }

  ctx.restore();
}

/** In-memory cache of decoded logo `HTMLImageElement` instances. */
const logoImageCache = new Map<string, HTMLImageElement>();

/**
 * Preloads and decodes an image URL into `logoImageCache` for synchronous
 * canvas rendering.
 */
export async function preloadLogoImage(src: string): Promise<void> {
  if (logoImageCache.has(src)) {
    return;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  logoImageCache.set(src, img);
}

/**
 * Returns a cached `HTMLImageElement` if ready, or initiates background
 * loading into `logoImageCache`.
 */
export function getOrCreateLogoImage(src: string): HTMLImageElement | null {
  const cached = logoImageCache.get(src);
  if (cached != null) {
    return cached;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    logoImageCache.set(src, img);
  };
  img.src = src;
  return null;
}

/** Draws an interactive bounding box and corner resize handles on the canvas. */
export function drawElementBounds(
  ctx: CanvasRenderingContext2D,
  options: ElementBoundsOptions,
): void {
  const {x, y, width, height, label, isHovered, isDragged} = options;
  ctx.save();

  if (isDragged) {
    ctx.strokeStyle = 'rgba(244, 63, 94, 1)';
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.fillRect(x, y, width, height);
  } else if (isHovered) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.fillRect(x, y, width, height);
  } else {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
  }

  ctx.strokeRect(x, y, width, height);

  if (isHovered || isDragged) {
    const handleSize = 14;
    ctx.setLineDash([]);
    ctx.fillStyle = isDragged ? '#f43f5e' : '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    const corners: ReadonlyArray<readonly [number, number]> = [
      [x, y],
      [x + width, y],
      [x, y + height],
      [x + width, y + height],
    ];

    for (const [cx, cy] of corners) {
      ctx.fillRect(
        cx - handleSize / 2,
        cy - handleSize / 2,
        handleSize,
        handleSize,
      );
      ctx.strokeRect(
        cx - handleSize / 2,
        cy - handleSize / 2,
        handleSize,
        handleSize,
      );
    }
  }

  ctx.font = 'bold 15px sans-serif';
  const labelMetrics = ctx.measureText(label);
  const badgeW = labelMetrics.width + 14;
  const badgeH = 24;
  const badgeX = x + 6;
  const badgeY = y + 6;

  ctx.setLineDash([]);
  ctx.fillStyle = isDragged
    ? 'rgba(244, 63, 94, 0.9)'
    : isHovered
      ? 'rgba(2, 132, 199, 0.9)'
      : 'rgba(15, 23, 42, 0.75)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
  } else {
    ctx.rect(badgeX, badgeY, badgeW, badgeH);
  }
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, badgeX + 7, badgeY + badgeH / 2);

  ctx.restore();
}

function drawDebugBox(
  ctx: CanvasRenderingContext2D,
  box: TextBoxConfig,
  isHovered = false,
  isDragged = false,
): void {
  drawElementBounds(ctx, {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    label: box.name,
    isHovered,
    isDragged,
  });
}

/**
 * Renders a complete 1920x1080 L-Banner frame (background, transparent video
 * cutout or composited video frame, brand logos, and all text boxes).
 */
export function drawAdFrame(
  canvas: HTMLCanvasElement,
  template: TemplateConfig,
  variation: AdVariation,
  previewState: PreviewRenderState = {},
): void {
  const {
    isPreview = false,
    hoveredBoxId,
    draggedBoxId,
    videoElement,
    videoTransform = {scale: 1, offsetX: 0, offsetY: 0},
  } = previewState;

  const ctx = canvas.getContext('2d');
  if (ctx == null) return;

  const width = 1920;
  const height = 1080;

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = variation.backgroundColor ?? template.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const videoWidth = width - template.lWidth;
  const videoHeight = height - template.lHeight;
  const videoX = template.type === 'bottom-left' ? template.lWidth : 0;
  const videoY = 0;

  ctx.clearRect(videoX, videoY, videoWidth, videoHeight);

  if (videoElement != null) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(videoX, videoY, videoWidth, videoHeight);
    ctx.clip();

    const drawW = videoWidth * videoTransform.scale;
    const drawH = videoHeight * videoTransform.scale;
    const centerX = videoX + videoWidth / 2 + videoTransform.offsetX;
    const centerY = videoY + videoHeight / 2 + videoTransform.offsetY;
    const drawX = centerX - drawW / 2;
    const drawY = centerY - drawH / 2;

    ctx.drawImage(videoElement, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else if (isPreview) {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(videoX, videoY, videoWidth, videoHeight);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(videoX + 2, videoY + 2, videoWidth - 4, videoHeight - 4);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `VIDEO AREA (${videoWidth} x ${videoHeight})`,
      videoX + videoWidth / 2,
      videoY + videoHeight / 2 - 20,
    );
    ctx.font = '24px sans-serif';
    ctx.fillText(
      'Transparent in PNG / Video inserted in MP4 Export',
      videoX + videoWidth / 2,
      videoY + videoHeight / 2 + 30,
    );
    ctx.restore();
  }

  for (const box of template.textBoxes) {
    const text = variation.texts[box.id] ?? '';
    const customFontSize = variation.fontSizes[box.id] ?? box.fontSize;
    const customFontFamily =
      variation.fontFamilies?.[box.id] ??
      box.defaultFontFamily ??
      'Noto Sans JP';

    const isHovered = hoveredBoxId === box.id;
    const isDragged = draggedBoxId === box.id;

    if (text === '' && !isPreview) continue;

    const displayText = text !== '' ? text : `[${box.name}]`;
    const renderOptions: TextRenderOptions = {
      text: displayText,
      box,
      customFontSize,
      customFontFamily,
      isPreview,
      isHovered,
      isDragged,
    };

    if (box.direction === 'vertical') {
      drawVerticalText(ctx, renderOptions);
    } else {
      drawHorizontalText(ctx, renderOptions);
    }
  }

  const drawLogoItem = (
    logoItem: {
      readonly url: string;
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    },
    elementId: string,
    label: string,
  ): void => {
    if (logoItem.url === '') return;

    const img = getOrCreateLogoImage(logoItem.url);
    const isLogoHovered = hoveredBoxId === elementId;
    const isLogoDragged = draggedBoxId === elementId;

    if (img != null && img.complete && img.naturalWidth > 0) {
      ctx.save();
      const scale = Math.min(
        logoItem.width / img.naturalWidth,
        logoItem.height / img.naturalHeight,
      );
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const drawX = logoItem.x + (logoItem.width - drawW) / 2;
      const drawY = logoItem.y + (logoItem.height - drawH) / 2;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    if (isPreview) {
      drawElementBounds(ctx, {
        x: logoItem.x,
        y: logoItem.y,
        width: logoItem.width,
        height: logoItem.height,
        label,
        isHovered: isLogoHovered,
        isDragged: isLogoDragged,
      });
    }
  };

  if (template.logo != null && template.logo.url !== '') {
    drawLogoItem(template.logo, '__logo__', 'Logo (ロゴ)');
  }

  if (template.extraLogos != null && template.extraLogos.length > 0) {
    for (const extra of template.extraLogos) {
      drawLogoItem(extra, extra.id, extra.name);
    }
  }
}
