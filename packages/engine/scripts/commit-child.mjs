import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { createInternalEngineComposition } from "../lib/ingest/composition.js";

const [root, payloadFile, requestId] = process.argv.slice(2);
if (root === undefined || payloadFile === undefined || requestId === undefined) {
  throw new Error("commit-child requires root, payload file, and request id");
}

const payload = JSON.parse(await readFile(payloadFile, "utf8"));
const deadline = Date.now() + 10_000;

for (;;) {
  try {
    const composition = await createInternalEngineComposition({ root });
    const result = await composition.commits.commit(payload.input, payload.session, { requestId });
    process.stdout.write(`result:${JSON.stringify({ kind: "success", result })}\n`);
    break;
  } catch (error) {
    if (error?.code === "stale_job") {
      process.stdout.write('result:{"kind":"stale_job"}\n');
      break;
    }
    if (error?.code !== "busy" || Date.now() >= deadline) throw error;
    await delay(20);
  }
}
