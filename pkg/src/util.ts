import {
  type Commitment,
  ComputeBudgetProgram,
  type Connection,
  type Finality,
  type Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  type VersionedTransactionResponse,
} from "@solana/web3.js";
import type { PriorityFee, TransactionResult } from "./types";

/**
 * @fileoverview Utility functions and constants for the PumpFundlerSDK
 * This file contains various helper functions for transaction handling,
 * fee calculations, and Solana blockchain interactions.
 */

/**
 * Default commitment level for transactions
 * @constant {Commitment}
 */
export const DEFAULT_COMMITMENT: Commitment = "finalized";

/**
 * Default finality for transactions
 * @constant {Finality}
 */
export const DEFAULT_FINALITY: Finality = "finalized";

/**
 * SDK Fee for creating a new token (0.01 SOL)
 * @constant {bigint}
 */
export const CREATION_FEE = BigInt(0.01 * LAMPORTS_PER_SOL);

/**
 * SDK Transaction fee percentage (1%)
 * @constant {number}
 */
export const TRANSACTION_FEE_PERCENT = 0.01;

/**
 * Public key of the fee recipient
 * @constant {PublicKey}
 * @todo Replace with actual fee wallet address
 */
export const FEE_RECIPIENT = new PublicKey(
  "HnE7hxHwj6J49rhvrPGZfyfYw8YEWhV3BPV2X7yDXRdv",
);

/**
 * Calculates the buy amount with slippage
 * @param {bigint} amount - The original amount
 * @param {bigint} basisPoints - The slippage in basis points
 * @returns {bigint} The amount adjusted for slippage
 */
export const calculateWithSlippageBuy = (
  amount: bigint,
  basisPoints: bigint,
): bigint => {
  return amount + (amount * basisPoints) / 10000n;
};

/**
 * Calculates the sell amount with slippage
 * @param {bigint} amount - The original amount
 * @param {bigint} basisPoints - The slippage in basis points
 * @returns {bigint} The amount adjusted for slippage
 */
export const calculateWithSlippageSell = (
  amount: bigint,
  basisPoints: bigint,
): bigint => {
  return amount - (amount * basisPoints) / 10000n;
};

/**
 * Calculates the transaction fee based on the amount
 * @param {bigint} dataSize - The transaction data size
 * @returns {bigint} The calculated fee
 */
export const calculateTransactionFee = (
  dataSize: bigint | undefined,
): bigint => {
  if (dataSize === undefined) {
    return BigInt(0);
  }
  return BigInt(Math.floor(Number(dataSize) * TRANSACTION_FEE_PERCENT));
};

/**
 * Creates a fee transfer instruction
 * @param {PublicKey} payer - The public key of the fee payer
 * @param {bigint} amount - The fee amount
 * @returns {Transaction} A transaction containing the fee transfer instruction
 */
export const createFeeInstruction = (
  payer: PublicKey,
  amount: bigint,
): Transaction => {
  return new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: FEE_RECIPIENT,
      lamports: amount,
    }),
  );
};

/**
 * Sends a transaction to the Solana network
 * @param {Connection} connection - The Solana connection object
 * @param {Transaction} tx - The transaction to send
 * @param {PublicKey} payer - The public key of the transaction payer
 * @param {Keypair[]} signers - Array of signers for the transaction
 * @param {PriorityFee} [priorityFees] - Optional priority fees
 * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
 * @param {Finality} [finality=DEFAULT_FINALITY] - The finality level
 * @returns {Promise<TransactionResult>} The result of the transaction
 */
