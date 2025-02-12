# pumpfundler-sdk

pumpfundler-sdk is a powerful TypeScript library for interacting with the PumpFun protocol on the Solana blockchain. It provides comprehensive functionality for bundling token creation, trading, and managing bonding curves with advanced features like MEV protection through Jito integration.

## Repository Structure

- `/docs`: Contains detailed documentation for the SDK - [View Docs](https://pumpfundler.mintlify.app/)
- `/pkg`: Contains the SDK package code - [View Package](https://www.npmjs.com/package/pumpfundler-sdk)

## Quick Start

1. Install the SDK:

```bash
npm install pumpfundler-sdk @solana/web3.js @coral-xyz/anchor
```

2. Import and configure the SDK:

```typescript
import { PumpFundlerSDK, PumpFundlerConfig } from "pumpfundler-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";

// Use your actual private key here
const privateKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));

const connection = new Connection("https://api.mainnet-beta.solana.com");
const wallet = new Wallet(keypair);

// Use your actual Jito auth private key here
const jitoAuthPrivateKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

const config: PumpFundlerConfig = {
  connection,
  jitoFee: 1000000, // 0.001 SOL
  commitmentLevel: "confirmed",
  blockEngineUrl: "https://your-jito-block-engine-url.com",
  jitoAuthKeypair: Keypair.fromSecretKey(Buffer.from(jitoAuthPrivateKey, 'hex')),
};

const provider = new AnchorProvider(connection, wallet, {});
const sdk = new PumpFundlerSDK(provider, config);
```

3. Use the SDK to interact with the PumpFun protocol:

```typescript
import { Keypair, PublicKey } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { CreateTokenMetadata } from "pumpfundler-sdk";

// Use your actual private keys here
const localPrivateKeys = [
  "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "2345678901abcdef2345678901abcdef2345678901abcdef2345678901abcdef",
  "3456789012abcdef3456789012abcdef3456789012abcdef3456789012abcdef",
  "4567890123abcdef4567890123abcdef4567890123abcdef4567890123abcdef",
];

const localWallets = localPrivateKeys.map(privateKey => 
  new Wallet(Keypair.fromSecretKey(Buffer.from(privateKey, 'hex')))
);

const metadata: CreateTokenMetadata = {
  name: "My Token",
  symbol: "MTK",
  description: "A sample token",
  file: new Blob(["dummy image data"]),
};

async function createAndBuyWithLocalWallets() {
  const creator = localWallets[0];
  const mint = Keypair.generate();
  const buyers = localWallets.slice(1);
  const buyAmountSol = BigInt(1_000_000_000); // 1 SOL per buyer

  const result = await sdk.createAndBuy(
    creator.payer,
    mint,
    buyers.map(wallet => wallet.payer),
    metadata,
    buyAmountSol * BigInt(buyers.length),
    300n // 3% slippage
  );

  console.log("Create and buy result with local wallets:", result);
}

createAndBuyWithLocalWallets().catch(console.error);
```

---

## Key Features  

- **Token Creation & Management** – Easily create, deploy, and manage tokens on Solana.  
- **Trading Operations** – Execute buy and sell orders with built-in slippage protection.  
- **Transaction Bundling** – Efficiently bundle multiple transactions for atomic execution.  
- **MEV Protection** – Integrate with Jito for enhanced MEV protection.  

## Core Components  

- **PumpFundlerSDK** – Main class for interacting with PumpFun.  
- **Token Operations** – Methods for creating, buying, and selling tokens.  
- **AMM (Automated Market Maker)** – Handles swaps and price calculations.  
- **Event Handling** – Subscribe to protocol events.  
- **Jito Integration** – Ensures MEV protection and optimized transactions.  

## Fees  

| Fee Type         | Cost                  |
|-----------------|----------------------|
| **Creation Fee**  | `0.01 SOL` per token |
| **Transaction Fee** | `1%` of the transaction amount |

## Documentation

For detailed documentation, please refer to the `/docs` directory or visit the [documentation site](https://pumpfundler.mintlify.app/).

## License

This project is licensed under the [MIT License](LICENSE).

![github-header-image](https://github.com/user-attachments/assets/d0944308-5979-4521-a000-0a40332998f4)
