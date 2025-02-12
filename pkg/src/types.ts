import type { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";

/**
 * @fileoverview Type definitions for the PumpFundlerSDK
 * This file contains various types and interfaces used throughout the SDK,
 * including event types, metadata structures, and transaction-related types.
 */

/**
 * Metadata for creating a new token
 * @typedef {Object} CreateTokenMetadata
 * @property {string} name - The name of the token
 * @property {string} symbol - The symbol of the token
 * @property {string} description - A description of the token
 * @property {Blob} file - The image file for the token
 * @property {string} [twitter] - Optional Twitter handle associated with the token
 * @property {string} [telegram] - Optional Telegram group associated with the token
 * @property {string} [website] - Optional website associated with the token
 */
export type CreateTokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  file: Blob;
  twitter?: string;
  telegram?: string;
  website?: string;
};

/**
 * Metadata for an existing token
 * @typedef {Object} TokenMetadata
 * @property {string} name - The name of the token
 * @property {string} symbol - The symbol of the token
 * @property {string} description - A description of the token
 * @property {string} image - URL or path to the token's image
 * @property {boolean} showName - Whether to display the token's name
 * @property {string} createdOn - The creation date of the token
 * @property {string} twitter - Twitter handle associated with the token
 */
export type TokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  showName: boolean;
  createdOn: string;
  twitter: string;
};

/**
 * Event emitted when a new token is created
 * @typedef {Object} CreateEvent
 * @property {string} name - The name of the created token
 * @property {string} symbol - The symbol of the created token
 * @property {string} uri - The URI of the token's metadata
 * @property {PublicKey} mint - The public key of the token's mint
 * @property {PublicKey} bondingCurve - The public key of the token's bonding curve
 * @property {PublicKey} user - The public key of the user who created the token
 */
export type CreateEvent = {
  name: string;
  symbol: string;
  uri: string;
  mint: PublicKey;
  bondingCurve: PublicKey;
  user: PublicKey;
};

/**
 * Event emitted when a trade occurs
 * @typedef {Object} TradeEvent
 * @property {PublicKey} mint - The public key of the token's mint
 * @property {bigint} solAmount - The amount of SOL involved in the trade
 * @property {bigint} tokenAmount - The amount of tokens involved in the trade
 * @property {boolean} isBuy - Whether the trade is a buy (true) or sell (false)
 * @property {PublicKey} user - The public key of the user who made the trade
 * @property {number} timestamp - The timestamp of the trade
 * @property {bigint} virtualSolReserves - The virtual SOL reserves after the trade
 * @property {bigint} virtualTokenReserves - The virtual token reserves after the trade
 * @property {bigint} realSolReserves - The real SOL reserves after the trade
 * @property {bigint} realTokenReserves - The real token reserves after the trade
 */
export type TradeEvent = {
  mint: PublicKey;
  solAmount: bigint;
  tokenAmount: bigint;
  isBuy: boolean;
  user: PublicKey;
  timestamp: number;
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realSolReserves: bigint;
  realTokenReserves: bigint;
};

/**
 * Event emitted when a token's lifecycle is completed
 * @typedef {Object} CompleteEvent
 * @property {PublicKey} user - The public key of the user who completed the token
 * @property {PublicKey} mint - The public key of the token's mint
 * @property {PublicKey} bondingCurve - The public key of the token's bonding curve
 * @property {number} timestamp - The timestamp of the completion
 */
export type CompleteEvent = {
  user: PublicKey;
  mint: PublicKey;
  bondingCurve: PublicKey;
  timestamp: number;
};

/**
 * Event emitted when parameters are set or updated
 * @typedef {Object} SetParamsEvent
 * @property {PublicKey} feeRecipient - The public key of the fee recipient
 * @property {bigint} initialVirtualTokenReserves - The initial virtual token reserves
 * @property {bigint} initialVirtualSolReserves - The initial virtual SOL reserves
 * @property {bigint} initialRealTokenReserves - The initial real token reserves
 * @property {bigint} tokenTotalSupply - The total supply of the token
 * @property {bigint} feeBasisPoints - The fee in basis points
 */
export type SetParamsEvent = {
  feeRecipient: PublicKey;
  initialVirtualTokenReserves: bigint;
  initialVirtualSolReserves: bigint;
  initialRealTokenReserves: bigint;
  tokenTotalSupply: bigint;
  feeBasisPoints: bigint;
};

/**
 * Interface defining the handlers for different event types
 * @interface PumpFunEventHandlers
 */
export interface PumpFunEventHandlers {
  createEvent: CreateEvent;
  tradeEvent: TradeEvent;
  completeEvent: CompleteEvent;
  setParamsEvent: SetParamsEvent;
}

/**
 * Union type of all possible event types in the PumpFunSDK
 * @typedef {keyof PumpFunEventHandlers} PumpFunEventType
 */
export type PumpFunEventType = keyof PumpFunEventHandlers;

/**
 * Structure for defining priority fees
 * @typedef {Object} PriorityFee
 * @property {number} unitLimit - The maximum number of compute units the transaction can consume
 * @property {number} unitPrice - The price in micro-lamports per compute unit
 */
export type PriorityFee = {
  unitLimit: number;
  unitPrice: number;
};

/**
 * Structure representing the result of a transaction
 * @typedef {Object} TransactionResult
 * @property {string} [signature] - The transaction signature, if successful
 * @property {unknown} [error] - Any error that occurred during the transaction
 * @property {VersionedTransactionResponse} [results] - The full transaction response, if available
 * @property {boolean} success - Whether the transaction was successful
 */
export type TransactionResult = {
  signature?: string;
  error?: unknown;
  results?: VersionedTransactionResponse;
  success: boolean;
};
