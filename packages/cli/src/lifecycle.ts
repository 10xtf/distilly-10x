import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join } from "node:path";

import {
  createClaudeCodeHostBinding,
  createCodexHostBinding,
  type HostBinding,
  type HostFormPresenter,
} from "@distilly/bindings";
import {
  BUILTIN_HOSTS,
  contentDigestSchema,
  hostNameSchema,
  isoDateTimeSchema,
  type ContentDigest,
  type HostName,
} from "@distilly/protocol";

import { loadPreviewHostFixture } from "./host-capacity-fixtures.js";

const INSTALL_FILE = "install.json";
const LAUNCHER_FILE = "distilly";
const RUNTIME_FILE = "runtime.json";
const RELEASE_FILE = "release-manifest.json";
const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

interface ReleaseManifest {
  readonly releaseVersion: string;
  readonly canonicalSkillDigest: ContentDigest;
}

interface InstalledHost {
  readonly host: HostName;
  readonly executablePath: string;
  readonly hostVersion: string;
  readonly installedAt: string;
}

interface PreviewInstallManifest {
  readonly schemaVersion: 1;
  readonly releaseVersion: string;
  readonly wireMajor: 3;
  readonly nodePath: string;
  readonly entryPath: string;
  readonly launcherPath: string;
  readonly launcherDigest: ContentDigest;
  readonly runtimePath: string;
  readonly runtimeDigest: ContentDigest;
  readonly hosts: readonly InstalledHost[];
}

interface LifecyclePaths {
  readonly root: string;
  readonly install: string;
  readonly launcher: string;
  readonly runtimeDirectory: string;
  readonly runtime: string;
}

/** Trusted local paths used by the repo-local Developer Preview lifecycle. */
export interface PreviewLifecycleEnvironment {
  readonly homeDirectory: string;
  readonly nodePath: string;
  readonly entryPath: string;
  readonly pluginSourcesPath: string;
  readonly pathValue: string;
  readonly now?: () => Date;
}

/** One setup result suitable for concise human CLI output. */
export interface PreviewSetupResult {
  readonly host: HostName;
  readonly launcherPath: string;
  readonly releaseVersion: string;
  readonly restartRequired: true;
}

/** Narrow lifecycle plus binding health; it deliberately excludes deep Engine doctor. */
export interface PreviewDoctorReport {
  readonly ok: boolean;
  readonly installed: boolean;
  readonly releaseVersion?: string;
  readonly launcherReachable: boolean;
  readonly hosts: readonly {
    readonly host: HostName;
    readonly installed: boolean;
    readonly executableReachable: boolean;
    readonly launcherReachable: boolean;
    readonly wireCompatible: boolean;
    readonly warnings: readonly string[];
  }[];
  readonly warnings: readonly string[];
}

/** Result of removing one host projection without touching person data. */
export interface PreviewUninstallResult {
  readonly host: HostName;
  readonly removed: boolean;
  readonly launcherRemoved: boolean;
}

const fail = (message: string): Error => new Error(message);

const previewHost = (value: HostName): HostName => {
  const host = hostNameSchema.parse(value);
  if (host === BUILTIN_HOSTS.codex) return BUILTIN_HOSTS.codex;
  if (host === BUILTIN_HOSTS.claudeCode) return BUILTIN_HOSTS.claudeCode;
  throw fail("The Developer Preview supports only Codex and Claude Code.");
};

const compareUtf8 = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort(compareUtf8);
  const expected = [...keys].sort(compareUtf8);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const digest = (bytes: Uint8Array | string): ContentDigest =>
  contentDigestSchema.parse(`sha256_${createHash("sha256").update(bytes).digest("hex")}`);

const jsonBytes = (value: unknown): Uint8Array =>
  Buffer.from(`${JSON.stringify(value, undefined, 2)}\n`, "utf8");

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'"'"'`)}'`;

const launcherBytes = (nodePath: string, entryPath: string): Uint8Array =>
  Buffer.from(`#!/bin/sh\nexec ${shellQuote(nodePath)} ${shellQuote(entryPath)} "$@"\n`, "utf8");

const runtimeBytes = (releaseVersion: string, nodePath: string, entryPath: string): Uint8Array =>
  jsonBytes({ schemaVersion: 1, releaseVersion, nodePath, entryPath });

