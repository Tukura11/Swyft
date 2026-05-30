import { PoolState, TickState } from "./types";

const Q96 = 2n ** 96n;
const MAX_TICK = 887272;
const MIN_TICK = -887272;

/**
 * Parameters for calculating a simple swap quote without pool state.
 * Used for quick estimates before fetching full pool data.
 */
export interface SwapQuoteParams {
  /** Pool identifier (cuid or contract address) */
  poolId: string;
  /** Token address being swapped in */
  tokenInId: string;
  /** Token address being swapped out */
  tokenOutId: string;
  /** Amount of tokenIn to swap (in token units) */
  amountIn: string;
  /** Slippage tolerance in basis points (0-10000). For 0.5%, use 50 */
  slippageBps: number;
}

/**
 * Quote result from a swap operation.
 * All amounts are strings to preserve precision.
 */
export interface SwapQuote {
  /** Expected amount received after swap (before slippage) */
  amountOut: string;
  /** Price impact percentage (0-100). Higher means worse execution price */
  priceImpact: number;
  /** LP protocol fee amount */
  lpFee: string;
  /** Protocol fee amount */
  protocolFee: string;
  /** Minimum amount received accounting for slippage */
  minimumReceived: string;
  /** Actual execution price (amountOut / amountIn) */
  executionPrice: string;
}

/**
 * A zero-value quote returned when inputs are missing or invalid.
 * Use as a fallback when swap parameters are invalid.
 */
export const EMPTY_QUOTE: SwapQuote = {
  amountOut: "0",
  priceImpact: 0,
  lpFee: "0",
  protocolFee: "0",
  minimumReceived: "0",
  executionPrice: "0",
};

/**
 * Determine if a quote represents an empty or invalid result.
 * @param quote - The quote to check
 * @returns true if the quote is empty (zero output), false otherwise
 */
export function isEmptyQuote(quote: SwapQuote): boolean {
  return quote.amountOut === "0" && quote.executionPrice === "0";
}

/**
 * Calculate a simple swap quote without requiring full pool state.
 * Uses constant-product formula with estimated reserves.
 *
 * @param params - Swap parameters including pool, tokens, and amount
 * @returns Swap quote with output amount, fees, and price impact
 *
 * @remarks
 * This function provides quick estimates and uses default reserve assumptions.
 * For accurate quotes, use {@link getSwapQuote} with full pool state.
 *
 * Edge cases:
 * - Returns EMPTY_QUOTE if amountIn is missing, zero, or negative
 * - Returns EMPTY_QUOTE if parsing fails
 */
export function calculateSwapQuote(params: SwapQuoteParams): SwapQuote {
  if (!params?.amountIn) return EMPTY_QUOTE;
  const amountIn = parseFloat(params.amountIn);
  if (!amountIn || amountIn <= 0) {
    return EMPTY_QUOTE;
  }
  const reserveIn = 1_000_000;
  const reserveOut = 1_000_000;
  const lpFeeBps = 30;
  const lpFeeAmt = amountIn * (lpFeeBps / 10_000);
  const amountInAfterFee = amountIn - lpFeeAmt;
  const amountOut = (reserveOut * amountInAfterFee) / (reserveIn + amountInAfterFee);
  const spotPrice = reserveOut / reserveIn;
  const executionPrice = amountOut / amountIn;
  const priceImpact = Math.max(0, ((spotPrice - executionPrice) / spotPrice) * 100);
  const minimumReceived = amountOut * (1 - params.slippageBps / 10_000);
  return {
    amountOut: amountOut.toFixed(7),
    priceImpact: parseFloat(priceImpact.toFixed(4)),
    lpFee: lpFeeAmt.toFixed(7),
    protocolFee: "0",
    minimumReceived: minimumReceived.toFixed(7),
    executionPrice: executionPrice.toFixed(7),
  };
}

/**
 * Parameters for calculating an accurate swap quote with full pool state.
 * Requires complete pool data including tick information.
 */
export interface LocalSwapQuoteParams {
  /** Current pool state including liquidity, price, and optional tick data */
  poolState: PoolState & { ticks?: TickState[] };
  /** Address of token being swapped in (must be token0 or token1) */
  tokenIn: string;
  /** Amount of tokenIn to swap (integer string or bigint in token units) */
  amountIn: string | bigint;
  /** Slippage tolerance in basis points (0-10000). For 0.5%, use 50 */
  slippage: number;
}

