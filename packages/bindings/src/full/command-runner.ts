import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import type { HostCommandRunner } from "../protocol.js";

const OUTPUT_LIMIT = 1_048_576;

const append = (chunks: Buffer[], chunk: Buffer): void => {
  const used = chunks.reduce((total, value) => total + value.length, 0);
  if (used >= OUTPUT_LIMIT) return;
  chunks.push(chunk.subarray(0, OUTPUT_LIMIT - used));
};

/**
 * Runs one host command without a shell.
 *
 * @param input - Checked executable, arguments, and isolated home.
 * @param input.executablePath - Absolute checked host executable.
 * @param input.args - Exact host lifecycle arguments.
 * @param input.homeDirectory - Isolated user home for the child process.
 * @returns Process exit status and bounded output.
 */
const run: HostCommandRunner["run"] = async ({ executablePath, args, homeDirectory }) => {
  const codexHome = join(homeDirectory, ".codex");
  await mkdir(codexHome, { recursive: true });
  return new Promise((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const child = spawn(executablePath, [...args], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        HOME: homeDirectory,
        USERPROFILE: homeDirectory,
        CODEX_HOME: codexHome,
      },
    });
    child.stdout.on("data", (chunk: Buffer) => append(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => append(stderr, chunk));
    child.once("error", reject);
    child.once("close", (code) =>
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
  });
};

export const defaultHostCommandRunner: HostCommandRunner = Object.freeze({ run });
