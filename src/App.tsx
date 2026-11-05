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
 * Root application shell for L-Banner Ads Editor coordinating Step 1
 * (Template Editor), Step 2 (Variation Matrix), and Step 3 (PNG/MP4 Export).
 */

import './App.css';

import JSZip from 'jszip';
import {Info, Layers} from 'lucide-react';
import * as React from 'react';
import {useEffect, useState} from 'react';

import {TemplateEditor} from './components/TemplateEditor';
import {VariationTable} from './components/VariationTable';
import {VideoExporter} from './components/VideoExporter';
import type {AdVariation, GlobalStyleState, TemplateConfig} from './types';
import {DEFAULT_TEMPLATES, drawAdFrame, preloadLogoImage} from './utils/canvas';
import {
  AVAILABLE_FONTS,
  type FontOption,
  loadGoogleFont,
  warmUpFontGlyphs,
} from './utils/fonts';

/** Converts an HTMLCanvasElement into a PNG Blob using native fetch decoding. */
async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const dataUrl = canvas.toDataURL('image/png');
  const response = await fetch(dataUrl);
  return await response.blob();
}

/** Collects non-empty font names referenced across a template and variation. */
function collectReferencedFonts(
  template: TemplateConfig,
  variation: AdVariation,
): string[] {
  const fonts = new Set<string>();
  for (const box of template.textBoxes) {
    const fontName =
      variation.fontFamilies?.[box.id] ??
      box.defaultFontFamily ??
      'Noto Sans JP';
    if (fontName !== '') {
      fonts.add(fontName);
    }
  }
  return Array.from(fonts);
}

