
import type { Layer } from '@deck.gl/core';
import { PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { QuayZone } from '../../config/quayZones';

type QuaySlot = 'single' | 'first' | 'second';
type DisplayPosition = { position: [number, number]; heading: number };
type QuayWithDisplayPositions = QuayZone & {
  displayPositions?: Partial<Record<QuaySlot, DisplayPosition>>;
};

function getPolygonCenter(coordinates: [number, number][]): [number, number] {
  const total = coordinates.reduce((sum, [longitude, latitude]) => {
    sum.longitude += longitude;
    sum.latitude += latitude;
    return sum;
  }, { longitude: 0, latitude: 0 });

  return [
    total.longitude / coordinates.length,
    total.latitude / coordinates.length,
  ];
}

export function createQuayLayers(quays: QuayZone[], labelPrefix: string): Layer[] {
  const polygonLayer = new PolygonLayer<QuayZone>({
    id: 'quay-zones',
    data: quays,
    getPolygon: quay => quay.coordinates,
    getFillColor: () => [245, 158, 11, 25],
    getLineColor: () => [245, 158, 11, 230],
    getLineWidth: 1.5,
    lineWidthUnits: 'meters',
    stroked: true,
    filled: true,
    pickable: false,
  });

  const labelLayer = new TextLayer<QuayZone>({
    id: 'quay-labels',
    data: quays,
    getPosition: quay => [...getPolygonCenter(quay.coordinates), 1],
    getText: quay => {
      const number = quay.name.match(/\d+/)?.[0] ?? '';
      return `${labelPrefix} ${number}`;
    },
    getSize: 15,
    sizeUnits: 'meters',
    getColor: () => [180, 110, 0, 255],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    getAngle: 0,
    billboard: false,
    fontFamily: 'Arial, sans-serif',
    fontWeight: 500,
    pickable: false,
    updateTriggers: { getText: [labelPrefix] },
  });

  const SHOW_BERTH_POSITIONS = false;

  if (!SHOW_BERTH_POSITIONS) return [polygonLayer, labelLayer];

  const slotNames: QuaySlot[] = ['single', 'first', 'second'];
  const slotData = (quays as QuayWithDisplayPositions[]).flatMap(quay =>
    slotNames.flatMap(slot => {
      const position = quay.displayPositions?.[slot];
      return position ? [{ quayId: quay.id, slot, ...position }] : [];
    })
  );

  const slotLayer = new ScatterplotLayer<(typeof slotData)[number]>({
    id: 'quay-display-positions',
    data: slotData,
    getPosition: item => [...item.position, 3],
    getRadius: 5,
    radiusUnits: 'meters',
    getFillColor: item =>
      item.slot === 'single' ? [34, 197, 94, 220] :
      item.slot === 'first' ? [59, 130, 246, 220] :
      [239, 68, 68, 220],
    stroked: true,
    getLineColor: [255, 255, 255, 255],
    getLineWidth: 1,
    lineWidthUnits: 'meters',
    pickable: false,
  });

  const slotLabelLayer = new TextLayer<(typeof slotData)[number]>({
    id: 'quay-display-position-labels',
    data: slotData,
    getPosition: item => [...item.position, 4],
    getText: item =>
      item.slot === 'single' ? 'S' : item.slot === 'first' ? '1' : '2',
    getSize: 12,
    sizeUnits: 'meters',
    getColor: [255, 255, 255, 255],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    billboard: true,
    pickable: false,
  });

  return [polygonLayer, labelLayer, slotLayer, slotLabelLayer];
}
