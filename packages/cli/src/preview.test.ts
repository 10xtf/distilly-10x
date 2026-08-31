import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  BUILTIN_HOSTS,
  facetPathSchema,
  isoDateTimeSchema,
  requestIdSchema,
  type CommitInput,
  type RequestId,
} from "@distilly/protocol";
import { afterEach, describe, expect, it } from "vitest";

import { openPreviewMcpApplication, type PreviewMcpApplication } from "./preview.js";

const CAPACITY = {
  maximumInputTokens: 4_194_304,
  maximumToolResultBytes: 4_194_304,
  source: "binding_fixture" as const,
};
const IDENTITY = facetPathSchema.parse("identity");
let requestCounter = 1;
const roots: string[] = [];
const applications: PreviewMcpApplication[] = [];

const request = (): RequestId =>
  requestIdSchema.parse(`req_${(requestCounter++).toString(16).padStart(32, "0")}`);

const open = async (root: string): Promise<PreviewMcpApplication> => {
  const application = await openPreviewMcpApplication({
    root,
    host: BUILTIN_HOSTS.codex,
    sessionId: "preview-test-session",
    capacity: CAPACITY,
    panel: {
      assetsDir: resolve("packages/panel/web"),
      port: 43_191,
    },
  });
  applications.push(application);
  return application;
};

const close = async (application: PreviewMcpApplication): Promise<void> => {
  await application.close();
  const index = applications.indexOf(application);
  if (index !== -1) applications.splice(index, 1);
};

afterEach(async () => {
  await Promise.allSettled(applications.splice(0).map((application) => application.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("Developer Preview MCP application", () => {
  it("shares one real local authority across Distilly, Person, review, and reopen", async () => {
    const root = await mkdtemp(join(tmpdir(), "distilly-preview-mcp-"));
    roots.push(root);
    const first = await open(root);
    const person = await first.distilly.create(
      { displayName: "Mira Chen", aliases: ["Mira"], identityHints: [] },
      { requestId: request() },
    );
    const ingested = await person.ingest(
      [
        {
          clientRef: "mira-note",
          kind: "document",
          content: "Mira builds reliable local-first systems and explains evidence precisely.",
          source: {
            medium: "document",
            access: "private",
            capturedAt: isoDateTimeSchema.parse("2026-08-31T20:00:00.000Z"),
          },
          derivation: { kind: "native_text" },
        },
      ],
      { enqueue: "now" },
      { requestId: request() },
    );
    if (ingested.job === undefined) throw new Error("Expected immediate distillation work.");
    const briefing = await first.distilly.brief(
      { jobId: ingested.job.id },
      { requestId: request() },
    );
    const materialRef = briefing.materials[0]?.ref;
    if (materialRef === undefined) throw new Error("Expected one briefing material.");
    const patch: CommitInput["patch"] = {
      operations: [
        {
          op: "add",
          claim: {
            facet: IDENTITY,
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
    };
    const committed = await first.distilly.commit(
      {
        jobId: briefing.job.id,
        generation: briefing.job.generation,
        leaseId: briefing.lease.id,
        briefContractDigest: briefing.contract.digest,
        materialSetHash: briefing.job.materialSetHash,
        patch,
      },
      { requestId: request() },
    );
    expect(committed.kind).toBe("current");
    await expect(person.get()).resolves.toMatchObject({ subjectId: person.id });
    await expect(person.prompt()).resolves.toContain("Mira builds reliable local-first systems");

    const correction = await person.correct(
      { text: "Mira prioritizes auditable local-first systems." },
      { requestId: request() },
    );
    expect(correction.kind).toBe("current");
    await expect(person.prompt()).resolves.toContain(
      "Mira prioritizes auditable local-first systems.",
    );

    await close(first);
    const reopened = await open(root);
    const resolution = await reopened.distilly.resolve({
      selector: { kind: "id", subjectId: person.id },
    });
    expect(resolution.kind).toBe("found");
    await expect(reopened.distilly.person(person.id).prompt()).resolves.toContain(
      "Mira prioritizes auditable local-first systems.",
    );
  });

  it("waits for its active stdio transport before releasing the local root", async () => {
    const root = await mkdtemp(join(tmpdir(), "distilly-preview-mcp-close-"));
    roots.push(root);
    const first = await open(root);
    const serving = first.runStdio();

    await close(first);
    await expect(serving).resolves.toBeUndefined();

    const reopened = await open(root);
    await expect(reopened.distilly.list()).resolves.toMatchObject({ items: [] });
  });
});
