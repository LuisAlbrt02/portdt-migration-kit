import { ArcLayer, ColumnLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { EnergyData } from '../../types/EnergyData';
import { PORT_CENTER, PORT_DESTINATIONS, PORT_LOCATIONS } from '../../config/portMap';

type RGBA = [number, number, number, number];

function getTotalPower(data: EnergyData): number {
  return (data.L1?.P || 0) + (data.L2?.P || 0) + (data.L3?.P || 0);
}

function getInfrastructureColor(id: string): RGBA {
  if (id.includes('crane')) return [255, 140, 0, 220];
  if (id.includes('shore-power')) return [0, 255, 100, 220];
  if (id.includes('lighting')) return [255, 255, 100, 220];
  if (id.includes('administrative')) return [100, 150, 255, 220];
  return [200, 100, 255, 220];
}

export function createPowerLayers(selectedData: EnergyData | null, animationTime: number) {
  if (!selectedData) return [];

  const mainDock = PORT_LOCATIONS[0];
  const totalPower = getTotalPower(selectedData);

  const column = new ColumnLayer({
    id: 'power-column',
    data: [{ ...mainDock, power: totalPower }],
    diskResolution: 12,
    radius: 15,
    extruded: true,
    pickable: true,
    elevationScale: 0.1,
    getPosition: (item) => [item.longitude, item.latitude, item.elevation],
    getFillColor: (item) => {
      const normalized = item.power / 30_000;
      return [
        255 * Math.min(1, normalized * 1.2),
        50 + 150 * (1 - normalized * 0.5),
        255 * (1 - normalized * 0.8),
        240,
      ];
    },
    getElevation: (item) => Math.max(50, item.power * 0.01),
  });

  const mainMarker = new ScatterplotLayer({
    id: 'main-dock-marker',
    data: [{ ...mainDock, totalPower }],
    pickable: true,
    stroked: true,
    filled: true,
    radiusScale: 10,
    radiusMinPixels: 12,
    radiusMaxPixels: 25,
    lineWidthMinPixels: 3,
    getPosition: (item) => [item.longitude, item.latitude, 0],
    getRadius: (item) => 8 + item.totalPower / 3000,
    getFillColor: [0, 200, 255, 240],
    getLineColor: [255, 200, 0, 255],
  });

  const infrastructure = new ScatterplotLayer({
    id: 'infrastructure-markers',
    data: PORT_DESTINATIONS.slice(1),
    pickable: true,
    stroked: true,
    filled: true,
    radiusScale: 6,
    radiusMinPixels: 6,
    radiusMaxPixels: 15,
    lineWidthMinPixels: 2,
    getPosition: (item) => [item.longitude, item.latitude, 0],
    getRadius: (item) =>
      item.id.includes('crane')
        ? 8
        : item.id.includes('shore-power')
          ? 7
          : item.id.includes('lighting')
            ? 5
            : 6,
    getFillColor: (item) => getInfrastructureColor(item.id),
    getLineColor: [255, 255, 255, 255],
  });

  const centerMarker = new ScatterplotLayer({
    id: 'center-marker',
    data: [PORT_CENTER],
    pickable: true,
    stroked: true,
    filled: true,
    radiusScale: 15,
    radiusMinPixels: 15,
    radiusMaxPixels: 30,
    lineWidthMinPixels: 4,
    getPosition: (item) => [item.longitude, item.latitude, 0],
    getRadius: 12,
    getFillColor: [255, 215, 0, 255],
    getLineColor: [255, 100, 0, 255],
  });

  const phases = [selectedData.L1?.P || 0, selectedData.L2?.P || 0, selectedData.L3?.P || 0];

  const lineData = PORT_DESTINATIONS.map((destination, index) => {
    const phasePower = phases[index % 3];
    let factor = 0.2;

    if (destination.id.includes('crane')) factor = 0.4;
    else if (destination.id.includes('shore-power')) factor = 0.3;
    else if (destination.id.includes('lighting')) factor = 0.1;
    else if (destination.id.includes('administrative')) factor = 0.15;

    const power = phasePower * factor;

    return {
      destination,
      power,
      normalizedPower: Math.min(1, Math.abs(power) / 10_000),
      color: getInfrastructureColor(destination.id),
    };
  });

  const arcs = new ArcLayer({
    id: 'power-arcs',
    data: lineData,
    getSourcePosition: () => [PORT_CENTER.longitude, PORT_CENTER.latitude],
    getTargetPosition: (item) => [item.destination.longitude, item.destination.latitude],
    getSourceColor: [255, 215, 0, 255],
    getTargetColor: (item) => item.color,
    getWidth: (item) => Math.max(2, 2 + item.normalizedPower * 6),
    getTilt: (item) => 10 + item.normalizedPower * 20,
    getHeight: (item) => 0.2 + item.normalizedPower * 0.6,
    greatCircle: false,
    widthUnits: 'pixels',
    pickable: true,
  });

  const particlesData = lineData.flatMap((line) =>
    Array.from({ length: 12 }, (_, index) => {
      const speed = 0.5 + line.normalizedPower * 0.5;
      const progress = (animationTime * speed + index * 0.083) % 1;

      return {
        position: [
          PORT_CENTER.longitude +
            (line.destination.longitude - PORT_CENTER.longitude) * progress,
          PORT_CENTER.latitude +
            (line.destination.latitude - PORT_CENTER.latitude) * progress,
        ],
        color: line.color,
        normalizedPower: line.normalizedPower,
        index,
      };
    })
  );

  const particles = new ScatterplotLayer({
    id: 'power-particles',
    data: particlesData,
    pickable: false,
    stroked: true,
    filled: true,
    radiusScale: 6,
    radiusMinPixels: 3,
    radiusMaxPixels: 10,
    lineWidthMinPixels: 1,
    getPosition: (item) => item.position,
    getRadius: (item) => 2 + item.normalizedPower * 4,
    getFillColor: (item) => {
      const pulse =
        200 + 55 * Math.sin((animationTime * 2 + item.index * 0.5) * Math.PI);

      return [item.color[0], item.color[1], item.color[2], pulse];
    },
    getLineColor: [255, 255, 255, 150],
  });

  return [column, mainMarker, infrastructure, centerMarker, arcs, particles];
}
