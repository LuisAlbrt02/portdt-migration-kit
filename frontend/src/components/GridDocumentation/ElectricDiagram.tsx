'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { authService } from '../../lib/Auth';
import { useTranslation } from '../../hooks/useTranslation';

interface Meter {
  id: number;
  idSite: number;
  name: string;
  tags: number[];
  extra?: string | { friendlyName?: string } | null;
}

type SeriesRecord = [number, number, number, string, number];

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

interface DisjuntorProps {
  x: number;
  y: number;
  label: string;
  sublabel?: string;
  id: string;
  onClick?: (id: string) => void;
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

interface EndPanelProps {
  x: number;
  y: number;
  label: string;
  id: string;
  onClick?: (id: string) => void;
  color?: string;
  powerValue?: number;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const ACTIVE_POWER_UNIT = 12;
const ACTIVE_POWER_METRICS = [6, 7, 8];
const DATA_WINDOW_MINUTES = 15;

const demonstratorEquipment = [
  { l: 'Q.BAT', i: 0 },
  { l: 'Q.Vload.P', i: 1 },
  { l: 'Q.lig.AC', i: 2 },
  { l: 'Q.Empilhador', i: 3 },
  { l: 'Q.Carregadores', i: 4 },
  { l: 'Q.PV', i: 5 },
];

const emergencyCircuits = [
  { d: 'D15', p: 'Q.P.01' },
  { d: 'D16', p: 'Q.P.02' },
  { d: 'D17', p: 'Q.P.03' },
  { d: 'D18', p: 'Q.P.04' },
  { d: 'D19', p: 'Q.P.05' },
  { d: 'D20', p: 'Q.AVAC 2' },
  { d: 'D21', p: 'Q.P.07' },
  { d: 'D22', p: 'Q.P.08' },
  { d: 'D23', p: 'Q.P.1.1' },
  { d: 'D24', p: 'Q.P.1.2' },
  { d: 'D25', p: 'Q.P.1.3' },
  { d: 'D26', p: 'Q.P.1.4' },
  { d: 'D27', p: 'Q.P.N.R.O' },
  { d: 'D28', p: 'CHILLER (E)' },
  { d: 'D29', p: 'Q.E.S.I' },
  { d: 'D30', p: 'Q.BOMBAS' },
  { d: 'D31', p: 'Q.SERVIDORES' },
];

const normalCircuits = [
  { d: 'D1', p: 'Q.P.01' },
  { d: 'D2', p: 'Q.P.02' },
  { d: 'D3', p: 'Q.P.03' },
  { d: 'D4', p: 'Q.P.04' },
  { d: 'D5', p: 'Q.P.05' },
  { d: 'D6', p: 'Q.P.07' },
  { d: 'D7', p: 'Q.P.1.1' },
  { d: 'D8', p: 'Q.P.1.2' },
  { d: 'D9', p: 'Q.P.1.3' },
  { d: 'D10', p: 'Q.P.14' },
  { d: 'D11', p: 'Q.P.N.P.G' },
  { d: 'D12', p: 'Q.AVAC.0.2' },
  { d: 'D13', p: 'Q.AVAC 1' },
  { d: 'D14', p: 'CHILLER (N)' },
];

function getMeterFriendlyName(meter: Meter): string | null {
  if (!meter.extra) return null;

  try {
    const extra = typeof meter.extra === 'string' ? JSON.parse(meter.extra) : meter.extra;
    return typeof extra?.friendlyName === 'string' && extra.friendlyName.trim()
      ? extra.friendlyName.trim()
      : null;
  } catch {
    return null;
  }
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPowerPayload(siteId: number) {
  const end = new Date();
  const start = new Date(end.getTime() - DATA_WINDOW_MINUTES * 60 * 1000);

  return {
    start_dtm: start.toISOString(),
    end_dtm: end.toISOString(),
    series: [{
      sources: ['data_lake'],
      site: [siteId],
      site_type: ['port'],
      device: [],
      device_type: ['meter'],
      metric_type: [0],
      unit: [ACTIVE_POWER_UNIT],
      field: 'default',
    }],
  };
}

function buildDevicePowerMap(data: SeriesResponse, meters: Meter[]) {
  const latestValues = new Map<number, Map<number, { timestamp: number; value: number }>>();

  data.series?.forEach(series => {
    if (!ACTIVE_POWER_METRICS.includes(series.metric_type)) return;

    series.records?.forEach(record => {
      const deviceId = record[1] ?? series.device;
      const metricType = record[2];
      const timestamp = new Date(record[3]).getTime();
      const value = record[4];

      if (!Number.isFinite(timestamp) || typeof value !== 'number' || !Number.isFinite(value)) return;

      let deviceMetrics = latestValues.get(deviceId);

      if (!deviceMetrics) {
        deviceMetrics = new Map();
        latestValues.set(deviceId, deviceMetrics);
      }

      const previous = deviceMetrics.get(metricType);

      if (!previous || timestamp > previous.timestamp) {
        deviceMetrics.set(metricType, { timestamp, value });
      }
    });
  });

  const result = new Map<string, number>();

  meters.forEach(meter => {
    const metrics = latestValues.get(meter.id);
    if (!metrics) return;

    const powerW =
      (metrics.get(6)?.value || 0) +
      (metrics.get(7)?.value || 0) +
      (metrics.get(8)?.value || 0);

    const powerKW = Math.max(0, powerW / 1000);
    const friendlyName = getMeterFriendlyName(meter);

    result.set(meter.name, powerKW);

    if (friendlyName) {
      result.set(friendlyName, powerKW);
      result.set(`${meter.name} - ${friendlyName}`, powerKW);
    }
  });

  return result;
}

const Disjuntor: React.FC<DisjuntorProps> = ({
  x,
  y,
  label,
  sublabel,
  id,
  onClick,
  size = 'medium',
  color = '#1e40af',
}) => {
  const dims = {
    small: { w: 28, h: 36, fs: 7, sfs: 6 },
    medium: { w: 40, h: 50, fs: 9, sfs: 7 },
    large: { w: 58, h: 68, fs: 11, sfs: 9 },
  };

  const { w, h, fs, sfs } = dims[size];

  return (
    <g className="cursor-pointer transition-opacity hover:opacity-75" onClick={() => onClick?.(id)}>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        fill="white"
        stroke={color}
        strokeWidth={1.5}
        rx={3}
      />
      <line
        x1={x - w / 2 + 4}
        y1={y + h / 2 - 4}
        x2={x + w / 2 - 4}
        y2={y - h / 2 + 4}
        stroke={color}
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + h / 2 + fs + 4}
        textAnchor="middle"
        fontSize={fs}
        fontWeight="bold"
        fill={color}
      >
        {label}
      </text>
      {sublabel && (
        <text
          x={x}
          y={y + h / 2 + fs + sfs + 6}
          textAnchor="middle"
          fontSize={sfs}
          fill="#6b7280"
        >
          {sublabel}
        </text>
      )}
    </g>
  );
};

const Generator: React.FC<{
  x: number;
  y: number;
  label: string;
  onClick?: (id: string) => void;
}> = ({ x, y, label, onClick }) => (
  <g className="cursor-pointer hover:opacity-75" onClick={() => onClick?.('generator')}>
    <circle cx={x} cy={y} r={24} fill="white" stroke="#16a34a" strokeWidth={2} />
    <text x={x} y={y + 6} textAnchor="middle" fontSize={20} fontWeight="bold" fill="#16a34a">
      G
    </text>
    <text x={x} y={y + 42} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#166534">
      {label}
    </text>
  </g>
);

const Transformer: React.FC<{ x: number; y: number; label: string }> = ({ x, y, label }) => (
  <g>
    <circle cx={x} cy={y - 12} r={14} fill="none" stroke="#7c3aed" strokeWidth={2} />
    <circle cx={x} cy={y + 12} r={14} fill="none" stroke="#7c3aed" strokeWidth={2} />
    <text x={x + 26} y={y + 4} fontSize={10} fill="#7c3aed" fontWeight="600">
      {label}
    </text>
  </g>
);

const Line: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  dashed?: boolean;
  width?: number;
  animated?: boolean;
}> = ({
  x1,
  y1,
  x2,
  y2,
  color = '#475569',
  dashed = false,
  width = 2,
  animated = false,
}) => (
  <>
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashed ? '6,4' : undefined}
    />
    {animated && (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeDasharray="10 10"
        strokeOpacity="0.7"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="20"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </line>
    )}
  </>
);

