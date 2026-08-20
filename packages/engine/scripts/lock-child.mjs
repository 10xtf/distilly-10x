import { appendFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { SystemClock } from "../lib/defaults/system-clock.js";
import { Layout } from "../lib/layout.js";
import { FileSubjectLock } from "../lib/transaction/subject-lock.js";

const [root, eventFile, label, rawHoldMilliseconds] = process.argv.slice(2);
if (
  root === undefined ||
  eventFile === undefined ||
  label === undefined ||
  rawHoldMilliseconds === undefined
) {
  throw new Error("lock-child requires root, event file, label, and hold milliseconds");
}

const holdMilliseconds = Number(rawHoldMilliseconds);
if (!Number.isSafeInteger(holdMilliseconds) || holdMilliseconds < 0) {
  throw new Error("lock-child hold milliseconds must be a non-negative safe integer");
}

const subjectId = `subject_${"1".repeat(32)}`;
const lock = new FileSubjectLock(new Layout(root), new SystemClock());
const deadline = Date.now() + 5_000;
let lease;
while (lease === undefined) {
  try {
    lease = await lock.acquire(subjectId);
  } catch (error) {
    if (error?.code !== "busy" || Date.now() >= deadline) throw error;
    await delay(20);
  }
}

await appendFile(eventFile, `acquired:${label}\n`);
process.stdout.write(`acquired:${label}\n`);
await delay(holdMilliseconds);
await appendFile(eventFile, `releasing:${label}\n`);
await lease.release();
process.stdout.write(`released:${label}\n`);
