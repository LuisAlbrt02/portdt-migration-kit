
'use client';
import { Clock } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export type TimePeriod = '1hour' | '3hours' | '6hours' | '12hours' | '24hours' | 'today';

const MADEIRA_TIMEZONE = 'Atlantic/Madeira';

function getMadeiraDateParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADEIRA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour'), minute: get('minute'), second: get('second')
  };
}

// Midnight in Madeira, independently of the browser timezone
export function getTodayStartMs(): number {
  const now = Date.now();
  const { year, month, day } = getMadeiraDateParts(now);
  const midnightUTC = Date.UTC(year, month - 1, day);
  const parts = getMadeiraDateParts(midnightUTC);
  const localAsUTC = Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second
  );
  const offset = localAsUTC - midnightUTC;
  return midnightUTC - offset;
}

export function getTimePeriodMinutes(period: TimePeriod): number {
  switch (period) {
    case '1hour': return 60;
    case '3hours': return 180;
    case '6hours': return 360;
    case '12hours': return 720;
    case '24hours': return 1440;
    case 'today': return Math.max(0, Math.ceil((Date.now() - getTodayStartMs()) / 60_000));
  }
}

export function getChartStepMs(period: TimePeriod): number {
  return 60_000;
}

export function aggregateMinuteValues(
  values: (number | null)[],
  stepMs: number
): (number | null)[] {
  const minutesPerPoint = Math.max(1, Math.round(stepMs / 60_000));
  if (minutesPerPoint === 1) return values;

  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i += minutesPerPoint) {
    const group = values.slice(i, i + minutesPerPoint);
    // Do not average incomplete or missing minute values.
    if (group.some(value => value === null || !Number.isFinite(value))) {
      result.push(null);
      continue;
    }
    result.push(group.reduce<number>((sum, value) => sum + (value ?? 0), 0) / group.length);
  }
  return result;
}

interface TimeSelectorProps {
  value: TimePeriod;
  onChange: (value: TimePeriod) => void;
  disabled?: boolean;
}

export default function TimeSelector({ value, onChange, disabled = false }: TimeSelectorProps) {
  const t = useTranslation();
  const options: { value: TimePeriod; label: string }[] = [
    { value: '1hour', label: t.lastHour },
    { value: '3hours', label: t.last3Hours },
    { value: '6hours', label: t.last6Hours },
    { value: '12hours', label: 'Last 12 Hours' },
    { value: '24hours', label: 'Last 24 Hours' },
    { value: 'today', label: 'Today' }
  ];

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-3 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <label className="mb-3 flex items-center text-base font-semibold text-gray-700 dark:text-gray-300">
        <Clock className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
        {t.timePeriod}
      </label>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`rounded-lg border-2 px-3 py-2 font-medium transition-all duration-200 ${
              value === option.value
                ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-600 hover:shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <span className="text-sm">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