const EndPanel: React.FC<EndPanelProps> = ({
  x,
  y,
  label,
  id,
  onClick,
  color = '#dbeafe',
  powerValue,
}) => (
  <g className="cursor-pointer hover:opacity-75" onClick={() => onClick?.(id)}>
    <rect
      x={x - 32}
      y={y - 12}
      width={64}
      height={24}
      fill={color}
      stroke="#3b82f6"
      strokeWidth={1.5}
      rx={4}
    />
    <text x={x} y={y + 2} textAnchor="middle" fontSize={7} fontWeight="600" fill="#1e40af">
      {label}
    </text>
    {powerValue !== undefined && powerValue >= 0 && (
      <text x={x} y={y + 10} textAnchor="middle" fontSize={6} fontWeight="bold" fill="#059669">
        {powerValue.toFixed(2)} kW
      </text>
    )}
  </g>
);

export default function ElectricalDiagram() {
  const t = useTranslation();
  const router = useRouter();

  const [devicePowerMap, setDevicePowerMap] = useState<Map<string, number>>(new Map());
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const token = authService.getToken();
      const tokenType = authService.getTokenType();

      if (!token) {
        authService.logout();
        router.replace('/login');
        return;
      }

      try {
        const meterResponse = await fetch(`${BACKEND_URL}/api/meters`, {
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`,
          },
          cache: 'no-store',
        });

        if (meterResponse.status === 401) {
          authService.logout();
          router.replace('/login');
          return;
        }

        if (!meterResponse.ok) {
          throw new Error(`Meters API ${meterResponse.status}`);
        }

        const meters = (await meterResponse.json()) as Meter[];
        const siteId = meters[0]?.idSite;

        if (siteId === undefined) {
          throw new Error('Port site could not be determined.');
        }

        const powerResponse = await fetch(`${BACKEND_URL}/api/series/data_lake`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `${tokenType} ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildPowerPayload(siteId)),
        });

        if (powerResponse.status === 401) {
          authService.logout();
          router.replace('/login');
          return;
        }

        if (!powerResponse.ok) {
          throw new Error(`Power API ${powerResponse.status}`);
        }

        const data = (await powerResponse.json()) as SeriesResponse;

        if (!cancelled) {
          setDevicePowerMap(buildDevicePowerMap(data, meters));
        }
      } catch (error) {
        console.error(
          'SHIFT2DC electrical diagram error:',
          error instanceof Error ? error.message : error
        );
      }
    };

    void loadData();
    const interval = window.setInterval(() => void loadData(), 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router]);

  const getPower = (deviceName?: string, panelName?: string) => {
    if (deviceName) {
      const exactDevice = devicePowerMap.get(deviceName);
      if (exactDevice !== undefined) return exactDevice;
    }

    if (panelName) {
      const exactPanel = devicePowerMap.get(panelName);
      if (exactPanel !== undefined) return exactPanel;

      const normalizedPanel = normalizeName(panelName);

      for (const [name, power] of devicePowerMap.entries()) {
        if (normalizeName(name).includes(normalizedPanel)) return power;
      }
    }

    return undefined;
  };

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4.5;

  const handleZoomIn = () => setScale(value => Math.min(value + 0.1, MAX_ZOOM));
  const handleZoomOut = () => setScale(value => Math.max(value - 0.1, MIN_ZOOM));

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;

    setIsDragging(true);
    setDragStart({
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;

    setPosition({
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();

    setScale(value =>
      Math.max(
        MIN_ZOOM,
        Math.min(
          MAX_ZOOM,
          value + (event.deltaY > 0 ? -0.05 : 0.05)
        )
      )
    );
  };

  const handleClick = (id: string) => setSelectedComponent(id);

  const W = 3200;
  const H = 950;
  const centerX = W / 2;
  const topY = 40;
  const cbSpacing = 70;
  const mainBusY = topY + 320;
  const qgedY = topY + 420;
  const subBusY = topY + 500;
  const cbY = topY + 590;
  const endPanelY = topY + 680;

  const demoX = 180;
  const demoPanelY = cbY;
  const demoBusY = endPanelY + 60;
  const demoEquipY = demoBusY + 50;

  const qgedEStartX = 380;
  const qgedEBusWidth = 17 * cbSpacing + 120;
  const qgedECenterX = qgedEStartX + (17 * cbSpacing) / 2;

  const qgedNStartX = qgedEStartX + 17 * cbSpacing + 180;
  const qgedNBusWidth = 14 * cbSpacing + 40;
  const qgedNCenterX = qgedNStartX + qgedNBusWidth / 2;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-3 text-xl font-bold text-white">
              <span className="rounded-lg bg-blue-500/20 p-2">
                <Info className="h-5 w-5 text-blue-400" />
              </span>
              {t.shift2dcDiagramTitle}
            </h2>
            <p className="ml-12 mt-1 text-sm text-slate-400">
              {t.shift2dcDiagramSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="rounded-lg bg-slate-700 p-2.5 transition-colors hover:bg-slate-600"
              disabled={scale <= MIN_ZOOM}
            >
              <ZoomOut
                className={`h-4 w-4 ${
                  scale <= MIN_ZOOM ? 'text-slate-500' : 'text-slate-300'
                }`}
              />
            </button>

            <div className="min-w-[60px] rounded-lg bg-slate-700 px-3 py-1.5 text-center">
              <span className="text-sm text-slate-300">
                {Math.round(scale * 100)}%
              </span>
            </div>

            <button
              onClick={handleZoomIn}
              className="rounded-lg bg-slate-700 p-2.5 transition-colors hover:bg-slate-600"
              disabled={scale >= MAX_ZOOM}
            >
              <ZoomIn
                className={`h-4 w-4 ${
                  scale >= MAX_ZOOM ? 'text-slate-500' : 'text-slate-300'
                }`}
              />
            </button>

            <div className="mx-1 h-6 w-px bg-slate-600" />

            <button
              onClick={handleReset}
              className="rounded-lg bg-slate-700 p-2.5 transition-colors hover:bg-slate-600"
            >
              <RotateCcw className="h-4 w-4 text-slate-300" />
            </button>

            <button
              onClick={() => setIsFullscreen(value => !value)}
              className="rounded-lg bg-slate-700 p-2.5 transition-colors hover:bg-slate-600"
            >
              {isFullscreen
                ? <X className="h-4 w-4 text-slate-300" />
                : <Maximize2 className="h-4 w-4 text-slate-300" />}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-lg dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 ${
          isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
        }`}
        style={{ height: isFullscreen ? '100vh' : '600px' }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${H}`}
          className="cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke="#eef2f7"
                strokeWidth="0.4"
              />
            </pattern>
          </defs>

          <rect width={W} height={H} fill="#f9fbfd" />
          <rect width={W} height={H} fill="url(#grid)" />

          <text
            x={centerX}
            y={topY}
            textAnchor="middle"
            fontSize={16}
            fontWeight="bold"
            fill="#dc2626"
          >
            {t.shift2dcElectricalGrid}
          </text>

          <Line
            x1={centerX}
            y1={topY + 12}
            x2={centerX}
            y2={topY + 30}
            color="#dc2626"
            width={2.5}
            animated
          />

          <Transformer
            x={centerX}
            y={topY + 55}
            label={t.shift2dcTransformer}
          />

          <Line
            x1={centerX}
            y1={topY + 80}
            x2={centerX}
            y2={topY + 100}
            color="#7c3aed"
            width={2.5}
            animated
          />

          <Disjuntor
            x={centerX}
            y={topY + 135}
            label="Q.GE"
            sublabel={t.shift2dcMainEntry}
            id="q-ge"
            onClick={handleClick}
            size="large"
            color="#dc2626"
          />

          <Generator
            x={centerX - 180}
            y={topY + 135}
            label={t.shift2dcEmergencyGenerator}
            onClick={handleClick}
          />

          <Line
            x1={centerX - 155}
            y1={topY + 135}
            x2={centerX - 50}
            y2={topY + 135}
            color="#16a34a"
            dashed
          />

          <text
            x={centerX - 100}
            y={topY + 123}
            textAnchor="middle"
            fontSize={9}
            fill="#16a34a"
            fontWeight="600"
          >
            ({t.shift2dcBackup})
          </text>

          <Line
            x1={centerX}
            y1={topY + 180}
            x2={centerX}
            y2={topY + 210}
            color="#1e3a8a"
            width={2.5}
            animated
          />

          <Disjuntor
            x={centerX}
            y={topY + 250}
            label="QGBT (N+E)"
            sublabel={t.shift2dcMainSwitchboard}
            id="qgbt"
            onClick={handleClick}
            size="large"
            color="#1e3a8a"
          />

          <Line
            x1={centerX}
            y1={topY + 295}
            x2={centerX}
            y2={mainBusY}
            color="#1e3a8a"
            width={2.5}
            animated
          />

          <rect
            x={975}
            y={357}
            width={1290}
            height={6}
            fill="#1e3a8a"
            rx={2}
          />

          <Line
            x1={qgedECenterX}
            y1={mainBusY + 4}
            x2={qgedECenterX}
            y2={qgedY - 45}
            color="#f97316"
            width={2.5}
            animated
          />

          <Line
            x1={qgedNCenterX}
            y1={mainBusY + 4}
            x2={qgedNCenterX}
            y2={qgedY - 45}
            color="#22c55e"
            width={2.5}
            animated
          />

          <Disjuntor
            x={qgedECenterX}
            y={qgedY}
            label="QGED (E)"
            sublabel={t.shift2dcEmergencyPower}
            id="qged-e"
            onClick={handleClick}
            size="large"
            color="#f97316"
          />

          <Line
            x1={qgedECenterX}
            y1={qgedY + 50}
            x2={qgedECenterX}
            y2={subBusY}
            color="#f97316"
            width={2.5}
            animated
          />

          <rect
            x={180}
            y={537}
            width={1320}
            height={6}
            fill="#f97316"
            rx={2}
          />

          <Line
            x1={demoX}
            y1={subBusY + 4}
            x2={demoX}
            y2={demoPanelY - 35}
            color="#0891b2"
            width={2.5}
            animated
          />

          <Disjuntor
            x={demoX}
            y={demoPanelY}
            label="Q.DEMONSTRADOR"
            sublabel={t.shift2dcPhysical}
            id="demonstrador"
            onClick={handleClick}
            size="medium"
            color="#0891b2"
          />

          <Line
            x1={demoX}
            y1={demoPanelY + 45}
            x2={demoX}
            y2={demoBusY}
            color="#0891b2"
            animated
          />

          <rect
            x={165}
            y={777}
            width={550}
            height={6}
            fill="#0891b2"
            rx={2}
          />

          {demonstratorEquipment.map(item => {
            const px = demoX - 10 + item.i * 108;
            const power = getPower(undefined, item.l);

            return (
              <g key={`demo-${item.i}`}>
                <Line
                  x1={px}
                  y1={demoBusY + 4}
                  x2={px}
                  y2={demoEquipY - 12}
                  color="#0891b2"
                  animated
                />
                <EndPanel
                  x={px}
                  y={demoEquipY}
                  label={item.l}
                  id={item.l}
                  onClick={handleClick}
                  color="#cffafe"
                  powerValue={power}
                />
              </g>
            );
          })}

          {emergencyCircuits.map((item, index) => {
            const bx = qgedEStartX + index * cbSpacing;
            const power = getPower(item.d, item.p);

            return (
              <g key={`e-${item.d}`}>
                <Line
                  x1={bx}
                  y1={subBusY + 4}
                  x2={bx}
                  y2={cbY - 25}
                  color="#f97316"
                  animated
                />
                <Disjuntor
                  x={bx}
                  y={cbY}
                  label={item.d}
                  id={`e-${item.d}`}
                  onClick={handleClick}
                  size="small"
                  color="#f97316"
                />
                <Line
                  x1={bx}
                  y1={cbY + 30}
                  x2={bx}
                  y2={endPanelY - 12}
                  color="#f97316"
                  animated
                />
                <EndPanel
                  x={bx}
                  y={endPanelY}
                  label={item.p}
                  id={`e-${item.p}`}
                  onClick={handleClick}
                  color="#ffedd5"
                  powerValue={power}
                />
              </g>
            );
          })}

          <Disjuntor
            x={qgedNCenterX}
            y={qgedY}
            label="QGED (N)"
            sublabel={t.shift2dcNormalPower}
            id="qged-n"
            onClick={handleClick}
            size="large"
            color="#22c55e"
          />

          <Line
            x1={qgedNCenterX}
            y1={qgedY + 50}
            x2={qgedNCenterX}
            y2={subBusY}
            color="#22c55e"
            width={2.5}
            animated
          />

          <rect
            x={1750}
            y={537}
            width={915}
            height={6}
            fill="#22c55e"
            rx={2}
          />

          {normalCircuits.map((item, index) => {
            const bx = qgedNStartX + index * cbSpacing;
            const power = getPower(item.d, item.p);

            return (
              <g key={`n-${item.d}`}>
                <Line
                  x1={bx}
                  y1={subBusY + 4}
                  x2={bx}
                  y2={cbY - 25}
                  color="#22c55e"
                  animated
                />
                <Disjuntor
                  x={bx}
                  y={cbY}
                  label={item.d}
                  id={`n-${item.d}`}
                  onClick={handleClick}
                  size="small"
                  color="#22c55e"
                />
                <Line
                  x1={bx}
                  y1={cbY + 30}
                  x2={bx}
                  y2={endPanelY - 12}
                  color="#22c55e"
                  animated
                />
                <EndPanel
                  x={bx}
                  y={endPanelY}
                  label={item.p}
                  id={item.p}
                  onClick={handleClick}
                  color="#dcfce7"
                  powerValue={power}
                />
              </g>
            );
          })}

          <text
            x={qgedNCenterX}
            y={endPanelY + 35}
            textAnchor="middle"
            fontSize={11}
            fill="#166534"
            fontStyle="italic"
            fontWeight="600"
          >
            ({t.shift2dcNormalPower})
          </text>

          <g transform={`translate(${W - 520}, ${topY + 40})`}>
            <rect
              x={0}
              y={0}
              width={240}
              height={100}
              fill="white"
              stroke="#e2e8f0"
              strokeWidth={1.2}
              rx={8}
            />

            <text x={14} y={18} fontSize={11} fontWeight="bold" fill="#1e293b">
              {t.shift2dcLegend}
            </text>

            <rect
              x={14}
              y={30}
              width={14}
              height={20}
              fill="white"
              stroke="#1e40af"
              strokeWidth={1.2}
              rx={2}
            />
            <line
              x1={16}
              y1={48}
              x2={26}
              y2={32}
              stroke="#1e40af"
              strokeWidth={1.2}
            />
            <text x={40} y={43} fontSize={9} fill="#334155">
              {t.shift2dcCircuitBreaker}
            </text>

            <circle
              cx={22}
              cy={70}
              r={7}
              fill="white"
              stroke="#16a34a"
              strokeWidth={1.2}
            />
            <text
              x={22}
              y={73}
              textAnchor="middle"
              fontSize={7}
              fontWeight="bold"
              fill="#16a34a"
            >
              G
            </text>
            <text x={40} y={73} fontSize={9} fill="#334155">
              {t.shift2dcGenerator}
            </text>

            <rect x={130} y={30} width={12} height={8} fill="#22c55e" rx={2} />
            <text x={150} y={38} fontSize={8} fill="#334155">
              {t.shift2dcNormal}
            </text>

            <rect x={130} y={46} width={12} height={8} fill="#f97316" rx={2} />
            <text x={150} y={54} fontSize={8} fill="#334155">
              {t.shift2dcEmergency}
            </text>

            <rect x={130} y={62} width={12} height={8} fill="#0891b2" rx={2} />
            <text x={150} y={70} fontSize={8} fill="#334155">
              {t.shift2dcDemonstrator}
            </text>

            <rect x={130} y={78} width={12} height={8} fill="#1e3a8a" rx={2} />
            <text x={150} y={86} fontSize={8} fill="#334155">
              {t.shift2dcMain}
            </text>
          </g>

          <g transform={`translate(${W - 270}, ${topY + 40})`}>
            <rect
              x={0}
              y={0}
              width={200}
              height={90}
              fill="white"
              stroke="#1e3a8a"
              strokeWidth={1.5}
              rx={6}
            />
            <rect
              x={0}
              y={0}
              width={200}
              height={24}
              fill="#1e3a8a"
              rx={6}
            />
            <rect
              x={0}
              y={18}
              width={200}
              height={6}
              fill="#1e3a8a"
            />

            <text
              x={100}
              y={17}
              textAnchor="middle"
              fontSize={11}
              fontWeight="bold"
              fill="white"
            >
              {t.shift2dcSingleLineDiagram}
            </text>

            <text
              x={100}
              y={42}
              textAnchor="middle"
              fontSize={9}
              fill="#1e293b"
              fontWeight="600"
            >
              Funchal Port - SHIFT2DC
            </text>

            <text
              x={100}
              y={58}
              textAnchor="middle"
              fontSize={8}
              fill="#475569"
            >
              {t.shift2dcElectricalDistribution}
            </text>

            <text
              x={100}
              y={74}
              textAnchor="middle"
              fontSize={8}
              fill="#94a3b8"
            >
              v2.4 • 2024
            </text>
          </g>
        </svg>

        {selectedComponent && (
          <div className="absolute right-4 top-4 z-10 w-64 rounded-xl border bg-white p-4 shadow-2xl dark:bg-slate-800">
            <div className="mb-2 flex items-start justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white">
                {selectedComponent}
              </h4>

              <button
                onClick={() => setSelectedComponent(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t.shift2dcElectricalComponent}
            </p>
          </div>
        )}

        <div className="absolute bottom-4 left-4 rounded-lg border bg-white/95 px-4 py-2 text-sm text-slate-600 shadow-lg backdrop-blur">
          <span className="font-medium">{t.shift2dcControls}:</span>{' '}
          {t.shift2dcScrollZoom} • {t.shift2dcDragMove}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            label: 'QGED(N)',
            value: '14',
            desc: 'D1-D14',
            color: 'bg-green-500',
            bg: 'bg-green-50',
          },
          {
            label: 'QGED(E)',
            value: '17',
            desc: 'D15-D31',
            color: 'bg-orange-500',
            bg: 'bg-orange-50',
          },
          {
            label: t.shift2dcDemonstrator,
            value: '6',
            desc: t.shift2dcEquipment,
            color: 'bg-cyan-500',
            bg: 'bg-cyan-50',
          },
          {
            label: 'Total',
            value: '31',
            desc: t.shift2dcCircuitBreakers,
            color: 'bg-blue-500',
            bg: 'bg-blue-50',
          },
        ].map((stat, index) => (
          <div
            key={index}
            className={`${stat.bg} rounded-xl border border-slate-200 p-4`}
          >
            <div className="mb-1 flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${stat.color}`} />
              <span className="text-sm font-semibold text-slate-700">
                {stat.label}
              </span>
            </div>

            <div className="text-2xl font-bold text-slate-900">
              {stat.value}
            </div>

            <div className="text-xs text-slate-500">
              {stat.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}