const pathsFor = (homeDirectory: string, releaseVersion: string): LifecyclePaths => {
  const root = join(homeDirectory, ".distilly");
  const runtimeDirectory = join(root, "runtime", releaseVersion);
  return {
    root,
    install: join(root, INSTALL_FILE),
    launcher: join(root, "bin", LAUNCHER_FILE),
    runtimeDirectory,
    runtime: join(runtimeDirectory, RUNTIME_FILE),
  };
};

const readOptionalRegularFile = async (path: string): Promise<Uint8Array | undefined> => {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw fail(`Expected a regular owned file at ${path}.`);
  }
  return Uint8Array.from(await readFile(path));
};

const ensureRoot = async (root: string): Promise<void> => {
  const metadata = await lstat(root).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (metadata !== undefined && (!metadata.isDirectory() || metadata.isSymbolicLink())) {
    throw fail("The Distilly data root must be a regular directory, not a symlink.");
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
};

const ensureRegularDirectory = async (path: string, create: boolean): Promise<void> => {
  let metadata = await lstat(path).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  });
  if (metadata === undefined && create) {
    await mkdir(path, { mode: 0o700 }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    });
    metadata = await lstat(path);
  }
  if (metadata === undefined || !metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw fail("A Distilly lifecycle directory is missing or is not a regular directory.");
  }
};

const verifyLifecycleDirectories = async (
  paths: LifecyclePaths,
  create: boolean,
): Promise<void> => {
  await ensureRegularDirectory(paths.root, false);
  await ensureRegularDirectory(dirname(paths.launcher), create);
  const runtimeRoot = dirname(paths.runtimeDirectory);
  await ensureRegularDirectory(runtimeRoot, create);
  await ensureRegularDirectory(paths.runtimeDirectory, create);
};

const atomicWrite = async (path: string, bytes: Uint8Array, mode: number): Promise<void> => {
  const temporary = `${path}.distilly-${randomUUID()}`;
  try {
    await writeFile(temporary, bytes, { mode, flag: "wx" });
    await rename(temporary, path);
    await chmod(path, mode);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
};

const removeIfPresent = async (path: string): Promise<void> => {
  await unlink(path).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
};

const removeEmptyDirectory = async (path: string): Promise<void> => {
  await rmdir(path).catch((error: unknown) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTEMPTY") throw error;
  });
};

const parseRelease = (bytes: Uint8Array): ReleaseManifest => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw fail("The plugin release manifest is not valid UTF-8 JSON.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw fail("The plugin release manifest is invalid.");
  }
  const record = value as Record<string, unknown>;
  const canonicalSkill = record.canonicalSkill;
  const wire = record.wire;
  if (
    typeof record.releaseVersion !== "string" ||
    !SEMVER_PATTERN.test(record.releaseVersion) ||
    canonicalSkill === null ||
    typeof canonicalSkill !== "object" ||
    Array.isArray(canonicalSkill) ||
    !contentDigestSchema.safeParse((canonicalSkill as Record<string, unknown>).digest).success ||
    wire === null ||
    typeof wire !== "object" ||
    Array.isArray(wire) ||
    (wire as Record<string, unknown>).minimumMajor !== 3 ||
    (wire as Record<string, unknown>).maximumMajor !== 3
  ) {
    throw fail("The plugin release manifest is incompatible with this Preview.");
  }
  return {
    releaseVersion: record.releaseVersion,
    canonicalSkillDigest: (canonicalSkill as { digest: ContentDigest }).digest,
  };
};

/**
 * Reads the exact release tuple consumed by setup and MCP preflight.
 *
 * @param pluginSourcesPath - Absolute root containing the release manifest.
 * @returns The validated Preview release tuple.
 */
export const readPreviewRelease = async (pluginSourcesPath: string): Promise<ReleaseManifest> => {
  if (!isAbsolute(pluginSourcesPath)) throw fail("The plugin source path must be absolute.");
  const bytes = await readOptionalRegularFile(join(pluginSourcesPath, RELEASE_FILE));
  if (bytes === undefined) throw fail("The plugin release manifest is missing.");
  return parseRelease(bytes);
};

