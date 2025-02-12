import { Agent, setGlobalDispatcher } from "undici";
import {
  type Commitment,
  type Connection,
  type Finality,
  type Keypair,
  PublicKey,
  Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import type {
  CompleteEvent,
  CreateEvent,
  CreateTokenMetadata,
  PriorityFee,
  PumpFunEventHandlers,
  PumpFunEventType,
  SetParamsEvent,
  TradeEvent,
  TransactionResult,
} from "./types";
import {
  CREATION_FEE,
  DEFAULT_COMMITMENT,
  DEFAULT_FINALITY,
  buildTx,
  calculateTransactionFee,
  calculateWithSlippageBuy,
  calculateWithSlippageSell,
  createFeeInstruction,
  getRandomInt,
  sendTx,
} from "./util";
import { IDL, PumpFun } from "./IDL";
import { type AnchorProvider, type Idl, Program } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  toCompleteEvent,
  toCreateEvent,
  toSetParamsEvent,
  toTradeEvent,
} from "./events";

import { BN } from "bn.js";
import { BondingCurveAccount } from "./bondingCurveAccount";
import { GlobalAccount } from "./globalAccount";
import { jitoWithAxios } from "./jitoWithAxios";

/**
 * @fileoverview PumpFundlerSDK class implementation
 * This file contains the main SDK class for interacting with the PumpFun protocol,
 * including methods for creating tokens, buying, selling, and managing various aspects of the protocol.
 */

const PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const MPL_TOKEN_METADATA_PROGRAM_ID =
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

export const GLOBAL_ACCOUNT_SEED = "global";
export const MINT_AUTHORITY_SEED = "mint-authority";
export const BONDING_CURVE_SEED = "bonding-curve";
export const METADATA_SEED = "metadata";

export const DEFAULT_DECIMALS = 6;

/**
 * Configuration interface for PumpFundlerSDK
 * @interface PumpFundlerConfig
 */
interface PumpFundlerConfig {
  connection: Connection;
  jitoFee: number;
  commitmentLevel: Commitment;
  blockEngineUrl: string;
  jitoAuthKeypair: string;
}

/**
 * Main SDK class for interacting with the PumpFun protocol
 */
export class PumpFundlerSDK {
  public program: Program<PumpFun>; // TODO: Fix type
  public connection: Connection;
  private config: PumpFundlerConfig;

  /**
   * Creates an instance of PumpFundlerSDK
   * @param {AnchorProvider} provider - The Anchor provider
   * @param {PumpFundlerConfig} config - The SDK configuration
   */
  constructor(provider: AnchorProvider, config: PumpFundlerConfig) {
    this.program = new Program<PumpFun>(IDL as PumpFun, provider); // TODO: Fix type assertion
    this.connection = config.connection;
    this.config = config;
  }

