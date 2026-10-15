import {
  getLatestBoatPositions,
} from './boat.service';

import {
  isInsidePortGeofence,
} from './boatGeofence.service';

import {
  handleBoatArrivalForLights,
} from './lights.service';

import type {
  BoatMonitorState,
  BoatPosition,
} from '../types/boat';

const boatStates =
  new Map<number, BoatMonitorState>();

let lastPollAt: string | null = null;

function confirmationsRequired(): number {
  return Math.max(
    1,
    Number(
      process.env.BOAT_GEOFENCE_CONFIRMATIONS ||
        3
    )
  );
}

function staleAfterMs(): number {
  return Math.max(
    1_000,
    Number(
      process.env.BOAT_POSITION_STALE_MS ||
        300_000
    )
  );
}

function isPositionFresh(
  position: BoatPosition,
  nowMs: number
): boolean {
  return (
    nowMs -
      new Date(position.timestamp).getTime() <=
    staleAfterMs()
  );
}

function createInitialState(
  position: BoatPosition,
  inside: boolean,
  fresh: boolean
): BoatMonitorState {
  return {
    ...position,
    status: fresh
      ? inside
        ? 'inside'
        : 'outside'
      : 'stale',
    insidePortZone: inside,
    positionFresh: fresh,
    insideConfirmations: 0,
    outsideConfirmations: 0,
  };
}

async function processPosition(
  position: BoatPosition,
  nowMs: number
): Promise<void> {
  const fresh =
    isPositionFresh(position, nowMs);

  const inside =
    isInsidePortGeofence(
      position.latitude,
      position.longitude
    );

  const previous =
    boatStates.get(position.deviceId);

  /**
   * First observation only establishes the baseline.
   * This avoids a fake ARRIVAL after a backend restart
   * when a boat was already inside the area.
   */
  if (!previous) {
    boatStates.set(
      position.deviceId,
      createInitialState(
        position,
        inside,
        fresh
      )
    );

    return;
  }

  const next: BoatMonitorState = {
    ...previous,
    ...position,
    positionFresh: fresh,
  };

  if (!fresh) {
    next.status = 'stale';
    next.insideConfirmations = 0;
    next.outsideConfirmations = 0;

    boatStates.set(position.deviceId, next);
    return;
  }

  /**
   * The new reading agrees with the already-confirmed
   * side of the geofence.
   */
  if (
    inside === previous.insidePortZone
  ) {
    next.status =
      inside ? 'inside' : 'outside';

    next.insideConfirmations = 0;
    next.outsideConfirmations = 0;

    boatStates.set(position.deviceId, next);
    return;
  }

  const required =
    confirmationsRequired();

  /**
   * OUTSIDE -> ENTERING -> INSIDE
   */
  if (inside) {
    next.status = 'entering';

    next.insideConfirmations =
      previous.insideConfirmations + 1;

    next.outsideConfirmations = 0;

    if (
      next.insideConfirmations >=
      required
    ) {
      next.status = 'inside';
      next.insidePortZone = true;
      next.insideConfirmations = 0;
      next.enteredAt =
        new Date().toISOString();

      boatStates.set(
        position.deviceId,
        next
      );

      console.log(
        `[BOAT] ARRIVAL: ${next.name}`
      );

      await handleBoatArrivalForLights(next);
      return;
    }
  }

  /**
   * INSIDE -> LEAVING -> OUTSIDE
   */
  else {
    next.status = 'leaving';

    next.outsideConfirmations =
      previous.outsideConfirmations + 1;

    next.insideConfirmations = 0;

    if (
      next.outsideConfirmations >=
      required
    ) {
      next.status = 'outside';
      next.insidePortZone = false;
      next.outsideConfirmations = 0;
      next.exitedAt =
        new Date().toISOString();

      console.log(
        `[BOAT] DEPARTURE: ${next.name}`
      );
    }
  }

  boatStates.set(
    position.deviceId,
    next
  );
}

export async function checkBoats(): Promise<void> {
  const now = new Date();
  const nowMs = now.getTime();

  const positions =
    await getLatestBoatPositions();

  const seenIds =
    new Set<number>();

  for (const position of positions) {
    seenIds.add(position.deviceId);

    await processPosition(
      position,
      nowMs
    );
  }

  /**
   * A boat can disappear entirely from the lookback query.
   * Do not leave an old position marked as live forever.
   */
  for (const [deviceId, state] of boatStates) {
    if (seenIds.has(deviceId)) {
      continue;
    }

    const age =
      nowMs -
      new Date(state.timestamp).getTime();

    if (age > staleAfterMs()) {
      boatStates.set(
        deviceId,
        {
          ...state,
          status: 'stale',
          positionFresh: false,
          insideConfirmations: 0,
          outsideConfirmations: 0,
        }
      );
    }
  }

  lastPollAt =
    now.toISOString();
}

export function getBoatSnapshot(): BoatMonitorState[] {
  return [
    ...boatStates.values(),
  ].sort(
    (a, b) =>
      a.name.localeCompare(b.name)
  );
}

export function getBoatMonitorLastPoll(): string | null {
  return lastPollAt;
}
