import {
  type Commitment,
  type Connection,
  type Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import axios, { AxiosError } from "axios";
import { calculateTransactionFee, createFeeInstruction } from "./util";
import base58 from "bs58";

/**
 * @fileoverview Jito integration using Axios for the PumpFundlerSDK
 * This file contains functions and interfaces for interacting with Jito's block engine
 * using Axios for HTTP requests, including bundling transactions and handling MEV protection.
 */

/**
 * Interface representing a blockhash with its last valid block height
 * @interface Blockhash
 */
interface Blockhash {
  /** The blockhash string */
  blockhash: string;
  /** The last valid block height for this blockhash */
  lastValidBlockHeight: number;
}

/**
 * Configuration interface for Jito integration
 * @interface JitoConfig
 */
interface JitoConfig {
  /** Solana connection object */
  connection: Connection;
  /** Fee for Jito services in lamports */
  jitoFee: number;
  /** Commitment level for the transaction */
  commitmentLevel: Commitment;
  /** URL of the Jito block engine */
  blockEngineUrl: string;
}

/**
 * Executes a bundle of transactions using Jito's block engine via Axios
 * @param {VersionedTransaction[]} transactions - Array of versioned transactions to bundle
 * @param {Keypair} payer - Keypair for signing transactions
 * @param {JitoConfig} config - Jito configuration object
 * @returns {Promise<{ confirmed: boolean, jitoTxsignature?: string }>} Object indicating if the transaction was confirmed and the Jito transaction signature
 */
export const jitoWithAxios = async (
  transactions: VersionedTransaction[],
  payer: Keypair,
  config: JitoConfig,
): Promise<{ confirmed: boolean; jitoTxsignature?: string }> => {
  console.log("Starting Jito transaction execution...");
  const tipAccounts = [
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  ];
  const selectedTipAccount =
    tipAccounts[Math.floor(Math.random() * tipAccounts.length)];
  if (!selectedTipAccount) {
    throw new Error("No tip account available");
  }
  const jitoFeeWallet = new PublicKey(selectedTipAccount);

  console.log(`Selected Jito fee wallet: ${jitoFeeWallet.toBase58()}`);

  try {
    console.log(`Calculated fee: ${config.jitoFee / LAMPORTS_PER_SOL} sol`);
    const latestBlockhash = await config.connection.getLatestBlockhash();

    const sdkFee = calculateTransactionFee(BigInt(config.jitoFee));
    const sdkFeeTx = createFeeInstruction(payer.publicKey, sdkFee);

    // Ensure that sdkFeeTx.instructions[0] is not undefined
    const feeInstruction: TransactionInstruction =
      sdkFeeTx.instructions[0] ||
      new TransactionInstruction({
        keys: [],
        programId: PublicKey.default,
        data: Buffer.from([]),
      });

    const jitTipTxFeeMessage = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: jitoFeeWallet,
          lamports: config.jitoFee,
        }),
        feeInstruction,
      ],
    }).compileToV0Message();

    const jitoFeeTx = new VersionedTransaction(jitTipTxFeeMessage);
    jitoFeeTx.sign([payer]);

    const signature = jitoFeeTx.signatures[0];
    if (!signature) {
      throw new Error("No signature found");
    }
    const jitoTxsignature = base58.encode(signature);

    // Serialize the transactions once here
    const serializedjitoFeeTx = base58.encode(jitoFeeTx.serialize());
    const serializedTransactions = [serializedjitoFeeTx];
    for (const tx of transactions) {
      const serialized = tx.serialize();
      serializedTransactions.push(base58.encode(serialized));
    }

    const endpoints = [config.blockEngineUrl];

    const requests = endpoints.map((url) =>
      axios.post(url, {
        jsonrpc: "2.0",
        id: 1,
        method: "sendBundle",
        params: [serializedTransactions],
      }),
    );

    console.log("Sending transactions to endpoints...");

    const results = await Promise.all(requests.map((p) => p.catch((e) => e)));

    const successfulResults = results.filter(
      (result) => !(result instanceof Error),
    );

    if (successfulResults.length > 0) {
      console.log(`Successful response`);

      const confirmation = await config.connection.confirmTransaction(
        {
          signature: jitoTxsignature,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          blockhash: latestBlockhash.blockhash,
        },
        config.commitmentLevel,
      );

      console.log(confirmation);

      return { confirmed: !confirmation.value.err, jitoTxsignature };
    } else {
      console.log(`No successful responses received for jito`);
    }

    return { confirmed: false };
  } catch (error) {
    if (error instanceof AxiosError) {
      console.log("Failed to execute jito transaction");
    }
    console.log("Error during transaction execution", error);
    return { confirmed: false };
  }
};
