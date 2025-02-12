import {
  type Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  type SearcherClient,
  searcherClient,
} from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
import base58 from "bs58";
import { isError } from "jito-ts/dist/sdk/block-engine/utils";
import { calculateTransactionFee, createFeeInstruction } from "./util";

/**
 * @fileoverview Jito integration for the PumpFundlerSDK
 * This file contains functions and interfaces for interacting with Jito's block engine,
 * including bundling transactions and handling MEV protection.
 */

/**
 * Configuration interface for Jito integration
 * @interface JitoConfig
 */
interface JitoConfig {
  /** Solana connection object */
  connection: Connection;
  /** Fee for Jito services in lamports */
  jitoFee: number;
  /** URL of the Jito block engine */
  blockEngineUrl: string;
  /** Base58 encoded string of the Jito authentication keypair */
  jitoAuthKeypair: string;
}

/**
 * Result interface for account-related operations
 * @interface AccountsResult
 */
interface AccountsResult {
  /** Indicates if the operation was successful */
  ok: boolean;
  /** Optional error message if the operation failed */
  error?: { message: string };
  /** Optional array of account addresses if the operation succeeded */
  value?: string[];
}

/**
 * Result interface for send operations
 * @interface SendResult
 */
interface SendResult {
  /** Indicates if the send operation was successful */
  ok: boolean;
  /** Optional error message if the send operation failed */
  error?: { message: string };
}

/**
 * Bundles and sends transactions using Jito's block engine
 * @param {VersionedTransaction[]} txs - Array of versioned transactions to bundle
 * @param {Keypair} keypair - Keypair for signing transactions
 * @param {JitoConfig} config - Jito configuration object
 * @returns {Promise<boolean>} True if all transactions were successfully bundled and sent
 */
export async function bundle(
  txs: VersionedTransaction[],
  keypair: Keypair,
  config: JitoConfig,
): Promise<boolean> {
  try {
    const txNum = Math.ceil(txs.length / 3);
    let successNum = 0;
    for (let i = 0; i < txNum; i++) {
      const upperIndex = (i + 1) * 3;
      const downIndex = i * 3;
      const newTxs: VersionedTransaction[] = [];
      for (let j = downIndex; j < upperIndex; j++) {
        const tx = txs[j];
        if (tx) newTxs.push(tx);
      }
      const success = await bull_dozer(newTxs, keypair, config);
      if (success) successNum++;
    }
    return successNum === txNum;
  } catch (error) {
    console.error("Error in bundle function:", error);
    return false;
  }
}

/**
 * Processes a batch of transactions using Jito's block engine
 * @param {VersionedTransaction[]} txs - Array of versioned transactions to process
 * @param {Keypair} keypair - Keypair for signing transactions
 * @param {JitoConfig} config - Jito configuration object
 * @returns {Promise<boolean>} True if the transactions were successfully processed
 */
export async function bull_dozer(
  txs: VersionedTransaction[],
  keypair: Keypair,
  config: JitoConfig,
): Promise<boolean> {
  try {
    const bundleTransactionLimit = Number.parseInt("4");
    const jitoKey = Keypair.fromSecretKey(
      base58.decode(config.jitoAuthKeypair),
    );
    const search = searcherClient(config.blockEngineUrl, jitoKey);

    const buildResult = await build_bundle(
      search,
      bundleTransactionLimit,
      txs,
      keypair,
      config,
    );
    if (isError(buildResult)) {
      console.error("Error building bundle:", buildResult.message);
      return false;
    }
    const bundle_result = await onBundleResult(search);
    return bundle_result > 0;
  } catch (error) {
    console.error("Error in bull_dozer function:", error);
    return false;
  }
}

/**
 * Builds a bundle of transactions for Jito's block engine
 * @param {SearcherClient} search - Jito searcher client
 * @param {number} bundleTransactionLimit - Maximum number of transactions in a bundle
 * @param {VersionedTransaction[]} txs - Array of versioned transactions to bundle
 * @param {Keypair} keypair - Keypair for signing transactions
 * @param {JitoConfig} config - Jito configuration object
 * @returns {Promise<Bundle | Error>} The built bundle or an error
 */
async function build_bundle(
  search: SearcherClient,
  bundleTransactionLimit: number,
  txs: VersionedTransaction[],
  keypair: Keypair,
  config: JitoConfig,
): Promise<Bundle | Error> {
  const accountsResult = await search.getTipAccounts();
  if (!Array.isArray(accountsResult)) {
    return new Error(
      `Failed to get tip accounts: ${
        (accountsResult as any).error?.message ?? "Unknown error"
      }`,
    );
  }
  const accounts = accountsResult;
  const _tipAccount =
    accounts[Math.min(Math.floor(Math.random() * accounts.length), 3)];
  if (!_tipAccount) {
    return new Error("No tip account available");
  }
  const tipAccount = new PublicKey(_tipAccount);

  const bund = new Bundle([], bundleTransactionLimit);
  const resp = await config.connection.getLatestBlockhash("processed");

  const sdkFee = calculateTransactionFee(BigInt(config.jitoFee));
  const sdkFeeTx = createFeeInstruction(keypair.publicKey, sdkFee);

  // Fix: Ensure that sdkFeeTx.instructions[0] is not undefined
  const feeInstruction: TransactionInstruction =
    sdkFeeTx.instructions[0] ||
    new TransactionInstruction({
      keys: [],
      programId: PublicKey.default,
      data: Buffer.from([]),
    });

  const sdkFeeVersionedTx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: resp.blockhash,
      instructions: [feeInstruction],
    }).compileToV0Message(),
  );
  sdkFeeVersionedTx.sign([keypair]);

  bund.addTransactions(sdkFeeVersionedTx, ...txs);

  const maybeBundle = bund.addTipTx(
    keypair,
    Number(config.jitoFee / LAMPORTS_PER_SOL),
    tipAccount,
    resp.blockhash,
  );

  if (isError(maybeBundle)) {
    return maybeBundle;
  }
  try {
    const sendResult = await search.sendBundle(maybeBundle);
    if (typeof sendResult !== "string") {
      return new Error(
        `Failed to send bundle: ${
          (sendResult as any).error?.message ?? "Unknown error"
        }`,
      );
    }
    return maybeBundle;
  } catch (e) {
    return new Error(
      `Error sending bundle: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Handles the result of a bundle submission to Jito's block engine
 * @param {SearcherClient} c - Jito searcher client
 * @returns {Promise<number>} The number of accepted bundles (0 or 1)
 */
export const onBundleResult = (c: SearcherClient): Promise<number> => {
  let first = 0;
  let isResolved = false;

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(first);
      isResolved = true;
    }, 30000);

    c.onBundleResult(
      (result: any) => {
        if (isResolved) return first;
        const isAccepted = result.accepted;
        const isRejected = result.rejected;
        if (!isResolved) {
          if (isAccepted) {
            first += 1;
            isResolved = true;
            resolve(first);
          }
          if (isRejected) {
            // Do not resolve or reject the promise here
          }
        }
      },
      (e: any) => {
        // Do not reject the promise here
        console.error("Error in onBundleResult:", e);
      },
    );
  });
};