const parseInstalledHost = (value: unknown): InstalledHost => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw fail("The Preview install manifest contains an invalid host entry.");
  }
  const record = value as Record<string, unknown>;
  const host = hostNameSchema.safeParse(record.host);
  const installedAt = isoDateTimeSchema.safeParse(record.installedAt);
  if (
    !hasExactKeys(record, ["host", "executablePath", "hostVersion", "installedAt"]) ||
    !host.success ||
    (host.data !== BUILTIN_HOSTS.codex && host.data !== BUILTIN_HOSTS.claudeCode) ||
    typeof record.executablePath !== "string" ||
    !isAbsolute(record.executablePath) ||
    typeof record.hostVersion !== "string" ||
    record.hostVersion.length === 0 ||
    record.hostVersion.length > 256 ||
    record.hostVersion.includes("\n") ||
    record.hostVersion.includes("\r") ||
    !installedAt.success
  ) {
    throw fail("The Preview install manifest contains an invalid host entry.");
  }
  return {
    host: host.data,
    executablePath: record.executablePath,
    hostVersion: record.hostVersion,
    installedAt: installedAt.data,
  };
};

const parseInstallManifest = (bytes: Uint8Array): PreviewInstallManifest => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw fail("The Preview install manifest is not valid UTF-8 JSON.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw fail("The Preview install manifest is invalid.");
  }
  const record = value as Record<string, unknown>;
  const launcherDigest = contentDigestSchema.safeParse(record.launcherDigest);
  const runtimeDigest = contentDigestSchema.safeParse(record.runtimeDigest);
  if (
    !hasExactKeys(record, [
      "schemaVersion",
      "releaseVersion",
      "wireMajor",
      "nodePath",
      "entryPath",
      "launcherPath",
      "launcherDigest",
      "runtimePath",
      "runtimeDigest",
      "hosts",
    ]) ||
    record.schemaVersion !== 1 ||
    typeof record.releaseVersion !== "string" ||
    !SEMVER_PATTERN.test(record.releaseVersion) ||
    record.wireMajor !== 3 ||
    typeof record.nodePath !== "string" ||
    !isAbsolute(record.nodePath) ||
    typeof record.entryPath !== "string" ||
    !isAbsolute(record.entryPath) ||
    typeof record.launcherPath !== "string" ||
    !isAbsolute(record.launcherPath) ||
    !launcherDigest.success ||
    typeof record.runtimePath !== "string" ||
    !isAbsolute(record.runtimePath) ||
    !runtimeDigest.success ||
    !Array.isArray(record.hosts)
  ) {
    throw fail("The Preview install manifest is invalid.");
  }
  const hosts = record.hosts
    .map(parseInstalledHost)
    .sort((left, right) => compareUtf8(left.host, right.host));
  if (hosts.length > 2 || new Set(hosts.map((entry) => entry.host)).size !== hosts.length) {
    throw fail("The Preview install manifest contains duplicate hosts.");
  }
  return {
    schemaVersion: 1,
    releaseVersion: record.releaseVersion,
    wireMajor: 3,
    nodePath: record.nodePath,
    entryPath: record.entryPath,
    launcherPath: record.launcherPath,
    launcherDigest: launcherDigest.data,
    runtimePath: record.runtimePath,
    runtimeDigest: runtimeDigest.data,
    hosts,
  };
};

const readInstallManifest = async (path: string): Promise<PreviewInstallManifest | undefined> => {
  const bytes = await readOptionalRegularFile(path);
  return bytes === undefined ? undefined : parseInstallManifest(bytes);
};

const verifyOwnedFile = async (
  path: string,
  expectedDigest: ContentDigest,
  executable = false,
): Promise<void> => {
  const bytes = await readOptionalRegularFile(path);
  if (bytes === undefined || digest(bytes) !== expectedDigest) {
    throw fail(`An owned Distilly lifecycle file is missing or modified: ${path}.`);
  }
  if (executable && process.platform !== "win32") {
    await access(path, constants.X_OK).catch(() => {
      throw fail(`The Distilly launcher is not executable: ${path}.`);
    });
  }
};

