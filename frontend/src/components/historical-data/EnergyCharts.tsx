'use client';

import React, { useMemo } from 'react';
import type { EnergyData } from '../../types/EnergyData';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { useTranslation } from '../../hooks/useTranslation';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale);

interface EnergyChartsProps {
  filteredData: EnergyData[];
  selectedDevice: string | null;
  isHistoricalView: boolean;
}

export default function EnergyCharts({ filteredData, selectedDevice, isHistoricalView }: EnergyChartsProps) {
  const t = useTranslation();
  const grouped = useMemo(() => {
    const byId = new Map<string, EnergyData[]>();
    for (const row of filteredData) {
      if (!byId.has(row.device)) byId.set(row.device, []);
      byId.get(row.device)!.push(row);
    }
    return [...byId.entries()].map(([id, rows]) => ({ id, name: rows[0].deviceName || `Device ${id}`, rows: rows.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)) }));
  }, [filteredData]);

  const lineData = useMemo(() => ({
    datasets: grouped.map((group, index) => {
      const hue = (index * 137.5 + 210) % 360;
      const step = Math.max(1, Math.ceil(group.rows.length / 1000));
      const sampled = group.rows.filter((_, i) => i % step === 0 || i === group.rows.length - 1);
      return {
        label: group.name,
        data: sampled.map(row => ({ x: Date.parse(row.timestamp), y: row.measure_cons ?? 0 })),
        borderColor: `hsl(${hue}, 68%, 48%)`,
        backgroundColor: `hsla(${hue}, 68%, 48%, 0.15)`,
        borderWidth: 2,
        tension: 0.15,
        pointRadius: sampled.length > 120 ? 0 : 2,
      };
    }),
  }), [grouped]);

  const averageData = useMemo(() => {
    const allDates = filteredData.map(row => new Date(row.timestamp));
    const multiDay = allDates.length > 0 && allDates.some(date => date.toDateString() !== allDates[0].toDateString());
    const keyFor = (date: Date) => multiDay ? date.toLocaleDateString('en-CA') : `${String(date.getHours()).padStart(2, '0')}:00`;
    const keys = [...new Set(filteredData.map(row => keyFor(new Date(row.timestamp))))].sort();
    return {
      multiDay,
      data: {
        labels: keys,
        datasets: grouped.map((group, index) => {
          const color = `hsl(${(index * 137.5 + 210) % 360}, 68%, 48%)`;
          return {
            label: `${group.name} — average W`,
            data: keys.map(key => {
              const records = group.rows.filter(row => keyFor(new Date(row.timestamp)) === key);
              return records.length ? records.reduce((sum, row) => sum + (row.measure_cons ?? 0), 0) / records.length : null;
            }),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
          };
        }),
      },
    };
  }, [filteredData, grouped]);

  if (!filteredData.length) return <div className="text-center py-16 text-gray-600 dark:text-gray-300">{t.noDataAvailableForCharts}</div>;

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' as const } },
  };

  return <div className="space-y-6">
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t.powerByDeviceOverTime} (W)
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {selectedDevice ? t.selectedDevice : t.separateSeriesForEachDevice}
          {isHistoricalView ? ` · ${t.historicalData}` : ''}
        </p>
      </div>
      <div className="p-6 h-[440px]">
        <Line data={lineData} options={{
          ...sharedOptions,
          parsing: false,
          interaction: { mode: 'nearest' as const, intersect: false },
          scales: {
            x: { type: 'time' as const, title: { display: true, text: t.time } },
            y: { title: { display: true, text: t.powerW } }
          }
        }} />
      </div>
    </div>
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {averageData.multiDay ? t.averageDailyPower : t.averageHourlyPower} (W)
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t.averagePowerDescription}
        </p>
      </div>
      <div className="p-6 h-[400px]">
        <Bar data={averageData.data} options={{
          ...sharedOptions,
          scales: {
            x: { title: { display: true, text: averageData.multiDay ? t.date : t.hourOfDay } },
            y: { title: { display: true, text: t.averagePowerW } }
          }
        }} />
      </div>
    </div>
  </div>;
}
