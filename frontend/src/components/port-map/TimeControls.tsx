'use client';

import {
  Clock3,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';

import { useState } from 'react';

import { useDraggablePanel } from '../../hooks/useDraggablePanel';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  startTime: Date;
  endTime: Date;
  selectedTime: Date;
  isLiveMode: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  hasData: boolean;
  onTimeChange: (time: Date) => void;
  onPlayPause: () => void;
  onReset: () => void;
}

function formatTime(
  date: Date
): string {
  return date.toLocaleTimeString(
    [],
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  );
}

export default function TimeControls({
  startTime,
  endTime,
  selectedTime,
  isLiveMode,
  isPlaying,
  isLoading,
  hasData,
  onTimeChange,
  onPlayPause,
  onReset,
}: Props) {
  const t = useTranslation();

  const [minimized, setMinimized] =
    useState(false);

  const {
    panelStyle,
    dragHandleProps,
  } = useDraggablePanel();

  const startMs =
    startTime.getTime();

  const endMs =
    Math.max(
      startMs + 1,
      endTime.getTime()
    );

  const selectedMs =
    Math.min(
      endMs,
      Math.max(
        startMs,
        selectedTime.getTime()
      )
    );

  return (
    <div
      {...dragHandleProps}
      style={panelStyle}
      className="absolute right-5 top-5 z-30 w-[430px] max-w-[calc(100%-2.5rem)] 
      cursor-grab select-none overflow-hidden rounded-xl border border-slate-200 
      bg-white/95 shadow-xl backdrop-blur active:cursor-grabbing"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-blue-600" />

          <span className="text-lg font-semibold text-slate-800">
            {t.timeControl}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={
              isLiveMode
                ? 'text-base font-semibold text-emerald-600'
                : 'text-base font-semibold text-amber-600'
            }
          >
            {isLiveMode
              ? t.live
              : t.historical}
          </span>

          <button
            type="button"
            onClick={() =>
              setMinimized(
                (value) => !value
              )
            }
            className="
              cursor-pointer
              rounded-md
              p-1
              text-slate-500
              transition
              hover:bg-slate-100
            "
            aria-label={
              minimized
                ? t.expand
                : t.minimize
            }
            title={
              minimized
                ? t.expand
                : t.minimize
            }
          >
            {minimized ? (
              <Plus className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="px-4 py-3">
          {isLoading ? (
            <div className="flex min-h-[80px] flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />

              <span className="text-sm font-medium">
                {t.loadingData}
              </span>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-base text-slate-500">
                  {hasData
                    ? t.selectedTime
                    : t.noDataAvailable}
                </span>

                <strong className="text-lg text-slate-900">
                  {hasData
                    ? formatTime(
                        selectedTime
                      )
                    : '—'}
                </strong>
              </div>

              <input
                type="range"
                min={startMs}
                max={endMs}
                step={1000}
                value={selectedMs}
                disabled={!hasData}
                onChange={(event) =>
                  onTimeChange(
                    new Date(
                      Number(
                        event.target.value
                      )
                    )
                  )
                }
                className="
                  w-full
                  cursor-pointer
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              />

              <div className="mt-1 flex justify-between text-[12px] text-slate-500">
                <span>
                  {formatTime(
                    startTime
                  )}
                </span>

                <span>
                  {formatTime(
                    endTime
                  )}
                </span>
              </div>

              <div className="mt-3 flex justify-center gap-2 border-t border-slate-200 pt-2.5">
                <button
                  type="button"
                  onClick={
                    onPlayPause
                  }
                  disabled={!hasData}
                  className="
                    flex
                    cursor-pointer
                    items-center
                    gap-1.5
                    rounded-md
                    bg-blue-600
                    px-3
                    py-1.5
                    text-xs
                    font-semibold
                    text-white
                    transition
                    hover:bg-blue-700
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                  aria-label={
                    isPlaying
                      ? t.pausePlayback
                      : t.autoPlayThroughHistory
                  }
                  title={
                    isPlaying
                      ? t.pausePlayback
                      : t.autoPlayThroughHistory
                  }
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}

                  {isPlaying
                    ? t.pause
                    : t.play}
                </button>

                <button
                  type="button"
                  onClick={
                    onReset
                  }
                  disabled={!hasData}
                  className="
                    flex
                    cursor-pointer
                    items-center
                    gap-1.5
                    rounded-md
                    bg-slate-100
                    px-3
                    py-1.5
                    text-xs
                    font-semibold
                    text-slate-700
                    transition
                    hover:bg-slate-200
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                  aria-label={
                    t.returnToLiveData
                  }
                  title={
                    t.returnToLiveData
                  }
                >
                  <RotateCcw className="h-3.5 w-3.5" />

                  {t.live}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}