const verifyManifestPaths = (
  manifest: PreviewInstallManifest,
  environment: PreviewLifecycleEnvironment,
): LifecyclePaths => {
  const expected = pathsFor(environment.homeDirectory, manifest.releaseVersion);
  if (
    manifest.launcherPath !== expected.launcher ||
    manifest.runtimePath !== expected.runtime ||
    manifest.nodePath !== environment.nodePath ||
    manifest.entryPath !== environment.entryPath
  ) {
    throw fail("The Preview lifecycle manifest does not match this installed entry.");
  }
  return expected;
};

const verifyBootstrap = async (
  manifest: PreviewInstallManifest,
  environment: PreviewLifecycleEnvironment,
): Promise<LifecyclePaths> => {
  const paths = verifyManifestPaths(manifest, environment);
  await verifyLifecycleDirectories(paths, false);
  await verifyOwnedFile(paths.launcher, manifest.launcherDigest, true);
  await verifyOwnedFile(paths.runtime, manifest.runtimeDigest);
  return paths;
};

const hostExecutableName = (host: HostName): "codex" | "claude" =>
  host === BUILTIN_HOSTS.codex ? "codex" : "claude";

/**
 * Finds one executable through absolute PATH entries and stores its resolved path.
 *
 * @param host - Supported host whose executable is required.
 * @param pathValue - PATH string containing only explicitly searched entries.
 * @returns The resolved regular executable path.
 */
const findHostExecutable = async (host: HostName, pathValue: string): Promise<string> => {
  const name = hostExecutableName(host);
  const suffixes = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of pathValue.split(delimiter)) {
    if (!isAbsolute(directory)) continue;
    for (const suffix of suffixes) {
      const candidate = join(directory, `${name}${suffix}`);
      try {
        await access(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
        const resolved = await realpath(candidate);
        const metadata = await lstat(resolved);
        if (metadata.isFile() && !metadata.isSymbolicLink()) return resolved;
      } catch {
        // Try the next explicit PATH entry.
      }
    }
  }
  throw fail(`Could not find the ${name} executable on PATH.`);
};

const probeHostVersion = async (executablePath: string, homeDirectory: string): Promise<string> =>
  new Promise((resolvePromise, reject) => {
    execFile(
      executablePath,
      ["--version"],
      {
        encoding: "utf8",
        env: { ...process.env, HOME: homeDirectory, USERPROFILE: homeDirectory },
        maxBuffer: 4_096,
        timeout: 5_000,
      },
      (error, stdout, stderr) => {
        if (error !== null) {
          reject(fail("The host executable version probe failed."));
          return;
        }
        const standard = stdout.trim();
        const diagnostic = stderr.trim();
        const version = standard.length > 0 && diagnostic.length === 0 ? standard : "";
        if (
          version.length === 0 ||
          version.length > 256 ||
          version.includes("\n") ||
          version.includes("\r")
        ) {
          reject(fail("The host executable returned an invalid version."));
          return;
        }
        resolvePromise(version);
      },
    );
  });

const forms: HostFormPresenter = {
  ask: () =>
    Promise.reject(fail("Interactive host forms are not available during lifecycle setup.")),
};

const createBinding = (
  host: HostName,
  hostVersion: string,
  environment: PreviewLifecycleEnvironment,
  release: ReleaseManifest,
  executablePath: string,
): HostBinding => {
  const options = {
    homeDirectory: environment.homeDirectory,
    forms,
    provider: {
      load: (context: { readonly environment: "desktop" | "cli" | "ci" }) =>
        Promise.resolve(
          loadPreviewHostFixture(host, hostVersion, context.environment, {
            releaseVersion: release.releaseVersion,
            canonicalSkillDigest: release.canonicalSkillDigest,
          }),
        ),
    },
    release: {
      releaseVersion: release.releaseVersion,
      wireMajor: 3 as const,
      canonicalSkillDigest: release.canonicalSkillDigest,
    },
    ...(environment.now === undefined ? {} : { now: environment.now }),
  };
  return host === BUILTIN_HOSTS.codex
    ? createCodexHostBinding({ ...options, executablePath })
    : createClaudeCodeHostBinding(options);
};

const pluginSource = (pluginSourcesPath: string, host: HostName): string =>
  join(pluginSourcesPath, host === BUILTIN_HOSTS.codex ? "codex" : "claude-code");

