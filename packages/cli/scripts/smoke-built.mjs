import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { distillyMcpTools } from "@distilly/protocol";

const rootExports = await import("@distilly/cli");
const previewExports = await import("@distilly/cli/preview");
assert.deepEqual(Object.keys(rootExports), []);
assert.deepEqual(Object.keys(previewExports), ["openPreviewMcpApplication"]);

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const fixturePath = fileURLToPath(new URL("./stdio-preview.mjs", import.meta.url));
const panelAssets = fileURLToPath(new URL("../../panel/web/", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "distilly-preview-mcp-built-"));
let requestCounter = 10;
const requestId = () => `req_${(requestCounter++).toString(16).padStart(32, "0")}`;

const freePort = async () => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
};

const withTimeout = async (label, operation, milliseconds = 10_000) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const waitUntil = async (predicate) => {
  while (!predicate()) await new Promise((resolve) => setTimeout(resolve, 10));
};

const connect = async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fixturePath],
    cwd: packageRoot,
    env: {
      ...process.env,
      NODE_NO_WARNINGS: "1",
      DISTILLY_PREVIEW_ROOT: root,
      DISTILLY_PREVIEW_PANEL_ASSETS: panelAssets,
      DISTILLY_PREVIEW_PANEL_PORT: String(await freePort()),
    },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.setEncoding("utf8");
  transport.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const client = new Client({ name: "distilly-preview-built-smoke", version: "0.0.0" });
  await withTimeout("Preview MCP initialize", client.connect(transport));
  return { client, transport, stderr: () => stderr };
};

const output = (toolIndex, result) => {
  const contract = distillyMcpTools[toolIndex];
  assert.ok(contract);
  return contract.output.parse(result.structuredContent);
};

try {
  const first = await connect();
  let subjectId;
  try {
    const listed = await first.client.listTools();
    assert.deepEqual(
      listed.tools.map(({ name }) => name),
      distillyMcpTools.map(({ name }) => name),
    );

    const ingested = output(
      1,
      await first.client.callTool({
        name: "distilly_ingest",
        arguments: {
          wireVersion: "3",
          requestId: requestId(),
          subject: {
            kind: "create",
            input: { displayName: "Mira Chen", aliases: ["Mira"], identityHints: [] },
          },
          materials: [
            {
              clientRef: "built-note",
              kind: "document",
              content: "Mira builds reliable local-first systems and explains evidence precisely.",
              source: {
                medium: "document",
                access: "private",
                capturedAt: "2026-08-31T20:00:00.000Z",
              },
              derivation: { kind: "native_text" },
            },
          ],
          enqueue: "now",
        },
      }),
    );
    assert.equal(ingested.ok, true);
    assert.equal(ingested.value.kind, "ingested");
    subjectId = ingested.value.subject.id;

    const pending = output(
      2,
      await first.client.callTool({
        name: "distilly_pending",
        arguments: {
          wireVersion: "3",
          requestId: requestId(),
          action: "list",
          subjectId,
        },
      }),
    );
    assert.equal(pending.ok && pending.value.kind, "jobs");
    const job = pending.value.jobs[0];
    assert.ok(job);

    const brief = output(
      2,
      await first.client.callTool({
        name: "distilly_pending",
        arguments: {
          wireVersion: "3",
          requestId: requestId(),
          action: "brief",
          jobId: job.id,
        },
      }),
    );
    assert.equal(brief.ok && brief.value.kind, "briefing");
    const briefing = brief.value.briefing;
    const materialRef = briefing.materials[0]?.ref;
    assert.ok(materialRef);

    const committed = output(
      3,
      await first.client.callTool({
        name: "distilly_commit",
        arguments: {
          wireVersion: "3",
          requestId: requestId(),
          jobId: briefing.job.id,
          generation: briefing.job.generation,
          leaseId: briefing.lease.id,
          briefContractDigest: briefing.contract.digest,
          materialSetHash: briefing.job.materialSetHash,
          patch: {
            operations: [
              {
                op: "add",
                claim: {
                  facet: "identity",
                  text: "Mira builds reliable local-first systems.",
                  evidence: [
                    {
                      kind: "brief_material",
                      materialRef,
                      quote: "Mira builds reliable local-first systems",
                    },
                  ],
                },
              },
            ],
          },
        },
      }),
    );
    assert.equal(committed.ok && committed.value.kind, "current");

    const profile = output(
      0,
      await first.client.callTool({
        name: "distilly_get",
        arguments: {
          wireVersion: "3",
          requestId: requestId(),
          action: "prompt",
          subject: { kind: "id", subjectId },
        },
      }),
    );
    assert.equal(profile.ok && profile.value.kind, "prompt");
    assert.match(profile.value.prompt, /reliable local-first systems/u);

    const corrected = output(
      4,
      await first.client.callTool({
        name: "distilly_correct",
        arguments: {
          wireVersion: "3",
          requestId: requestId(),
          subjectId,
          text: "Mira prioritizes auditable local-first systems.",
        },
      }),
    );
    assert.equal(corrected.ok && corrected.value.kind, "suspended");
    const reviewUrl = new URL(corrected.value.review.url);
    const health = await fetch(`${reviewUrl.origin}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      panelVersion: "0.0.0",
      status: "ready",
      wireVersion: "3",
    });
  } finally {
    await withTimeout("first Preview MCP close", first.client.close(), 5_000);
    await withTimeout(
      "first Preview child exit",
      waitUntil(() => first.transport.pid === null),
      5_000,
    );
    assert.equal(first.stderr(), "");
  }

  const reopened = await connect();
  try {
    const profile = output(
      0,
      await reopened.client.callTool({
        name: "distilly_get",
        arguments: {
          wireVersion: "3",
          requestId: requestId(),
          action: "profile",
          subject: { kind: "id", subjectId },
        },
      }),
    );
    assert.equal(profile.ok && profile.value.kind, "profile");
    assert.equal(profile.value.subject.id, subjectId);
  } finally {
    await withTimeout("reopened Preview MCP close", reopened.client.close(), 5_000);
    await withTimeout(
      "reopened Preview child exit",
      waitUntil(() => reopened.transport.pid === null),
      5_000,
    );
    assert.equal(reopened.stderr(), "");
  }
} finally {
  await rm(root, { force: true, recursive: true });
}