/** Renders the main L-Banner Ads Editor single-page application. */
export function App(): React.ReactElement {
  const [templateMap, setTemplateMap] = useState<
    Record<string, TemplateConfig>
  >(() => {
    const map: Record<string, TemplateConfig> = {};
    for (const preset of DEFAULT_TEMPLATES) {
      map[preset.id] = {
        ...preset,
        textBoxes: preset.textBoxes.map((b) => ({...b})),
        logo: preset.logo != null ? {...preset.logo} : undefined,
        extraLogos: preset.extraLogos != null ? [...preset.extraLogos] : [],
      };
    }
    return map;
  });

  const [activeTemplateId, setActiveTemplateId] = useState<string>(
    DEFAULT_TEMPLATES[0].id,
  );

  const [globalStyle, setGlobalStyle] = useState<GlobalStyleState>(() => ({
    backgroundColor: DEFAULT_TEMPLATES[0].backgroundColor,
    lWidth: DEFAULT_TEMPLATES[0].lWidth,
    lHeight: DEFAULT_TEMPLATES[0].lHeight,
    logoUrl: DEFAULT_TEMPLATES[0].logo?.url,
    extraLogos: [],
  }));

  const currentBaseTemplate =
    templateMap[activeTemplateId] ?? DEFAULT_TEMPLATES[0];

  const template: TemplateConfig = {
    ...currentBaseTemplate,
    backgroundColor: globalStyle.backgroundColor,
    lWidth: globalStyle.lWidth,
    lHeight: globalStyle.lHeight,
    logo:
      currentBaseTemplate.logo != null
        ? {
            ...currentBaseTemplate.logo,
            url: globalStyle.logoUrl ?? currentBaseTemplate.logo.url,
          }
        : globalStyle.logoUrl != null && globalStyle.logoUrl !== ''
          ? {
              url: globalStyle.logoUrl,
              x: 40,
              y: 860,
              width: 340,
              height: 180,
            }
          : undefined,
    extraLogos: globalStyle.extraLogos,
  };

  const handleUpdateTemplate: React.Dispatch<
    React.SetStateAction<TemplateConfig>
  > = (updater) => {
    const nextTemplate =
      typeof updater === 'function' ? updater(template) : updater;

    if (nextTemplate.id !== activeTemplateId) {
      setActiveTemplateId(nextTemplate.id);
      return;
    }

    setTemplateMap((prev) => ({
      ...prev,
      [activeTemplateId]: nextTemplate,
    }));

    setGlobalStyle({
      backgroundColor: nextTemplate.backgroundColor,
      lWidth: nextTemplate.lWidth,
      lHeight: nextTemplate.lHeight,
      logoUrl: nextTemplate.logo?.url,
      extraLogos: nextTemplate.extraLogos ?? [],
    });
  };

  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [appNotice, setAppNotice] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all(
      AVAILABLE_FONTS.filter((f) => f.isGoogle).map((f) =>
        loadGoogleFont(f.value),
      ),
    );
  }, []);

  const [variations, setVariations] = useState<AdVariation[]>(() => [
    {
      id: 'var-1',
      name: 'Pattern_A_限定訴求',
      texts: {
        'box-left': '期間限定キャンペーン開催中',
        'box-bottom-main': '新規ご入会で最大10,000ptプレゼント！',
        'box-bottom-cta': '詳しくは「検索」',
        'box-right': '期間限定キャンペーン開催中',
        'box-bottom-left': '新規ご入会で最大10,000ptプレゼント！',
      },
      fontSizes: {
        'box-left': 64,
        'box-bottom-main': 56,
        'box-bottom-cta': 44,
        'box-right': 64,
        'box-bottom-left': 56,
      },
      fontFamilies: {
        'box-left': 'Noto Sans JP',
        'box-bottom-main': 'Noto Sans JP',
        'box-bottom-cta': 'Noto Sans JP',
        'box-right': 'Noto Sans JP',
        'box-bottom-left': 'Noto Sans JP',
      },
    },
    {
      id: 'var-2',
      name: 'Pattern_B_特典訴求',
      texts: {
        'box-left': '年会費永年無料！今すぐ申込',
        'box-bottom-main': '最短5分で即時発行・ポイント2倍！',
        'box-bottom-cta': '今すぐチェック',
        'box-right': '年会費永年無料！今すぐ申込',
        'box-bottom-left': '最短5分で即時発行・ポイント2倍！',
      },
      fontSizes: {
        'box-left': 64,
        'box-bottom-main': 56,
        'box-bottom-cta': 44,
        'box-right': 64,
        'box-bottom-left': 56,
      },
      fontFamilies: {
        'box-left': 'M PLUS Rounded 1c',
        'box-bottom-main': 'M PLUS Rounded 1c',
        'box-bottom-cta': 'Noto Sans JP',
        'box-right': 'M PLUS Rounded 1c',
        'box-bottom-left': 'M PLUS Rounded 1c',
      },
    },
  ]);

  const [selectedVariationId, setSelectedVariationId] =
    useState<string>('var-1');

  const selectedVariation =
    variations.find((v) => v.id === selectedVariationId) ?? variations[0];

  const handleUpdateSelectedVariation = (updated: AdVariation): void => {
    setVariations((prev) =>
      prev.map((v) => (v.id === updated.id ? updated : v)),
    );
  };

  const handleAddCustomFont = (newFont: FontOption): void => {
    setCustomFonts((prev) => [...prev, newFont]);
  };

  const handleExportAllPngZip = async (): Promise<void> => {
    if (isExportingPng) {
      return;
    }
    setIsExportingPng(true);
    setAppNotice(null);

    try {
      const zip = new JSZip();
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = 1920;
      offscreenCanvas.height = 1080;

      const logoUrls: string[] = [];
      if (template.logo?.url != null && template.logo.url !== '') {
        logoUrls.push(template.logo.url);
      }
      if (template.extraLogos != null) {
        for (const extra of template.extraLogos) {
          if (extra.url !== '') {
            logoUrls.push(extra.url);
          }
        }
      }
      await Promise.all(logoUrls.map((url) => preloadLogoImage(url)));

      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        const fonts = collectReferencedFonts(template, v);
        const allChars = Object.values(v.texts).join('');
        await Promise.all(
          fonts.map(async (f) => {
            await loadGoogleFont(f, allChars);
            await warmUpFontGlyphs(f, allChars);
          }),
        );

        drawAdFrame(offscreenCanvas, template, v, {isPreview: false});
        const pngBlob = await canvasToPngBlob(offscreenCanvas);
        const safeName = v.name.replace(/[^a-zA-Z0-9_\u3000-\u9FFF-]/g, '_');
        zip.file(`${safeName || `variation_${i + 1}`}.png`, pngBlob);
      }

      const zipBlob = await zip.generateAsync({type: 'blob'});
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `l_banner_png_overlays_${variations.length}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setAppNotice(
        `Successfully exported ${variations.length} transparent PNG overlay(s) as ZIP.`,
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to export PNG ZIP.';
      setAppNotice(`Export error: ${msg}`);
    } finally {
      setIsExportingPng(false);
    }
  };

  return (
    <div className="app-container">
      <div className="bg-grid-overlay" />

      <header className="app-header">
        <div className="header-left">
          <div className="header-logo-box">
            <Layers size={22} className="logo-icon" />
          </div>
          <div className="header-title-block">
            <h1 className="header-title">
              L-Banner Ads Editor
              <span className="version-badge">v1.0 • Stateless Client SPA</span>
            </h1>
            <p className="header-desc">
              1920×1080 L-Shape Video Overlay & Batch Creative Variation Studio
            </p>
          </div>
        </div>
        <div className="header-right">
          <a href="#workflow-guide" className="header-link">
            Workflow Guide
          </a>
        </div>
      </header>

      <main className="app-main">
        {appNotice != null && (
          <div className="premium-card px-4 py-2.5 rounded-lg text-xs text-gray-200 flex items-center justify-between">
            <span>{appNotice}</span>
            <button
              type="button"
              onClick={() => {
                setAppNotice(null);
              }}
              className="btn btn-outline px-2 py-0.5 text-[10px]">
              Dismiss
            </button>
          </div>
        )}

        {/* Step 1: L-Banner Template & Layout Editor */}
        <section className="section-container">
          <div className="section-header">
            <h2 className="section-title">
              <span className="step-badge">1</span>
              Template & Typography Layout (L字テンプレート・文字配置設定)
            </h2>
          </div>
          <TemplateEditor
            template={template}
            onUpdateTemplate={handleUpdateTemplate}
            onUpdateGlobalStyle={setGlobalStyle}
            selectedVariation={selectedVariation}
            onUpdateVariation={handleUpdateSelectedVariation}
            customFonts={customFonts}
            onAddCustomFont={handleAddCustomFont}
          />
        </section>

        {/* Step 2: Batch Variation Spreadsheet & Gemini 3+ Copy Generation */}
        <section className="section-container">
          <div className="section-header">
            <h2 className="section-title">
              <span className="step-badge">2</span>
              Creative Variations & AI Copywriting
              (バリエーション一括編集・AI生成)
            </h2>
          </div>
          <VariationTable
            template={template}
            variations={variations}
            onUpdateVariations={setVariations}
            selectedVariationId={selectedVariation.id}
            onSelectVariation={setSelectedVariationId}
            customFonts={customFonts}
          />
        </section>

        {/* Step 3: Transparent PNG & WebCodecs MP4 Video Export */}
        <section className="section-container">
          <div className="section-header">
            <h2 className="section-title">
              <span className="step-badge">3</span>
              Export PNG Overlays & Composite MP4 Videos (書き出し・動画合成)
            </h2>
          </div>
          <VideoExporter
            template={template}
            variations={variations}
            selectedVariation={selectedVariation}
            onExportPngZip={handleExportAllPngZip}
            isExportingPng={isExportingPng}
          />
        </section>

        {/* Workflow Guide */}
        <section id="workflow-guide" className="premium-card instruction-card">
          <Info size={20} className="instruction-icon" />
          <div className="instruction-content">
            <h3 className="instruction-title">
              Quick Workflow & Self-Hosting Guide (使い方ガイド)
            </h3>
            <ol className="instruction-list">
              <li>
                <strong>Step 1 (Design Layout)</strong>: Choose Left+Bottom or
                Right+Bottom L-shape, adjust bar dimensions, upload brand logos,
                and drag or resize text boxes directly on the 1920×1080 canvas.
              </li>
              <li>
                <strong>Step 2 (Batch Variations)</strong>: Add rows manually,
                import/export UTF-8 CSV files, or optionally generate Japanese
                ad copy variations using your own Gemini 3+ API key.
              </li>
              <li>
                <strong>Step 3 (Export Assets)</strong>: Download transparent
                cutout PNG overlays as a ZIP archive, or upload a base video to
                render hardware-accelerated H.264/AAC MP4 composite videos.
              </li>
            </ol>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          L-Banner Ads Editor • Licensed under Apache License 2.0 • 100%
          Client-Side Execution (Zero Backend Storage). Experimental software
          provided &quot;AS IS&quot; without warranties of any kind; please
          verify all generated creative outputs prior to campaign launch.
        </p>
      </footer>
    </div>
  );
}
