import { SorobanRpc, Contract, xdr, scValToNative } from '@stellar/stellar-sdk';

import { PoolState, PositionState, TickState, SwyftRpcError } from './types';

async function callContract(
  rpcUrl: string,
  contractAddress: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<xdr.ScVal> {
  const server = new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  const contract = new Contract(contractAddress);
  const op = contract.call(method, ...args);

  try {
    const result = await server.simulateTransaction(
      // We only need the result value; build a minimal transaction envelope
      // by wrapping the operation in a simulation request directly.
      // stellar-sdk's simulateTransaction accepts an Operation or a built tx;
      // here we pass the raw operation xdr for simulation.
      op as unknown as Parameters<typeof server.simulateTransaction>[0]
    );

    if (SorobanRpc.Api.isSimulationError(result)) {
      throw new SwyftRpcError(`Simulation failed for ${method}: ${result.error}`);
    }

    const sim = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;
    if (!sim.result) {
      throw new SwyftRpcError(`No result returned for ${method} on ${contractAddress}`);
    }
    return sim.result.retval;
  } catch (err) {
    if (err instanceof SwyftRpcError) throw err;
    throw new SwyftRpcError(
      `RPC call failed for ${method} on ${contractAddress}: ${(err as Error).message}`,
      err
    );
  }
}

export async function getPool({
  rpcUrl,
  poolAddress,
}: {
  rpcUrl: string;
  poolAddress: string;
}): Promise<PoolState> {
  const retval = await callContract(rpcUrl, poolAddress, 'get_pool_state');
  const raw = scValToNative(retval) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new SwyftRpcError(`Unexpected pool state shape from ${poolAddress}`);
  }

  return {
    poolAddress,
    sqrtPrice: String(raw['sqrt_price'] ?? raw['sqrtPrice'] ?? '0'),
    currentTick: Number(raw['current_tick'] ?? raw['currentTick'] ?? 0),
    liquidity: String(raw['liquidity'] ?? '0'),
    feeTier: Number(raw['fee_tier'] ?? raw['feeTier'] ?? 0),
    token0: String(raw['token0'] ?? ''),
    token1: String(raw['token1'] ?? ''),
  };
}

export async function getPosition({
  rpcUrl,
  positionNftId,
}: {
  rpcUrl: string;
  positionNftId: string;
}): Promise<PositionState> {
  // positionNftId is the NFT contract address that holds the position
  const retval = await callContract(rpcUrl, positionNftId, 'get_position');
  const raw = scValToNative(retval) as Record<string, unknown> | null | undefined;

  // The on-chain contract returns `Option<PositionMetadata>`.
  // When the token was burned (or never minted), the result can be empty,
  // so we fail fast with a domain error instead of returning zero/blank data.
  // "Empty" cases can surface as `null`/`undefined`, an empty object, or sometimes
  // wrapped option-like payloads depending on the Soroban decoder.

  if (raw == null) {
    throw new SwyftRpcError(`Position is empty (token not found) on ${positionNftId}`);
  }

  if (typeof raw !== 'object') {
    throw new SwyftRpcError(`Unexpected position state shape from ${positionNftId}`);
  }

  // If the decoder yields an empty object, treat it as Option::None.
  if (Object.keys(raw as Record<string, unknown>).length === 0) {
    throw new SwyftRpcError(`Position is empty (token not found) on ${positionNftId}`);
  }

  // Handle potential option-like wrappers: { value: null }
  const maybeValue = (raw as Record<string, unknown>)['value'];
  if ('value' in (raw as Record<string, unknown>) && maybeValue == null) {
    throw new SwyftRpcError(`Position is empty (token not found) on ${positionNftId}`);
  }

  // If wrapped as { value: PositionMetadata }, unwrap it.
  const position =
    'value' in (raw as Record<string, unknown>)
      ? ((raw as Record<string, unknown>)['value'] ?? raw)
      : raw;

  return {
    positionNftId,
    owner: String((position as Record<string, unknown>)['owner'] ?? ''),
    pool: String((position as Record<string, unknown>)['pool'] ?? ''),
    lowerTick: Number(
      (position as Record<string, unknown>)['lower_tick'] ??
        (position as Record<string, unknown>)['lowerTick'] ??
        0
    ),
    upperTick: Number(
      (position as Record<string, unknown>)['upper_tick'] ??
        (position as Record<string, unknown>)['upperTick'] ??
        0
    ),
    liquidity: String((position as Record<string, unknown>)['liquidity'] ?? '0'),
  };
}

export async function getTick({
  rpcUrl,
  poolAddress,
  tick,
}: {
  rpcUrl: string;
  poolAddress: string;
  tick: number;
}): Promise<TickState> {
  const tickArg = xdr.ScVal.scvI32(tick);
  const retval = await callContract(rpcUrl, poolAddress, 'get_tick', [tickArg]);
  const raw = scValToNative(retval) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new SwyftRpcError(`Unexpected tick state shape for tick ${tick} on ${poolAddress}`);
  }

  return {
    tick,
    liquidityNet: String(raw['liquidity_net'] ?? raw['liquidityNet'] ?? '0'),
    liquidityGross: String(raw['liquidity_gross'] ?? raw['liquidityGross'] ?? '0'),
    feeGrowthOutside: String(raw['fee_growth_outside'] ?? raw['feeGrowthOutside'] ?? '0'),
  };
}
