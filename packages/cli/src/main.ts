import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { realpath } from "node:fs/promises";

import { BUILTIN_HOSTS, type HostName } from "@distilly/protocol";

import {
  doctorPreview,
  requireInstalledPreviewBinding,
  setupPreviewHost,
  uninstallPreviewHost,
  type PreviewLifecycleEnvironment,
} from "./lifecycle.js";

/** Process streams kept injectable for focused command tests. */
export interface PreviewCliIo {
  readonly stdout: { write(value: string): unknown };
  readonly stderr: { write(value: string): unknown };
}

/** Explicit command environment; packaged Preview assembly can replace repo-local paths later. */
export interface PreviewCliEnvironment {
  readonly lifecycle: PreviewLifecycleEnvironment;
  readonly panelAssetsPath: string;
}

const parseHost = (value: string | undefined): HostName => {
  if (value === BUILTIN_HOSTS.codex) return BUILTIN_HOSTS.codex;
  throw new Error("--host must be codex for this Developer Preview.");
};

const hostOption = (args: readonly string[], required: boolean): HostName | undefined => {
  if (args.length === 0 && !required) return undefined;
  if (args.length !== 2 || args[0] !== "--host") {
    throw new Error(required ? "This command requires --host." : "Expected only --host <host>.");
  }
  return parseHost(args[1]);
};

const freePanelPort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    throw new Error("Could not reserve a local Panel port.");
  }
  await new Promise<void>((resolvePromise, reject) =>
    server.close((error) => (error === undefined ? resolvePromise() : reject(error))),
  );
  return address.port;
};

const runMcp = async (host: HostName, environment: PreviewCliEnvironment): Promise<void> => {
  const binding = await requireInstalledPreviewBinding(environment.lifecycle, host);
  const hostContext = {
    sessionId: `${host}-preview-mcp-${process.pid}`,
    environment: "cli" as const,
  };
  const preflight = await binding.preflight(hostContext);
  if (!preflight.ok) throw new Error(preflight.error.message);
  const { openPreviewMcpApplication } = await import("./preview.js");
  const application = await openPreviewMcpApplication({
    root: join(environment.lifecycle.homeDirectory, ".distilly"),
    binding,
    hostContext,
    capacity: preflight.capacity,
    panel: {
      assetsDir: environment.panelAssetsPath,
      port: await freePanelPort(),
    },
  });
  try {
    await application.runStdio();
  } finally {
    await application.close();
  }
};

/**
 * Resolves the repo-local built entry used before packaged Preview assembly.
 *
 * @returns Trusted paths derived from this built command entry.
 */
export const resolvePreviewCliEnvironment = async (): Promise<PreviewCliEnvironment> => {
  const configuredHome = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
  if (!isAbsolute(configuredHome)) throw new Error("The user home path must be absolute.");
  const entryPath = await realpath(fileURLToPath(new URL("./bin.js", import.meta.url)));
  const packageRoot = resolve(dirname(entryPath), "..");
  return {
    lifecycle: {
      homeDirectory: resolve(configuredHome),
      nodePath: await realpath(process.execPath),
      entryPath,
      pluginSourcesPath: await realpath(resolve(packageRoot, "../..", "plugins")),
      pathValue: process.env.PATH ?? "",
    },
    panelAssetsPath: await realpath(resolve(packageRoot, "../panel/web")),
  };
};

const help = `Distilly Developer Preview

Usage:
  distilly setup --host codex
  distilly doctor [--host codex]
  distilly uninstall --host codex
`;

/**
 * Runs the narrow real Developer Preview command surface.
 *
 * @param argv - Command arguments after the executable name.
 * @param environment - Trusted lifecycle and Panel paths.
 * @param io - Process output streams.
 * @returns The process exit code.
 */
export const runPreviewCli = async (
  argv: readonly string[],
  environment: PreviewCliEnvironment,
  io: PreviewCliIo,
): Promise<number> => {
  const [command, ...args] = argv;
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    io.stdout.write(help);
    return 0;
  }
  if (command === "setup") {
    const host = hostOption(args, true);
    if (host === undefined) throw new Error("This command requires --host.");
    const result = await setupPreviewHost(host, environment.lifecycle);
    io.stdout.write(
      `Installed Distilly ${result.releaseVersion} for ${result.host}. Restart the host to discover it.\n`,
    );
    return 0;
  }
  if (command === "doctor") {
    const report = await doctorPreview(environment.lifecycle, hostOption(args, false));
    io.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
    return report.ok ? 0 : 1;
  }
  if (command === "uninstall") {
    const host = hostOption(args, true);
    if (host === undefined) throw new Error("This command requires --host.");
    const result = await uninstallPreviewHost(host, environment.lifecycle);
    io.stdout.write(
      `${result.removed ? "Removed" : "No installed integration for"} ${result.host}; person data was preserved.\n`,
    );
    return 0;
  }
  if (command === "mcp") {
    const host = hostOption(args, true);
    if (host === undefined) throw new Error("This command requires --host.");
    await runMcp(host, environment);
    return 0;
  }
  io.stderr.write(`Unknown or unavailable Developer Preview command: ${command}.\n`);
  return 2;
};
