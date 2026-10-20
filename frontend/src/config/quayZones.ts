export type QuayZone = {
  id: string;
  name: string;
  coordinates: [number, number][];
  displayPosition: [number, number];
  displayHeading: number;
};

export const QUAY_ZONES: QuayZone[] = [
  {
    id: 'quay-1',
    name: 'Cais 1',
    coordinates: [
      [-16.915101, 32.641469],
      [-16.915272, 32.641966],
      [-16.910863, 32.642707],
      [-16.910766, 32.642101],
    ],
    displayPosition: [-16.9130005, 32.64206075],
    displayHeading: 79,
  },
  {
    id: 'quay-2',
    name: 'Cais 2',
    coordinates: [
      [-16.910455, 32.642111],
      [-16.910530, 32.642653],
      [-16.906990, 32.642662],
      [-16.906928, 32.642091],
    ],
    displayPosition: [-16.90872575, 32.64237925],
    displayHeading: 90,
  },
  {
    id: 'quay-3',
    name: 'Cais 3',
    coordinates: [
      [-16.915151, 32.642631],
      [-16.914808, 32.642225],
      [-16.912576, 32.643643],
      [-16.912919, 32.644004],
    ],
    displayPosition: [-16.9138635, 32.64312575],
    displayHeading: 53,
  },
];
