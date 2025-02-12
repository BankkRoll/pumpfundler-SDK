# pumpfundler-sdk

pumpfundler-sdk is a powerful TypeScript library for interacting with the PumpFun protocol on the Solana blockchain. It provides comprehensive functionality for bundling token creation, trading, and managing bonding curves with advanced features like MEV protection through Jito integration.

## Repository Structure

- `/docs`: Contains detailed documentation for the SDK
- `/pkg`: Contains the SDK package code

## Quick Start

1. Install the SDK:

```bash
npm install pumpfundler-sdk
```

2. Import and configure the SDK:

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { PumpFundlerSDK, PumpFundlerConfig } from "pumpfundler-sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const wallet = new Wallet(Keypair.generate());

const config: PumpFundlerConfig = {
  connection,
  jitoFee: 1000000, // 0.001 SOL
  commitmentLevel: "confirmed",
  blockEngineUrl: "https://your-jito-block-engine-url.com",
  jitoAuthKeypair: "your-jito-auth-keypair-base58",
};

const provider = new AnchorProvider(connection, wallet, {});
const sdk = new PumpFundlerSDK(provider, config);
```

3. Use the SDK to interact with the PumpFun protocol:

```typescript
// Example: Create and buy a token
const result = await sdk.createAndBuy(
  creator,
  mint,
  buyers,
  tokenMetadata,
  buyAmount,
  slippage
);
```

## Key Features

- Token creation and bundling management
- Buying and selling tokens
- Bonding curve mechanics
- Automated Market Maker (AMM) functionality
- Event handling
- Jito integration for MEV protection
- Comprehensive utility functions

## Documentation

For detailed documentation, please refer to the `/docs` directory or visit our [official documentation site](https://pumpfundler.mintlify.app/).

## License

This project is licensed under the [MIT License](LICENSE).

![github-header-image](https://github.com/user-attachments/assets/d0944308-5979-4521-a000-0a40332998f4)