export type Coordinate = [longitude: number, latitude: number];

export const PORT_GEOFENCE_NAME = 'Funchal Port Arrival Zone';

export const PORT_GEOFENCE = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-16.917314, 32.635758],
      [-16.898262, 32.638126],
      [-16.897486, 32.646540], 
      [-16.915438, 32.644574],
      //Close the polygon
      [-16.917314, 32.635758],
    ] satisfies Coordinate[],
  ],
};