const installContext = (
  paths: LifecyclePaths,
  release: ReleaseManifest,
  pluginSourcesPath: string,
  host: HostName,
) => ({
  launcherPath: paths.launcher,
  pluginSourcePath: pluginSource(pluginSourcesPath, host),
  runtimeVersion: release.releaseVersion,
});

const writeManifest = async (path: string, manifest: PreviewInstallManifest): Promise<void> =>
  atomicWrite(path, jsonBytes(manifest), 0o600);

const removeBootstrap = async (paths: LifecyclePaths): Promise<void> => {
  await removeIfPresent(paths.launcher);
  await removeIfPresent(paths.runtime);
  await removeEmptyDirectory(dirname(paths.launcher));
  await removeEmptyDirectory(paths.runtimeDirectory);
  await removeEmptyDirectory(dirname(paths.runtimeDirectory));
};

const assertEnvironment = (environment: PreviewLifecycleEnvironment): void => {
  if (
    !isAbsolute(environment.homeDirectory) ||
    !isAbsolute(environment.nodePath) ||
    !isAbsolute(environment.entryPath) ||
    !isAbsolute(environment.pluginSourcesPath)
  ) {
    throw fail("Preview lifecycle paths must be absolute.");
  }
  const [majorText, minorText] = process.versions.node.split(".");
  const major = Number(majorText);
  const minor = Number(minorText);
  if (!((major === 22 && minor >= 19) || major === 24)) {
    throw fail("Distilly Developer Preview requires Node 22.19+ or Node 24.");
  }
  if (!new Set(["darwin", "linux"]).has(process.platform)) {
    throw fail(`Distilly Developer Preview does not support ${process.platform}.`);
  }
};

/**
 * Installs one real host integration around the current checked built entry.
 *
 * @param hostValue - Codex or Claude Code.
 * @param environment - Trusted local lifecycle paths and clock.
 * @returns The installed host and restart requirement.
 */
export const setupPreviewHost = async (
  hostValue: HostName,
  environment: PreviewLifecycleEnvironment,
): Promise<PreviewSetupResult> => {
  assertEnvironment(environment);
  const host = previewHost(hostValue);
  const release = await readPreviewRelease(environment.pluginSourcesPath);
  const paths = pathsFor(environment.homeDirectory, release.releaseVersion);
  const executablePath = await findHostExecutable(host, environment.pathValue);
  const hostVersion = await probeHostVersion(executablePath, environment.homeDirectory);
  const binding = createBinding(host, hostVersion, environment, release, executablePath);
  const preflight = await binding.preflight({ sessionId: `setup-${host}`, environment: "cli" });
  if (!preflight.ok) throw fail(preflight.error.message);
  await ensureRoot(paths.root);
  await verifyLifecycleDirectories(paths, true);
  const previous = await readInstallManifest(paths.install);
  const expectedLauncher = launcherBytes(environment.nodePath, environment.entryPath);
  const expectedRuntime = runtimeBytes(
    release.releaseVersion,
    environment.nodePath,
    environment.entryPath,
  );
  const launcherDigest = digest(expectedLauncher);
  const runtimeDigest = digest(expectedRuntime);
  let createdBootstrap = false;
  if (previous === undefined) {
    if (
      (await readOptionalRegularFile(paths.launcher)) !== undefined ||
      (await readOptionalRegularFile(paths.runtime)) !== undefined
    ) {
      throw fail("Unowned Distilly bootstrap files already exist.");
    }
    try {
      await atomicWrite(paths.runtime, expectedRuntime, 0o600);
      await atomicWrite(paths.launcher, expectedLauncher, 0o700);
      createdBootstrap = true;
    } catch (error) {
      await removeBootstrap(paths);
      throw error;
    }
  } else {
    if (
      previous.releaseVersion !== release.releaseVersion ||
      previous.launcherDigest !== launcherDigest ||
      previous.runtimeDigest !== runtimeDigest
    ) {
      throw fail("A different Distilly runtime is installed; Preview upgrade is not enabled yet.");
    }
    await verifyBootstrap(previous, environment);
  }

  const existed = previous?.hosts.some((entry) => entry.host === host) ?? false;
  let bindingInstalled = false;
  try {
    const installed = await binding.installPlugin(
      installContext(paths, release, environment.pluginSourcesPath, host),
    );
    bindingInstalled = true;
    const health = await binding.doctor({ sessionId: `setup-${host}`, environment: "cli" });
    if (
      !installed.restartRequired ||
      !health.installed ||
      !health.launcherReachable ||
      !health.wireCompatible ||
      health.warnings.length > 0
    ) {
      throw fail(`Distilly setup could not verify the ${host} integration.`);
    }
    const priorHost = previous?.hosts.find((entry) => entry.host === host);
    const hostEntry: InstalledHost =
      priorHost === undefined
        ? {
            host,
            executablePath,
            hostVersion,
            installedAt: isoDateTimeSchema.parse(
              (environment.now ?? (() => new Date()))().toISOString(),
            ),
          }
        : { ...priorHost, executablePath, hostVersion };
    const hosts = [
      ...(previous?.hosts.filter((entry) => entry.host !== host) ?? []),
      hostEntry,
    ].sort((left, right) => compareUtf8(left.host, right.host));
    await writeManifest(paths.install, {
      schemaVersion: 1,
      releaseVersion: release.releaseVersion,
      wireMajor: 3,
      nodePath: environment.nodePath,
      entryPath: environment.entryPath,
      launcherPath: paths.launcher,
      launcherDigest,
      runtimePath: paths.runtime,
      runtimeDigest,
      hosts,
    });
    return {
      host,
      launcherPath: paths.launcher,
      releaseVersion: release.releaseVersion,
      restartRequired: true,
    };
  } catch (error) {
    if (bindingInstalled && !existed) {
      await binding
        .uninstallPlugin(installContext(paths, release, environment.pluginSourcesPath, host))
        .catch(() => undefined);
    }
    if (createdBootstrap) await removeBootstrap(paths).catch(() => undefined);
    throw error;
  }
};

