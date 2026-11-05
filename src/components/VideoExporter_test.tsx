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

import type {AdVariation} from '../types';
import {DEFAULT_TEMPLATES} from '../utils/canvas';
import {VideoExporter} from './VideoExporter';

const SAMPLE_VARIATIONS: readonly AdVariation[] = [
  {
    id: 'var-1',
    name: 'Summer_Promo_1',
    texts: {
      'box-left': '期間限定特典',
      'box-bottom-main': 'ポイント最大10倍',
      'box-bottom-cta': '詳細を見る',
    },
    fontSizes: {
      'box-left': 64,
      'box-bottom-main': 56,
      'box-bottom-cta': 44,
    },
  },
];

describe('VideoExporter component', () => {
  it('renders the PNG overlay ZIP export and WebCodecs MP4 synthesis controls', () => {
    const markup = renderToStaticMarkup(
      <VideoExporter
        template={DEFAULT_TEMPLATES[0]}
        variations={SAMPLE_VARIATIONS}
        selectedVariation={SAMPLE_VARIATIONS[0]}
        onExportPngZip={jasmine
          .createSpy<() => Promise<void>>('onExportPngZip')
          .and.resolveTo(undefined)}
        isExportingPng={false}
      />,
    );

    expect(markup).toContain('PNG Overlays (ZIP)');
    expect(markup).toContain('Video Composite (MP4)');
  });
});
