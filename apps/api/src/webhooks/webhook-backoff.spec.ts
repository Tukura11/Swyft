import {
  WEBHOOK_RETRY_ATTEMPTS,
  WEBHOOK_RETRY_BACKOFF_MS,
  webhookBackoffDelayMs,
  webhookBackoffSchedule,
} from './webhook-backoff';

describe('webhookBackoffDelayMs', () => {
  it('returns null for attempt 0 (below the 1-based range)', () => {
    expect(webhookBackoffDelayMs(0)).toBeNull();
  });

  it('returns 0 for attempt 1 (runs immediately)', () => {
    expect(webhookBackoffDelayMs(1)).toBe(0);
  });

  it('returns baseDelayMs for attempt 2', () => {
    expect(webhookBackoffDelayMs(2, 2000, 5)).toBe(2000);
  });

  it('doubles the delay for each subsequent attempt', () => {
    expect(webhookBackoffDelayMs(3, 2000, 5)).toBe(4000);
    expect(webhookBackoffDelayMs(4, 2000, 5)).toBe(8000);
  });

  it('returns null for an attempt beyond the configured maximum', () => {
    expect(webhookBackoffDelayMs(4, 2000, 3)).toBeNull();
    expect(webhookBackoffDelayMs(WEBHOOK_RETRY_ATTEMPTS + 1)).toBeNull();
  });

  it('uses the configured defaults when no arguments are supplied', () => {
    expect(webhookBackoffDelayMs(1)).toBe(0);
    expect(webhookBackoffDelayMs(2)).toBe(WEBHOOK_RETRY_BACKOFF_MS);
  });
});

describe('webhookBackoffSchedule', () => {
  it('produces one entry per attempt up to the maximum', () => {
    expect(webhookBackoffSchedule(2000, 3)).toEqual([0, 2000, 4000]);
  });

  it('is non-decreasing across increasing attempts', () => {
    const schedule = webhookBackoffSchedule(2000, 5);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i]).toBeGreaterThanOrEqual(schedule[i - 1]);
    }
  });

  it('never exceeds the cap implied by the maximum attempt', () => {
    const baseDelayMs = 2000;
    const maxAttempts = 4;
    const cap = baseDelayMs * 2 ** (maxAttempts - 2);
    const schedule = webhookBackoffSchedule(baseDelayMs, maxAttempts);
    for (const delay of schedule) {
      expect(delay).toBeLessThanOrEqual(cap);
    }
  });

  it('does not throw for a single-attempt schedule', () => {
    expect(webhookBackoffSchedule(2000, 1)).toEqual([0]);
  });
});
