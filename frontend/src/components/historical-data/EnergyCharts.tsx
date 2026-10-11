'use client';

import React, { useCallback, useMemo } from 'react';
import type { EnergyData } from '../../types/EnergyData';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  TooltipItem,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { useTranslation } from '../../hooks/useTranslation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface EnergyChartsProps {
  filteredData: EnergyData[];
  selectedDevice: string | null;
  isHistoricalView: boolean;
}

export default function EnergyCharts({
  filteredData,
  selectedDevice,
  isHistoricalView,
}: EnergyChartsProps) {
  const t = useTranslation();

  const sortedData = useMemo(
    () =>
      [...filteredData].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() -
          new Date(b.timestamp).getTime()
      ),
    [filteredData]
  );

  const isMultiDay = useMemo(() => {
    if (!sortedData.length) return false;

    return (
      new Date(sortedData[0].timestamp).toDateString() !==
      new Date(
        sortedData[sortedData.length - 1].timestamp
      ).toDateString()
    );
  }, [sortedData]);

  const downsampleData = useCallback(
    (data: EnergyData[], targetPoints: number) => {
      if (data.length <= targetPoints) return data;

      const samplingRate = Math.ceil(
        data.length / targetPoints
      );

      const sampled: EnergyData[] = [];

      for (
        let i = 0;
        i < data.length;
        i += samplingRate
      ) {
        sampled.push(data[i]);
      }

      if (
        sampled[sampled.length - 1] !==
        data[data.length - 1]
      ) {
        sampled.push(data[data.length - 1]);
      }

      return sampled;
    },
    []
  );

  const powerChartData = useMemo(() => {
    const MAX_POINTS =
      isMultiDay ? 1000 : 500;

    let dataPoints = sortedData;

    if (sortedData.length > MAX_POINTS * 2) {
      dataPoints = downsampleData(
        sortedData,
        MAX_POINTS
      );
    } else if (
      sortedData.length > MAX_POINTS
    ) {
      dataPoints = downsampleData(
        sortedData,
        Math.floor(sortedData.length * 0.7)
      );
    }

    if (
      !isHistoricalView &&
      dataPoints.length > 200
    ) {
      dataPoints =
        dataPoints.slice(-200);
    }

    return {
      labels: dataPoints.map(
        item => new Date(item.timestamp)
      ),
      datasets: [
        {
          label: `${t.l1Power} (W)`,
          data: dataPoints.map(
            item => item.L1?.P || 0
          ),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor:
            'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          borderWidth: 2,
          pointRadius:
            dataPoints.length > 200 ? 0 : 2,
          pointHoverRadius: 6,
          fill: false,
        },
        {
          label: `${t.l2Power} (W)`,
          data: dataPoints.map(
            item => item.L2?.P || 0
          ),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor:
            'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          borderWidth: 2,
          pointRadius:
            dataPoints.length > 200 ? 0 : 2,
          pointHoverRadius: 6,
          fill: false,
        },
        {
          label: `${t.l3Power} (W)`,
          data: dataPoints.map(
            item => item.L3?.P || 0
          ),
          borderColor: 'rgb(139, 92, 246)',
          backgroundColor:
            'rgba(139, 92, 246, 0.1)',
          tension: 0.4,
          borderWidth: 2,
          pointRadius:
            dataPoints.length > 200 ? 0 : 2,
          pointHoverRadius: 6,
          fill: false,
        },
      ],
    };
  }, [
    sortedData,
    isHistoricalView,
    isMultiDay,
    downsampleData,
    t,
  ]);

  const totalConsumptionData = useMemo(() => {
    if (!sortedData.length) {
      return {
        labels: [],
        datasets: [{
          label: `${t.totalConsumption} (W)`,
          data: [],
          backgroundColor:
            'rgba(59, 130, 246, 0.8)',
          borderColor:
            'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          borderRadius: 4,
        }],
      };
    }

    if (isMultiDay) {
      const dailyData: Record<
        string,
        { total: number; count: number }
      > = {};

      sortedData.forEach(item => {
        const dayKey =
          new Date(
            item.timestamp
          ).toLocaleDateString('en-CA');

        if (!dailyData[dayKey]) {
          dailyData[dayKey] = {
            total: 0,
            count: 0,
          };
        }

        const totalPower =
          (item.L1?.P || 0) +
          (item.L2?.P || 0) +
          (item.L3?.P || 0);

        dailyData[dayKey].total +=
          totalPower;

        dailyData[dayKey].count += 1;
      });

      const days =
        Object.keys(dailyData).sort();

      return {
        labels: days.map(day =>
          new Date(day).toLocaleDateString(
            'pt-PT',
            {
              month: 'short',
              day: 'numeric',
            }
          )
        ),
        datasets: [{
          label: t.averageDailyPowerW,
          data: days.map(
            day =>
              dailyData[day].total /
              dailyData[day].count
          ),
          backgroundColor:
            'rgba(59, 130, 246, 0.8)',
          borderColor:
            'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          borderRadius: 4,
        }],
      };
    }

    const hourlyData: Record<
      string,
      { total: number; count: number }
    > = {};

    sortedData.forEach(item => {
      const date =
        new Date(item.timestamp);

      const hourKey =
        `${date.getHours()
          .toString()
          .padStart(2, '0')}:00`;

      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = {
          total: 0,
          count: 0,
        };
      }

      const totalPower =
        (item.L1?.P || 0) +
        (item.L2?.P || 0) +
        (item.L3?.P || 0);

      hourlyData[hourKey].total +=
        totalPower;

      hourlyData[hourKey].count += 1;
    });

    const hours =
      Object.keys(hourlyData).sort();

    return {
      labels: hours,
      datasets: [{
        label: 'Average Hourly Power (W)',
        data: hours.map(
          hour =>
            hourlyData[hour].total /
            hourlyData[hour].count
        ),
        backgroundColor:
          'rgba(59, 130, 246, 0.8)',
        borderColor:
          'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 4,
      }],
    };
  }, [sortedData, isMultiDay, t]);

  const dailyComparisonData =
    useMemo(() => {
      if (
        !isMultiDay ||
        !sortedData.length
      ) {
        return null;
      }

      const stats: Record<
        string,
        {
          min: number;
          max: number;
          avg: number;
          count: number;
          sum: number;
        }
      > = {};

      sortedData.forEach(item => {
        const dayKey =
          new Date(
            item.timestamp
          ).toLocaleDateString('en-CA');

        if (!stats[dayKey]) {
          stats[dayKey] = {
            min: Infinity,
            max: -Infinity,
            avg: 0,
            count: 0,
            sum: 0,
          };
        }

        const totalPower =
          (item.L1?.P || 0) +
          (item.L2?.P || 0) +
          (item.L3?.P || 0);

        stats[dayKey].min =
          Math.min(
            stats[dayKey].min,
            totalPower
          );

        stats[dayKey].max =
          Math.max(
            stats[dayKey].max,
            totalPower
          );

        stats[dayKey].sum +=
          totalPower;

        stats[dayKey].count++;
      });

      Object.keys(stats).forEach(day => {
        stats[day].avg =
          stats[day].sum /
          stats[day].count;
      });

      const days =
        Object.keys(stats).sort();

      const labels =
        days.map(day =>
          new Date(day).toLocaleDateString(
            'pt-PT',
            {
              month: 'short',
              day: 'numeric',
            }
          )
        );

      return {
        labels,
        datasets: [
          {
            label: t.peakPowerW,
            data: days.map(
              day => stats[day].max
            ),
            backgroundColor:
              'rgba(239, 68, 68, 0.6)',
            borderColor:
              'rgba(239, 68, 68, 1)',
            borderWidth: 2,
            borderRadius: 4,
          },
          {
            label: t.averagePowerW,
            data: days.map(
              day => stats[day].avg
            ),
            backgroundColor:
              'rgba(34, 197, 94, 0.6)',
            borderColor:
              'rgba(34, 197, 94, 1)',
            borderWidth: 2,
            borderRadius: 4,
          },
          {
            label: 'Minimum Power (W)',
            data: days.map(
              day => stats[day].min
            ),
            backgroundColor:
              'rgba(59, 130, 246, 0.6)',
            borderColor:
              'rgba(59, 130, 246, 1)',
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      };
    }, [sortedData, isMultiDay, t]);

  const lineChartOptions =
    useMemo(() => ({
      responsive: true,
      maintainAspectRatio: false,

      animation: {
        duration:
          sortedData.length > 5000
            ? 0
            : 750,
      },

      plugins: {
        legend: {
          position: 'top' as const,
        },

        tooltip: {
          backgroundColor:
            'rgba(31, 41, 55, 0.95)',

          callbacks: {
            title(
              context:
                TooltipItem<'line'>[]
            ) {
              return new Date(
                context[0].label
              ).toLocaleString();
            },

            label(
              context:
                TooltipItem<'line'>
            ) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} W`;
            },
          },
        },

        decimation: {
          enabled:
            sortedData.length > 2000,
          algorithm:
            'lttb' as const,
          samples: 1000,
        },
      },

      scales: {
        x: {
          type: 'time' as const,

          time: {
            unit:
              isMultiDay ||
              isHistoricalView
                ? 'hour' as const
                : 'minute' as const,

            tooltipFormat: 'PPpp',

            displayFormats: {
              minute: 'HH:mm',
              hour: 'HH:mm',
            },
          },

          title: {
            display: true,
            text: t.time,
          },

          ticks: {
            maxTicksLimit:
              isMultiDay ? 20 : 15,
            autoSkip: true,
          },
        },

        y: {
          beginAtZero: true,

          title: {
            display: true,
            text: t.powerW,
          },

          ticks: {
            maxTicksLimit: 10,
          },
        },
      },

      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
    }), [
      sortedData.length,
      isHistoricalView,
      isMultiDay,
      t,
    ]);

  const barChartOptions =
    useMemo(() => ({
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          position: 'top' as const,
        },

        tooltip: {
          backgroundColor:
            'rgba(31, 41, 55, 0.95)',

          callbacks: {
            label(
              context:
                TooltipItem<'bar'>
            ) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} W`;
            },
          },
        },
      },

      scales: {
        x: {
          title: {
            display: true,
            text:
              isMultiDay
                ? t.date
                : t.hourOfDay,
          },
        },

        y: {
          beginAtZero: true,

          title: {
            display: true,
            text: t.averagePowerW,
          },

          ticks: {
            maxTicksLimit: 10,
          },
        },
      },
    }), [isMultiDay, t]);

  if (!filteredData.length) {
    return (
      <div className="text-center py-16">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t.noDataAvailable}
        </h3>

        <p className="text-gray-600 dark:text-gray-400">
          {t.noDataAvailableForCharts}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t.powerConsumptionOverTime}
          </h3>
        </div>

        <div className="p-6">
          <div className="h-96 w-full">
            <Line
              data={powerChartData}
              options={lineChartOptions}
            />
          </div>
        </div>
      </div>

      {isMultiDay &&
        dailyComparisonData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t.dailyPowerComparison}
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t.peakAverageMinimumPowerConsumption}
              </p>
            </div>

            <div className="p-6">
              <div className="h-96 w-full">
                <Bar
                  data={dailyComparisonData}
                  options={barChartOptions}
                />
              </div>
            </div>
          </div>
        )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isMultiDay
              ? t.dailyEnergyConsumption
              : t.hourlyEnergyConsumption}
          </h3>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedDevice
              ? `${t.aggregated} ${
                  isMultiDay
                    ? t.daily
                    : t.hourly
                } ${t.consumptionFor} ${selectedDevice}`
              : `${t.total} ${
                  isMultiDay
                    ? t.daily
                    : t.hourly
                } ${t.energyUsagePatterns}`}
          </p>
        </div>

        <div className="p-6">
          <div className="h-96 w-full">
            <Bar
              data={totalConsumptionData}
              options={barChartOptions}
            />
          </div>
        </div>
      </div>

    </div>
  );
}