  /**
   * Creates a token and executes buy orders
   * @param {Keypair} creator - The creator's keypair
   * @param {Keypair} mint - The mint keypair
   * @param {Keypair[]} buyers - Array of buyer keypairs
   * @param {CreateTokenMetadata} createTokenMetadata - Metadata for token creation
   * @param {bigint} buyAmountSol - Amount of SOL to buy
   * @param {bigint} [slippageBasisPoints=300n] - Slippage tolerance in basis points
   * @param {PriorityFee} [priorityFees] - Optional priority fees
   * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
   * @param {Finality} [finality=DEFAULT_FINALITY] - The finality level
   * @returns {Promise<any>} The result of the create and buy operation
   */
  async createAndBuy(
    creator: Keypair,
    mint: Keypair,
    buyers: Keypair[],
    createTokenMetadata: CreateTokenMetadata,
    buyAmountSol: bigint,
    slippageBasisPoints = 300n,
    priorityFees?: PriorityFee,
    commitment: Commitment = DEFAULT_COMMITMENT,
    finality: Finality = DEFAULT_FINALITY,
  ) {
    const tokenMetadata = await this.createTokenMetadata(createTokenMetadata);

    const createTx = await this.getCreateInstructions(
      creator.publicKey,
      createTokenMetadata.name,
      createTokenMetadata.symbol,
      tokenMetadata.metadataUri,
      mint,
    );

    const creationFeeTx = createFeeInstruction(creator.publicKey, CREATION_FEE);

    const newTx = new Transaction().add(creationFeeTx).add(createTx);
    const buyTxs: VersionedTransaction[] = [];

    const createVersionedTx = await buildTx(
      this.connection,
      newTx,
      creator.publicKey,
      [creator, mint],
      priorityFees,
      commitment,
      finality,
    );

    if (buyAmountSol > 0) {
      for (const buyer of buyers) {
        const randomPercent = getRandomInt(10, 25);
        const buyAmountSolWithRandom =
          (buyAmountSol / BigInt(100)) *
          BigInt(randomPercent % 2 ? 100 + randomPercent : 100 - randomPercent);

        const buyTx = await this.getBuyInstructionsBySolAmount(
          buyer.publicKey,
          mint.publicKey,
          buyAmountSolWithRandom,
          slippageBasisPoints,
          commitment,
        );

        const buyVersionedTx = await buildTx(
          this.connection,
          buyTx,
          buyer.publicKey,
          [buyer],
          priorityFees,
          commitment,
          finality,
        );
        buyTxs.push(buyVersionedTx);
      }
    }

    await sendTx(
      this.connection,
      newTx,
      creator.publicKey,
      [creator, mint],
      priorityFees,
      commitment,
      finality,
    );
    let result;
    while (true) {
      result = await jitoWithAxios(
        [createVersionedTx, ...buyTxs],
        creator,
        this.config,
      );
      if (result.confirmed) break;
    }

    return result;
  }

  /**
   * Executes a buy order
   * @param {Keypair} buyer - The buyer's keypair
   * @param {PublicKey} mint - The mint public key
   * @param {bigint} buyAmountSol - Amount of SOL to buy
   * @param {bigint} [slippageBasisPoints=500n] - Slippage tolerance in basis points
   * @param {PriorityFee} [priorityFees] - Optional priority fees
   * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
   * @param {Finality} [finality=DEFAULT_FINALITY] - The finality level
   * @returns {Promise<TransactionResult>} The result of the buy transaction
   */
  async buy(
    buyer: Keypair,
    mint: PublicKey,
    buyAmountSol: bigint,
    slippageBasisPoints = 500n,
    priorityFees?: PriorityFee,
    commitment: Commitment = DEFAULT_COMMITMENT,
    finality: Finality = DEFAULT_FINALITY,
  ): Promise<TransactionResult> {
    const fee = calculateTransactionFee(buyAmountSol);
    const buyAmountAfterFee = buyAmountSol - fee;

    const buyTx = await this.getBuyInstructionsBySolAmount(
      buyer.publicKey,
      mint,
      buyAmountAfterFee,
      slippageBasisPoints,
      commitment,
    );

    const feeTx = createFeeInstruction(buyer.publicKey, fee);

    const combinedTx = new Transaction().add(feeTx).add(buyTx);

    const buyResults = await sendTx(
      this.connection,
      combinedTx,
      buyer.publicKey,
      [buyer],
      priorityFees,
      commitment,
      finality,
    );
    return buyResults;
  }

