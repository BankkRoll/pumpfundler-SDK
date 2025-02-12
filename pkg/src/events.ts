import type {
  CompleteEvent,
  CreateEvent,
  SetParamsEvent,
  TradeEvent,
} from "./types";

import { PublicKey } from "@solana/web3.js";

/**
 * @fileoverview Event conversion functions for the PumpFundlerSDK
 * This file contains utility functions to convert raw event data into
 * strongly-typed event objects with proper PublicKey and BigInt conversions.
 */

/**
 * Converts a raw CreateEvent into a properly typed CreateEvent object
 * @param {CreateEvent} event - The raw create event data
 * @returns {CreateEvent} A new CreateEvent object with properly converted fields
 */
export function toCreateEvent(event: CreateEvent): CreateEvent {
  return {
    name: event.name,
    symbol: event.symbol,
    uri: event.uri,
    mint: new PublicKey(event.mint),
    bondingCurve: new PublicKey(event.bondingCurve),
    user: new PublicKey(event.user),
  };
}

/**
 * Converts a raw CompleteEvent into a properly typed CompleteEvent object
 * @param {CompleteEvent} event - The raw complete event data
 * @returns {CompleteEvent} A new CompleteEvent object with properly converted fields
 */
export function toCompleteEvent(event: CompleteEvent): CompleteEvent {
  return {
    user: new PublicKey(event.user),
    mint: new PublicKey(event.mint),
    bondingCurve: new PublicKey(event.bondingCurve),
    timestamp: event.timestamp,
  };
}

/**
 * Converts a raw TradeEvent into a properly typed TradeEvent object
 * @param {TradeEvent} event - The raw trade event data
 * @returns {TradeEvent} A new TradeEvent object with properly converted fields
 */
export function toTradeEvent(event: TradeEvent): TradeEvent {
  return {
    mint: new PublicKey(event.mint),
    solAmount: BigInt(event.solAmount),
    tokenAmount: BigInt(event.tokenAmount),
    isBuy: event.isBuy,
    user: new PublicKey(event.user),
    timestamp: Number(event.timestamp),
    virtualSolReserves: BigInt(event.virtualSolReserves),
    virtualTokenReserves: BigInt(event.virtualTokenReserves),
    realSolReserves: BigInt(event.realSolReserves),
    realTokenReserves: BigInt(event.realTokenReserves),
  };
}

/**
 * Converts a raw SetParamsEvent into a properly typed SetParamsEvent object
 * @param {SetParamsEvent} event - The raw set params event data
 * @returns {SetParamsEvent} A new SetParamsEvent object with properly converted fields
 */
export function toSetParamsEvent(event: SetParamsEvent): SetParamsEvent {
  return {
    feeRecipient: new PublicKey(event.feeRecipient),
    initialVirtualTokenReserves: BigInt(event.initialVirtualTokenReserves),
    initialVirtualSolReserves: BigInt(event.initialVirtualSolReserves),
    initialRealTokenReserves: BigInt(event.initialRealTokenReserves),
    tokenTotalSupply: BigInt(event.tokenTotalSupply),
    feeBasisPoints: BigInt(event.feeBasisPoints),
  };
}
