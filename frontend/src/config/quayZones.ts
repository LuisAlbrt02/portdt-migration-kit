
export type QuayDisplayPosition = {
  position: [number, number];
  heading: number;
};

export type QuayZone = {
  id: string;
  name: string;
  coordinates: [number, number][];
  berthStart: [number, number];
  berthEnd: [number, number];
  berthOffsetMeters: number;
  bowDirection: 'start' | 'end';
  displayPositions: {
    single: QuayDisplayPosition;
    first: QuayDisplayPosition;
    second: QuayDisplayPosition;
  };
};

type QuayDefinition = Omit<QuayZone, 'displayPositions'>;

function calculateHeading(start: [number, number], end: [number, number]): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const lat1 = toRad(start[1]);
  const lat2 = toRad(end[1]);
  const deltaLon = toRad(end[0] - start[0]);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function getDisplayPosition(quay: QuayDefinition, ratio: number): [number, number] {
  const longitude = quay.berthStart[0] + (quay.berthEnd[0] - quay.berthStart[0]) * ratio;
  const latitude = quay.berthStart[1] + (quay.berthEnd[1] - quay.berthStart[1]) * ratio;
  const heading = calculateHeading(quay.berthStart, quay.berthEnd);
  const radians = (heading - 90) * Math.PI / 180;
  const offset = quay.berthOffsetMeters;

  return [
    longitude + (offset * Math.sin(radians)) / (111320 * Math.cos(latitude * Math.PI / 180)),
    latitude + (offset * Math.cos(radians)) / 111320,
  ];
}

function createQuay(quay: QuayDefinition): QuayZone {
  const quayHeading = calculateHeading(quay.berthStart, quay.berthEnd);

  // Modelo 3D: orientación visual calibrada con el offset de BoatLayer.tsx.
  // Si la proa aparece invertida, cambia MODEL_ROTATION_OFFSET en BoatLayer
  // o ajusta la conversión de heading de manera consistente.
  const headingToStart = (quayHeading + 180) % 360;
  const headingToEnd = quayHeading;

  const singleToStart = quay.bowDirection === 'start';

  return {
    ...quay,
    displayPositions: {
      single: {
        position: getDisplayPosition(quay, singleToStart ? 0.25 : 0.75),
        heading: singleToStart ? headingToStart : headingToEnd,
      },
      first: {
        position: getDisplayPosition(quay, 0.25),
        heading: headingToStart,
      },
      second: {
        position: getDisplayPosition(quay, 0.75),
        heading: headingToEnd,
      },
    },
  };
}

export const QUAY_ZONES: QuayZone[] = [
  createQuay({
    id: 'quay-1', name: 'Cais 1',
    coordinates: [
      [-16.916641, 32.641257], [-16.916709, 32.641679],
      [-16.914872, 32.641980], [-16.914725, 32.641500],
    ],
    berthStart: [-16.914725, 32.641500],
    berthEnd: [-16.916641, 32.641257],
    berthOffsetMeters: -10,
    bowDirection: 'start',
  }),
  createQuay({
    id: 'quay-2', name: 'Cais 2',
    coordinates: [
      [-16.914638, 32.641500], [-16.914740, 32.642000],
      [-16.910773, 32.642707], [-16.910716, 32.642101],
    ],
    berthStart: [-16.910716, 32.642101],
    berthEnd: [-16.914638, 32.641500],
    berthOffsetMeters: -10,
    bowDirection: 'start',
  }),
  createQuay({
    id: 'quay-3', name: 'Cais 3',
    coordinates: [
      [-16.910455, 32.642111], [-16.910530, 32.642753],
      [-16.906950, 32.642722], [-16.906928, 32.642091],
    ],
    berthStart: [-16.906928, 32.642091],
    berthEnd: [-16.910455, 32.642111],
    berthOffsetMeters: -15,
    bowDirection: 'start',
  }),
  createQuay({
    id: 'quay-6', name: 'Cais 6',
    coordinates: [
      [-16.915151, 32.642631], [-16.914808, 32.642225],
      [-16.912576, 32.643643], [-16.912919, 32.644004],
    ],
    berthStart: [-16.912919, 32.644004],
    berthEnd: [-16.915151, 32.642631],
    berthOffsetMeters: 30,
    bowDirection: 'start',
  }),
];

export function getQuayById(quayId: string): QuayZone | undefined {
  return QUAY_ZONES.find(quay => quay.id === quayId);
}

export function getQuayDisplayPositions(quay: QuayZone): QuayZone['displayPositions'] {
  return quay.displayPositions;
}
