import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePriceCandles } from "@/hooks/usePriceCandles";

describe("usePriceCandles", () => {
  const mockApiBase = "http://localhost:3000/api";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should parse correct candle array from backend response", async () => {
    const mockResponse = {
      data: [
        {
          timestamp: 1000,
          open: "100.5",
          high: "102.0",
          low: "99.5",
          close: "101.0",
          volume: "1000",
        },
        {
          timestamp: 2000,
          open: "101.0",
          high: "103.0",
          low: "100.5",
          close: "102.5",
          volume: "1500",
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePriceCandles("XLM", "USDC", "1h"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.candles).toHaveLength(2);
    expect(result.current.candles[0]).toEqual({
      time: 1000,
      open: 100.5,
      high: 102.0,
      low: 99.5,
      close: 101.0,
      volume: 1000,
    });
    expect(result.current.candles[1]).toEqual({
      time: 2000,
      open: 101.0,
      high: 103.0,
      low: 100.5,
      close: 102.5,
      volume: 1500,
    });
  });

  it("should return empty array on malformed response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() => usePriceCandles("XLM", "USDC", "1h"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.candles).toEqual([]);
  });

  it("should return empty array on fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => usePriceCandles("XLM", "USDC", "1h"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.candles).toEqual([]);
  });

  it("should set empty array on 404 response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => usePriceCandles("XLM", "USDC", "1h"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.candles).toEqual([]);
  });

  it("should filter out invalid candles", async () => {
    const mockResponse = {
      data: [
        {
          timestamp: 1000,
          open: "100.5",
          high: "102.0",
          low: "99.5",
          close: "101.0",
          volume: "1000",
        },
        {
          timestamp: "invalid",
          open: "101.0",
          high: "103.0",
          low: "100.5",
          close: "102.5",
          volume: "1500",
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePriceCandles("XLM", "USDC", "1h"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.candles).toHaveLength(1);
  });
});
