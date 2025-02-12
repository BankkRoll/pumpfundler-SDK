import {
  type Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  type VersionedTransaction,
} from "@solana/web3.js";
import {
  type SearcherClient,
  searcherClient,
} from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
import base58 from "bs58";
import { isError } from "jito-ts/dist/sdk/block-engine/utils";

interface JitoConfig {
  connection: Connection;
  jitoFee: number;
  blockEngineUrl: string;
  jitoAuthKeypair: string;
}

interface AccountsResult {
  ok: boolean;
  error?: { message: string };
  value?: string[];
}

interface SendResult {
  ok: boolean;
  error?: { message: string };
}

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
  bund.addTransactions(...txs);

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