/**
 * Accurate swap quote result calculated using complete pool state.
 * All amounts are strings to preserve precision for large values.
 */
export interface LocalSwapQuote {
  /** Exact amount that will be received after swap (before slippage) */
  amountOut: string;
  /** Price impact percentage (0-100) */
  priceImpact: number;
  /** Total fee amount deducted from input */
  fee: string;
  /** Minimum amount guaranteed by slippage tolerance */
  minimumReceived: string;
  /** Price limit for swap execution (sqrtPrice * 2^96) */
  sqrtPriceLimitX96: string;
}

/**
 * Calculate an accurate swap quote using complete pool state.
 * Simulates the swap across ticks to compute exact output amount.
 *
 * @param params - Pool state, input token, amount, and slippage tolerance
 * @returns Accurate swap quote with exact output and execution details
 *
 * @throws Error if amountIn is zero or negative
 * @throws Error if amountIn is not a valid integer string
 * @throws Error if pool has zero liquidity in current range
 * @throws Error if amountIn is fully consumed by fees
 * @throws Error if invalid token direction (token not in pool)
 * @throws Error if swap exceeds available liquidity in pool
 * @throws Error if slippage exceeds 100% (10000 bps)
 *
 * @remarks
 * This function performs an exact simulation based on current pool state.
 * Results are only valid at the moment the pool state was fetched.
 * Use returned sqrtPriceLimitX96 to protect against slippage on-chain.
 */
export function getSwapQuote(params: LocalSwapQuoteParams): LocalSwapQuote {
  const amountIn = toBigIntAmount(params.amountIn);
  if (amountIn <= 0n) {
    throw new Error("amountIn must be greater than zero");
  }

  const zeroForOne = direction(params.poolState, params.tokenIn);
  let sqrtPrice = BigInt(params.poolState.sqrtPrice);
  let liquidity = BigInt(params.poolState.liquidity);
  let currentTick = params.poolState.currentTick;

  if (liquidity <= 0n) {
    throw new Error("zero liquidity in current range");
  }

  const fee = mulDivRoundingUp(amountIn, feeUnits(params.poolState.feeTier), 1_000_000n);
  let remaining = amountIn - fee;
  if (remaining <= 0n) {
    throw new Error("amountIn is fully consumed by fees");
  }

  let amountOut = 0n;
  const ticks = sortedTicks(params.poolState.ticks ?? [], zeroForOne, currentTick);

  while (remaining > 0n) {
    if (liquidity <= 0n) {
      throw new Error("zero liquidity in range");
    }

    const nextTick = ticks.shift();
    const targetTick = nextTick?.tick ?? (zeroForOne ? MIN_TICK : MAX_TICK);
    const targetSqrtPrice = sqrtRatioAtTick(targetTick);

    const step = zeroForOne
      ? swapToken0ForToken1Step(remaining, liquidity, sqrtPrice, targetSqrtPrice)
      : swapToken1ForToken0Step(remaining, liquidity, sqrtPrice, targetSqrtPrice);

    remaining -= step.amountIn;
    amountOut += step.amountOut;
    sqrtPrice = step.nextSqrtPrice;

    if (!step.reachedTarget) {
      break;
    }

    if (!nextTick) {
      throw new Error("amount exceeds available liquidity");
    }

    liquidity = zeroForOne
      ? liquidity - BigInt(nextTick.liquidityNet)
      : liquidity + BigInt(nextTick.liquidityNet);
    currentTick = nextTick.tick;
  }

  const minimumReceived = applySlippage(amountOut, params.slippage);

  return {
    amountOut: amountOut.toString(),
    priceImpact: priceImpact(params.poolState.sqrtPrice, sqrtPrice),
    fee: fee.toString(),
    minimumReceived: minimumReceived.toString(),
    sqrtPriceLimitX96: sqrtPrice.toString(),
  };
}

function direction(pool: PoolState, tokenIn: string): boolean {
  if (tokenIn === pool.token0) return true;
  if (tokenIn === pool.token1) return false;
  throw new Error("invalid token direction");
}

function sortedTicks(
  ticks: TickState[],
  zeroForOne: boolean,
  currentTick: number,
): TickState[] {
  return ticks
    .filter((tick) => (zeroForOne ? tick.tick < currentTick : tick.tick > currentTick))
    .sort((a, b) => (zeroForOne ? b.tick - a.tick : a.tick - b.tick));
}

