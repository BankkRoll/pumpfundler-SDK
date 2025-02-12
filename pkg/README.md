# PumpFun SDK

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Core Components](#core-components)
5. [PumpFunSDK Class](#pumpfunsdk-class)
6. [Token Creation and Management](#token-creation-and-management)
7. [Buying and Selling Tokens](#buying-and-selling-tokens)
8. [Bonding Curve Mechanics](#bonding-curve-mechanics)
9. [AMM (Automated Market Maker)](#amm-automated-market-maker)
10. [Event Handling](#event-handling)
11. [Jito Integration](#jito-integration)
12. [Utility Functions](#utility-functions)
13. [Error Handling](#error-handling)
14. [Advanced Usage](#advanced-usage)
15. [TypeScript Types](#typescript-types)

## Introduction

The PumpFun SDK is a powerful TypeScript library for interacting with the PumpFun protocol on the Solana blockchain. It provides comprehensive functionality for token creation, trading, and managing bonding curves with advanced features like MEV protection through Jito integration.

## Installation

```bash
npm install pumpfun-sdk
```

## Configuration

To use the SDK, you need to create a `PumpFunConfig` object and initialize the SDK:

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { PumpFunSDK, PumpFunConfig } from "pumpfun-sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const wallet = new Wallet(Keypair.generate());

const config: PumpFunConfig = {
connection,
jitoFee: 1000000, // 0.001 SOL
commitmentLevel: "confirmed",
blockEngineUrl: "https://your-jito-block-engine-url.com",
jitoAuthKeypair: "your-jito-auth-keypair-base58",
};

const provider = new AnchorProvider(connection, wallet, {});
const sdk = new PumpFunSDK(provider, config);
```

## Core Components

### PumpFunSDK

The main class that provides methods for interacting with the PumpFun protocol.

### BondingCurveAccount

Represents the bonding curve for a token, handling price calculations and reserve management.

### GlobalAccount

Manages global state and parameters for the PumpFun protocol.

### AMM

Implements the Automated Market Maker logic for token swaps.

## PumpFunSDK Class

The `PumpFunSDK` class is the main entry point for interacting with the PumpFun protocol. It provides methods for token creation, buying, selling, and managing bonding curves.

### Constructor

```typescript
constructor(provider: Provider, config: PumpFunConfig)
```

- `provider`: An Anchor Provider instance.
- `config`: A `PumpFunConfig` object containing connection details and Jito configuration.

### Key Properties

- `program`: The Anchor Program instance for PumpFun.
- `connection`: The Solana connection object.
- `config`: The configuration object passed during initialization.

## Token Creation and Management

### createAndBuy

Creates a new token and executes initial buy orders.

```typescript
async createAndBuy(
creator: Keypair,
mint: Keypair,
buyers: Keypair[],
createTokenMetadata: CreateTokenMetadata,
buyAmountSol: bigint,
slippageBasisPoints: bigint = 300n,
priorityFees?: PriorityFee,
commitment: Commitment = DEFAULT_COMMITMENT,
finality: Finality = DEFAULT_FINALITY,
): Promise<{ confirmed: boolean, jitoTxsignature?: string }>
```

#### Parameters:

- `creator`: Keypair of the token creator.
- `mint`: Keypair for the new token's mint.
- `buyers`: Array of Keypairs for initial buyers.
- `createTokenMetadata`: Metadata for the new token.
- `buyAmountSol`: Total amount of SOL for initial buy orders.
- `slippageBasisPoints`: Slippage tolerance in basis points.
- `priorityFees`: Optional priority fees for the transaction.
- `commitment`: Desired commitment level for the transaction.
- `finality`: Desired finality for the transaction.

#### Example:

```typescript
const creator = Keypair.generate();
const mint = Keypair.generate();
const buyers = [Keypair.generate(), Keypair.generate()];
const metadata: CreateTokenMetadata = {
name: "My Token",
symbol: "MTK",
description: "A test token",
file: new Blob(["dummy image data"]),
};

const result = await sdk.createAndBuy(
creator,
mint,
buyers,
metadata,
BigInt(1_000_000_000), // 1 SOL
300n, // 3% slippage
);

console.log("Token created and bought:", result);
```

### createTokenMetadata

Creates metadata for a new token.

```typescript
async createTokenMetadata(create: CreateTokenMetadata): Promise<TokenMetadata>
```

#### Parameters:

- `create`: An object containing token metadata information.

#### Example:

```typescript
const metadata: CreateTokenMetadata = {
name: "My Token",
symbol: "MTK",
description: "A test token",
file: new Blob(["dummy image data"]),
twitter: "https://twitter.com/mytoken",
telegram: "https://t.me/mytoken",
website: "https://mytoken.com",
};

const tokenMetadata = await sdk.createTokenMetadata(metadata);
console.log("Token metadata created:", tokenMetadata);
```

## Buying and Selling Tokens

### buy

Executes a buy order for an existing token.

```typescript
async buy(
buyer: Keypair,
mint: PublicKey,
buyAmountSol: bigint,
slippageBasisPoints: bigint = 500n,
priorityFees?: PriorityFee,
commitment: Commitment = DEFAULT_COMMITMENT,
finality: Finality = DEFAULT_FINALITY,
): Promise<TransactionResult>
```

#### Parameters:

- `buyer`: Keypair of the buyer.
- `mint`: PublicKey of the token's mint.
- `buyAmountSol`: Amount of SOL to spend on buying tokens.
- `slippageBasisPoints`: Slippage tolerance in basis points.
- `priorityFees`: Optional priority fees for the transaction.
- `commitment`: Desired commitment level for the transaction.
- `finality`: Desired finality for the transaction.

#### Example:

```typescript
const buyer = Keypair.generate();
const mint = new PublicKey("...");
const buyResult = await sdk.buy(
buyer,
mint,
BigInt(500_000_000), // 0.5 SOL
300n, // 3% slippage
);

console.log("Buy result:", buyResult);
```

### sell

Executes a sell order for a token.

```typescript
async sell(
seller: Keypair,
mint: PublicKey,
sellTokenAmount: bigint,
slippageBasisPoints: bigint = 500n,
priorityFees?: PriorityFee,
commitment: Commitment = DEFAULT_COMMITMENT,
finality: Finality = DEFAULT_FINALITY,
): Promise<TransactionResult>
```

#### Parameters:

- `seller`: Keypair of the seller.
- `mint`: PublicKey of the token's mint.
- `sellTokenAmount`: Amount of tokens to sell.
- `slippageBasisPoints`: Slippage tolerance in basis points.
- `priorityFees`: Optional priority fees for the transaction.
- `commitment`: Desired commitment level for the transaction.
- `finality`: Desired finality for the transaction.

#### Example:

```typescript
const seller = Keypair.generate();
const mint = new PublicKey("...");
const sellResult = await sdk.sell(
seller,
mint,
BigInt(1_000_000), // 1 million tokens
300n, // 3% slippage
);

console.log("Sell result:", sellResult);
```

## Bonding Curve Mechanics

The `BondingCurveAccount` class handles the bonding curve mechanics for each token.

### Key Methods

#### getBuyPrice

Calculates the buy price for a given amount of SOL.

```typescript
getBuyPrice(amount: bigint): bigint
```

#### getSellPrice

Calculates the sell price for a given amount of tokens.

```typescript
getSellPrice(amount: bigint, feeBasisPoints: bigint): bigint
```

#### getMarketCapSOL

Calculates the current market cap in SOL.

```typescript
getMarketCapSOL(): bigint
```

#### getFinalMarketCapSOL

Calculates the final market cap in SOL.

```typescript
getFinalMarketCapSOL(feeBasisPoints: bigint): bigint
```

### Example Usage

```typescript
const bondingCurveAccount = await sdk.getBondingCurveAccount(mint);
if (bondingCurveAccount) {
const buyPrice = bondingCurveAccount.getBuyPrice(BigInt(1_000_000_000)); // 1 SOL
console.log("Buy price for 1 SOL:", buyPrice.toString());

const marketCap = bondingCurveAccount.getMarketCapSOL();
console.log("Current market cap in SOL:", marketCap.toString());
}
```

## AMM (Automated Market Maker)

The `AMM` class provides methods for simulating buy and sell operations.

### Key Methods

#### getBuyPrice

Calculates the buy price for a given amount of tokens.

```typescript
getBuyPrice(tokens: bigint): bigint
```

#### applyBuy

Simulates a buy operation and returns the result.

```typescript
applyBuy(token_amount: bigint): BuyResult
```

#### applySell

Simulates a sell operation and returns the result.

```typescript
applySell(token_amount: bigint): SellResult
```

#### getSellPrice

Calculates the sell price for a given amount of tokens.

```typescript
getSellPrice(tokens: bigint): bigint
```

### Example Usage

```typescript
const globalAccount = await sdk.getGlobalAccount();
const amm = AMM.fromGlobalAccount(globalAccount);

const buyPrice = amm.getBuyPrice(BigInt(1_000_000)); // 1 million tokens
console.log("Buy price for 1M tokens:", buyPrice.toString());

const sellResult = amm.applySell(BigInt(500_000)); // Sell 500k tokens
console.log("Sell result:", sellResult);
```

## Event Handling

The SDK provides methods for subscribing to various events:

```typescript
addEventListener<T extends PumpFunEventType>(
eventType: T,
callback: (event: PumpFunEventHandlers[T], slot: number, signature: string) => void
): number

removeEventListener(eventId: number): void
```

Supported event types: `createEvent`, `tradeEvent`, `completeEvent`, `setParamsEvent`.

### Example Usage

```typescript
const eventId = sdk.addEventListener("tradeEvent", (event, slot, signature) => {
console.log("Trade event:", event);
console.log("Slot:", slot);
console.log("Signature:", signature);
});

// Later, to remove the event listener:
sdk.removeEventListener(eventId);
```

## Jito Integration

The SDK integrates with Jito for MEV protection and efficient transaction processing. This is handled through the `jitoWithAxios` function.

### Key Components

- `bundle`: Bundles multiple transactions for atomic execution.
- `bull_dozer`: Processes a bundle of transactions using Jito.
- `build_bundle`: Builds a bundle of transactions with Jito tip.

### Example Usage

```typescript
import { jitoWithAxios } from "pumpfun-sdk";

const result = await jitoWithAxios(transactions, payer, sdk.config);
if (result.confirmed) {
console.log("Jito bundle confirmed:", result.jitoTxsignature);
} else {
console.error("Jito bundle failed");
}
```

## Utility Functions

The SDK provides several utility functions for common operations:

- `calculateWithSlippageBuy`: Calculates buy amount with slippage.
- `calculateWithSlippageSell`: Calculates sell amount with slippage.
- `sendTx`: Sends a transaction with optional priority fees.
- `buildTx`: Builds a versioned transaction.
- `getTxDetails`: Retrieves transaction details.
- `getRandomInt`: Generates a random integer within a range.

### Example Usage

```typescript
import { calculateWithSlippageBuy, sendTx } from "pumpfun-sdk";

const amountWithSlippage = calculateWithSlippageBuy(BigInt(1_000_000_000), 300n);
console.log("Amount with 3% slippage:", amountWithSlippage.toString());

const txResult = await sendTx(connection, transaction, payer.publicKey, [payer]);
console.log("Transaction result:", txResult);
```

## Error Handling

The SDK uses a `TransactionResult` type to handle the results of transactions:

```typescript
type TransactionResult = {
signature?: string;
error?: unknown;
results?: VersionedTransactionResponse;
success: boolean;
};
```

Always check the `success` field to determine if a transaction was successful.

### Example Usage

```typescript
const result = await sdk.buy(buyer, mint, amount);
if (result.success) {
console.log("Transaction successful:", result.signature);
} else {
console.error("Transaction failed:", result.error);
}
```

## Advanced Usage

### Multi-Wallet Buying

This example demonstrates how to perform buys from multiple wallets:

```typescript
async function multiBuyToken(tokenMint: PublicKey, buyers: Keypair[], amounts: bigint[]) {
const buyPromises = buyers.map((buyer, index) =>
sdk.buy(
buyer,
tokenMint,
amounts[index],
300n, // 3% slippage
)
);

const results = await Promise.all(buyPromises);
results.forEach((result, index) => {
console.log(`Buy result for buyer ${index + 1}:`, result);
});
}

const buyers = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
const amounts = [BigInt(1_000_000_000), BigInt(500_000_000), BigInt(750_000_000)];
await multiBuyToken(tokenMint, buyers, amounts);
```

### Bonding Curve Analysis

This example shows how to analyze the bonding curve for a token:

```typescript
async function analyzeBondingCurve(tokenMint: PublicKey) {
const bondingCurveAccount = await sdk.getBondingCurveAccount(tokenMint);
if (!bondingCurveAccount) {
console.error("Bonding curve not found");
return;
}

const globalAccount = await sdk.getGlobalAccount();

console.log("Virtual Token Reserves:", bondingCurveAccount.virtualTokenReserves.toString());
console.log("Virtual SOL Reserves:", bondingCurveAccount.virtualSolReserves.toString());
console.log("Real Token Reserves:", bondingCurveAccount.realTokenReserves.toString());
console.log("Real SOL Reserves:", bondingCurveAccount.realSolReserves.toString());

const buyAmount = BigInt(1e9); // 1 SOL
const buyPrice = bondingCurveAccount.getBuyPrice(buyAmount);
console.log(`Buy Price for 1 SOL: ${buyPrice} tokens`);

const sellAmount = BigInt(1e6); // 1 million tokens
const sellPrice = bondingCurveAccount.getSellPrice(sellAmount, globalAccount.feeBasisPoints);
console.log(`Sell Price for 1M tokens: ${sellPrice} lamports`);

const marketCap = bondingCurveAccount.getMarketCapSOL();
console.log("Market Cap in SOL:", marketCap.toString());
}

analyzeBondingCurve(tokenMint).catch(console.error);
```

## TypeScript Types

The SDK provides comprehensive TypeScript types for all its functionality. Here are some key types:

```typescript
import {
CreateTokenMetadata,
TokenMetadata,
CreateEvent,
TradeEvent,
CompleteEvent,
SetParamsEvent,
PumpFunEventHandlers,
PumpFunEventType,
PriorityFee,
TransactionResult,
BuyResult,
SellResult
} from "pumpfun-sdk";

// Example usage of types
const metadata: CreateTokenMetadata = {
name: "My Token",
symbol: "MTK",
description: "A sample token",
file: new Blob(["dummy image"]),
};

const eventHandler: PumpFunEventHandlers["tradeEvent"] = (event: TradeEvent) => {
console.log("Trade event:", event);
};

const priorityFee: PriorityFee = {
unitLimit: 1_000_000,
unitPrice: 1000,
};

// These types are used internally in the SDK
type BuyResult = {
token_amount: bigint;
sol_amount: bigint;
};

type SellResult = {
token_amount: bigint;
sol_amount: bigint;
};
```
