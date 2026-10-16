import { rankPools, type RankablePool } from './pool-ranking.util';

describe('pool-ranking.util', () => {
  const pool = (
    poolId: string,
    volume24h: string,
    liquidity: string,
  ): RankablePool => ({ poolId, volume24h, liquidity });

  it('returns an empty result for empty input without throwing', () => {
    expect(rankPools([])).toEqual([]);
  });

  it('returns a single pool unchanged', () => {
    const only = pool('pool-1', '1000', '500');

    expect(rankPools([only])).toEqual([only]);
  });

  it('orders pools by volume descending, then liquidity descending', () => {
    const low = pool('pool-low', '100', '900');
    const high = pool('pool-high', '5000', '100');
    const mid = pool('pool-mid', '1000', '400');

    expect(rankPools([low, high, mid]).map((p) => p.poolId)).toEqual([
      'pool-high',
      'pool-mid',
      'pool-low',
    ]);
  });

  it('breaks equal-volume ties by liquidity descending', () => {
    const thin = pool('pool-thin', '1000', '10');
    const deep = pool('pool-deep', '1000', '900');

    expect(rankPools([thin, deep]).map((p) => p.poolId)).toEqual([
      'pool-deep',
      'pool-thin',
    ]);
  });

  it('breaks fully equal scores deterministically by pool id ascending', () => {
    const b = pool('pool-b', '1000', '500');
    const a = pool('pool-a', '1000', '500');
    const c = pool('pool-c', '1000', '500');

    expect(rankPools([b, a, c]).map((p) => p.poolId)).toEqual([
      'pool-a',
      'pool-b',
      'pool-c',
    ]);
    // Ordering is stable regardless of input order.
    expect(rankPools([c, b, a]).map((p) => p.poolId)).toEqual([
      'pool-a',
      'pool-b',
      'pool-c',
    ]);
  });

  it('treats missing or unparseable volume and liquidity as zero', () => {
    const empty = pool('pool-empty', '', '');
    const real = pool('pool-real', '10', '5');

    expect(rankPools([empty, real]).map((p) => p.poolId)).toEqual([
      'pool-real',
      'pool-empty',
    ]);
  });
});
