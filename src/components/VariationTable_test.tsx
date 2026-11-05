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

import 'jasmine';

import {renderToStaticMarkup} from 'react-dom/server';

import type {AdVariation, StateUpdater} from '../types';
import {DEFAULT_TEMPLATES} from '../utils/canvas';
import {VariationTable} from './VariationTable';

const SAMPLE_VARIATIONS: readonly AdVariation[] = [
  {
    id: 'var-1',
    name: 'Spring_Campaign_A',
    texts: {
      'box-left': '春の新生活応援',
      'box-bottom-main': '年会費永年無料',
      'box-bottom-cta': '今すぐ申し込む',
    },
    fontSizes: {
      'box-left': 64,
      'box-bottom-main': 56,
      'box-bottom-cta': 44,
    },
  },
];

describe('VariationTable component', () => {
  it('renders the variation rows and CSV import/export action buttons', () => {
    const markup = renderToStaticMarkup(
      <VariationTable
        template={DEFAULT_TEMPLATES[0]}
        variations={SAMPLE_VARIATIONS}
        onUpdateVariations={jasmine.createSpy<
          StateUpdater<readonly AdVariation[]>
        >('onUpdateVariations')}
        selectedVariationId="var-1"
        onSelectVariation={jasmine.createSpy<(id: string) => void>(
          'onSelectVariation',
        )}
        customFonts={[]}
      />,
    );

    expect(markup).toContain('Spring_Campaign_A');
    expect(markup).toContain('Export CSV');
  });
});
