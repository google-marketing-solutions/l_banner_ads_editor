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

import {
  DEFAULT_TEMPLATES,
  drawAdFrame,
  drawElementBounds,
  getOrCreateLogoImage,
} from './canvas';

describe('canvas rendering utilities', () => {
  it('provides bottom-left and bottom-right default L-Banner templates', () => {
    expect(DEFAULT_TEMPLATES.map((tpl) => tpl.type)).toEqual([
      'bottom-left',
      'bottom-right',
    ]);
  });

  it('returns null on first uncached logo lookup in getOrCreateLogoImage', () => {
    expect(
      getOrCreateLogoImage('data:image/gif;base64,R0lGODlhAQABAAAAACw='),
    ).toBeNull();
  });

  it('strokes the element bounding box in drawElementBounds', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const strokeRectSpy = spyOn(ctx, 'strokeRect').and.callThrough();
    const bounds = {
      x: 40,
      y: 60,
      width: 340,
      height: 200,
      label: 'Headline',
      isHovered: false,
      isDragged: false,
    };

    drawElementBounds(ctx, bounds);

    expect(strokeRectSpy).toHaveBeenCalledWith(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );
  });

  it('fills the background canvas frame in drawAdFrame', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const fillRectSpy = spyOn(ctx, 'fillRect').and.callThrough();

    drawAdFrame(canvas, DEFAULT_TEMPLATES[0], {
      id: 'var-1',
      name: 'Pattern_1',
      texts: {'box-left': 'テスト'},
      fontSizes: {'box-left': 64},
    });

    expect(fillRectSpy).toHaveBeenCalledWith(0, 0, 1920, 1080);
  });
});
