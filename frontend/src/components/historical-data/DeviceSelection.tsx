'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

type DateRangeType = 'single' | '3days' | 'week' | 'custom';

interface DeviceSelectionProps {
  deviceList: { id: string; name: string }[];
  allDeviceList: { id: string; name: string }[];
  selectedDevice: string | null;
  selectedDate: string;
  isSearching: boolean;
  handleDeviceSelect: (deviceId: string | null) => void;
  handleDateChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  fetchHistoricalData: () => Promise<void>;
  dateRangeType?: DateRangeType;
  onDateRangeTypeChange?: (type: DateRangeType) => void;
  endDate?: string;
  onEndDateChange?: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
}

export default function DeviceSelection({
  deviceList,
  allDeviceList,
  selectedDevice,
  selectedDate,
  isSearching,
  handleDeviceSelect,
  handleDateChange,
  fetchHistoricalData,
  dateRangeType = 'single',
  onDateRangeTypeChange,
  endDate,
  onEndDateChange,
}: DeviceSelectionProps) {
  const t = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const availableDevices = allDeviceList.map(device => ({
    ...device,
    hasData: deviceList.some(active => active.id === device.id),
  }));

  const hasDevicesAvailable = availableDevices.length > 0;

  const getDeviceDisplayName = (
    device: { id: string; name: string }
  ) => {
    if (
      device.name &&
      device.name !== device.id &&
      !device.name.includes('...')
    ) return device.name;

    if (device.id.length > 10) {
      return `Device ${device.id.substring(0, 8)}`;
    }

    return device.id;
  };

  const getSelectedDeviceName = () => {
    if (!selectedDevice) return t.allDevices;

    const device = availableDevices.find(
      device => device.id === selectedDevice
    );

    return device
      ? getDeviceDisplayName(device)
      : t.selectADevice;
  };

  const showStartDate =
    dateRangeType === 'single' ||
    dateRangeType === 'custom';

  const showEndDate =
    dateRangeType === 'custom';

  const gridClass = showEndDate
    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]'
    : showStartDate
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_auto]'
      : 'grid-cols-1 lg:grid-cols-[1fr_auto]';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <div className="mb-6">
          <div className={`grid gap-4 items-end ${gridClass}`}>
            <div>
              <label className="flex items-center text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <svg
                  className="w-4 h-4 mr-2 text-[#3b82f6]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>

                {t.selectDevice}
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={!hasDevicesAvailable}
                  className="w-full px-4 py-2.5 text-left bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6] dark:text-gray-100 transition-all duration-200 shadow-sm"
                >
                  <span className="font-medium">
                    {getSelectedDeviceName()}
                  </span>

                  <svg
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-transform ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isDropdownOpen && hasDevicesAvailable && (
                  <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-gray-700 border-2 border-[#3b82f6]/30 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        handleDeviceSelect(null);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left border-b border-gray-200 dark:border-gray-600 hover:bg-[#3b82f6]/10 ${
                        selectedDevice === null
                          ? 'bg-[#3b82f6]/20 text-[#3b82f6] font-semibold'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {t.allDevices}
                    </button>

                    {availableDevices.map(device => (
                      <button
                        type="button"
                        key={device.id}
                        onClick={() => {
                          handleDeviceSelect(device.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-[#3b82f6]/10 flex items-center justify-between ${
                          selectedDevice === device.id
                            ? 'bg-[#3b82f6]/20 text-[#3b82f6] font-semibold'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <span>
                          {getDeviceDisplayName(device)}
                        </span>

                        {device.hasData && (
                          <span className="flex items-center text-xs text-green-600 dark:text-green-400">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                            {t.active}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {showStartDate && (
              <div>
                <label
                  htmlFor="date-select"
                  className="flex items-center text-base font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  {dateRangeType === 'custom'
                    ? t.startDate
                    : t.selectDate}
                </label>

                <input
                  type="date"
                  id="date-select"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#3b82f6] dark:bg-gray-700/50 dark:text-gray-100"
                />
              </div>
            )}

            {showEndDate && (
              <div>
                <label
                  htmlFor="end-date-select"
                  className="flex items-center text-base font-bold text-gray-700 dark:text-gray-300 mb-2"
                >
                  {t.endDate}
                </label>

                <input
                  type="date"
                  id="end-date-select"
                  value={endDate || selectedDate}
                  onChange={onEndDateChange}
                  min={selectedDate}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#3b82f6] dark:bg-gray-700/50 dark:text-gray-100"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-transparent mb-2">
                {t.search}
              </label>

              <button
                type="button"
                onClick={fetchHistoricalData}
                disabled={isSearching || !hasDevicesAvailable}
                className="px-6 py-2.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-gray-400 text-white font-semibold rounded-lg flex items-center space-x-2 shadow-md disabled:cursor-not-allowed"
              >
                {isSearching ? t.searching : t.search}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <label className="flex items-center text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t.queryTimeRange}
          </label>

          <div className="grid grid-cols-2 text-base font-semibold md:grid-cols-4 gap-3">
            <RangeButton
              active={dateRangeType === 'single'}
              label={t.singleDay}
              onClick={() => onDateRangeTypeChange?.('single')}
            />

            <RangeButton
              active={dateRangeType === '3days'}
              label={t.last3Days}
              onClick={() => onDateRangeTypeChange?.('3days')}
            />

            <RangeButton
              active={dateRangeType === 'week'}
              label={t.last7Days}
              onClick={() => onDateRangeTypeChange?.('week')}
            />

            <RangeButton
              active={dateRangeType === 'custom'}
              label={t.customRange}
              onClick={() => onDateRangeTypeChange?.('custom')}
            />
          </div>
        </div>

        <SearchProgressBar active={isSearching} />
      </div>
    </div>
  );
}

function RangeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 border-2 ${
        active
          ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-md'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#3b82f6]'
      }`}
    >
      {label}
    </button>
  );
}

function SearchProgressBar({ active }: { active: boolean }) {
  const t = useTranslation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (active) {
      setVisible(true);
      setProgress(0);

      interval = setInterval(() => {
        setProgress(previous => {
          if (previous >= 90) return previous;

          return Math.min(
            90,
            previous + Math.max(0.5, 3 * Math.random())
          );
        });
      }, 150);
    } else if (visible) {
      setProgress(100);

      const timeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 500);

      return () => clearTimeout(timeout);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [active, visible]);

  if (!visible) return null;

  return (
    <div className="mt-4">
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-2 bg-blue-600 transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {t.fetchingHistoricalData}
      </div>
    </div>
  );
}