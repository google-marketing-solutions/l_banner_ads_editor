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

import type {AdVariation, TemplateConfig} from '../types';
import {exportVariationsToCSV, parseCSVToVariations} from './csv';

const TEST_TEMPLATE: TemplateConfig = {
  id: 'tpl-bottom-left',
  name: 'Bottom-Left L-Banner',
  type: 'bottom-left',
  lWidth: 480,
  lHeight: 270,
  backgroundColor: '#1e293b',
  textBoxes: [
    {
      id: 'box-headline',
      name: 'Headline',
      x: 40,
      y: 80,
      width: 400,
      height: 120,
      fontSize: 36,
      defaultFontFamily: 'Noto Sans JP',
      color: '#ffffff',
      direction: 'horizontal',
      align: 'center',
      vAlign: 'middle',
    },
  ],
};

describe('csv utilities', () => {
  it('parses CSV rows with variation names, text values, font sizes, and fonts', () => {
    const csvInput = [
      'Variation Name,Headline,Headline [Font Size],Headline [Font]',
      'Spring_A,期間限定キャンペーン,42,M PLUS Rounded 1c',
    ].join('\r\n');

    const result = parseCSVToVariations(csvInput, TEST_TEMPLATE);

    expect(result).toEqual([
      {
        name: 'Spring_A',
        texts: {'box-headline': '期間限定キャンペーン'},
        fontSizes: {'box-headline': 42},
        fontFamilies: {'box-headline': 'M PLUS Rounded 1c'},
      },
    ]);
  });

  it('strips UTF-8 BOM and ignores empty trailing rows when parsing CSV', () => {
    const csvWithBom =
      '\uFEFFバリエーション名,Headline,Headline [文字サイズ],Headline [フォント]\n' +
      'Summer_B,"新規入会で5,000pt",38,Noto Serif JP\n\n';

    const result = parseCSVToVariations(csvWithBom, TEST_TEMPLATE);

    expect(result).toEqual([
      {
        name: 'Summer_B',
        texts: {'box-headline': '新規入会で5,000pt'},
        fontSizes: {'box-headline': 38},
        fontFamilies: {'box-headline': 'Noto Serif JP'},
      },
    ]);
  });

  it('returns an empty array when CSV input contains fewer than two rows', () => {
    expect(
      parseCSVToVariations('Variation Name,Headline', TEST_TEMPLATE),
    ).toEqual([]);
  });

  it('exports variations to an RFC 4180 CSV string with escaped quotes and commas', () => {
    const variations: readonly AdVariation[] = [
      {
        id: 'var-1',
        name: 'Pattern_1',
        texts: {'box-headline': 'Special "Offer", Today'},
        fontSizes: {'box-headline': 40},
        fontFamilies: {'box-headline': 'Noto Sans JP'},
      },
    ];

    const csvOutput = exportVariationsToCSV(variations, TEST_TEMPLATE);

    expect(csvOutput).toEqual(
      [
        'Variation Name,Headline,Headline [Font Size],Headline [Font]',
        'Pattern_1,"Special ""Offer"", Today",40,Noto Sans JP',
      ].join('\r\n'),
    );
  });
});
