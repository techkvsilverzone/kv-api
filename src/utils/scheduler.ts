import Logger from './logger';
import { msUntilNextDailyIST } from './time';

export interface ScheduledJob {
  stop: () => void;
}

/**
 * Run `task` every day at `hour:minute` IST (#25 cron, no external dependency).
 *
 * Uses a self-rescheduling timer rather than a fixed 24h interval so a single
 * missed/clock-drifted tick cannot permanently shift the run time. The timer is
 * `unref()`-ed so it never keeps the process alive on its own.
 */
export function scheduleDailyIST(
  hour: number,
  minute: number,
  task: () => Promise<void> | void,
  label = 'daily-job',
): ScheduledJob {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const scheduleNext = (): void => {
    if (stopped) return;
    const delay = msUntilNextDailyIST(hour, minute);
    const mins = Math.round(delay / 60_000);
    Logger.info(`[scheduler] "${label}" next run in ~${mins} min (at ${hour}:${String(minute).padStart(2, '0')} IST)`);

    timer = setTimeout(async () => {
      try {
        await task();
      } catch (error) {
        Logger.error(`[scheduler] "${label}" failed: ${String(error)}`);
      } finally {
        scheduleNext();
      }
    }, delay);

    // Do not let the timer hold the event loop open by itself.
    if (typeof timer.unref === 'function') timer.unref();
  };

  scheduleNext();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