export async function sendTx(
  connection: Connection,
  tx: Transaction,
  payer: PublicKey,
  signers: Keypair[],
  priorityFees?: PriorityFee,
  commitment: Commitment = DEFAULT_COMMITMENT,
  finality: Finality = DEFAULT_FINALITY,
): Promise<TransactionResult> {
  const newTx = new Transaction();

  if (priorityFees) {
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: priorityFees.unitLimit,
    });

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFees.unitPrice,
    });
    newTx.add(modifyComputeUnits);
    newTx.add(addPriorityFee);
  }

  if (tx.instructions.length > 0 && tx.instructions[0]?.data) {
    const fee = calculateTransactionFee(BigInt(tx.instructions[0].data.length));
    newTx.add(createFeeInstruction(payer, fee));
  } else {
    console.warn(
      "Transaction has no instructions or first instruction has no data. Skipping fee calculation.",
    );
  }

  newTx.add(tx);
  const versionedTx = await buildVersionedTx(
    connection,
    payer,
    newTx,
    commitment,
  );
  versionedTx.sign(signers);
  try {
    console.log(await connection.simulateTransaction(versionedTx, undefined));

    const sig = await connection.sendTransaction(versionedTx, {
      skipPreflight: false,
    });
    console.log("sig:", `https://solscan.io/tx/${sig}`);

    const txResult = await getTxDetails(connection, sig, commitment, finality);
    if (!txResult) {
      return {
        success: false,
        error: "Transaction failed",
      };
    }
    return {
      success: true,
      signature: sig,
      results: txResult,
    };
  } catch (e) {
    if (e instanceof SendTransactionError) {
      const ste = e as SendTransactionError;
      // TODO: Handle SendTransactionError specifically
    } else {
      console.error(e);
    }
    return {
      error: e,
      success: false,
    };
  }
}

/**
 * Builds a versioned transaction
 * @param {Connection} connection - The Solana connection object
 * @param {Transaction} tx - The transaction to build
 * @param {PublicKey} payer - The public key of the transaction payer
 * @param {Keypair[]} signers - Array of signers for the transaction
 * @param {PriorityFee} [priorityFees] - Optional priority fees
 * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
 * @param {Finality} [finality=DEFAULT_FINALITY] - The finality level
 * @returns {Promise<VersionedTransaction>} The built versioned transaction
 */
export async function buildTx(
  connection: Connection,
  tx: Transaction,
  payer: PublicKey,
  signers: Keypair[],
  priorityFees?: PriorityFee,
  commitment: Commitment = DEFAULT_COMMITMENT,
  finality: Finality = DEFAULT_FINALITY,
): Promise<VersionedTransaction> {
  const newTx = new Transaction();

  if (priorityFees) {
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: priorityFees.unitLimit,
    });

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFees.unitPrice,
    });
    newTx.add(modifyComputeUnits);
    newTx.add(addPriorityFee);
  }

  if (tx.instructions.length > 0 && tx.instructions[0]?.data) {
    const fee = calculateTransactionFee(BigInt(tx.instructions[0].data.length));
    newTx.add(createFeeInstruction(payer, fee));
  } else {
    console.warn(
      "Transaction has no instructions or first instruction has no data. Skipping fee calculation.",
    );
  }

  newTx.add(tx);
  const versionedTx = await buildVersionedTx(
    connection,
    payer,
    newTx,
    commitment,
  );
  versionedTx.sign(signers);
  return versionedTx;
}

/**
 * Builds a versioned transaction message
 * @param {Connection} connection - The Solana connection object
 * @param {PublicKey} payer - The public key of the transaction payer
 * @param {Transaction} tx - The transaction to build
 * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
 * @returns {Promise<VersionedTransaction>} The built versioned transaction
 */
export const buildVersionedTx = async (
  connection: Connection,
  payer: PublicKey,
  tx: Transaction,
  commitment: Commitment = DEFAULT_COMMITMENT,
): Promise<VersionedTransaction> => {
  const blockHash = (await connection.getLatestBlockhash(commitment)).blockhash;

  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockHash,
    instructions: tx.instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
};

/**
 * Retrieves transaction details
 * @param {Connection} connection - The Solana connection object
 * @param {string} sig - The transaction signature
 * @param {Commitment} [commitment=DEFAULT_COMMITMENT] - The commitment level
 * @param {Finality} [finality=DEFAULT_FINALITY] - The finality level
 * @returns {Promise<VersionedTransactionResponse | null>} The transaction details
 */
export const getTxDetails = async (
  connection: Connection,
  sig: string,
  commitment: Commitment = DEFAULT_COMMITMENT,
  finality: Finality = DEFAULT_FINALITY,
): Promise<VersionedTransactionResponse | null> => {
  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: sig,
    },
    commitment,
  );

  return connection.getTransaction(sig, {
    maxSupportedTransactionVersion: 0,
    commitment: finality,
  });
};

/**
 * Generates a random integer between min and max (inclusive)
 * @param {number} min - The minimum value
 * @param {number} max - The maximum value
 * @returns {number} A random integer between min and max
 */
export const getRandomInt = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
