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
 * Popover control for selecting text direction, horizontal alignment, and
 * vertical alignment on a template text box.
 */

import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  ArrowDown,
  ArrowRight,
  ArrowUp,
} from 'lucide-react';
import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

import type {HorizontalAlign, TextDirection, VerticalAlign} from '../types';

/** Props for the TextAlignmentPopover component. */
interface TextAlignmentPopoverProps {
  readonly direction: TextDirection;
  readonly align: HorizontalAlign;
  readonly vAlign: VerticalAlign;
  readonly onChange: (updates: {
    direction?: TextDirection;
    align?: HorizontalAlign;
    vAlign?: VerticalAlign;
  }) => void;
}

interface HorizontalAlignOption {
  readonly id: HorizontalAlign;
  readonly label: string;
  readonly icon: React.ReactElement;
}

interface VerticalAlignOption {
  readonly id: VerticalAlign;
  readonly label: string;
  readonly icon: React.ReactElement;
}

const HORIZONTAL_ALIGN_OPTIONS: readonly HorizontalAlignOption[] = [
  {id: 'left', label: 'Left', icon: <AlignLeft size={13} />},
  {
    id: 'center',
    label: 'Center',
    icon: <AlignHorizontalJustifyCenter size={13} />,
  },
  {id: 'right', label: 'Right', icon: <AlignRight size={13} />},
];

const VERTICAL_ALIGN_OPTIONS: readonly VerticalAlignOption[] = [
  {id: 'top', label: 'Top', icon: <ArrowUp size={13} />},
  {
    id: 'middle',
    label: 'Middle',
    icon: <AlignVerticalJustifyCenter size={13} />,
  },
  {id: 'bottom', label: 'Bottom', icon: <ArrowDown size={13} />},
];

/** Renders a portal-backed alignment and text direction selector popover. */
export const TextAlignmentPopover: React.FC<TextAlignmentPopoverProps> = ({
  direction,
  align,
  vAlign,
  onChange,
}): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({top: 0, left: 0});

  const updateCoords = (): void => {
    if (triggerRef.current != null) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 230;
      let left = rect.right - popoverWidth;
      if (left < 12) left = 12;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }

      let top = rect.bottom + 6;
      if (top + 220 > window.innerHeight - 12) {
        top = rect.top - 220;
      }

      setCoords({top, left});
    }
  };

  const toggleOpen = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        popoverRef.current != null &&
        !popoverRef.current.contains(target) &&
        triggerRef.current != null &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (): void => {
      updateCoords();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const getHorizontalIcon = (): React.ReactElement => {
    if (align === 'left') return <AlignLeft size={12} />;
    if (align === 'right') return <AlignRight size={12} />;
    return <AlignCenter size={12} />;
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        title="Text Direction & Alignment"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          backgroundColor: isOpen ? 'rgba(244, 63, 94, 0.2)' : '#161624',
          border: isOpen ? '1px solid #f43f5e' : '1px solid #2e2e48',
          color: isOpen ? '#fda4af' : '#d1d5db',
          transition: 'all 0.15s ease',
        }}>
        <span style={{color: '#fb7185', fontWeight: 700, fontSize: '10px'}}>
          {direction === 'vertical' ? '縦' : '横'}
        </span>
        <span style={{color: '#4b5563'}}>|</span>
        {getHorizontalIcon()}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '230px',
              backgroundColor: '#12121e',
              border: '1px solid #2e2e48',
              borderRadius: '10px',
              padding: '12px',
              boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.85)',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              color: '#f8fafc',
              fontFamily: "'Fira Sans', system-ui, sans-serif",
            }}>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  letterSpacing: '0.5px',
                }}>
                Text Direction (文字方向)
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  backgroundColor: '#090910',
                  padding: '3px',
                  borderRadius: '6px',
                  border: '1px solid #24243a',
                }}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({direction: 'horizontal'});
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '5px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor:
                      direction === 'horizontal' ? '#e11d48' : 'transparent',
                    color: direction === 'horizontal' ? '#ffffff' : '#9ca3af',
                  }}>
                  <ArrowRight size={12} /> 横書き
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange({direction: 'vertical'});
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '5px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor:
                      direction === 'vertical' ? '#e11d48' : 'transparent',
                    color: direction === 'vertical' ? '#ffffff' : '#9ca3af',
                  }}>
                  <ArrowDown size={12} /> 縦書き
                </button>
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  letterSpacing: '0.5px',
                }}>
                Horizontal Align (水平揃え)
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '4px',
                  backgroundColor: '#090910',
                  padding: '3px',
                  borderRadius: '6px',
                  border: '1px solid #24243a',
                }}>
                {HORIZONTAL_ALIGN_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange({align: item.id});
                    }}
                    title={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '5px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor:
                        align === item.id ? '#e11d48' : 'transparent',
                      color: align === item.id ? '#ffffff' : '#9ca3af',
                    }}>
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                  letterSpacing: '0.5px',
                }}>
                Vertical Align (垂直揃え)
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '4px',
                  backgroundColor: '#090910',
                  padding: '3px',
                  borderRadius: '6px',
                  border: '1px solid #24243a',
                }}>
                {VERTICAL_ALIGN_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange({vAlign: item.id});
                    }}
                    title={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '5px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor:
                        vAlign === item.id ? '#e11d48' : 'transparent',
                      color: vAlign === item.id ? '#ffffff' : '#9ca3af',
                    }}>
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
