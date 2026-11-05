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
 * Spreadsheet editor for managing batch ad variations, CSV import/export, and
 * optional BYOK Gemini 3+ AI ad copy generation.
 */

import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Key,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as React from 'react';
import {useRef, useState} from 'react';

import type {AdVariation, StateUpdater, TemplateConfig} from '../types';
import {
  downloadCSVFile,
  exportVariationsToCSV,
  parseCSVToVariations,
} from '../utils/csv';
import {AVAILABLE_FONTS, type FontOption, loadGoogleFont} from '../utils/fonts';

/** Props for the VariationTable component. */
interface VariationTableProps {
  readonly template: TemplateConfig;
  readonly variations: readonly AdVariation[];
  readonly onUpdateVariations: StateUpdater<AdVariation[]>;
  readonly selectedVariationId: string;
  readonly onSelectVariation: (id: string) => void;
  readonly customFonts: readonly FontOption[];
}

interface GeminiModelOption {
  readonly id: string;
  readonly label: string;
}

const GEMINI_API_KEY_STORAGE = 'l_banner_gemini_api_key';

const GEMINI_MODELS: readonly GeminiModelOption[] = [
  {id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (推奨・高速)'},
  {id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro'},
];

interface FeedbackBanner {
  readonly type: 'error' | 'info';
  readonly message: string;
}

/** Renders the Step 2 variation spreadsheet and optional Gemini AI panel. */
export const VariationTable: React.FC<VariationTableProps> = ({
  template,
  variations,
  onUpdateVariations,
  selectedVariationId,
  onSelectVariation,
  customFonts,
}): React.ReactElement => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allFonts: readonly FontOption[] = [...AVAILABLE_FONTS, ...customFonts];

  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(GEMINI_API_KEY_STORAGE) ?? '',
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    GEMINI_MODELS[0].id,
  );
  const [productName, setProductName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [campaignAppeal, setCampaignAppeal] = useState('');
  const [generateCount, setGenerateCount] = useState<number>(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);

  const handleSaveApiKey = (val: string): void => {
    setApiKey(val);
    if (val.trim() !== '') {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, val.trim());
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    }
  };

  const handleClearApiKey = (): void => {
    setApiKey('');
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    setFeedback({
      type: 'info',
      message: 'Cleared Gemini API Key from local browser storage.',
    });
  };

  const handleAddRow = (): void => {
    const nextNum = variations.length + 1;
    const newTexts: Record<string, string> = {};
    const newSizes: Record<string, number> = {};
    const newFonts: Record<string, string> = {};

    for (const box of template.textBoxes) {
      newTexts[box.id] = `サンプルテキスト ${nextNum}`;
      newSizes[box.id] = box.fontSize;
      newFonts[box.id] = box.defaultFontFamily ?? 'Noto Sans JP';
    }

    const newVariation: AdVariation = {
      id: `var-${Date.now()}`,
      name: `Pattern_${nextNum}`,
      texts: newTexts,
      fontSizes: newSizes,
      fontFamilies: newFonts,
    };

    onUpdateVariations((prev) => [...prev, newVariation]);
    onSelectVariation(newVariation.id);
  };

  const handleDuplicateRow = (variation: AdVariation): void => {
    const dupVariation: AdVariation = {
      id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${variation.name}_copy`,
      backgroundColor: variation.backgroundColor,
      texts: {...variation.texts},
      fontSizes: {...variation.fontSizes},
      fontFamilies: variation.fontFamilies
        ? {...variation.fontFamilies}
        : undefined,
    };
    onUpdateVariations((prev) => [...prev, dupVariation]);
    onSelectVariation(dupVariation.id);
  };

  const handleDeleteRow = (id: string): void => {
    if (variations.length <= 1) {
      setFeedback({
        type: 'error',
        message: 'At least one variation must remain in the table.',
      });
      return;
    }
    const remaining = variations.filter((v) => v.id !== id);
    onUpdateVariations(remaining);
    if (selectedVariationId === id && remaining.length > 0) {
      onSelectVariation(remaining[0].id);
    }
  };

  const handleUpdateName = (id: string, name: string): void => {
    onUpdateVariations((prev) =>
      prev.map((v) => (v.id === id ? {...v, name} : v)),
    );
  };

  const handleUpdateText = (id: string, boxId: string, text: string): void => {
    onUpdateVariations((prev) =>
      prev.map((v) =>
        v.id === id ? {...v, texts: {...v.texts, [boxId]: text}} : v,
      ),
    );
  };

  const handleUpdateFontSize = (
    id: string,
    boxId: string,
    fontSize: number,
  ): void => {
    onUpdateVariations((prev) =>
      prev.map((v) =>
        v.id === id
          ? {...v, fontSizes: {...v.fontSizes, [boxId]: fontSize}}
          : v,
      ),
    );
  };

  const handleUpdateFontFamily = async (
    id: string,
    boxId: string,
    fontFamily: string,
  ): Promise<void> => {
    await loadGoogleFont(fontFamily);
    onUpdateVariations((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              fontFamilies: {...(v.fontFamilies ?? {}), [boxId]: fontFamily},
            }
          : v,
      ),
    );
  };

  const handleExportCSV = (): void => {
    const csvContent = exportVariationsToCSV(variations, template);
    downloadCSVFile(csvContent, `l_banner_variations_${template.id}.csv`);
    setFeedback({
      type: 'info',
      message: `Exported ${variations.length} variation(s) to CSV.`,
    });
  };

  const handleImportCSV = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (file == null) return;

    try {
      const text = await file.text();
      const parsedRows = parseCSVToVariations(text, template);
      if (parsedRows.length === 0) {
        setFeedback({
          type: 'error',
          message:
            'No valid variation rows were found in the uploaded CSV file.',
        });
        return;
      }

      const importedVariations: AdVariation[] = parsedRows.map((row, idx) => {
        const finalTexts: Record<string, string> = {};
        const finalSizes: Record<string, number> = {};
        const finalFonts: Record<string, string> = {};

        for (const box of template.textBoxes) {
          finalTexts[box.id] = row.texts[box.id] ?? '';
          finalSizes[box.id] = row.fontSizes[box.id] ?? box.fontSize;
          finalFonts[box.id] =
            row.fontFamilies[box.id] ?? box.defaultFontFamily ?? 'Noto Sans JP';
        }

        return {
          id: `var-csv-${Date.now()}-${idx}`,
          name:
            row.name != null && row.name !== ''
              ? row.name
              : `CSV_Pattern_${idx + 1}`,
          texts: finalTexts,
          fontSizes: finalSizes,
          fontFamilies: finalFonts,
        };
      });

      onUpdateVariations(importedVariations);
      if (importedVariations.length > 0) {
        onSelectVariation(importedVariations[0].id);
      }
      setFeedback({
        type: 'info',
        message: `Imported ${importedVariations.length} variation(s) from ${file.name}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse CSV';
      setFeedback({type: 'error', message: msg});
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerateWithGemini = async (): Promise<void> => {
    if (isGenerating) {
      return;
    }
    if (apiKey.trim() === '') {
      setAiError('Please enter your Google AI Studio Gemini API Key.');
      return;
    }
    if (productName.trim() === '' && campaignAppeal.trim() === '') {
      setAiError('Please enter a Product/Service Name or Campaign Appeal.');
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      const boxDescriptions = template.textBoxes
        .map(
          (b) =>
            `- Box ID "${b.id}" (${b.name}): ${
              b.direction === 'vertical' ? 'Vertical Tategaki' : 'Horizontal'
            } layout (${b.width}x${b.height}px, base font ${b.fontSize}px). Keep copy concise and impactful (10-22 Japanese characters).`,
        )
        .join('\n');

      const prompt = `You are an expert Japanese digital advertising copywriter specializing in high-impact L-Banner video ads.
Generate ${generateCount} distinct ad copy variations for the following campaign:
- Product / Brand: ${productName || 'Not specified'}
- Target Audience: ${targetAudience || 'General consumers in Japan'}
- Key Appeal / Offer: ${campaignAppeal || 'Special limited-time promotion'}

The L-Banner template has the following text boxes:
${boxDescriptions}

Return ONLY valid JSON matching this schema:
{
  "variations": [
    {
      "name": "Short variation label (e.g., 訴求A_限定感)",
      "texts": {
        "<box_id>": "Ad copy for this box"
      }
    }
  ]
}`;

      const endpoint = new URL(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          selectedModel.trim(),
        )}:generateContent`,
      );
      endpoint.searchParams.set('key', apiKey.trim());

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          contents: [{parts: [{text: prompt}]}],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Gemini API error (${response.status}): ${errorText.slice(0, 200)}`,
        );
      }

      const rawData: unknown = await response.json();
      let rawText = '';
      if (
        typeof rawData === 'object' &&
        rawData !== null &&
        'candidates' in rawData &&
        Array.isArray(rawData.candidates)
      ) {
        const firstCandidate: unknown = rawData.candidates[0];
        if (
          typeof firstCandidate === 'object' &&
          firstCandidate !== null &&
          'content' in firstCandidate
        ) {
          const content: unknown = firstCandidate.content;
          if (
            typeof content === 'object' &&
            content !== null &&
            'parts' in content &&
            Array.isArray(content.parts)
          ) {
            const firstPart: unknown = content.parts[0];
            if (
              typeof firstPart === 'object' &&
              firstPart !== null &&
              'text' in firstPart &&
              typeof firstPart.text === 'string'
            ) {
              rawText = firstPart.text;
            }
          }
        }
      }

      if (rawText === '') {
        throw new Error('Gemini returned an empty response.');
      }

      const parsedJson: unknown = JSON.parse(rawText);
      if (
        typeof parsedJson !== 'object' ||
        parsedJson === null ||
        !('variations' in parsedJson) ||
        !Array.isArray(parsedJson.variations) ||
        parsedJson.variations.length === 0
      ) {
        throw new Error('Unexpected JSON structure from Gemini API.');
      }

      const generatedVariations: AdVariation[] = [];
      for (const [idx, item] of parsedJson.variations.entries()) {
        if (typeof item !== 'object' || item === null) {
          continue;
        }
        const rawName: unknown = 'name' in item ? item.name : undefined;
        const textMap = new Map<string, string>();
        if (
          'texts' in item &&
          typeof item.texts === 'object' &&
          item.texts !== null
        ) {
          for (const [key, val] of Object.entries(item.texts)) {
            if (typeof val === 'string') {
              textMap.set(key, val);
            }
          }
        }

        const newTexts: Record<string, string> = {};
        const newSizes: Record<string, number> = {};
        const newFonts: Record<string, string> = {};

        for (const box of template.textBoxes) {
          newTexts[box.id] = textMap.get(box.id) ?? '';
          newSizes[box.id] = box.fontSize;
          newFonts[box.id] = box.defaultFontFamily ?? 'Noto Sans JP';
        }

        generatedVariations.push({
          id: `var-ai-${Date.now()}-${idx}`,
          name:
            typeof rawName === 'string' && rawName.trim() !== ''
              ? rawName.trim()
              : `AI_Pattern_${idx + 1}`,
          texts: newTexts,
          fontSizes: newSizes,
          fontFamilies: newFonts,
        });
      }

      if (generatedVariations.length > 0) {
        onUpdateVariations((prev) => [...prev, ...generatedVariations]);
        onSelectVariation(generatedVariations[0].id);
        setFeedback({
          type: 'info',
          message: `Generated ${generatedVariations.length} AI variation(s) with ${selectedModel}. Please review all AI-generated copy for accuracy and compliance before export.`,
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to generate ad copy.';
      setAiError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="premium-card p-5 rounded-xl flex flex-col gap-4">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24243a] pb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-accent" />
          <span className="text-sm font-bold text-white">
            Variation Matrix (バリエーション一覧)
          </span>
          <span className="badge-count">{variations.length} Rows</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsAiPanelOpen((prev) => !prev);
            }}
            className={`btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${
              isAiPanelOpen ? 'btn-accent' : 'btn-outline'
            }`}>
            <Sparkles size={14} />
            AI Copywriter (Gemini 3+)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              void handleImportCSV(e);
            }}
            style={{display: 'none'}}
          />
          <button
            type="button"
            onClick={() => {
              fileInputRef.current?.click();
            }}
            className="btn btn-outline px-3 py-1.5 text-xs flex items-center gap-1.5">
            <Upload size={14} /> Import CSV
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-outline px-3 py-1.5 text-xs flex items-center gap-1.5">
            <Download size={14} /> Export CSV
          </button>

          <button
            type="button"
            onClick={handleAddRow}
            className="btn btn-accent px-3 py-1.5 text-xs flex items-center gap-1.5">
            <Plus size={14} /> Add Variation
          </button>
        </div>
      </div>

      {/* Inline Status / Validation Banner */}
      {feedback != null && (
        <div
          className={`flex items-center justify-between px-3.5 py-2 rounded-lg text-xs border ${
            feedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-[#12121e] border-[#2e2e48] text-gray-200'
          }`}>
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
            }}
            className="bg-transparent border-none text-gray-400 hover:text-white cursor-pointer p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Optional Collapsible Gemini 3+ AI Copy Generation Panel */}
      {isAiPanelOpen && (
        <div className="premium-ai-panel bg-[#12121e] border border-rose-500/30 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-rose-400" />
              <span className="text-xs font-bold text-white uppercase">
                Gemini 3+ Ad Copy Generator (BYOK / Client-Side)
              </span>
            </div>
            <span className="text-[11px] text-gray-400">
              API Key is stored strictly in your browser&apos;s localStorage
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                Google AI Studio API Key
              </label>
              <div className="flex items-center gap-1.5">
                <Key size={14} className="text-gray-400 shrink-0" />
                <input
                  type="password"
                  value={apiKey}
                  placeholder="AIzaSy..."
                  onChange={(e) => {
                    handleSaveApiKey(e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs font-mono"
                />
                {apiKey !== '' && (
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="btn btn-outline px-2 py-1 text-[10px] shrink-0"
                    title="Clear saved API Key from browser storage">
                    Clear Key
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                Gemini Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 text-xs">
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                Number of Variations
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={generateCount}
                onChange={(e) => {
                  setGenerateCount(
                    Math.max(1, Math.min(10, Number(e.target.value) || 3)),
                  );
                }}
                className="w-full px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                Product / Service Name (商材・サービス名)
              </label>
              <input
                type="text"
                value={productName}
                placeholder="例: JCB カード W"
                onChange={(e) => {
                  setProductName(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                Target Audience (ターゲット層)
              </label>
              <input
                type="text"
                value={targetAudience}
                placeholder="例: 20代〜30代のネットショッピング利用者"
                onChange={(e) => {
                  setTargetAudience(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1">
                Campaign Appeal / Offer (訴求軸・特典)
              </label>
              <input
                type="text"
                value={campaignAppeal}
                placeholder="例: 年会費永年無料・新規入会で最大10,000円キャッシュバック"
                onChange={(e) => {
                  setCampaignAppeal(e.target.value);
                }}
                className="w-full px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          {aiError != null && (
            <div className="text-xs text-red-400 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-1.5">
              {aiError}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-gray-400">
              AI-generated copy may contain inaccuracies. Always review before
              publishing.
            </span>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => {
                void handleGenerateWithGemini();
              }}
              className="btn btn-accent px-4 py-1.5 text-xs flex items-center gap-1.5">
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Generate {generateCount} Variations
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto max-h-[380px] rounded-lg border border-[#24243a]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#12121e] text-[11px] text-gray-300 uppercase">
              <th className="p-2.5 w-16 text-center">Preview</th>
              <th className="p-2.5 min-w-[150px]">Variation Name</th>
              {template.textBoxes.map((box) => (
                <th key={box.id} className="p-2.5 min-w-[200px]">
                  <div className="flex flex-col">
                    <span className="text-white font-bold">{box.name}</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      {box.direction === 'vertical'
                        ? '縦書き (Vertical)'
                        : '横書き (Horizontal)'}
                    </span>
                  </div>
                </th>
              ))}
              <th className="p-2.5 w-28 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e2e48] text-xs">
            {variations.map((v) => {
              const isSelected = v.id === selectedVariationId;
              return (
                <tr
                  key={v.id}
                  onClick={() => {
                    onSelectVariation(v.id);
                  }}
                  className={`cursor-pointer ${
                    isSelected
                      ? 'bg-rose-500/10'
                      : 'bg-[#08080f] hover:bg-[#12121e]'
                  }`}>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVariation(v.id);
                      }}
                      className={`w-6 h-6 rounded-full inline-flex items-center justify-center border ${
                        isSelected
                          ? 'bg-rose-500 border-rose-500 text-white'
                          : 'bg-transparent border-[#2e2e48] text-transparent'
                      }`}
                      title="Preview this variation on canvas">
                      <Check size={12} />
                    </button>
                  </td>

                  <td className="p-2">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => {
                        handleUpdateName(v.id, e.target.value);
                      }}
                      className="font-semibold"
                    />
                  </td>

                  {template.textBoxes.map((box) => {
                    const textVal = v.texts[box.id] ?? '';
                    const sizeVal = v.fontSizes[box.id] ?? box.fontSize;
                    const fontVal =
                      v.fontFamilies?.[box.id] ??
                      box.defaultFontFamily ??
                      'Noto Sans JP';

                    return (
                      <td key={box.id} className="p-2 align-top">
                        <div className="flex flex-col gap-1.5">
                          <textarea
                            rows={2}
                            value={textVal}
                            onChange={(e) => {
                              handleUpdateText(v.id, box.id, e.target.value);
                            }}
                            className="w-full text-xs resize-y"
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={16}
                              max={160}
                              value={sizeVal}
                              onChange={(e) => {
                                const parsed = Number(e.target.value);
                                if (Number.isFinite(parsed) && parsed > 0) {
                                  handleUpdateFontSize(
                                    v.id,
                                    box.id,
                                    Math.round(parsed),
                                  );
                                }
                              }}
                              className="w-16 text-[11px] font-mono"
                              title="Font Size (px)"
                            />
                            <select
                              value={fontVal}
                              onChange={(e) => {
                                void handleUpdateFontFamily(
                                  v.id,
                                  box.id,
                                  e.target.value,
                                );
                              }}
                              className="flex-grow text-[11px]"
                              title="Font Family">
                              {allFonts.map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  <td
                    className="p-2 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleDuplicateRow(v);
                        }}
                        className="btn btn-outline p-1.5 text-gray-300 hover:text-white"
                        title="Duplicate row">
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteRow(v.id);
                        }}
                        disabled={variations.length <= 1}
                        className="btn btn-outline p-1.5 text-red-400"
                        title="Delete row">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
