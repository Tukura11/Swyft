/**
 * Tests for the bounded counter used by observability code.
 *
 * A bounded counter caps memory growth under high-cardinality input by
 * evicting the least-recently-used key once capacity is exceeded. These
 * tests assert that contract: increments accumulate, the size never
 * exceeds capacity, and eviction follows the documented LRU policy.
 */

import { BoundedCounter } from './bounded-counter';

describe('BoundedCounter', () => {
  describe('increment', () => {
    it('accumulates repeated increments on an existing key', () => {
      const counter = new BoundedCounter(10);

      counter.increment('a');
      counter.increment('a');
      counter.increment('a');

      expect(counter.get('a')).toBe(3);
      expect(counter.size).toBe(1);
    });

    it('tracks distinct keys independently', () => {
      const counter = new BoundedCounter(10);

      counter.increment('a');
      counter.increment('b');
      counter.increment('b');

      expect(counter.get('a')).toBe(1);
      expect(counter.get('b')).toBe(2);
      expect(counter.size).toBe(2);
    });

    it('returns 0 for keys that were never incremented', () => {
      const counter = new BoundedCounter(10);

      expect(counter.get('missing')).toBe(0);
    });
  });

  describe('capacity bound', () => {
    it('never exceeds the configured capacity', () => {
      const capacity = 3;
      const counter = new BoundedCounter(capacity);

      for (let i = 0; i < 100; i++) {
        counter.increment(`key-${i}`);
        expect(counter.size).toBeLessThanOrEqual(capacity);
      }

      expect(counter.size).toBe(capacity);
    });

    it('fills up to capacity without evicting', () => {
      const counter = new BoundedCounter(3);

      counter.increment('a');
      counter.increment('b');
      counter.increment('c');

      expect(counter.size).toBe(3);
      expect(counter.get('a')).toBe(1);
      expect(counter.get('b')).toBe(1);
      expect(counter.get('c')).toBe(1);
    });

    it('does not throw when adding keys past capacity', () => {
      const counter = new BoundedCounter(2);

      expect(() => {
        counter.increment('a');
        counter.increment('b');
        counter.increment('c');
      }).not.toThrow();
    });
  });

  describe('eviction policy', () => {
    it('evicts the least-recently-used key when capacity is exceeded', () => {
      const counter = new BoundedCounter(2);

      counter.increment('a');
      counter.increment('b');
      // 'a' is now the least-recently-used key.
      counter.increment('c');

      expect(counter.size).toBe(2);
      expect(counter.get('a')).toBe(0);
      expect(counter.get('b')).toBe(1);
      expect(counter.get('c')).toBe(1);
    });

    it('keeps recently used keys when evicting', () => {
      const counter = new BoundedCounter(2);

      counter.increment('a');
      counter.increment('b');
      // Touch 'a' so 'b' becomes the least-recently-used key.
      counter.increment('a');
      counter.increment('c');

      expect(counter.size).toBe(2);
      expect(counter.get('a')).toBe(2);
      expect(counter.get('b')).toBe(0);
      expect(counter.get('c')).toBe(1);
    });
  });
});
