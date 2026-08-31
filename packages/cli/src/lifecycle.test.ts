import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { BUILTIN_HOSTS } from "@distilly/protocol";
import { afterEach, describe, expect, it } from "vitest";

import {
  doctorPreview,
  setupPreviewHost,
  uninstallPreviewHost,
  type PreviewLifecycleEnvironment,
} from "./lifecycle.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIXED_NOW = new Date("2026-08-31T12:00:00.000Z");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const executable = async (path: string, version: string): Promise<void> => {
  await writeFile(
    path,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then\n  printf '%s\\n' '${version}'\nfi\nexit 0\n`,
    { mode: 0o755 },
  );
  await chmod(path, 0o755);
};

const fixture = async (): Promise<{
  readonly root: string;
  readonly home: string;
  readonly environment: PreviewLifecycleEnvironment;
}> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-cli-lifecycle-"));
  temporaryRoots.push(root);
  const home = join(root, "home");
  const bin = join(root, "host-bin");
  const entryPath = join(root, "distilly-entry.js");
  await mkdir(home);
  await mkdir(bin);
  await writeFile(entryPath, "// built Distilly entry fixture\n");
  await executable(join(bin, "codex"), "codex-cli 0.146.0");
  await executable(join(bin, "claude"), "2.1.220 (Claude Code)");
  return {
    root,
    home,
    environment: {
      homeDirectory: home,
      nodePath: process.execPath,
      entryPath,
      pluginSourcesPath: join(REPOSITORY_ROOT, "plugins"),
      pathValue: bin,
      now: () => FIXED_NOW,
    },
  };
};

describe("Developer Preview CLI lifecycle", () => {
  it("sets up Codex, diagnoses it, and preserves data through uninstall", async () => {
    const { home, environment } = await fixture();

    const codex = await setupPreviewHost(BUILTIN_HOSTS.codex, environment);
    const replay = await setupPreviewHost(BUILTIN_HOSTS.codex, environment);
    expect(replay).toEqual(codex);
    const launcher = join(home, ".distilly", "bin", "distilly");
    expect(codex.launcherPath).toBe(launcher);
    expect(await readFile(launcher, "utf8")).toContain(process.execPath);
    expect(
      JSON.parse(await readFile(join(home, "plugins", "distilly", ".mcp.json"), "utf8")),
    ).toEqual({
      distilly: { command: launcher, args: ["mcp", "--host", "codex"] },
    });
    await expect(doctorPreview(environment)).resolves.toMatchObject({
      ok: true,
      installed: true,
      launcherReachable: true,
      hosts: [{ host: "codex", installed: true }],
    });

    const personData = join(home, ".distilly", "people", "keep.txt");
    const personSkill = join(home, ".codex", "skills", "distilly-mira", "SKILL.md");
    await mkdir(join(home, ".distilly", "people"));
    await mkdir(join(home, ".codex", "skills", "distilly-mira"), { recursive: true });
    await writeFile(personData, "keep me\n");
    await writeFile(personSkill, "# keep this person Skill\n");
    await expect(uninstallPreviewHost(BUILTIN_HOSTS.codex, environment)).resolves.toEqual({
      host: BUILTIN_HOSTS.codex,
      removed: true,
      launcherRemoved: true,
    });
    await expect(readFile(launcher)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(personData, "utf8")).resolves.toBe("keep me\n");
    await expect(readFile(personSkill, "utf8")).resolves.toBe("# keep this person Skill\n");
  });

  it("reports tampered lifecycle bytes and refuses destructive uninstall", async () => {
    const { home, environment } = await fixture();
    await setupPreviewHost(BUILTIN_HOSTS.codex, environment);
    const launcher = join(home, ".distilly", "bin", "distilly");
    const personData = join(home, ".distilly", "people", "keep.txt");
    await mkdir(join(home, ".distilly", "people"));
    await writeFile(personData, "keep me\n");
    await writeFile(launcher, "#!/bin/sh\nexit 9\n", { mode: 0o755 });

    await expect(doctorPreview(environment)).resolves.toMatchObject({
      ok: false,
      installed: true,
      launcherReachable: false,
    });
    await expect(uninstallPreviewHost(BUILTIN_HOSTS.codex, environment)).rejects.toThrow(
      /missing or modified/u,
    );
    await expect(readFile(personData, "utf8")).resolves.toBe("keep me\n");
    await expect(readFile(launcher, "utf8")).resolves.toContain("exit 9");
  });

  it("removes a new bootstrap when no supported host executable is found", async () => {
    const { home, environment } = await fixture();

    await expect(
      setupPreviewHost(BUILTIN_HOSTS.codex, { ...environment, pathValue: "" }),
    ).rejects.toThrow(/Could not find/u);
    await expect(readFile(join(home, ".distilly", "bin", "distilly"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("fails before writing when the observed host version has no exact fixture", async () => {
    const { root, home, environment } = await fixture();
    await executable(join(root, "host-bin", "codex"), "codex-cli 99.0.0");

    await expect(setupPreviewHost(BUILTIN_HOSTS.codex, environment)).rejects.toThrow(
      /verified Distilly briefing capacity/u,
    );
    await expect(readFile(join(home, ".distilly", "install.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("fails before writing for a host whose real capacity evidence is not installed", async () => {
    const { home, environment } = await fixture();

    await expect(setupPreviewHost(BUILTIN_HOSTS.claudeCode, environment)).rejects.toThrow(
      /verified Distilly briefing capacity/u,
    );
    await expect(readFile(join(home, ".distilly", "install.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("refuses lifecycle parent symlinks without writing outside the data root", async () => {
    const { root, home, environment } = await fixture();
    const outside = join(root, "outside-bin");
    await mkdir(outside);
    await mkdir(join(home, ".distilly"));
    await symlink(outside, join(home, ".distilly", "bin"), "dir");

    await expect(setupPreviewHost(BUILTIN_HOSTS.codex, environment)).rejects.toThrow(
      /lifecycle directory/u,
    );
    await expect(readdir(outside)).resolves.toEqual([]);
  });
});
