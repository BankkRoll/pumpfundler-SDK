import { type Layout, bool, struct, u64 } from "@coral-xyz/borsh";

/**
 * @fileoverview BondingCurveAccount class for the PumpFundlerSDK
 * This file contains the implementation of the BondingCurveAccount class,
 * which represents the bonding curve for a token and provides methods for
 * price calculations and market cap estimations.
 */

/**
 * Represents a Bonding Curve Account for a token
 */
export class BondingCurveAccount {
  /**
   * @param {bigint} discriminator - Unique identifier for the account type
   * @param {bigint} virtualTokenReserves - Virtual token reserves
   * @param {bigint} virtualSolReserves - Virtual SOL reserves
   * @param {bigint} realTokenReserves - Real token reserves
   * @param {bigint} realSolReserves - Real SOL reserves
   * @param {bigint} tokenTotalSupply - Total supply of the token
   * @param {boolean} complete - Whether the bonding curve is complete
   */
  constructor(
    public discriminator: bigint,
    public virtualTokenReserves: bigint,
    public virtualSolReserves: bigint,
    public realTokenReserves: bigint,
    public realSolReserves: bigint,
    public tokenTotalSupply: bigint,
    public complete: boolean,
  ) {}

  /**
   * Calculates the buy price for a given amount of tokens
   * @param {bigint} amount - The amount of tokens to buy
   * @returns {bigint} The price in SOL for buying the specified amount of tokens
   * @throws {Error} If the curve is complete
   */
  getBuyPrice(amount: bigint): bigint {
    if (this.complete) {
      throw new Error("Curve is complete");
    }

    if (amount <= 0n) {
      return 0n;
    }

    // Calculate the product of virtual reserves
    const n = this.virtualSolReserves * this.virtualTokenReserves;

    // Calculate the new virtual sol reserves after the purchase
    const i = this.virtualSolReserves + amount;

    // Calculate the new virtual token reserves after the purchase
    const r = n / i + 1n;

    // Calculate the amount of tokens to be purchased
    const s = this.virtualTokenReserves - r;

    // Return the minimum of the calculated tokens and real token reserves
    return s < this.realTokenReserves ? s : this.realTokenReserves;
  }

  /**
   * Calculates the sell price for a given amount of tokens
   * @param {bigint} amount - The amount of tokens to sell
   * @param {bigint} feeBasisPoints - The fee in basis points
   * @returns {bigint} The price in SOL for selling the specified amount of tokens
   * @throws {Error} If the curve is complete
   */
  getSellPrice(amount: bigint, feeBasisPoints: bigint): bigint {
    if (this.complete) {
      throw new Error("Curve is complete");
    }

    if (amount <= 0n) {
      return 0n;
    }

    // Calculate the proportional amount of virtual sol reserves to be received
    const n =
      (amount * this.virtualSolReserves) / (this.virtualTokenReserves + amount);

    // Calculate the fee amount in the same units
    const a = (n * feeBasisPoints) / 10000n;

    // Return the net amount after deducting the fee
    return n - a;
  }

  /**
   * Calculates the current market cap in SOL
   * @returns {bigint} The current market cap in SOL
   */
  getMarketCapSOL(): bigint {
    if (this.virtualTokenReserves === 0n) {
      return 0n;
    }

    return (
      (this.tokenTotalSupply * this.virtualSolReserves) /
      this.virtualTokenReserves
    );
  }

  /**
   * Calculates the final market cap in SOL
   * @param {bigint} feeBasisPoints - The fee in basis points
   * @returns {bigint} The final market cap in SOL
   */
  getFinalMarketCapSOL(feeBasisPoints: bigint): bigint {
    const totalSellValue = this.getBuyOutPrice(
      this.realTokenReserves,
      feeBasisPoints,
    );
    const totalVirtualValue = this.virtualSolReserves + totalSellValue;
    const totalVirtualTokens =
      this.virtualTokenReserves - this.realTokenReserves;

    if (totalVirtualTokens === 0n) {
      return 0n;
    }

    return (this.tokenTotalSupply * totalVirtualValue) / totalVirtualTokens;
  }

  /**
   * Calculates the buyout price for a given amount of tokens
   * @param {bigint} amount - The amount of tokens to buy out
   * @param {bigint} feeBasisPoints - The fee in basis points
   * @returns {bigint} The buyout price in SOL
   */
  getBuyOutPrice(amount: bigint, feeBasisPoints: bigint): bigint {
    const solTokens =
      amount < this.realSolReserves ? this.realSolReserves : amount;
    const totalSellValue =
      (solTokens * this.virtualSolReserves) /
        (this.virtualTokenReserves - solTokens) +
      1n;
    const fee = (totalSellValue * feeBasisPoints) / 10000n;
    return totalSellValue + fee;
  }

  /**
   * Creates a BondingCurveAccount instance from a buffer
   * @param {Buffer} buffer - The buffer containing the account data
   * @returns {BondingCurveAccount} A new BondingCurveAccount instance
   */
  public static fromBuffer(buffer: Buffer): BondingCurveAccount {
    const structure: Layout<BondingCurveAccount> = struct([
      u64("discriminator"),
      u64("virtualTokenReserves"),
      u64("virtualSolReserves"),
      u64("realTokenReserves"),
      u64("realSolReserves"),
      u64("tokenTotalSupply"),
      bool("complete"),
    ]);

    const value = structure.decode(buffer);
    return new BondingCurveAccount(
      BigInt(value.discriminator),
      BigInt(value.virtualTokenReserves),
      BigInt(value.virtualSolReserves),
      BigInt(value.realTokenReserves),
      BigInt(value.realSolReserves),
      BigInt(value.tokenTotalSupply),
      value.complete,
    );
  }
}
