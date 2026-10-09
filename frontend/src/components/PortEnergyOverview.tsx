'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Clock,
  Database,
  DollarSign,
  PieChart,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';

import { useTranslation } from '../hooks/useTranslation';
import { authService } from '../services/AuthService';
import MetricCard from './dashboard/MetricCard';

type TimePeriod =
  | '15min'
  | '30min'
  | '1hour'
  | '3hours'
  | '6hours';

interface Meter {
  id: number;
  idSite: number;
  name: string;
  tags: number[];
}

type SeriesRecord = [
  number,
  number,
  number,
  string,
  number
];

interface SeriesItem {
  source: string;
  site: number;
  device: number;
  metric_type: number;
  records: SeriesRecord[];
}

interface SeriesResponse {
  start_dtm?: string | null;
  end_dtm?: string | null;
  series: SeriesItem[];
}

interface DashboardValues {
  totalDevices: number;
  currentTotalPower: number;
  averagePowerFactor: number;
}

interface LoadingState {
  meters: boolean;
  power: boolean;
  powerFactor: boolean;
}

interface ErrorState {
  meters: string | null;
  power: string | null;
  powerFactor: string | null;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:5001';

const EE_TAG_ID = 1;

const ACTIVE_POWER_UNIT = 12;
const POWER_FACTOR_UNIT = 15;

const POWER_FACTOR_L1 = 19;
const POWER_FACTOR_L2 = 20;
const POWER_FACTOR_L3 = 21;

const LIVE_DATA_MAX_AGE_MINUTES = 3;

const MONTHLY_ENERGY = 53439;
const MAX_POWER = 120.1;

const TOP_CONSUMER = {
  name: 'D14 - Chiller - Gare - N',
  percentage: 42,
};

const ESTIMATED_MONTHLY_COST = 8015.86;

function getLiveWindow() {
  const end = new Date();

  const start = new Date(
    end.getTime() -
      LIVE_DATA_MAX_AGE_MINUTES *
        60 *
        1000
  );

  return {
    start_dtm: start.toISOString(),
    end_dtm: end.toISOString(),
  };
}

/*
 * Current Total Power payload.
 *
 * We know exactly which device is EE,
 * therefore device_type must remain empty.
 */
function buildPowerPayload(
  deviceId: number,
  siteId: number
) {
  const { start_dtm, end_dtm } =
    getLiveWindow();

  return {
    start_dtm,
    end_dtm,
    series: [
      {
        sources: ['data_lake'],
        site: [siteId],
        site_type: ['port'],
        device: [deviceId],
        device_type: [],
        metric_type: [0],
        unit: [ACTIVE_POWER_UNIT],
        field: 'default',
      },
    ],
  };
}

/*
 * Average Power Factor payload.
 *
 * For PF Atlas works differently:
 *
 * device: []
 * device_type: ['meter']
 *
 * This returns all meters that have the
 * requested PF metrics.
 */
function buildPowerFactorPayload(
  siteId: number
) {
  const { start_dtm, end_dtm } =
    getLiveWindow();

  return {
    start_dtm,
    end_dtm,
    series: [
      {
        sources: ['data_lake'],
        site: [siteId],
        site_type: ['port'],
        device: [],
        device_type: ['meter'],
        metric_type: [
          POWER_FACTOR_L1,
          POWER_FACTOR_L2,
          POWER_FACTOR_L3,
        ],
        unit: [POWER_FACTOR_UNIT],
        field: 'default',
      },
    ],
  };
}

/*
 * Atlas returns the records chronologically.
 * For dashboard cards we only need the
 * most recent value.
 */
function getLatestValue(
  series: SeriesItem
): number | undefined {
  if (!series.records?.length) {
    return undefined;
  }

  const lastRecord =
    series.records[
      series.records.length - 1
    ];

  const value = lastRecord[4];

  return typeof value === 'number' &&
    Number.isFinite(value)
    ? value
    : undefined;
}

/*
 * Current Total Power:
 *
 * EE device only.
 *
 * metric 6 = phase 1
 * metric 7 = phase 2
 * metric 8 = phase 3
 *
 * Latest values are summed and converted
 * from W to kW.
 */
function calculateCurrentTotalPower(
  data: SeriesResponse,
  eeDeviceId: number
): number {
  if (!Array.isArray(data.series)) {
    return 0;
  }

  const values = data.series
    .filter(
      (series) =>
        series.device === eeDeviceId &&
        (
          series.metric_type === 6 ||
          series.metric_type === 7 ||
          series.metric_type === 8
        )
    )
    .map(getLatestValue)
    .filter(
      (value): value is number =>
        value !== undefined
    );

  if (values.length === 0) {
    return 0;
  }

  const totalWatts =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  return totalWatts / 1000;
}

/*
 * Average Power Factor:
 *
 * 1. Ignore Entrada de Energia.
 * 2. Get latest PF L1, L2 and L3 for every meter.
 * 3. Calculate average PF of each meter:
 *
 *    (L1 + L2 + L3) / 3
 *
 * 4. Calculate average across all valid meters.
 */
function calculateAveragePowerFactor(
  data: SeriesResponse,
  eeDeviceId: number
): number {
  if (!Array.isArray(data.series)) {
    return 0;
  }

  const devicePowerFactors =
    new Map<
      number,
      Map<number, number>
    >();

  data.series.forEach((series) => {
    if (
      series.device === eeDeviceId
    ) {
      return;
    }

    if (
      series.metric_type !==
        POWER_FACTOR_L1 &&
      series.metric_type !==
        POWER_FACTOR_L2 &&
      series.metric_type !==
        POWER_FACTOR_L3
    ) {
      return;
    }

    const value =
      getLatestValue(series);

    if (
      value === undefined ||
      value <= 0
    ) {
      return;
    }

    let deviceValues =
      devicePowerFactors.get(
        series.device
      );

    if (!deviceValues) {
      deviceValues =
        new Map<number, number>();

      devicePowerFactors.set(
        series.device,
        deviceValues
      );
    }

    deviceValues.set(
      series.metric_type,
      value
    );
  });

  const deviceAverages: number[] = [];

  devicePowerFactors.forEach(
    (metrics, deviceId) => {
      const l1 =
        metrics.get(
          POWER_FACTOR_L1
        );

      const l2 =
        metrics.get(
          POWER_FACTOR_L2
        );

      const l3 =
        metrics.get(
          POWER_FACTOR_L3
        );

      /*
       * Only calculate a meter when
       * all three phases are available.
       */
      if (
        l1 === undefined ||
        l2 === undefined ||
        l3 === undefined
      ) {
        return;
      }

      const average =
        (l1 + l2 + l3) / 3;

      deviceAverages.push(
        average
      );

      console.log(
        `⚡ PF device ${deviceId}:`,
        {
          L1: l1,
          L2: l2,
          L3: l3,
          average,
        }
      );
    }
  );

  if (
    deviceAverages.length === 0
  ) {
    return 0;
  }

  const averagePowerFactor =
    deviceAverages.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    deviceAverages.length;

  console.log(
    '⚡ Average Power Factor:',
    {
      devices:
        deviceAverages.length,
      averages:
        deviceAverages,
      result:
        averagePowerFactor,
    }
  );

  return averagePowerFactor;
}

export default function PortEnergyOverview() {
  const t = useTranslation();
  const router = useRouter();

  const [values, setValues] =
    useState<DashboardValues>({
      totalDevices: 0,
      currentTotalPower: 0,
      averagePowerFactor: 0,
    });

  const [loading, setLoading] =
    useState<LoadingState>({
      meters: true,
      power: true,
      powerFactor: true,
    });

  const [errors, setErrors] =
    useState<ErrorState>({
      meters: null,
      power: null,
      powerFactor: null,
    });

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [timePeriod, setTimePeriod] =
    useState<TimePeriod>('15min');

  useEffect(() => {
    const loadData = async () => {
      const token =
        authService.getToken();

      const tokenType =
        authService.getTokenType();

      if (!token) {
        authService.logout();
        router.replace('/login');
        return;
      }

      const headers = {
        Accept: 'application/json',
        Authorization:
          `${tokenType} ${token}`,
      };

      setLoading({
        meters: true,
        power: true,
        powerFactor: true,
      });

      setErrors({
        meters: null,
        power: null,
        powerFactor: null,
      });

      let meters: Meter[];

      /*
       * =====================================
       * METERS
       * =====================================
       */

      try {
        const response =
          await fetch(
            `${BACKEND_URL}/api/meters`,
            {
              headers,
              cache: 'no-store',
            }
          );

        if (response.status === 401) {
          authService.logout();
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Meters API ${response.status}`
          );
        }

        meters =
          (await response.json()) as Meter[];

        setValues((current) => ({
          ...current,
          totalDevices:
            meters.length,
        }));

        setLoading((current) => ({
          ...current,
          meters: false,
        }));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load meters';

        console.error(
          'Meters error:',
          message
        );

        setErrors((current) => ({
          ...current,
          meters: message,
        }));

        setLoading({
          meters: false,
          power: false,
          powerFactor: false,
        });

        return;
      }

      /*
       * =====================================
       * FIND ENTRADA DE ENERGIA
       * =====================================
       */

      const eeMeter =
        meters.find(
          (meter) =>
            meter.tags?.includes(
              EE_TAG_ID
            )
        );

      if (!eeMeter) {
        const message =
          'EE meter not found';

        console.error(message);

        setErrors((current) => ({
          ...current,
          power: message,
          powerFactor: message,
        }));

        setLoading((current) => ({
          ...current,
          power: false,
          powerFactor: false,
        }));

        return;
      }

      /*
       * =====================================
       * BUILD REQUESTS
       * =====================================
       */

      const powerPayload =
        buildPowerPayload(
          eeMeter.id,
          eeMeter.idSite
        );

      const powerFactorPayload =
        buildPowerFactorPayload(
          eeMeter.idSite
        );

      console.log(
        '⚡ Current Power request:',
        powerPayload
      );

      console.log(
        '⚡ Power Factor request:',
        powerFactorPayload
      );

      /*
       * =====================================
       * REQUEST SERIES
       * =====================================
       */

      try {
        const [
          powerResponse,
          powerFactorResponse,
        ] = await Promise.all([
          fetch(
            `${BACKEND_URL}/api/series/data_lake`,
            {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify(
                powerPayload
              ),
            }
          ),

          fetch(
            `${BACKEND_URL}/api/series/data_lake`,
            {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify(
                powerFactorPayload
              ),
            }
          ),
        ]);

        if (
          powerResponse.status === 401 ||
          powerFactorResponse.status === 401
        ) {
          authService.logout();
          router.replace('/login');
          return;
        }

        /*
         * =====================================
         * CURRENT TOTAL POWER
         * =====================================
         */

        if (powerResponse.ok) {
          const data =
            (await powerResponse.json()) as SeriesResponse;

          const currentTotalPower =
            calculateCurrentTotalPower(
              data,
              eeMeter.id
            );

          setValues((current) => ({
            ...current,
            currentTotalPower:
              Math.round(
                currentTotalPower *
                  100
              ) / 100,
          }));
        } else {
          const message =
            `Power API ${powerResponse.status}`;

          console.error(message);

          setErrors((current) => ({
            ...current,
            power: message,
          }));
        }

        setLoading((current) => ({
          ...current,
          power: false,
        }));

        /*
         * =====================================
         * AVERAGE POWER FACTOR
         * =====================================
         */

        if (
          powerFactorResponse.ok
        ) {
          const data =
            (await powerFactorResponse.json()) as SeriesResponse;

          console.log(
            '⚡ Power Factor response:',
            data
          );

          const averagePowerFactor =
            calculateAveragePowerFactor(
              data,
              eeMeter.id
            );

          setValues((current) => ({
            ...current,
            averagePowerFactor:
              Math.round(
                averagePowerFactor *
                  100
              ) / 100,
          }));
        } else {
          const message =
            `Power Factor API ${powerFactorResponse.status}`;

          console.error(message);

          setErrors((current) => ({
            ...current,
            powerFactor: message,
          }));
        }

        setLoading((current) => ({
          ...current,
          powerFactor: false,
        }));

        setLastUpdated(
          new Date()
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load series data';

        console.error(
          'Series request error:',
          message
        );

        setErrors((current) => ({
          ...current,
          power:
            current.power ||
            message,
          powerFactor:
            current.powerFactor ||
            message,
        }));

        setLoading((current) => ({
          ...current,
          power: false,
          powerFactor: false,
        }));
      }
    };

    loadData();
  }, [router]);

  const getTimePeriodLabel = (
    period: TimePeriod
  ) => {
    switch (period) {
      case '15min':
        return t.last15Minutes;
      case '30min':
        return t.last30Minutes;
      case '1hour':
        return t.lastHour;
      case '3hours':
        return t.last3Hours;
      case '6hours':
        return t.last6Hours;
    }
  };

  const periodOptions: {
    value: TimePeriod;
    label: string;
  }[] = [
    {
      value: '15min',
      label: t.last15Minutes,
    },
    {
      value: '30min',
      label: t.last30Minutes,
    },
    {
      value: '1hour',
      label: t.lastHour,
    },
    {
      value: '3hours',
      label: t.last3Hours,
    },
    {
      value: '6hours',
      label: t.last6Hours,
    },
  ];

  const apiConnected =
    !loading.meters &&
    !errors.meters;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">

        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          {t.portEnergyOverview}
        </h2>

        {apiConnected ? (
          <div className="flex items-center text-green-600 dark:text-green-400">
            <Wifi className="h-4 w-4 mr-1" />

            <span className="text-sm">
              {t.active}
            </span>
          </div>
        ) : errors.meters ? (
          <div className="flex items-center text-red-600 dark:text-red-400">
            <WifiOff className="h-4 w-4 mr-1" />

            <span className="text-sm">
              {t.disconnected}
            </span>
          </div>
        ) : (
          <div className="flex items-center text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 mr-2" />

            <span className="text-sm">
              {t.loadingData}
            </span>
          </div>
        )}

      </div>

      {/* Current Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        <MetricCard
          title={t.totalDevicesLabel}
          value={values.totalDevices}
          icon={Database}
          variant="blue"
          loading={loading.meters}
          error={!!errors.meters}
        />

        <MetricCard
          title={t.currentTotalPowerLabel}
          value={values.currentTotalPower}
          unit={t.kW}
          icon={Zap}
          variant="yellow"
          loading={loading.power}
          error={!!errors.power}
        />

        <MetricCard
          title={t.averagePowerFactorLabel}
          value={values.averagePowerFactor}
          icon={Activity}
          variant="purple"
          loading={loading.powerFactor}
          error={!!errors.powerFactor}
        />

      </div>

      {/* Time Period */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 mb-6">

        <label className="flex items-center text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">

          <Clock className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />

          {t.timePeriod}

        </label>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

          {periodOptions.map(
            (option) => (
              <button
                key={option.value}
                onClick={() =>
                  setTimePeriod(
                    option.value
                  )
                }
                className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 border-2 ${
                  timePeriod ===
                  option.value
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-600 hover:shadow-sm'
                }`}
              >
                <div className="text-sm">
                  {option.label}
                </div>
              </button>
            )
          )}

        </div>
      </div>

      {/* Power Distribution */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">

        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">

          <Activity className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />

          {t.devicePowerDistribution}{' '}
          -{' '}
          {getTimePeriodLabel(
            timePeriod
          )}

        </h3>

        <div className="h-72 flex items-center justify-center">
          <div className="text-center">

            <Activity className="h-10 w-10 mx-auto mb-3 text-gray-400" />

            <p className="text-gray-500 dark:text-gray-400">
              Consumption data integration pending
            </p>

          </div>
        </div>

      </div>

      {/* Temporary Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">

        <MetricCard
          title={t.monthlyEnergyLabel}
          value={MONTHLY_ENERGY.toLocaleString()}
          unit={`${t.kWh} (${t.last30Days})`}
          icon={Zap}
          variant="indigo"
        />

        <MetricCard
          title={t.maxPowerLabel}
          value={MAX_POWER}
          unit={`${t.kW} (${t.maximum})`}
          icon={TrendingUp}
          variant="rose"
        />

        <MetricCard
          title={t.topConsumerLabel}
          value={TOP_CONSUMER.name}
          unit={`${TOP_CONSUMER.percentage}% (${getTimePeriodLabel(
            timePeriod
          )})`}
          icon={PieChart}
          variant="amber"
        />

      </div>

      {/* Estimated Monthly Cost */}
      <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">

        <div className="flex items-center justify-between">

          <div className="flex items-center">

            <DollarSign className="h-8 w-8 text-purple-600 dark:text-purple-400" />

            <div className="ml-3">

              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {t.estimatedMonthlyCost}
              </p>

              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                €
                {ESTIMATED_MONTHLY_COST.toLocaleString()}
              </p>

            </div>

          </div>

          <div className="text-right text-xs text-gray-500 dark:text-gray-400">

            <p>
              {t.basedOn015EuroPerKwh}
            </p>

            <p>
              {MONTHLY_ENERGY.toLocaleString()}{' '}
              {t.kWh}{' '}
              {t.consumed}
            </p>

          </div>

        </div>
      </div>

      {/* Last Update */}
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">

        <p>
          {t.lastUpdated}:{' '}

          {lastUpdated
            ? lastUpdated.toLocaleTimeString()
            : t.na}
        </p>

      </div>

    </div>
  );
}