const executableReachable = async (path: string): Promise<boolean> => {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile()) return false;
    if (process.platform !== "win32") await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Reads only lifecycle ownership and each installed binding's narrow doctor.
 *
 * @param environment - Trusted local lifecycle paths and clock.
 * @param hostFilter - Optional supported host to diagnose.
 * @returns Narrow lifecycle and binding health.
 */
export const doctorPreview = async (
  environment: PreviewLifecycleEnvironment,
  hostFilter?: HostName,
): Promise<PreviewDoctorReport> => {
  assertEnvironment(environment);
  const warnings: string[] = [];
  let manifest: PreviewInstallManifest | undefined;
  try {
    manifest = await readInstallManifest(
      join(environment.homeDirectory, ".distilly", INSTALL_FILE),
    );
  } catch (error) {
    return {
      ok: false,
      installed: false,
      launcherReachable: false,
      hosts: [],
      warnings: [error instanceof Error ? error.message : "The install manifest is invalid."],
    };
  }
  if (manifest === undefined) {
    return {
      ok: false,
      installed: false,
      launcherReachable: false,
      hosts: [],
      warnings: ["Distilly Developer Preview is not installed."],
    };
  }
  let launcherReachable = true;
  try {
    await verifyBootstrap(manifest, environment);
  } catch (error) {
    launcherReachable = false;
    warnings.push(
      error instanceof Error ? error.message : "Distilly bootstrap verification failed.",
    );
  }
  const release = await readPreviewRelease(environment.pluginSourcesPath);
  if (release.releaseVersion !== manifest.releaseVersion) {
    warnings.push("The installed Preview release does not match this CLI entry.");
  }
  const selected = manifest.hosts.filter(
    (entry) => hostFilter === undefined || entry.host === hostFilter,
  );
  if (hostFilter !== undefined && selected.length === 0) {
    warnings.push(`Distilly is not installed for ${hostFilter}.`);
  }
  const hosts = await Promise.all(
    selected.map(async (entry) => {
      const executableOk = await executableReachable(entry.executablePath);
      const observedVersion = executableOk
        ? await probeHostVersion(entry.executablePath, environment.homeDirectory).catch(
            () => undefined,
          )
        : undefined;
      const binding = createBinding(
        entry.host,
        observedVersion ?? "unavailable",
        environment,
        release,
        entry.executablePath,
      );
      const preflight = await binding.preflight({
        sessionId: `doctor-${entry.host}`,
        environment: "cli",
      });
      const health = await binding.doctor({
        sessionId: `doctor-${entry.host}`,
        environment: "cli",
      });
      const hostWarnings = [...health.warnings];
      if (!executableOk)
        hostWarnings.push(`The ${hostExecutableName(entry.host)} executable is missing.`);
      else if (observedVersion !== entry.hostVersion)
        hostWarnings.push("The installed host version changed after Distilly setup.");
      if (!preflight.ok) hostWarnings.push(preflight.error.message);
      return {
        host: entry.host,
        installed: health.installed,
        executableReachable: executableOk,
        launcherReachable: health.launcherReachable,
        wireCompatible: health.wireCompatible,
        warnings: hostWarnings,
      };
    }),
  );
  const ok =
    warnings.length === 0 &&
    hosts.length > 0 &&
    hosts.every(
      (entry) =>
        entry.installed &&
        entry.executableReachable &&
        entry.launcherReachable &&
        entry.wireCompatible &&
        entry.warnings.length === 0,
    );
  return {
    ok,
    installed: manifest.hosts.length > 0,
    releaseVersion: manifest.releaseVersion,
    launcherReachable,
    hosts,
    warnings,
  };
};

