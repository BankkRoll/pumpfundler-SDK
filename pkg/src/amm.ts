import type { BondingCurveAccount } from "./bondingCurveAccount";
import type { GlobalAccount } from "./globalAccount";

/**
 * @fileoverview Automated Market Maker (AMM) implementation for the PumpFundlerSDK
 * This file contains the AMM class and related types for handling token buying and selling operations.
 */

/**
 * Represents the result of a buy operation
 * @typedef {Object} BuyResult
 * @property {bigint} token_amount - The amount of tokens bought
 * @property {bigint} sol_amount - The amount of SOL spent
 */
export type BuyResult = {
  token_amount: bigint;
  sol_amount: bigint;
};

/**
 * Represents the result of a sell operation
 * @typedef {Object} SellResult
 * @property {bigint} token_amount - The amount of tokens sold
 * @property {bigint} sol_amount - The amount of SOL received
 */
export type SellResult = {
  token_amount: bigint;
  sol_amount: bigint;
};

/**
 * Automated Market Maker (AMM) class
 * Handles the core logic for token buying and selling operations
 */
export class AMM {
  /**
   * Creates an instance of AMM
   * @param {bigint} virtualSolReserves - The virtual SOL reserves
   * @param {bigint} virtualTokenReserves - The virtual token reserves
   * @param {bigint} realSolReserves - The real SOL reserves
   * @param {bigint} realTokenReserves - The real token reserves
   * @param {bigint} initialVirtualTokenReserves - The initial virtual token reserves
   */
  constructor(
    public virtualSolReserves: bigint,
    public virtualTokenReserves: bigint,
    public realSolReserves: bigint,
    public realTokenReserves: bigint,
    public initialVirtualTokenReserves: bigint,
  ) {}

  /**
   * Creates an AMM instance from a GlobalAccount
   * @param {GlobalAccount} global - The GlobalAccount instance
   * @returns {AMM} A new AMM instance
   */
  static fromGlobalAccount(global: GlobalAccount): AMM {
    return new AMM(
      global.initialVirtualSolReserves,
      global.initialVirtualTokenReserves,
      0n,
      global.initialRealTokenReserves,
      global.initialVirtualTokenReserves,
    );
  }

  /**
   * Creates an AMM instance from a BondingCurveAccount
   * @param {BondingCurveAccount} bonding_curve - The BondingCurveAccount instance
   * @param {bigint} initialVirtualTokenReserves - The initial virtual token reserves
   * @returns {AMM} A new AMM instance
   */
  static fromBondingCurveAccount(
    bonding_curve: BondingCurveAccount,
    initialVirtualTokenReserves: bigint,
  ): AMM {
    return new AMM(
      bonding_curve.virtualSolReserves,
      bonding_curve.virtualTokenReserves,
      bonding_curve.realSolReserves,
      bonding_curve.realTokenReserves,
      initialVirtualTokenReserves,
    );
  }

  /**
   * Calculates the buy price for a given amount of tokens
   * @param {bigint} tokens - The amount of tokens to buy
   * @returns {bigint} The amount of SOL needed to buy the tokens
   */
  getBuyPrice(tokens: bigint): bigint {
    const product_of_reserves =
      this.virtualSolReserves * this.virtualTokenReserves;
    const new_virtual_token_reserves = this.virtualTokenReserves - tokens;
    const new_virtual_sol_reserves =
      product_of_reserves / new_virtual_token_reserves + 1n;
    const amount_needed =
      new_virtual_sol_reserves > this.virtualSolReserves
        ? new_virtual_sol_reserves - this.virtualSolReserves
        : 0n;
    return amount_needed > 0n ? amount_needed : 0n;
  }

  /**
   * Applies a buy operation to the AMM
   * @param {bigint} token_amount - The amount of tokens to buy
   * @returns {BuyResult} The result of the buy operation
   */
  applyBuy(token_amount: bigint): BuyResult {
    const final_token_amount =
      token_amount > this.realTokenReserves
        ? this.realTokenReserves
        : token_amount;
    const sol_amount = this.getBuyPrice(final_token_amount);

    this.virtualTokenReserves = this.virtualTokenReserves - final_token_amount;
    this.realTokenReserves = this.realTokenReserves - final_token_amount;

    this.virtualSolReserves = this.virtualSolReserves + sol_amount;
    this.realSolReserves = this.realSolReserves + sol_amount;

    return {
      token_amount: final_token_amount,
      sol_amount: sol_amount,
    };
  }

  /**
   * Applies a sell operation to the AMM
   * @param {bigint} token_amount - The amount of tokens to sell
   * @returns {SellResult} The result of the sell operation
   */
  applySell(token_amount: bigint): SellResult {
    this.virtualTokenReserves = this.virtualTokenReserves + token_amount;
    this.realTokenReserves = this.realTokenReserves + token_amount;

    const sell_price = this.getSellPrice(token_amount);

    this.virtualSolReserves = this.virtualSolReserves - sell_price;
    this.realSolReserves = this.realSolReserves - sell_price;

    return {
      token_amount: token_amount,
      sol_amount: sell_price,
    };
  }

  /**
   * Calculates the sell price for a given amount of tokens
   * @param {bigint} tokens - The amount of tokens to sell
   * @returns {bigint} The amount of SOL to be received for selling the tokens
   */
  getSellPrice(tokens: bigint): bigint {
    const scaling_factor = this.initialVirtualTokenReserves;
    const token_sell_proportion =
      (tokens * scaling_factor) / this.virtualTokenReserves;
    const sol_received =
      (this.virtualSolReserves * token_sell_proportion) / scaling_factor;
    return sol_received < this.realSolReserves
      ? sol_received
      : this.realSolReserves;
  }
}
