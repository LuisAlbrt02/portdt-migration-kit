import {
  checkBoats,
} from '../services/boatMonitor.service';

let intervalHandle:
  NodeJS.Timeout | null = null;

let running = false;

async function runCheck(): Promise<void> {
  if (running) {
    console.warn(
      '[BOAT] Previous check still running; skipping cycle'
    );

    return;
  }

  running = true;

  try {
    await checkBoats();
  } catch (error) {
    console.error(
      '[BOAT] Geofence check failed:',
      error
    );
  } finally {
    running = false;
  }
}

export function startBoatGeofenceJob(): void {
  if (intervalHandle) {
    return;
  }

  const intervalMs =
    Math.max(
      10_000,
      Number(
        process.env.BOAT_POLL_INTERVAL_MS ||
          60_000
      )
    );

  console.log(
    `[BOAT] Monitor started every ${intervalMs} ms`
  );

  // First reading establishes the baseline.
  void runCheck();

  intervalHandle =
    setInterval(
      runCheck,
      intervalMs
    );
}

export function stopBoatGeofenceJob(): void {
  if (!intervalHandle) {
    return;
  }

  clearInterval(intervalHandle);
  intervalHandle = null;
}
