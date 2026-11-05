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

import 'jasmine';

import {AVAILABLE_FONTS, loadGoogleFont, warmUpFontGlyphs} from './fonts';

describe('fonts utilities', () => {
  it('defines Noto Sans JP as the primary Google Font option in AVAILABLE_FONTS', () => {
    expect(AVAILABLE_FONTS[0]).toEqual({
      label: 'Noto Sans JP (ゴシック / 太字)',
      value: 'Noto Sans JP',
      isGoogle: true,
      url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700;900&display=swap',
    });
  });

  it('skips glyph warm-up for standard system fonts', async () => {
    const loadSpy = spyOn(document.fonts, 'load').and.resolveTo([]);

    await warmUpFontGlyphs('sans-serif');

    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('skips stylesheet loading when a non-Google system font is requested', async () => {
    const loadSpy = spyOn(document.fonts, 'load').and.resolveTo([]);

    await loadGoogleFont('Meiryo');

    expect(loadSpy).not.toHaveBeenCalled();
  });
});
