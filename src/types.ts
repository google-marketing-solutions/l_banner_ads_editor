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
 * Core data models for L-Banner Ads Editor templates, variations, and styles.
 */

import type * as React from 'react';

/** Supported L-Banner layout orientations on a 1920x1080 canvas. */
export type LShapeType = 'bottom-left' | 'bottom-right';

/** Supported text flow directions for Japanese and Latin typography. */
export type TextDirection = 'horizontal' | 'vertical';

/** Horizontal text alignment options. */
export type HorizontalAlign = 'left' | 'center' | 'right';

/** Vertical text alignment options. */
export type VerticalAlign = 'top' | 'middle' | 'bottom';

/** Bounding box and typography settings for a template text region. */
export interface TextBoxConfig {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  readonly maxLines?: number;
  readonly defaultFontFamily?: string;
  readonly color: string;
  readonly direction: TextDirection;
  readonly align: HorizontalAlign;
  readonly vAlign: VerticalAlign;
}

/** Primary brand logo asset and bounding box configuration. */
export interface LogoConfig {
  readonly url: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Secondary logo or badge asset positioned on the L-Banner canvas. */
export interface ExtraLogoAsset {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Complete L-Banner layout template definition for a 1920x1080 frame. */
export interface TemplateConfig {
  readonly id: string;
  readonly name: string;
  readonly type: LShapeType;
  /** Width of the vertical L-Banner bar in pixels (out of 1920). */
  readonly lWidth: number;
  /** Height of the horizontal bottom L-Banner bar in pixels (out of 1080). */
  readonly lHeight: number;
  readonly backgroundColor: string;
  readonly textBoxes: TextBoxConfig[];
  readonly logo?: LogoConfig;
  readonly extraLogos?: ExtraLogoAsset[];
}

/** Creative variation row containing per-box copy and typography overrides. */
export interface AdVariation {
  readonly id: string;
  readonly name: string;
  readonly backgroundColor?: string;
  readonly texts: Record<string, string>;
  readonly fontSizes: Record<string, number>;
  readonly fontFamilies?: Record<string, string>;
}

/** Parsed CSV variation row imported from a spreadsheet file. */
export interface ImportedVariationRow {
  readonly name?: string;
  readonly texts: Record<string, string>;
  readonly fontSizes: Record<string, number>;
  readonly fontFamilies: Record<string, string>;
}

/** Global style overrides shared across L-shape orientation switches. */
export interface GlobalStyleState {
  readonly backgroundColor: string;
  readonly lWidth: number;
  readonly lHeight: number;
  readonly logoUrl?: string;
  readonly extraLogos: ExtraLogoAsset[];
}

/** State Updater function signature compatible with React useState. */
export type StateUpdater<T> = React.Dispatch<React.SetStateAction<T>>;
