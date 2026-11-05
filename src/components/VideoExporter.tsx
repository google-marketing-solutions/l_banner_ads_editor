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
 * Step 3 export workbench for generating transparent PNG overlay ZIP archives
 * and WebCodecs hardware-accelerated MP4 composite video variations.
 */

import JSZip from 'jszip';
import {
  CheckCircle,
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Move,
  Play,
  RotateCcw,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {ArrayBufferTarget, Muxer} from 'mp4-muxer';
import * as React from 'react';
import {useEffect, useRef, useState} from 'react';

import type {AdVariation, TemplateConfig} from '../types';
import {drawAdFrame, preloadLogoImage} from '../utils/canvas';
import {loadGoogleFont} from '../utils/fonts';

/** Props for the VideoExporter component. */
interface VideoExporterProps {
  readonly template: TemplateConfig;
  readonly variations: readonly AdVariation[];
  readonly selectedVariation: AdVariation;
  readonly onExportPngZip: () => Promise<void>;
  readonly isExportingPng: boolean;
}

/** Yields to the browser task queue by awaiting a 1x1 ImageBitmap decode. */
async function yieldBrowserFrame(canvas: HTMLCanvasElement): Promise<void> {
  const bitmap = await createImageBitmap(canvas, 0, 0, 1, 1);
  bitmap.close();
}

/** Decodes an audio track from a media blob URL using Web Audio API. */
async function extractFullAudioBuffer(
  url: string,
): Promise<AudioBuffer | null> {
  if (typeof AudioContext === 'undefined') {
    return null;
  }
  const audioCtx = new AudioContext();
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.warn('No decodable audio track or audio decode skipped:', err);
    return null;
  } finally {
    await audioCtx.close();
  }
}

/** Collects non-empty font names from a variation and template. */
function collectVariationFonts(
  template: TemplateConfig,
  variation: AdVariation,
): string[] {
  const fontSet = new Set<string>();
  for (const box of template.textBoxes) {
    const fontName =
      variation.fontFamilies?.[box.id] ??
      box.defaultFontFamily ??
      'Noto Sans JP';
    if (fontName !== '') {
      fontSet.add(fontName);
    }
  }
  return Array.from(fontSet);
}

