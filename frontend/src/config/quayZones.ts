export type QuayZone = {
  id: string;
  name: string;
  coordinates: [number, number][];
  berthStart: [number, number];
  berthEnd: [number, number];
  berthOffsetMeters: number;
};
export const QUAY_ZONES: QuayZone[] = [
  {
    id: 'quay-1', name: 'Cais 1',
    coordinates: [
      [-16.916641, 32.641257], [-16.916709, 32.641679],
      [-16.914872, 32.641980], [-16.914725, 32.641500],
    ],
    berthStart: [-16.914725, 32.641500],
    berthEnd: [-16.916641, 32.641257],
    berthOffsetMeters: -10,
  },
  {
    id: 'quay-2', name: 'Cais 2',
    coordinates: [
      [-16.914638, 32.641500], [-16.914740, 32.642000],
      [-16.910773, 32.642707], [-16.910716, 32.642101],
    ],
    berthStart: [-16.910716, 32.642101],
    berthEnd: [-16.914638, 32.641500],
    berthOffsetMeters: -30,
  },
  {
    id: 'quay-3', name: 'Cais 3',
    coordinates: [
      [-16.910455, 32.642111], [-16.910530, 32.642753],
      [-16.906950, 32.642722], [-16.906928, 32.642091],
    ],
    berthStart: [-16.906928, 32.642091],
    berthEnd: [-16.910455, 32.642111],
    berthOffsetMeters: -15,
  },
  {
    id: 'quay-6', name: 'Cais 6',
    coordinates: [
      [-16.915151, 32.642631], [-16.914808, 32.642225],
      [-16.912576, 32.643643], [-16.912919, 32.644004],
    ],
    berthStart: [-16.912919, 32.644004],
    berthEnd: [-16.915151, 32.642631],
    berthOffsetMeters: 5,
  },
];
export function getQuayById(quayId: string): QuayZone | undefined {
  return QUAY_ZONES.find(quay => quay.id === quayId);
}