function swapToken0ForToken1Step(
  amountRemaining: bigint,
  liquidity: bigint,
  sqrtPrice: bigint,
  targetSqrtPrice: bigint,
) {
  const amountToTarget = getAmount0Delta(targetSqrtPrice, sqrtPrice, liquidity, true);

  if (amountRemaining >= amountToTarget) {
    return {
      amountIn: amountToTarget,
      amountOut: getAmount1Delta(targetSqrtPrice, sqrtPrice, liquidity, false),
      nextSqrtPrice: targetSqrtPrice,
      reachedTarget: true,
    };
  }

  const nextSqrtPrice = getNextSqrtPriceFromAmount0In(sqrtPrice, liquidity, amountRemaining);
  return {
    amountIn: amountRemaining,
    amountOut: getAmount1Delta(nextSqrtPrice, sqrtPrice, liquidity, false),
    nextSqrtPrice,
    reachedTarget: false,
  };
}

function swapToken1ForToken0Step(
  amountRemaining: bigint,
  liquidity: bigint,
  sqrtPrice: bigint,
  targetSqrtPrice: bigint,
) {
  const amountToTarget = getAmount1Delta(sqrtPrice, targetSqrtPrice, liquidity, true);

  if (amountRemaining >= amountToTarget) {
    return {
      amountIn: amountToTarget,
      amountOut: getAmount0Delta(sqrtPrice, targetSqrtPrice, liquidity, false),
      nextSqrtPrice: targetSqrtPrice,
      reachedTarget: true,
    };
  }

  const nextSqrtPrice = sqrtPrice + (amountRemaining * Q96) / liquidity;
  return {
    amountIn: amountRemaining,
    amountOut: getAmount0Delta(sqrtPrice, nextSqrtPrice, liquidity, false),
    nextSqrtPrice,
    reachedTarget: false,
  };
}

function getAmount0Delta(
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint,
  roundUp: boolean,
): bigint {
  const [lower, upper] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  const numerator = liquidity * (upper - lower) * Q96;
  const denominator = upper * lower;
  return roundUp ? divRoundingUp(numerator, denominator) : numerator / denominator;
}

function getAmount1Delta(
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint,
  roundUp: boolean,
): bigint {
  const [lower, upper] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
  const numerator = liquidity * (upper - lower);
  return roundUp ? divRoundingUp(numerator, Q96) : numerator / Q96;
}

function getNextSqrtPriceFromAmount0In(
  sqrtPrice: bigint,
  liquidity: bigint,
  amountIn: bigint,
): bigint {
  const numerator = liquidity * sqrtPrice * Q96;
  const denominator = liquidity * Q96 + amountIn * sqrtPrice;
  return divRoundingUp(numerator, denominator);
}

function sqrtRatioAtTick(tick: number): bigint {
  const ratio = Math.sqrt(Math.pow(1.0001, tick));
  return BigInt(Math.floor(ratio * Number(Q96)));
}

function priceImpact(startSqrt: string, endSqrt: bigint): number {
  const start = Number(BigInt(startSqrt));
  const end = Number(endSqrt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) return 0;
  const startPrice = (start / Number(Q96)) ** 2;
  const endPrice = (end / Number(Q96)) ** 2;
  return Number(Math.abs(((endPrice - startPrice) / startPrice) * 100).toFixed(6));
}

function applySlippage(amountOut: bigint, slippage: number): bigint {
  const bps = BigInt(Math.max(0, Math.floor(slippage)));
  if (bps > 10_000n) throw new Error("slippage cannot exceed 10000 bps");
  return (amountOut * (10_000n - bps)) / 10_000n;
}

function feeUnits(feeTier: number): bigint {
  if (!Number.isInteger(feeTier) || feeTier < 0 || feeTier >= 1_000_000) {
    throw new Error("invalid fee tier");
  }
  return BigInt(feeTier);
}

function toBigIntAmount(value: string | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (!/^\d+$/.test(value)) throw new Error("amountIn must be an integer string");
  return BigInt(value);
}

function mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint): bigint {
  return divRoundingUp(a * b, denominator);
}

function divRoundingUp(numerator: bigint, denominator: bigint): bigint {
  return numerator === 0n ? 0n : (numerator - 1n) / denominator + 1n;
}
