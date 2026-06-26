import {
  buildSwapTx,
  toStellarAddress,
  toRawAmount,
  toXdrBase64,
} from "../swap";

const POOL  = toStellarAddress("CPOOL000000000000000000000000000000000000000000000000000A");
const TOKEN_IN  = toStellarAddress("CTOKENIN0000000000000000000000000000000000000000000000000");
const TOKEN_OUT = toStellarAddress("CTOKENOUT000000000000000000000000000000000000000000000000");
const OWNER = toStellarAddress("GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ");
const AMOUNT_IN  = toRawAmount("1000000");
const MIN_OUT    = toRawAmount("990000");

describe("buildSwapTx", () => {
  it("returns type 'swap'", () => {
    const tx = buildSwapTx({
      poolId: POOL,
      tokenInId: TOKEN_IN,
      tokenOutId: TOKEN_OUT,
      amountIn: AMOUNT_IN,
      minimumReceived: MIN_OUT,
      ownerAddress: OWNER,
    });
    expect(tx.type).toBe("swap");
  });

  it("returns a non-empty xdr string", () => {
    const tx = buildSwapTx({
      poolId: POOL,
      tokenInId: TOKEN_IN,
      tokenOutId: TOKEN_OUT,
      amountIn: AMOUNT_IN,
      minimumReceived: MIN_OUT,
      ownerAddress: OWNER,
    });
    expect(typeof tx.xdr).toBe("string");
    expect(tx.xdr.length).toBeGreaterThan(0);
  });

  it("encodes all params inside the xdr payload", () => {
    const tx = buildSwapTx({
      poolId: POOL,
      tokenInId: TOKEN_IN,
      tokenOutId: TOKEN_OUT,
      amountIn: AMOUNT_IN,
      minimumReceived: MIN_OUT,
      ownerAddress: OWNER,
    });
    const decoded = atob(tx.xdr);
    const payload = JSON.parse(decoded);
    expect(payload.op).toBe("swap");
    expect(payload.poolId).toBe(POOL);
    expect(payload.tokenInId).toBe(TOKEN_IN);
    expect(payload.tokenOutId).toBe(TOKEN_OUT);
    expect(payload.amountIn).toBe(AMOUNT_IN);
    expect(payload.minimumReceived).toBe(MIN_OUT);
    expect(payload.ownerAddress).toBe(OWNER);
    expect(payload.timestamp).toBeDefined();
    expect(typeof payload.timestamp).toBe("string");
  });

  it("produces a different xdr for different amountIn values", () => {
    const params = {
      poolId: POOL,
      tokenInId: TOKEN_IN,
      tokenOutId: TOKEN_OUT,
      amountIn: AMOUNT_IN,
      minimumReceived: MIN_OUT,
      ownerAddress: OWNER,
    };
    const tx1 = buildSwapTx(params);
    const tx2 = buildSwapTx({ ...params, amountIn: toRawAmount("5000000") });
    expect(tx1.xdr).not.toBe(tx2.xdr);
  });

  it("throws when poolId is empty", () => {
    expect(() =>
      buildSwapTx({
        poolId: toStellarAddress(""),
        tokenInId: TOKEN_IN,
        tokenOutId: TOKEN_OUT,
        amountIn: AMOUNT_IN,
        minimumReceived: MIN_OUT,
        ownerAddress: OWNER,
      })
    ).toThrow();
  });

  it("throws when tokenInId is empty", () => {
    expect(() =>
      buildSwapTx({
        poolId: POOL,
        tokenInId: toStellarAddress(""),
        tokenOutId: TOKEN_OUT,
        amountIn: AMOUNT_IN,
        minimumReceived: MIN_OUT,
        ownerAddress: OWNER,
      })
    ).toThrow();
  });

  it("throws when amountIn is empty", () => {
    expect(() =>
      buildSwapTx({
        poolId: POOL,
        tokenInId: TOKEN_IN,
        tokenOutId: TOKEN_OUT,
        amountIn: toRawAmount(""),
        minimumReceived: MIN_OUT,
        ownerAddress: OWNER,
      })
    ).toThrow();
  });
});

describe("cast helpers", () => {
  it("toStellarAddress returns the same string value", () => {
    const addr = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
    expect(toStellarAddress(addr)).toBe(addr);
  });

  it("toRawAmount returns the same string value", () => {
    expect(toRawAmount("9999")).toBe("9999");
  });

  it("toXdrBase64 returns the same string value", () => {
    const b64 = btoa("hello");
    expect(toXdrBase64(b64)).toBe(b64);
  });
});
