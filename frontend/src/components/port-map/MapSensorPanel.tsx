'use client';

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Zap,
} from 'lucide-react';

import { useState } from 'react';

import { useDraggablePanel } from '../../hooks/useDraggablePanel';
import { useTranslation } from '../../hooks/useTranslation';
import type { EnergyData } from '../../types/EnergyData';

interface Meter {
  id: number;
  name: string;
}

interface Props {
  meters: Meter[];
  selectedDeviceId: number | null;
  selectedData: EnergyData | null;
  activeDeviceIds: Set<number>;
  isLoading: boolean;
  onDeviceChange: (deviceId: number) => void;
}

function formatPower(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} W`;
}

export default function MapSensorPanel({
  meters,
  selectedDeviceId,
  selectedData,
  activeDeviceIds,
  isLoading,
  onDeviceChange,
}: Props) {
  const t = useTranslation();

  const [minimized, setMinimized] = useState(false);

  const {
    panelStyle,
    dragHandleProps,
  } = useDraggablePanel();

  const currentIndex = Math.max(
    0,
    meters.findIndex(
      (meter) =>
        meter.id === selectedDeviceId
    )
  );

  const selectedMeter =
    meters[currentIndex];

  const hasMeters =
    meters.length > 0;

  const goTo = (
    offset: number
  ) => {
    if (!hasMeters) return;

    const nextIndex =
      (
        currentIndex +
        offset +
        meters.length
      ) %
      meters.length;

    onDeviceChange(
      meters[nextIndex].id
    );
  };

  const l1 =
    selectedData?.L1?.P || 0;

  const l2 =
    selectedData?.L2?.P || 0;

  const l3 =
    selectedData?.L3?.P || 0;

  const total =
    l1 + l2 + l3;

  return (
    <div
      {...dragHandleProps}
      style={panelStyle}
      className="
        absolute
        bottom-5
        left-5
        z-30
        w-[280px]
        cursor-grab
        select-none
        overflow-hidden
        rounded-[18px]
        border
        border-blue-200
        bg-[#f8fbff]
        shadow-xl
        active:cursor-grabbing
      "
    >
      <div className="bg-blue-600 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">
            {t.sensors}
          </span>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {hasMeters
                ? `${currentIndex + 1}/${meters.length}`
                : '0/0'}
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
                transition
                hover:bg-white/15
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
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => goTo(-1)}
              disabled={!hasMeters}
              className="
                cursor-pointer
                rounded-md
                p-1
                transition
                hover:bg-white/15
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
              aria-label={
                t.previousDevice
              }
              title={
                t.previousDevice
              }
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <span className="max-w-[185px] truncate text-lg font-bold">
              {selectedMeter?.name ||
                (
                  isLoading
                    ? t.loadingData
                    : t.noDataAvailable
                )}
            </span>

            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={!hasMeters}
              className="
                cursor-pointer
                rounded-md
                p-1
                transition
                hover:bg-white/15
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
              aria-label={
                t.nextDevice
              }
              title={
                t.nextDevice
              }
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {!minimized && (
        <div className="space-y-3 p-3">
          {isLoading ? (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />

              <span className="text-sm font-medium">
                {t.loadingData}
              </span>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                <h3 className="mb-3 text-base font-bold text-slate-900">
                  {t.threePhase}
                </h3>

                <div className="space-y-2 text-sm text-slate-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                      <span>L1</span>
                    </div>

                    <strong>
                      {formatPower(l1)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-blue-500" />
                      <span>L2</span>
                    </div>

                    <strong>
                      {formatPower(l2)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span>L3</span>
                    </div>

                    <strong>
                      {formatPower(l3)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-3">
                <div className="flex items-center gap-2 text-base text-slate-900">
                  <Zap className="h-5 w-5 text-amber-500" />

                  <span>
                    {t.totalPower}
                  </span>
                </div>

                <strong className="text-base text-slate-900">
                  {formatPower(total)}
                </strong>
              </div>

              <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                <span>
                  {selectedMeter &&
                  activeDeviceIds.has(
                    selectedMeter.id
                  )
                    ? t.lastRecord
                    : t.noDataAvailable}
                </span>

                <span>
                  {selectedData
                    ? new Date(
                        selectedData.timestamp
                      ).toLocaleTimeString(
                        [],
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }
                      )
                    : '—'}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}