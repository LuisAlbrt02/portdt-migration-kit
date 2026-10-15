import {
  PORT_GEOFENCE,
  PORT_GEOFENCE_NAME,
  type Coordinate,
} from '../config/portGeofence';

import type {
  GeofenceResponse,
} from '../types/boat';

const EPSILON = 1e-10;

function pointOnSegment(
  point: Coordinate,
  a: Coordinate,
  b: Coordinate
): boolean {
  const [px, py] = point;
  const [ax, ay] = a;
  const [bx, by] = b;

  const cross =
    (px - ax) * (by - ay) -
    (py - ay) * (bx - ax);

  if (Math.abs(cross) > EPSILON) {
    return false;
  }

  const dot =
    (px - ax) * (bx - ax) +
    (py - ay) * (by - ay);

  if (dot < 0) {
    return false;
  }

  const squaredLength =
    (bx - ax) ** 2 +
    (by - ay) ** 2;

  return dot <= squaredLength;
}

export function isInsidePortGeofence(
  latitude: number,
  longitude: number
): boolean {
  const polygon =
    PORT_GEOFENCE.coordinates[0];

  const point: Coordinate = [
    longitude,
    latitude,
  ];

  // Border is considered inside.
  for (
    let index = 0;
    index < polygon.length - 1;
    index += 1
  ) {
    if (
      pointOnSegment(
        point,
        polygon[index],
        polygon[index + 1]
      )
    ) {
      return true;
    }
  }

  // Ray casting.
  let inside = false;

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersects =
      yi > latitude !== yj > latitude &&
      longitude <
        ((xj - xi) * (latitude - yi)) /
          (yj - yi) +
          xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function getPortGeofence(): GeofenceResponse {
  return {
    name: PORT_GEOFENCE_NAME,
    type: PORT_GEOFENCE.type,
    coordinates: PORT_GEOFENCE.coordinates,
  };
}
