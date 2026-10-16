import {
  calculateSwapFeesUsd,
  calculateSwapVolumeUsd,
  isInHalfOpenWindow,
  SwapAmounts,
} from './volume-metrics';

describe('isInHalfOpenWindow', () => {
  const start = new Date('2024-01-01T00:00:00.000Z');
  const end = new Date('2024-01-02T00:00:00.000Z');

  it('includes a swap timestamped exactly on the window start boundary', () => {
    expect(isInHalfOpenWindow(new Date(start.getTime()), start, end)).toBe(
      true,
    );
  });

  it('excludes a swap timestamped exactly on the window end boundary', () => {
    expect(isInHalfOpenWindow(new Date(end.getTime()), start, end)).toBe(false);
  });

  it('excludes a swap just before the window start', () => {
    expect(isInHalfOpenWindow(new Date(start.getTime() - 1), start, end)).toBe(
      false,
    );
  });

  it('excludes a swap just after the window end', () => {
    expect(isInHalfOpenWindow(new Date(end.getTime() + 1), start, end)).toBe(
      false,
    );
  });

  it('includes a swap strictly inside the window', () => {
    const inside = new Date(start.getTime() + 1);
    expect(isInHalfOpenWindow(inside, start, end)).toBe(true);
  });

  it('returns false for an invalid timestamp', () => {
    expect(isInHalfOpenWindow(new Date('invalid'), start, end)).toBe(false);
  });
});

describe('calculateSwapVolumeUsd', () => {
  const swap: SwapAmounts = {
    amount0: '1000000',
    amount1: '2000000',
  };

  it('sums the USD value of both swap amounts', () => {
    expect(calculateSwapVolumeUsd(swap, 6, 6, 1, 0.5)).toBe(2);
  });

  it('returns zero for an empty swap', () => {
    expect(
      calculateSwapVolumeUsd({ amount0: '0', amount1: '0' }, 6, 6, 1, 1),
    ).toBe(0);
  });
});

describe('calculateSwapFeesUsd', () => {
  it('converts a raw fee amount to USD', () => {
    expect(calculateSwapFeesUsd('1000000', 6, 2)).toBe(2);
  });

  it('returns zero for an empty fee amount', () => {
    expect(calculateSwapFeesUsd('0', 6, 2)).toBe(0);
  });
});
