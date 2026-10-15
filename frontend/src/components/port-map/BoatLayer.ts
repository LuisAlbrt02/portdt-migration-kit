import { ScatterplotLayer } from '@deck.gl/layers';

import type { Boat } from '../../types/Boat';

export function createBoatLayers(boats: Boat[]) {
  const visibleBoats = boats.filter(
    (boat) =>
      boat.positionFresh &&
      boat.insidePortZone
  );

  if (!visibleBoats.length) {
    return [];
  }

  return [
    new ScatterplotLayer<Boat>({
      id: 'boats',
      data: visibleBoats,

      getPosition: (boat) => [
        boat.longitude,
        boat.latitude,
        8,
      ],

      getRadius: 15,
      radiusUnits: 'meters',

      getFillColor: [30, 144, 255, 220],
      getLineColor: [255, 255, 255, 255],

      stroked: true,
      filled: true,

      lineWidthMinPixels: 2,

      pickable: true,
    }),
  ];
}