  /**
   * Executes a sell order
   * @param {Keypair} seller - The seller's keypair
   * @param {PublicKey} mint - The mint public key
   * @param {bigint} sellTokenAmount - Amount of tokens to sell
   * @param {bigint} [slippageBasisPoints=500n] - Slippage tolerance in basis points
   * @param {PriorityFee} [priorityFees] - Optional priority fees
   * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
   * @param {Finality} [finality=DEFAULT_FINALITY] - The finality level
   * @returns {Promise<TransactionResult>} The result of the sell transaction
   */
  async sell(
    seller: Keypair,
    mint: PublicKey,
    sellTokenAmount: bigint,
    slippageBasisPoints = 500n,
    priorityFees?: PriorityFee,
    commitment: Commitment = DEFAULT_COMMITMENT,
    finality: Finality = DEFAULT_FINALITY,
  ): Promise<TransactionResult> {
    const sellTx = await this.getSellInstructionsByTokenAmount(
      seller.publicKey,
      mint,
      sellTokenAmount,
      slippageBasisPoints,
      commitment,
    );

    const sellResults = await sendTx(
      this.connection,
      sellTx,
      seller.publicKey,
      [seller],
      priorityFees,
      commitment,
      finality,
    );

    if (sellResults.success && sellResults.results) {
      const soldAmount =
        sellResults.results.meta?.postBalances[0] -
        sellResults.results.meta?.preBalances[0];
      if (soldAmount) {
        const fee = calculateTransactionFee(BigInt(soldAmount));
        const feeTx = createFeeInstruction(seller.publicKey, fee);
        await sendTx(
          this.connection,
          feeTx,
          seller.publicKey,
          [seller],
          priorityFees,
          commitment,
          finality,
        );
      }
    }

    return sellResults;
  }

  /**
   * Gets instructions for creating a token
   * @param {PublicKey} creator - The creator's public key
   * @param {string} name - The token name
   * @param {string} symbol - The token symbol
   * @param {string} uri - The token metadata URI
   * @param {Keypair} mint - The mint keypair
   * @returns {Promise<Transaction>} The transaction containing create instructions
   */
  async getCreateInstructions(
    creator: PublicKey,
    name: string,
    symbol: string,
    uri: string,
    mint: Keypair,
  ) {
    const mplTokenMetadata = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        mplTokenMetadata.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      mplTokenMetadata,
    );

    const associatedBondingCurve = await getAssociatedTokenAddress(
      mint.publicKey,
      this.getBondingCurvePDA(mint.publicKey),
      true,
    );

