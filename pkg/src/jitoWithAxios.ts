// src/jitoWithAxios.ts
import {
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import axios, { AxiosError } from "axios";

import base58 from "bs58";

interface Blockhash {
  blockhash: string;
  lastValidBlockHeight: number;
}

interface JitoConfig {
  connection: Connection;
  jitoFee: number;
  commitmentLevel: Commitment;
  blockEngineUrl: string;
}

export const jitoWithAxios = async (
  transactions: VersionedTransaction[],
  payer: Keypair,
  config: JitoConfig,
) => {
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
    let latestBlockhash = await config.connection.getLatestBlockhash();
    const jitTipTxFeeMessage = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: jitoFeeWallet,
          lamports: config.jitoFee,
        }),
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