/**
 * Returns one verified installed host entry for the plugin-owned MCP command.
 *
 * @param environment - Trusted local lifecycle paths and clock.
 * @param hostValue - Supported host claimed by the owned plugin command.
 * @returns The exact installed host entry.
 */
export const requireInstalledPreviewHost = async (
  environment: PreviewLifecycleEnvironment,
  hostValue: HostName,
): Promise<InstalledHost> => {
  assertEnvironment(environment);
  const host = previewHost(hostValue);
  const manifest = await readInstallManifest(
    join(environment.homeDirectory, ".distilly", INSTALL_FILE),
  );
  if (manifest === undefined) throw fail("Distilly Developer Preview is not installed.");
  await verifyBootstrap(manifest, environment);
  const entry = manifest.hosts.find((candidate) => candidate.host === host);
  if (entry === undefined) throw fail(`Distilly is not installed for ${host}.`);
  const observedVersion = await probeHostVersion(entry.executablePath, environment.homeDirectory);
  if (observedVersion !== entry.hostVersion) {
    throw fail("The installed host version changed; run Distilly setup again.");
  }
  return entry;
};

/**
 * Removes one exact host projection and only last-host bootstrap files.
 *
 * @param hostValue - Supported host to remove.
 * @param environment - Trusted local lifecycle paths and clock.
 * @returns Whether the host and shared launcher were removed.
 */
export const uninstallPreviewHost = async (
  hostValue: HostName,
  environment: PreviewLifecycleEnvironment,
): Promise<PreviewUninstallResult> => {
  assertEnvironment(environment);
  const host = previewHost(hostValue);
  const installPath = join(environment.homeDirectory, ".distilly", INSTALL_FILE);
  const manifest = await readInstallManifest(installPath);
  if (manifest === undefined) return { host, removed: false, launcherRemoved: false };
  const paths = await verifyBootstrap(manifest, environment);
  const entry = manifest.hosts.find((candidate) => candidate.host === host);
  if (entry === undefined) {
    if (manifest.hosts.length === 0) {
      await removeBootstrap(paths);
      await removeIfPresent(paths.install);
      return { host, removed: false, launcherRemoved: true };
    }
    return { host, removed: false, launcherRemoved: false };
  }
  const release = await readPreviewRelease(environment.pluginSourcesPath);
  const binding = createBinding(
    host,
    entry.hostVersion,
    environment,
    release,
    entry.executablePath,
  );
  await binding.uninstallPlugin(
    installContext(paths, release, environment.pluginSourcesPath, host),
  );
  const remaining = manifest.hosts.filter((candidate) => candidate.host !== host);
  if (remaining.length > 0) {
    await writeManifest(paths.install, { ...manifest, hosts: remaining });
    return { host, removed: true, launcherRemoved: false };
  }
  await removeBootstrap(paths);
  await removeIfPresent(paths.install);
  return { host, removed: true, launcherRemoved: true };
};
