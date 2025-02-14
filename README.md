# pumpfundler-sdk

pumpfundler-sdk is a powerful TypeScript library for interacting with the PumpFun protocol on the Solana blockchain. It provides comprehensive functionality for bundling token creation, trading, and managing bonding curves with advanced features like MEV protection through Jito integration.

## Repository Structure

- `/docs`: Contains detailed documentation for the SDK - [View Docs](https://pumpfundler.mintlify.app/)
- `/pkg`: Contains the SDK package code - [View Package](https://www.npmjs.com/package/pumpfundler-sdk)

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
