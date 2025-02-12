import { type Layout, bool, publicKey, struct, u64 } from "@coral-xyz/borsh";
import type { PublicKey } from "@solana/web3.js";

/**
 * @fileoverview GlobalAccount class for the PumpFundlerSDK
 * This file contains the implementation of the GlobalAccount class,
 * which represents the global state and configuration for the PumpFun protocol.
 */

/**
 * Represents the global account for the PumpFun protocol
 */
export class GlobalAccount {
  /**
   * @param {bigint} discriminator - Unique identifier for the account type
   * @param {boolean} initialized - Whether the account has been initialized
   * @param {PublicKey} authority - The authority public key
   * @param {PublicKey} feeRecipient - The fee recipient public key
   * @param {bigint} initialVirtualTokenReserves - Initial virtual token reserves
   * @param {bigint} initialVirtualSolReserves - Initial virtual SOL reserves
   * @param {bigint} initialRealTokenReserves - Initial real token reserves
   * @param {bigint} tokenTotalSupply - Total supply of the token
   * @param {bigint} feeBasisPoints - Fee in basis points
   */
  constructor(
    public discriminator: bigint,
    public initialized: boolean,
    public authority: PublicKey,
    public feeRecipient: PublicKey,
    public initialVirtualTokenReserves: bigint,
    public initialVirtualSolReserves: bigint,
    public initialRealTokenReserves: bigint,
    public tokenTotalSupply: bigint,
    public feeBasisPoints: bigint,
  ) {}

  /**
   * Calculates the initial buy price for a given amount of tokens
   * @param {bigint} amount - The amount of tokens to buy
   * @returns {bigint} The initial buy price in SOL
   */
  getInitialBuyPrice(amount: bigint): bigint {
    if (amount <= 0n) {
      return 0n;
    }

    const n = this.initialVirtualSolReserves * this.initialVirtualTokenReserves;
    const i = this.initialVirtualSolReserves + amount;
    const r = n / i + 1n;
    const s = this.initialVirtualTokenReserves - r;
    return s < this.initialRealTokenReserves
      ? s
      : this.initialRealTokenReserves;
  }

  /**
   * Creates a GlobalAccount instance from a buffer
   * @param {Buffer} buffer - The buffer containing the account data
   * @returns {GlobalAccount} A new GlobalAccount instance
   */
  public static fromBuffer(buffer: Buffer): GlobalAccount {
    const structure: Layout<GlobalAccount> = struct([
      u64("discriminator"),
      bool("initialized"),
      publicKey("authority"),
      publicKey("feeRecipient"),
      u64("initialVirtualTokenReserves"),
      u64("initialVirtualSolReserves"),
      u64("initialRealTokenReserves"),
      u64("tokenTotalSupply"),
      u64("feeBasisPoints"),
    ]);

    const value = structure.decode(buffer);
    return new GlobalAccount(
      BigInt(value.discriminator),
      value.initialized,
      value.authority,
      value.feeRecipient,
      BigInt(value.initialVirtualTokenReserves),
      BigInt(value.initialVirtualSolReserves),
      BigInt(value.initialRealTokenReserves),
      BigInt(value.tokenTotalSupply),
      BigInt(value.feeBasisPoints),
    );
  }
}
