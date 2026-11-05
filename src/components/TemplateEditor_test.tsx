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

import type {
  AdVariation,
  GlobalStyleState,
  StateUpdater,
  TemplateConfig,
} from '../types';
import {DEFAULT_TEMPLATES} from '../utils/canvas';
import type {FontOption} from '../utils/fonts';
import {TemplateEditor} from './TemplateEditor';

const SAMPLE_VARIATION: AdVariation = {
  id: 'var-1',
  name: 'Pattern_1',
  texts: {
    'box-left': '新規入会キャンペーン',
    'box-bottom-main': '最大5,000円相当プレゼント',
    'box-bottom-cta': '詳しくはこちら',
  },
  fontSizes: {
    'box-left': 64,
    'box-bottom-main': 56,
    'box-bottom-cta': 44,
  },
};

describe('TemplateEditor component', () => {
  it('renders the template layout controls and configured text box names', () => {
    const markup = renderToStaticMarkup(
      <TemplateEditor
        template={DEFAULT_TEMPLATES[0]}
        onUpdateTemplate={jasmine.createSpy<StateUpdater<TemplateConfig>>(
          'onUpdateTemplate',
        )}
        onUpdateGlobalStyle={jasmine.createSpy<StateUpdater<GlobalStyleState>>(
          'onUpdateGlobalStyle',
        )}
        selectedVariation={SAMPLE_VARIATION}
        onUpdateVariation={jasmine.createSpy<(updated: AdVariation) => void>(
          'onUpdateVariation',
        )}
        customFonts={[]}
        onAddCustomFont={jasmine.createSpy<(font: FontOption) => void>(
          'onAddCustomFont',
        )}
      />,
    );

    expect(markup).toContain('Left Vertical Area (左縦スペース)');
    expect(markup).toContain('Bottom Main Copy (下メインコピー)');
  });
});
