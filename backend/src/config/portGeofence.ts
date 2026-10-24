
export type Coordinate = [longitude: number, latitude: number];

export const PORT_GEOFENCE_NAME = 'Funchal Port Arrival Zone';

export const PORT_GEOFENCE = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-16.916658, 32.641251],
      [-16.916812, 32.642266],
      [-16.915174, 32.642622],
      [-16.912939, 32.644022],
      [-16.905874, 32.645457],
      [-16.888887, 32.645784],
      [-16.888662, 32.634167],
      [-16.915702, 32.631761],
      [-16.917044, 32.640874],  
      // Close the polygon
      [-16.916658, 32.641251],
    ] satisfies Coordinate[],
  ],
};
