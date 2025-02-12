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
  DEFAULT_COMMITMENT,
  DEFAULT_FINALITY,
  buildTx,
  calculateWithSlippageBuy,
  calculateWithSlippageSell,
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

const PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const MPL_TOKEN_METADATA_PROGRAM_ID =
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

export const GLOBAL_ACCOUNT_SEED = "global";
export const MINT_AUTHORITY_SEED = "mint-authority";
export const BONDING_CURVE_SEED = "bonding-curve";
export const METADATA_SEED = "metadata";

export const DEFAULT_DECIMALS = 6;

interface PumpFundlerConfig {
  connection: Connection;
  jitoFee: number;
  commitmentLevel: Commitment;
  blockEngineUrl: string;
  jitoAuthKeypair: string;
}

//|||||||||||||||||||||||||||||||||||||||||\\
//                   TODO                    \\
//________________NOT FINISHED_________________\\

export class PumpFundlerSDK {
  public program: Program<PumpFun>; // TODO: Fix
  public connection: Connection;
  private config: PumpFundlerConfig;

  constructor(provider: AnchorProvider, config: PumpFundlerConfig) {
    this.program = new Program<PumpFun>(IDL as PumpFun, provider); // TODO: Fix
    this.connection = config.connection;
    this.config = config;
  }

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

    const newTx = new Transaction().add(createTx);
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

  async buy(
    buyer: Keypair,
    mint: PublicKey,
    buyAmountSol: bigint,
    slippageBasisPoints = 500n,
    priorityFees?: PriorityFee,
    commitment: Commitment = DEFAULT_COMMITMENT,
    finality: Finality = DEFAULT_FINALITY,
  ): Promise<TransactionResult> {
    const buyTx = await this.getBuyInstructionsBySolAmount(
      buyer.publicKey,
      mint,
      buyAmountSol,
      slippageBasisPoints,
      commitment,
    );

    const buyResults = await sendTx(
      this.connection,
      buyTx,
      buyer.publicKey,
      [buyer],
      priorityFees,
      commitment,
      finality,
    );
    return buyResults;
  }

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
    return sellResults;
  }

  //create token instructions
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

  //buy
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

  //sell
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

  getBondingCurvePDA(mint: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()],
      this.program.programId,
    )[0];
  }

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

  //EVENTS
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

  removeEventListener(eventId: number) {
    this.program.removeEventListener(eventId);
  }
}
