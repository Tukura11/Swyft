import { CacheService } from '../cache/cache.service';
import { LAST_INDEXED_LEDGER_KEY } from '../metrics/indexer-monitor.service';
import { PoolsService } from '../pools/pools.service';
import { PriceService } from '../price/price.service';
import { HorizonService } from './horizon.service';

describe('HorizonService ledger checkpoint', () => {
  const priceService = { broadcastPrice: jest.fn() };
  const poolsService = { handlePoolStateUpdate: jest.fn() };
  const cache = {
    publish: jest.fn().mockResolvedValue(undefined),
    setMaxNumber: jest.fn().mockResolvedValue(true),
  };

  beforeEach(() => jest.clearAllMocks());

  it('writes the ledger checkpoint only after processing an effect', async () => {
    const service = new HorizonService(
      priceService as unknown as PriceService,
      poolsService as unknown as PoolsService,
      cache as unknown as CacheService,
    );
    const call = jest.fn().mockResolvedValue({
      records: [
        {
          paging_token: 'cursor-1',
          ledger: 900,
          amount: '1.25',
          created_at: '2026-06-24T12:00:00.000Z',
        },
      ],
    });
    (service as any).server = {
      effects: () => ({
        forAccount: () => ({
          cursor: () => ({ order: () => ({ limit: () => ({ call }) }) }),
        }),
      }),
    };

    await (service as any).poll();

    expect(poolsService.handlePoolStateUpdate).toHaveBeenCalled();
    expect(cache.setMaxNumber).toHaveBeenCalledWith(
      LAST_INDEXED_LEDGER_KEY,
      900,
    );
  });

  it('does not write a checkpoint for an invalid ledger', async () => {
    const service = new HorizonService(
      priceService as unknown as PriceService,
      poolsService as unknown as PoolsService,
      cache as unknown as CacheService,
    );
    const call = jest.fn().mockResolvedValue({
      records: [
        {
          paging_token: 'cursor-2',
          ledger: -1,
          created_at: '2026-06-24T12:00:00.000Z',
        },
      ],
    });
    (service as any).server = {
      effects: () => ({
        forAccount: () => ({
          cursor: () => ({ order: () => ({ limit: () => ({ call }) }) }),
        }),
      }),
    };

    await (service as any).poll();

    expect(cache.setMaxNumber).not.toHaveBeenCalled();
  });
});