    return this.program.methods
      .create(name, symbol, uri)
      .accounts({
        mint: mint.publicKey,
        associatedBondingCurve: associatedBondingCurve,
        metadata: metadataPDA,
        user: creator,
      })
      .signers([mint])
      .transaction();
  }

  /**
   * Gets buy instructions based on SOL amount
   * @param {PublicKey} buyer - The buyer's public key
   * @param {PublicKey} mint - The mint public key
   * @param {bigint} buyAmountSol - Amount of SOL to buy
   * @param {bigint} [slippageBasisPoints=500n] - Slippage tolerance in basis points
   * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
   * @returns {Promise<Transaction>} The transaction containing buy instructions
   */
  async getBuyInstructionsBySolAmount(
    buyer: PublicKey,
    mint: PublicKey,
    buyAmountSol: bigint,
    slippageBasisPoints = 500n,
    commitment: Commitment = DEFAULT_COMMITMENT,
  ) {
    const bondingCurveAccount = await this.getBondingCurveAccount(
      mint,
      commitment,
    );
    if (!bondingCurveAccount) {
      throw new Error(`Bonding curve account not found: ${mint.toBase58()}`);
    }

    const buyAmount = bondingCurveAccount.getBuyPrice(buyAmountSol);
    const buyAmountWithSlippage = calculateWithSlippageBuy(
      buyAmountSol,
      slippageBasisPoints,
    );
    const globalAccount = await this.getGlobalAccount(commitment);

    return await this.getBuyInstructions(
      buyer,
      mint,
      globalAccount.feeRecipient,
      buyAmount,
      buyAmountWithSlippage,
    );
  }

  /**
   * Gets buy instructions
   * @param {PublicKey} buyer - The buyer's public key
   * @param {PublicKey} mint - The mint public key
   * @param {PublicKey} feeRecipient - The fee recipient's public key
   * @param {bigint} amount - Amount of tokens to buy
   * @param {bigint} solAmount - Amount of SOL to spend
   * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
   * @returns {Promise<Transaction>} The transaction containing buy instructions
   */
  async getBuyInstructions(
    buyer: PublicKey,
    mint: PublicKey,
    feeRecipient: PublicKey,
    amount: bigint,
    solAmount: bigint,
    commitment: Commitment = DEFAULT_COMMITMENT,
  ) {
    const associatedBondingCurve = await getAssociatedTokenAddress(
      mint,
      this.getBondingCurvePDA(mint),
      true,
    );

    const associatedUser = await getAssociatedTokenAddress(mint, buyer, false);

    const transaction = new Transaction();

    try {
      await getAccount(this.connection, associatedUser, commitment);
    } catch (e) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          buyer,
          associatedUser,
          buyer,
          mint,
        ),
      );
    }

    transaction.add(
      await this.program.methods
        .buy(new BN(amount.toString()), new BN(solAmount.toString()))
        .accounts({
          feeRecipient: feeRecipient,
          mint: mint,
          associatedBondingCurve: associatedBondingCurve,
          associatedUser: associatedUser,
          user: buyer,
        })
        .transaction(),
    );

    return transaction;
  }

  /**
   * Gets sell instructions based on token amount
   * @param {PublicKey} seller - The seller's public key
   * @param {PublicKey} mint - The mint public key
   * @param {bigint} sellTokenAmount - Amount of tokens to sell
   * @param {bigint} [slippageBasisPoints=500n] - Slippage tolerance in basis points
   * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
   * @returns {Promise<Transaction>} The transaction containing sell instructions
   */
  async getSellInstructionsByTokenAmount(
    seller: PublicKey,
    mint: PublicKey,
    sellTokenAmount: bigint,
    slippageBasisPoints = 500n,
    commitment: Commitment = DEFAULT_COMMITMENT,
  ) {
    const bondingCurveAccount = await this.getBondingCurveAccount(
      mint,
      commitment,
    );
    if (!bondingCurveAccount) {
      throw new Error(`Bonding curve account not found: ${mint.toBase58()}`);
    }

    const globalAccount = await this.getGlobalAccount(commitment);

    const minSolOutput = bondingCurveAccount.getSellPrice(
      sellTokenAmount,
      globalAccount.feeBasisPoints,
    );

    const sellAmountWithSlippage = calculateWithSlippageSell(
      minSolOutput,
      slippageBasisPoints,
    );

    return await this.getSellInstructions(
      seller,
      mint,
      globalAccount.feeRecipient,
      sellTokenAmount,
      sellAmountWithSlippage,
    );
  }

  /**
   * Gets sell instructions
   * @param {PublicKey} seller - The seller's public key
   * @param {PublicKey} mint - The mint public key
   * @param {PublicKey} feeRecipient - The fee recipient's public key
   * @param {bigint} amount - Amount of tokens to sell
   * @param {bigint} minSolOutput - Minimum SOL output expected
   * @returns {Promise<Transaction>} The transaction containing sell instructions
   */
  async getSellInstructions(
    seller: PublicKey,
    mint: PublicKey,
    feeRecipient: PublicKey,
    amount: bigint,
    minSolOutput: bigint,
  ) {
    const associatedBondingCurve = await getAssociatedTokenAddress(
      mint,
      this.getBondingCurvePDA(mint),
      true,
    );

    const associatedUser = await getAssociatedTokenAddress(mint, seller, false);

    const transaction = new Transaction();

    transaction.add(
      await this.program.methods
        .sell(new BN(amount.toString()), new BN(minSolOutput.toString()))
        .accounts({
          feeRecipient: feeRecipient,
          mint: mint,
          associatedBondingCurve: associatedBondingCurve,
          associatedUser: associatedUser,
          user: seller,
        })
        .transaction(),
    );

    return transaction;
  }

  /**
   * Gets the bonding curve account for a given mint
   * @param {PublicKey} mint - The mint public key
   * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
   * @returns {Promise<BondingCurveAccount | null>} The bonding curve account or null if not found
   */
  async getBondingCurveAccount(
    mint: PublicKey,
    commitment: Commitment = DEFAULT_COMMITMENT,
  ) {
    const tokenAccount = await this.connection.getAccountInfo(
      this.getBondingCurvePDA(mint),
      commitment,
    );
    if (!tokenAccount) {
      return null;
    }
    return BondingCurveAccount.fromBuffer(tokenAccount.data);
  }

  /**
   * Gets the global account
   * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
   * @returns {Promise<GlobalAccount>} The global account
   * @throws {Error} If the global account is not found
   */
  async getGlobalAccount(commitment: Commitment = DEFAULT_COMMITMENT) {
    const [globalAccountPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_ACCOUNT_SEED)],
      new PublicKey(PROGRAM_ID),
    );

    const tokenAccount = await this.connection.getAccountInfo(
      globalAccountPDA,
      commitment,
    );

    if (!tokenAccount) {
      throw new Error("Global account not found");
    }

    return GlobalAccount.fromBuffer(tokenAccount.data);
  }

  /**
   * Gets the bonding curve PDA for a given mint
   * @param {PublicKey} mint - The mint public key
   * @returns {PublicKey} The bonding curve PDA
   */
  getBondingCurvePDA(mint: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()],
      this.program.programId,
    )[0];
  }

  /**
   * Creates token metadata
   * @param {CreateTokenMetadata} create - The token metadata to create
   * @returns {Promise<any>} The result of the metadata creation
   */
  async createTokenMetadata(create: CreateTokenMetadata) {
    const formData = new FormData();
    formData.append("file", create.file);
    formData.append("name", create.name);
    formData.append("symbol", create.symbol);
    formData.append("description", create.description);
    formData.append("twitter", create.twitter || "");
    formData.append("telegram", create.telegram || "");
    formData.append("website", create.website || "");
    formData.append("showName", "true");

    setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }));
    const request = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      headers: {
        Host: "www.pump.fun",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        Referer: "https://www.pump.fun/create",
        Origin: "https://www.pump.fun",
        Connection: "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        Priority: "u=1",
        TE: "trailers",
      },
      body: formData,
    });
    return request.json();
  }

  /**
   * Adds an event listener for a specific event type
   * @param {PumpFunEventType} eventType - The type of event to listen for
   * @param {function} callback - The callback function to execute when the event occurs
   * @returns {number} The event listener id
   */
  addEventListener<T extends PumpFunEventType>(
    eventType: T,
    callback: (
      event: PumpFunEventHandlers[T],
      slot: number,
      signature: string,
    ) => void,
  ) {
    return this.program.addEventListener(
      eventType,
      (event: any, slot: number, signature: string) => {
        let processedEvent;
        switch (eventType) {
          case "createEvent":
            processedEvent = toCreateEvent(event as CreateEvent);
            callback(
              processedEvent as PumpFunEventHandlers[T],
              slot,
              signature,
            );
            break;
          case "tradeEvent":
            processedEvent = toTradeEvent(event as TradeEvent);
            callback(
              processedEvent as PumpFunEventHandlers[T],
              slot,
              signature,
            );
            break;
          case "completeEvent":
            processedEvent = toCompleteEvent(event as CompleteEvent);
            callback(
              processedEvent as PumpFunEventHandlers[T],
              slot,
              signature,
            );
            console.log("completeEvent", event, slot, signature);
            break;
          case "setParamsEvent":
            processedEvent = toSetParamsEvent(event as SetParamsEvent);
            callback(
              processedEvent as PumpFunEventHandlers[T],
              slot,
              signature,
            );
            break;
          default:
            console.error("Unhandled event type:", eventType);
        }
      },
    );
  }

  /**
   * Removes an event listener
   * @param {number} eventId - The id of the event listener to remove
   */
  removeEventListener(eventId: number) {
    this.program.removeEventListener(eventId);
  }
}
