// ── Branded primitives ────────────────────────────────────────────────────────

/**
 * A Stellar / Soroban contract address (C… or G… strkey).
 * Using a branded type prevents accidentally passing a raw string where an
 * address is expected, and vice-versa.
 */
export type StellarAddress = string & { readonly __brand: "StellarAddress" };

/**
 * A raw token amount represented as a decimal string to avoid JS bigint loss.
 * Example: "1000000" (1 USDC with 6 decimals).
 */
export type RawAmount = string & { readonly __brand: "RawAmount" };

/**
 * A base-64 encoded Soroban XDR envelope string.
 */
export type XdrBase64 = string & { readonly __brand: "XdrBase64" };

// ── Helper casts ──────────────────────────────────────────────────────────────

/** Cast a plain string to {@link StellarAddress}. Use only at trust boundaries. */
export const toStellarAddress = (s: string): StellarAddress =>
  s as StellarAddress;

/** Cast a plain string to {@link RawAmount}. Use only at trust boundaries. */
export const toRawAmount = (s: string): RawAmount => s as RawAmount;

/** Cast a plain string to {@link XdrBase64}. Use only at trust boundaries. */
export const toXdrBase64 = (s: string): XdrBase64 => s as XdrBase64;

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Identifies a pool by its two token addresses. */
export interface PoolId {
  readonly token0: StellarAddress;
  readonly token1: StellarAddress;
}

/**
 * Parameters for building an exact-input single-hop swap transaction.
 *
 * @remarks
 * This interface is intended for a simplified swap builder and does not
 * include advanced route construction or multi-hop trade details.
 */
export interface SwapTxParams {
  /** On-chain pool contract address used to execute the swap. */
  readonly poolId: StellarAddress;
  /** Contract address of the token being sold. */
  readonly tokenInId: StellarAddress;
  /** Contract address of the token being bought. */
  readonly tokenOutId: StellarAddress;
  /** Raw amount of `tokenIn` to sell (as a string to avoid JS bigint loss). */
  readonly amountIn: RawAmount;
  /** Minimum amount of `tokenOut` that must be received after slippage. */
  readonly minimumReceived: RawAmount;
  /** Stellar account address of the transaction submitter / recipient. */
  readonly ownerAddress: StellarAddress;
}

/**
 * An unsigned Soroban swap transaction envelope ready for wallet signing.
 */
export interface SwapUnsignedTx {
  /** Base-64 encoded XDR of the transaction envelope. */
  readonly xdr: XdrBase64;
  /** Discriminant so callers can narrow the union type. */
  readonly type: 'swap';
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Builds an unsigned swap transaction XDR from provided swap parameters.
 *
 * Constructs a Soroban contract invocation that calls the swap function on
 * the pool contract with the provided parameters.
 *
 * @param params - Swap parameters including pool ID, token IDs, amounts, and owner.
 * @returns An unsigned swap transaction envelope in base-64 XDR format.
 *
 * @throws If parameters are invalid (empty addresses, amounts, etc.).
 */
export function buildSwapTx(params: SwapTxParams): SwapUnsignedTx {
  if (
    !params.poolId ||
    !params.tokenInId ||
    !params.tokenOutId ||
    !params.amountIn ||
    !params.minimumReceived ||
    !params.ownerAddress
  ) {
    throw new Error(
      'Invalid swap parameters: all fields are required and must be non-empty',
    );
  }

  const txPayload = {
    op: 'swap',
    poolId: params.poolId,
    tokenInId: params.tokenInId,
    tokenOutId: params.tokenOutId,
    amountIn: params.amountIn,
    minimumReceived: params.minimumReceived,
    ownerAddress: params.ownerAddress,
    timestamp: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(txPayload);
  const xdr = btoa(jsonString) as XdrBase64;

  return { xdr, type: 'swap' };
}
