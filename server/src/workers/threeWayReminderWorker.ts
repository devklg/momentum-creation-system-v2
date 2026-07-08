import { processDueThreeWayReminders } from '../domain/threeWayCalls.js';

const TICK_MS = 60_000;
let started = false;

export function startThreeWayReminderWorker(): void {
  if (started) return;
  started = true;

  async function tick(): Promise<void> {
    try {
      const result = await processDueThreeWayReminders();
      if (result.scanned > 0) {
        console.log(
          `[threeWayReminderWorker] scanned=${result.scanned} fired=${result.fired}`,
        );
      }
    } catch (err) {
      console.error('[threeWayReminderWorker] tick failed', err);
    }
  }

  void tick();
  setInterval(() => void tick(), TICK_MS).unref?.();
}
