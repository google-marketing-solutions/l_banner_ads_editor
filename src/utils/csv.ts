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
 * CSV parsing and RFC 4180 serialization utilities for batch ad variations.
 */

import type {AdVariation, ImportedVariationRow, TemplateConfig} from '../types';

/**
 * Parses a CSV string into an array of imported variation row objects.
 * Supports dynamic text box names, `[Font Size]`, and `[Font]` columns.
 */
export function parseCSVToVariations(
  csvText: string,
  template: TemplateConfig,
): ImportedVariationRow[] {
  const cleanCsv = csvText.replace(/^\uFEFF/, '');
  const rows = parseCSVRaw(cleanCsv);
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  const results: ImportedVariationRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (
      values.length === 0 ||
      (values.length === 1 && values[0].trim() === '')
    ) {
      continue;
    }

    let name: string | undefined;
    const texts: Record<string, string> = {};
    const fontSizes: Record<string, number> = {};
    const fontFamilies: Record<string, string> = {};

    for (const [index, header] of headers.entries()) {
      const val = values[index]?.trim() ?? '';
      if (
        header.toLowerCase() === 'variation name' ||
        header === 'バリエーション名'
      ) {
        name = val;
        continue;
      }

      for (const box of template.textBoxes) {
        const boxNameLower = box.name.toLowerCase();
        const headerLower = header.toLowerCase();

        if (
          headerLower === boxNameLower ||
          headerLower === box.id.toLowerCase()
        ) {
          texts[box.id] = val;
        } else if (
          headerLower === `${boxNameLower} [font size]` ||
          headerLower === `${boxNameLower} (font size)` ||
          headerLower === `${boxNameLower} [文字サイズ]`
        ) {
          const parsedSize = Number(val);
          if (val !== '' && Number.isFinite(parsedSize) && parsedSize > 0) {
            fontSizes[box.id] = parsedSize;
          }
        } else if (
          headerLower === `${boxNameLower} [font]` ||
          headerLower === `${boxNameLower} [font family]` ||
          headerLower === `${boxNameLower} [フォント]`
        ) {
          if (val !== '') {
            fontFamilies[box.id] = val;
          }
        }
      }
    }

    results.push({
      name,
      texts,
      fontSizes,
      fontFamilies,
    });
  }

  return results;
}

/**
 * Generates an RFC 4180 compliant CSV string from variations and template boxes.
 */
export function exportVariationsToCSV(
  variations: readonly AdVariation[],
  template: TemplateConfig,
): string {
  const headers: string[] = ['Variation Name'];
  for (const box of template.textBoxes) {
    headers.push(box.name);
    headers.push(`${box.name} [Font Size]`);
    headers.push(`${box.name} [Font]`);
  }

  const csvRows: string[] = [headers.map(escapeCSVValue).join(',')];

  for (const variation of variations) {
    const row: string[] = [escapeCSVValue(variation.name)];

    for (const box of template.textBoxes) {
      const textVal = variation.texts[box.id] ?? '';
      const sizeVal = variation.fontSizes[box.id] ?? box.fontSize;
      const fontVal =
        variation.fontFamilies?.[box.id] ??
        box.defaultFontFamily ??
        'Noto Sans JP';

      row.push(escapeCSVValue(String(textVal)));
      row.push(escapeCSVValue(String(sizeVal)));
      row.push(escapeCSVValue(String(fontVal)));
    }

    csvRows.push(row.join(','));
  }

  return csvRows.join('\r\n');
}

/**
 * Triggers a browser file download of the CSV content with a UTF-8 BOM
 * so Microsoft Excel and Google Sheets open Japanese text without mojibake.
 */
export function downloadCSVFile(csvContent: string, filename: string): void {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Escapes a single cell value for CSV output. */
function escapeCSVValue(val: string): string {
  if (
    val.includes(',') ||
    val.includes('"') ||
    val.includes('\n') ||
    val.includes('\r')
  ) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/** Parses raw CSV text into a 2D array of cell strings. */
function parseCSVRaw(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentVal);
        currentVal = '';
      } else if (char === '\r' && nextChar === '\n') {
        row.push(currentVal);
        result.push(row);
        row = [];
        currentVal = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        row.push(currentVal);
        result.push(row);
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  row.push(currentVal);
  if (row.length > 1 || row[0] !== '') {
    result.push(row);
  }

  return result;
}
