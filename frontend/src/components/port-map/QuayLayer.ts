import type { Layer } from '@deck.gl/core';
import { PolygonLayer, TextLayer } from '@deck.gl/layers';
import type { QuayZone } from '../../config/quayZones';

function getPolygonCenter(
  coordinates: [number, number][]
): [number, number] {
  const total = coordinates.reduce(
    (sum, [longitude, latitude]) => {
      sum.longitude += longitude;
      sum.latitude += latitude;
      return sum;
    },
    { longitude: 0, latitude: 0 }
  );

  return [
    total.longitude / coordinates.length,
    total.latitude / coordinates.length,
  ];
}

export function createQuayLayers(
  quays: QuayZone[],
  labelPrefix: string
): Layer[] {
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

    getPosition: quay => {
      const [longitude, latitude] =
        getPolygonCenter(quay.coordinates);

      return [
        longitude,
        latitude,
        1,
      ];
    },

    getText: quay => {
      const number =
        quay.name.match(/\d+/)?.[0] ?? '';

      return `${labelPrefix} ${number}`;
    },

    getSize: 15,
    sizeUnits: 'meters',

    getColor: () => [
      180,
      110,
      0,
      255,
    ],

    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    getAngle: 0,

    billboard: false,

    fontFamily: 'Arial, sans-serif',
    fontWeight: 500,
    pickable: false,
    updateTriggers: {
      getText: [labelPrefix],
    },
  });

  return [
    polygonLayer,
    labelLayer,
  ];
}