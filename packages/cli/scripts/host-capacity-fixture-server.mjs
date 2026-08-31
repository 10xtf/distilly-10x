import { createMcpServer } from "@distilly/mcp";
import { runStdio } from "@distilly/mcp/stdio";

import { SUBJECT_ID, briefing, prompt } from "./host-capacity-fixture-data.mjs";

const subject = briefing.subject;

const client = {
  async call(method) {
    if (method === "subjects.resolve") return { kind: "found", subject };
    if (method === "profiles.prompt") return prompt;
    if (method === "distill.brief") return briefing;
    throw new Error(`Unexpected capacity fixture method: ${method}`);
  },
  async watch() {
    return () => undefined;
  },
  async close() {},
};

const reviewPresenter = {
  async present(ref) {
    return { ref, url: `http://127.0.0.1/review/${SUBJECT_ID}` };
  },
  async close() {},
};

const server = createMcpServer({ client, reviewPresenter });

try {
  await runStdio(server);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
}
