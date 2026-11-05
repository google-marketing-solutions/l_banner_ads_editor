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
 * Font preloading and Japanese glyph warm-up utilities for HTML5 Canvas 2D.
 */

/** Configuration for a selectable font family option. */
export interface FontOption {
  readonly label: string;
  readonly value: string;
  readonly isGoogle: boolean;
  readonly url?: string;
}

/** Pre-configured Japanese and system fonts available in the editor. */
export const AVAILABLE_FONTS: readonly FontOption[] = [
  {
    label: 'Noto Sans JP (ゴシック / 太字)',
    value: 'Noto Sans JP',
    isGoogle: true,
    url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700;900&display=swap',
  },
  {
    label: 'M PLUS Rounded 1c (丸ゴシック / ポップ)',
    value: 'M PLUS Rounded 1c',
    isGoogle: true,
    url: 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@700;800&display=swap',
  },
  {
    label: 'Noto Serif JP (明朝 / 高級感)',
    value: 'Noto Serif JP',
    isGoogle: true,
    url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700;900&display=swap',
  },
  {
    label: 'BIZ UDPGothic (UDゴシック / 視認性)',
    value: 'BIZ UDPGothic',
    isGoogle: true,
    url: 'https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@700&display=swap',
  },
  {
    label: 'Hiragino Kaku Gothic ProN (Mac標準)',
    value: 'Hiragino Kaku Gothic ProN',
    isGoogle: false,
  },
  {
    label: 'Meiryo (Windows標準)',
    value: 'Meiryo',
    isGoogle: false,
  },
  {
    label: 'System Sans-Serif (OS標準)',
    value: 'sans-serif',
    isGoogle: false,
  },
];

const loadedStylesheets = new Set<string>();

/**
 * Forces the browser to download all unicode-range font subsets needed for
 * Japanese Kanji, Hiragana, Katakana, and user-entered text before Canvas
 * rendering begins.
 */
export async function warmUpFontGlyphs(
  fontFamily: string,
  extraChars = '',
): Promise<void> {
  if (
    fontFamily === 'sans-serif' ||
    fontFamily === 'Meiryo' ||
    fontFamily === 'Hiragino Kaku Gothic ProN'
  ) {
    return;
  }

  let domText = '';
  if (typeof document !== 'undefined') {
    const inputs = document.querySelectorAll<HTMLInputElement>('input');
    for (const input of inputs) {
      if (input.value !== '') {
        domText += input.value;
      }
    }
    const textareas =
      document.querySelectorAll<HTMLTextAreaElement>('textarea');
    for (const textarea of textareas) {
      if (textarea.value !== '') {
        domText += textarea.value;
      }
    }
  }

  const preloadChars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
    '!?%$¥&()-+*:/.,' +
    '！？％＆（）ー「」『』【】・、。〜' +
    'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' +
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンヴー' +
    '期間限定今だけ新規入会キャンペーン最大ポイント還元プレゼント無料割引特典対象申込詳細検索公式' +
    '春夏秋冬セール開催中お得情報登録完了年会費永年実質円倍増額進呈利用条件達成先着名様限定公開' +
    '動画広告編集東京大阪日本全国対応時間分秒日月火水木金土年円万億兆個回枚本名様新商品発売記念' +
    domText +
    extraChars;

  const uniqueChars = Array.from(new Set(preloadChars)).join('');

  try {
    await Promise.all([
      document.fonts.load(`700 40px "${fontFamily}"`, uniqueChars),
      document.fonts.load(`900 40px "${fontFamily}"`, uniqueChars),
      document.fonts.load(`bold 40px "${fontFamily}"`, uniqueChars),
    ]);
    await document.fonts.ready;
  } catch (err) {
    console.warn(`Warm-up warning for font ${fontFamily}:`, err);
  }
}

/**
 * Loads a Google Font CSS stylesheet and pre-warms its Japanese glyph subsets.
 */
export async function loadGoogleFont(
  fontName: string,
  extraChars = '',
): Promise<void> {
  const fontConfig = AVAILABLE_FONTS.find(
    (font) => font.value === fontName && font.isGoogle,
  );
  if (fontConfig?.url == null) {
    return;
  }

  const fontUrl = fontConfig.url;
  if (!loadedStylesheets.has(fontUrl)) {
    const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
    if (existingLink == null) {
      try {
        const response = await fetch(fontUrl);
        if (response.ok) {
          const cssText = await response.text();
          const styleEl = document.createElement('style');
          styleEl.setAttribute('data-google-font', fontConfig.value);
          styleEl.textContent = cssText;
          document.head.appendChild(styleEl);
        }
      } catch (err) {
        console.warn(`Failed to fetch Google Font CSS from ${fontUrl}:`, err);
      }
    }
    loadedStylesheets.add(fontUrl);
  }

  await warmUpFontGlyphs(fontConfig.value, extraChars);
}

/**
 * Reads a user-uploaded font file (.ttf, .otf, .woff) and registers it in
 * `document.fonts` for immediate HTML5 Canvas rendering.
 */
export async function loadCustomFont(file: File): Promise<string> {
  const rawName = file.name.replace(/\.[^/.]+$/, '');
  const cleanName = `Custom_${rawName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const buffer = await file.arrayBuffer();
  const fontFace = new FontFace(cleanName, buffer);
  const loadedFace = await fontFace.load();
  document.fonts.add(loadedFace);
  await warmUpFontGlyphs(cleanName);
  return cleanName;
}
