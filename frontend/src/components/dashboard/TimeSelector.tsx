
'use client';
import { Clock } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export type TimePeriod = '15min' | '30min' | '1hour' | '3hours' | '6hours';

export function getTimePeriodMinutes(period: TimePeriod): number {
  switch (period) {
    case '15min': return 15;
    case '30min': return 30;
    case '1hour': return 60;
    case '3hours': return 180;
    case '6hours': return 360;
  }
}

export function getChartStepMs(period: TimePeriod): number {
  return period === '3hours' || period === '6hours' ? 120_000 : 60_000;
}

interface TimeSelectorProps { value: TimePeriod; onChange: (value: TimePeriod) => void; disabled?: boolean; }

export default function TimeSelector({ value, onChange, disabled = false }: TimeSelectorProps) {
  const t = useTranslation();
  const options: { value: TimePeriod; label: string }[] = [
    { value: '15min', label: t.last15Minutes },
    { value: '30min', label: t.last30Minutes },
    { value: '1hour', label: t.lastHour },
    { value: '3hours', label: t.last3Hours },
    { value: '6hours', label: t.last6Hours }
  ];
  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-3 shadow-md dark:border-gray-700 dark:bg-gray-800">
      <label className="mb-3 flex items-center text-base font-semibold text-gray-700 dark:text-gray-300">
        <Clock className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />{t.timePeriod}
      </label>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {options.map(option => (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} disabled={disabled}
            className={`rounded-lg border-2 px-3 py-2 font-medium transition-all duration-200 ${value === option.value ? 'border-blue-600 bg-blue-600 text-white shadow-md' : 'border-gray-200 bg-white text-gray-700 hover:border-blue-600 hover:shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
            <span className="text-sm">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