/** Renders the Step 3 PNG & WebCodecs MP4 export studio. */
export const VideoExporter: React.FC<VideoExporterProps> = ({
  template,
  variations,
  selectedVariation,
  onExportPngZip,
  isExportingPng,
}): React.ReactElement => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [includeAudio, setIncludeAudio] = useState<boolean>(true);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const [videoScale, setVideoScale] = useState<number>(1);
  const [videoOffsetX, setVideoOffsetX] = useState<number>(0);
  const [videoOffsetY, setVideoOffsetY] = useState<number>(0);
  const [isDraggingVideo, setIsDraggingVideo] = useState<boolean>(false);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file == null) return;
    if (videoSrc != null) {
      URL.revokeObjectURL(videoSrc);
    }
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoFileName(file.name);
    setExportStatus(null);
  };

  useEffect(() => {
    let animId = 0;
    const canvas = previewCanvasRef.current;
    const video = previewVideoRef.current;

    const renderLoop = (): void => {
      if (canvas != null) {
        drawAdFrame(canvas, template, selectedVariation, {
          isPreview: false,
          videoElement: videoSrc != null && video != null ? video : undefined,
          videoTransform: {
            scale: videoScale,
            offsetX: videoOffsetX,
            offsetY: videoOffsetY,
          },
        });
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    template,
    selectedVariation,
    videoSrc,
    videoScale,
    videoOffsetX,
    videoOffsetY,
  ]);

  const handlePreviewMouseDown = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): void => {
    if (videoSrc == null) return;
    const canvas = previewCanvasRef.current;
    if (canvas == null) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1920 / rect.width;
    const scaleY = 1080 / rect.height;

    setIsDraggingVideo(true);
    dragStartRef.current = {
      mouseX: (e.clientX - rect.left) * scaleX,
      mouseY: (e.clientY - rect.top) * scaleY,
      startOffsetX: videoOffsetX,
      startOffsetY: videoOffsetY,
    };
  };

  const handlePreviewMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement>,
  ): void => {
    if (!isDraggingVideo || dragStartRef.current == null) return;
    const canvas = previewCanvasRef.current;
    if (canvas == null) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1920 / rect.width;
    const scaleY = 1080 / rect.height;

    const currX = (e.clientX - rect.left) * scaleX;
    const currY = (e.clientY - rect.top) * scaleY;

    setVideoOffsetX(
      Math.round(
        dragStartRef.current.startOffsetX +
          (currX - dragStartRef.current.mouseX),
      ),
    );
    setVideoOffsetY(
      Math.round(
        dragStartRef.current.startOffsetY +
          (currY - dragStartRef.current.mouseY),
      ),
    );
  };

  const handlePreviewMouseUp = (): void => {
    setIsDraggingVideo(false);
    dragStartRef.current = null;
  };

  const renderSingleVariationMP4 = async (
    sourceVideoUrl: string,
    variation: AdVariation,
    labelPrefix = '',
  ): Promise<Blob> => {
    if (
      typeof VideoEncoder === 'undefined' ||
      typeof VideoFrame === 'undefined'
    ) {
      throw new Error(
        'WebCodecs API is not supported in this browser. Please use Google Chrome or Microsoft Edge.',
      );
    }

    const uniqueFonts = collectVariationFonts(template, variation);
    await Promise.all(uniqueFonts.map((font) => loadGoogleFont(font)));
    await document.fonts.ready;

    const logoUrlsToLoad: string[] = [];
    if (template.logo?.url != null && template.logo.url !== '') {
      logoUrlsToLoad.push(template.logo.url);
    }
    if (template.extraLogos != null) {
      for (const extra of template.extraLogos) {
        if (extra.url !== '') {
          logoUrlsToLoad.push(extra.url);
        }
      }
    }
    await Promise.all(logoUrlsToLoad.map((url) => preloadLogoImage(url)));

    const video = document.createElement('video');
    video.src = sourceVideoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    await video.play();
    video.pause();
    video.currentTime = 0;

    const duration =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 5;
    const fps = 30;
    const totalFrames = Math.max(1, Math.ceil(duration * fps));

    let audioBuffer: AudioBuffer | null = null;
    if (
      includeAudio &&
      typeof AudioEncoder !== 'undefined' &&
      typeof AudioData !== 'undefined'
    ) {
      setProgressText(`${labelPrefix}Decoding audio track...`);
      audioBuffer = await extractFullAudioBuffer(sourceVideoUrl);
    }

    const hasValidAudio = audioBuffer != null && audioBuffer.length > 0;
    const audioSampleRate =
      hasValidAudio && audioBuffer != null ? audioBuffer.sampleRate : 44100;
    const audioChannels =
      hasValidAudio && audioBuffer != null
        ? Math.min(2, audioBuffer.numberOfChannels)
        : 2;

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: 1920,
        height: 1080,
      },
      audio: hasValidAudio
        ? {
            codec: 'aac',
            sampleRate: audioSampleRate,
            numberOfChannels: audioChannels,
          }
        : undefined,
      fastStart: 'in-memory',
    });

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (err) => {
        console.error('VideoEncoder error:', err);
      },
    });

    videoEncoder.configure({
      codec: 'avc1.640028',
      width: 1920,
      height: 1080,
      bitrate: 8_000_000,
      framerate: fps,
    });

    if (
      hasValidAudio &&
      audioBuffer != null &&
      typeof AudioEncoder !== 'undefined' &&
      typeof AudioData !== 'undefined'
    ) {
      try {
        const audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            muxer.addAudioChunk(chunk, meta);
          },
          error: (err) => {
            console.warn('AudioEncoder error:', err);
          },
        });

        audioEncoder.configure({
          codec: 'mp4a.40.2',
          sampleRate: audioSampleRate,
          numberOfChannels: audioChannels,
          bitrate: 128_000,
        });

        const totalSamples = audioBuffer.length;
        const planarData = new Float32Array(totalSamples * audioChannels);
        for (let ch = 0; ch < audioChannels; ch++) {
          const channelData = audioBuffer.getChannelData(ch);
          planarData.set(channelData, ch * totalSamples);
        }

        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: audioSampleRate,
          numberOfFrames: totalSamples,
          numberOfChannels: audioChannels,
          timestamp: 0,
          data: planarData,
        });

        audioEncoder.encode(audioData);
        audioData.close();
        await audioEncoder.flush();
        audioEncoder.close();
      } catch (audioErr) {
        console.warn('Skipping audio encode due to error:', audioErr);
      }
    }

    const workCanvas = document.createElement('canvas');
    workCanvas.width = 1920;
    workCanvas.height = 1080;
    const frameDurationUs = Math.round((1 / fps) * 1_000_000);

    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      const timestampSec = Math.min(duration - 0.001, frameIdx / fps);
      video.currentTime = timestampSec;

      let waitGuards = 0;
      while (video.seeking && waitGuards < 60) {
        await yieldBrowserFrame(workCanvas);
        waitGuards++;
      }

      drawAdFrame(workCanvas, template, variation, {
        isPreview: false,
        videoElement: video,
        videoTransform: {
          scale: videoScale,
          offsetX: videoOffsetX,
          offsetY: videoOffsetY,
        },
      });

      const frameTimestampUs = Math.round((frameIdx / fps) * 1_000_000);

      const videoFrame = new VideoFrame(workCanvas, {
        timestamp: frameTimestampUs,
        duration: frameDurationUs,
      });

      videoEncoder.encode(videoFrame, {keyFrame: frameIdx % 60 === 0});
      videoFrame.close();

      if (frameIdx % 5 === 0 || frameIdx === totalFrames - 1) {
        const pct = Math.round(((frameIdx + 1) / totalFrames) * 100);
        setProgressPercent(pct);
        setProgressText(
          `${labelPrefix}Encoding frame ${frameIdx + 1}/${totalFrames} (${pct}%)`,
        );
        await yieldBrowserFrame(workCanvas);
      }
    }

    setProgressText(`${labelPrefix}Finalizing MP4 container...`);
    await videoEncoder.flush();
    videoEncoder.close();
    muxer.finalize();

    const buffer = muxer.target.buffer;
    return new Blob([buffer], {type: 'video/mp4'});
  };

  const handleExportCurrentMP4 = async (): Promise<void> => {
    if (videoSrc == null || isRecording) return;
    setIsRecording(true);
    setProgressPercent(0);
    setExportStatus(null);

    try {
      const mp4Blob = await renderSingleVariationMP4(
        videoSrc,
        selectedVariation,
      );
      const url = URL.createObjectURL(mp4Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedVariation.name || 'variation'}_l_banner.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportStatus(
        `Exported ${selectedVariation.name}_l_banner.mp4 (1920x1080 H.264 MP4).`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'MP4 export failed.';
      setExportStatus(`Error: ${msg}`);
    } finally {
      setIsRecording(false);
      setProgressText('');
    }
  };

  const handleExportAllMP4Zip = async (): Promise<void> => {
    if (videoSrc == null || isRecording) return;
    setIsRecording(true);
    setProgressPercent(0);
    setExportStatus(null);

    try {
      const zip = new JSZip();
      for (let i = 0; i < variations.length; i++) {
        const v = variations[i];
        const prefix = `[${i + 1}/${variations.length}: ${v.name}] `;
        const mp4Blob = await renderSingleVariationMP4(videoSrc, v, prefix);
        const safeName = v.name.replace(/[^a-zA-Z0-9_\u3000-\u9FFF-]/g, '_');
        zip.file(`${safeName || `variation_${i + 1}`}.mp4`, mp4Blob);
      }

      setProgressText('Compressing MP4 archive (ZIP)...');
      const zipBlob = await zip.generateAsync({type: 'blob'});
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `l_banner_mp4_variations_${variations.length}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportStatus(
        `Exported all ${variations.length} MP4 variations as ZIP.`,
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Batch MP4 export failed.';
      setExportStatus(`Error: ${msg}`);
    } finally {
      setIsRecording(false);
      setProgressText('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 5 Columns: PNG Overlay Export & Video Source Upload */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* Card A: Transparent Cutout PNG ZIP Export */}
        <div className="premium-card p-5 rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-[#24243a] pb-2.5">
            <ImageIcon size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-white m-0">
              Option A: Transparent Cutout PNGs (ZIP)
            </h3>
          </div>
          <p className="text-xs text-gray-400 m-0 leading-relaxed">
            Exports all <strong>{variations.length}</strong> variation(s) as{' '}
            <code className="text-rose-300">1920×1080</code> transparent PNG
            overlays for compositing in Adobe Premiere Pro, After Effects, or
            Final Cut Pro.
          </p>
          <button
            type="button"
            disabled={isExportingPng || isRecording}
            onClick={() => {
              void onExportPngZip();
            }}
            className="btn btn-accent py-2.5 px-4 text-xs flex items-center justify-center gap-2 w-full">
            {isExportingPng ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Generating PNG
                ZIP...
              </>
            ) : (
              <>
                <Download size={15} /> Download All PNG Overlays (
                {variations.length} Files)
              </>
            )}
          </button>
        </div>

        {/* Card B: Source Video Upload & MP4 Composite Rendering */}
        <div className="premium-card p-5 rounded-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#24243a] pb-2.5">
            <div className="flex items-center gap-2">
              <Film size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-white m-0">
                Option B: Composite MP4 Video Export (WebCodecs)
              </h3>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 font-semibold uppercase block mb-1.5">
              1. Upload Source Video (.mp4 / .webm / .mov)
            </label>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleVideoUpload}
              className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-rose-600 file:text-white hover:file:bg-rose-500 file:cursor-pointer"
            />
            {videoFileName !== '' && (
              <div className="text-[11px] text-gray-300 mt-1.5 flex items-center gap-1.5">
                <CheckCircle size={12} className="text-green-500" />
                <span>Loaded: {videoFileName}</span>
              </div>
            )}
          </div>

          {videoSrc != null && (
            <>
              {/* Video Scale & Pan Controls */}
              <div className="bg-[#12121e]/70 p-3 rounded-lg border border-[#24243a] flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Maximize2 size={13} className="text-rose-400" />
                    2. Video Framing Inside Cutout
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoScale(1);
                      setVideoOffsetX(0);
                      setVideoOffsetY(0);
                    }}
                    className="btn btn-outline px-2 py-0.5 text-[10px] flex items-center gap-1">
                    <RotateCcw size={10} /> Reset Framing
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-gray-300 mb-1">
                    <span>Zoom Scale</span>
                    <span className="font-mono">
                      {Math.round(videoScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.02}
                    value={videoScale}
                    onChange={(e) => {
                      setVideoScale(Number(e.target.value));
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase block">
                      Pan X (px)
                    </label>
                    <input
                      type="number"
                      value={videoOffsetX}
                      onChange={(e) => {
                        setVideoOffsetX(Number(e.target.value) || 0);
                      }}
                      className="w-full px-2 py-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase block">
                      Pan Y (px)
                    </label>
                    <input
                      type="number"
                      value={videoOffsetY}
                      onChange={(e) => {
                        setVideoOffsetY(Number(e.target.value) || 0);
                      }}
                      className="w-full px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Audio Toggle */}
              <div className="flex items-center justify-between bg-[#12121e]/70 px-3 py-2 rounded-lg border border-[#24243a]">
                <div className="flex items-center gap-2 text-xs text-gray-200">
                  {includeAudio ? (
                    <Volume2 size={15} className="text-rose-400" />
                  ) : (
                    <VolumeX size={15} className="text-gray-500" />
                  )}
                  <span>Preserve Source Audio Track (AAC)</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeAudio}
                  onChange={(e) => {
                    setIncludeAudio(e.target.checked);
                  }}
                  className="accent-rose-500 cursor-pointer"
                />
              </div>

              {/* MP4 Render Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => {
                    void handleExportCurrentMP4();
                  }}
                  className="btn btn-accent py-2.5 px-4 text-xs flex items-center justify-center gap-2 w-full">
                  {isRecording ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Rendering
                      MP4...
                    </>
                  ) : (
                    <>
                      <Video size={15} /> Render Selected Variation MP4 (
                      {selectedVariation.name})
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => {
                    void handleExportAllMP4Zip();
                  }}
                  className="btn btn-outline py-2.5 px-4 text-xs flex items-center justify-center gap-2 w-full">
                  <Download size={15} /> Batch Render All {variations.length}{' '}
                  Variations (MP4 ZIP)
                </button>
              </div>
            </>
          )}

          {isRecording && (
            <div className="bg-[#12121e] p-3 rounded-lg border border-rose-500/30 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-rose-300">
                <span>{progressText}</span>
                <span className="font-mono">{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#24243a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{width: `${progressPercent}%`}}
                />
              </div>
            </div>
          )}

          {exportStatus != null && (
            <div className="text-xs text-gray-200 bg-[#12121e] border border-[#2e2e48] rounded-lg px-3 py-2">
              {exportStatus}
            </div>
          )}
        </div>
      </div>

      {/* Right 7 Columns: Live Composite Video Preview */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        <div className="premium-card p-5 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#24243a] pb-2">
            <div className="flex items-center gap-2">
              <Play size={16} className="text-accent" />
              <span className="text-sm font-semibold text-white">
                Composite Video Preview ({selectedVariation.name})
              </span>
            </div>
            {videoSrc != null && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Move size={12} className="text-rose-400" /> Drag inside canvas
                to pan video
              </span>
            )}
          </div>

          <div className="relative w-full aspect-video bg-[#06060a] rounded-lg overflow-hidden border border-[#2e2e48] shadow-2xl">
            <canvas
              ref={previewCanvasRef}
              width={1920}
              height={1080}
              onMouseDown={handlePreviewMouseDown}
              onMouseMove={handlePreviewMouseMove}
              onMouseUp={handlePreviewMouseUp}
              onMouseLeave={handlePreviewMouseUp}
              className="w-full h-full object-contain block"
              style={{
                cursor:
                  videoSrc != null
                    ? isDraggingVideo
                      ? 'grabbing'
                      : 'grab'
                    : 'default',
              }}
            />
          </div>

          {videoSrc != null && (
            <video
              ref={previewVideoRef}
              src={videoSrc}
              controls
              loop
              playsInline
              className="w-full rounded-lg border border-[#24243a] bg-[#06060a] max-h-[170px]"
            />
          )}
        </div>
      </div>
    </div>
  );
};
