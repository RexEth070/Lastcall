import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  buildDemoPortalVerificationObjective,
  parseKaneAgentOutput,
  type ParsedKaneOutput,
} from "../lib/kane/verdict";

export interface KaneRunnerConfig {
  portalUrl: string;
  serviceName: string;
  portalEmail: string;
  portalPassword: string;
  timeoutSeconds?: number;
  maxSteps?: number;
  headless?: boolean;
  kaneCliPath?: string;
  checkStopRequested?: () => Promise<boolean>;
}

/**
 * Resolves the Kane CLI entrypoint directly to Node + kane-cli.cjs on Windows
 * so we NEVER use `shell: true` (which mangles spaces/quotes in natural-language objectives).
 */
function resolveKaneExecutable(
  customPath?: string,
): { command: string; prefixArgs: string[] } {
  const configured = customPath || process.env.KANE_CLI_PATH?.trim();

  if (configured && configured !== "kane-cli" && configured !== "kane-cli.cmd") {
    if (configured.endsWith(".cjs") || configured.endsWith(".js")) {
      return { command: process.execPath, prefixArgs: [configured] };
    }
    return { command: configured, prefixArgs: [] };
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      const cjsEntry = path.join(
        appData,
        "npm",
        "node_modules",
        "@testmuai",
        "kane-cli",
        "bin",
        "kane-cli.cjs",
      );
      if (fs.existsSync(cjsEntry)) {
        return { command: process.execPath, prefixArgs: [cjsEntry] };
      }
    }
  }

  return { command: "kane-cli", prefixArgs: [] };
}

/**
 * Safely invokes `kane-cli run --agent --assertion-mode dom --final-validation on`
 * with an ephemeral secret variables file, hard outer timeout, and safe stop support.
 */
export async function runKaneVerification(
  config: KaneRunnerConfig,
): Promise<ParsedKaneOutput> {
  const timeoutSeconds =
    config.timeoutSeconds ?? Number(process.env.KANE_TIMEOUT_SECONDS || 180);
  const maxSteps = config.maxSteps ?? Number(process.env.KANE_MAX_STEPS || 20);
  const headless = config.headless ?? process.env.WORKER_HEADLESS === "true";

  // Write ephemeral variables file (deleted in finally) so credentials never appear in prompts or argv
  const varsFile = path.join(
    os.tmpdir(),
    `lastcall-kane-vars-${crypto.randomBytes(6).toString("hex")}.json`,
  );
  const varsPayload = {
    portal_email: { value: config.portalEmail, secret: false },
    portal_password: { value: config.portalPassword, secret: true },
  };
  fs.writeFileSync(varsFile, JSON.stringify(varsPayload), { mode: 0o600 });

  const objective = buildDemoPortalVerificationObjective(config.serviceName);
  const { command, prefixArgs } = resolveKaneExecutable(config.kaneCliPath);

  const args = [
    ...prefixArgs,
    "run",
    objective,
    "--url",
    config.portalUrl,
    "--agent",
    "--assertion-mode",
    "dom",
    "--final-validation",
    "on",
    "--timeout",
    String(timeoutSeconds),
    "--max-steps",
    String(maxSteps),
    "--variables-file",
    varsFile,
  ];
  if (headless) {
    args.push("--headless");
  }

  try {
    return await new Promise<ParsedKaneOutput>((resolve) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;

      const child = spawn(command, args, {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const finish = (
        exitCode: number | null,
        spawnError: string | null = null,
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        if (stopPoller) clearInterval(stopPoller);

        const parsed = parseKaneAgentOutput({
          stdout,
          stderr,
          exitCode,
          timedOut,
          spawnError,
        });
        console.log(
          `[kane] exit=${exitCode} timedOut=${timedOut} verdict=${parsed.verdict} runId=${parsed.runId ?? "none"} events=${parsed.rawEventCount}`,
        );
        if (parsed.conciseError) {
          console.log(`[kane] note: ${parsed.conciseError}`);
        }
        resolve(parsed);
      };

      const watchdog = setTimeout(() => {
        timedOut = true;
        try {
          child.kill("SIGTERM");
        } catch {
          // ignore
        }
        finish(3);
      }, (timeoutSeconds + 20) * 1000);

      const stopPoller = config.checkStopRequested
        ? setInterval(async () => {
            try {
              if (await config.checkStopRequested?.()) {
                try {
                  child.kill("SIGTERM");
                } catch {
                  // ignore
                }
                finish(3, "Stopped by user during Kane verification.");
              }
            } catch {
              // ignore transient poll error
            }
          }, 2500)
        : null;

      child.stdout?.on("data", (chunk: Buffer) => {
        if (stdout.length < 512_000) stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderr.length < 128_000) stderr += chunk.toString("utf8");
      });

      child.on("error", (err) => {
        finish(null, err.message);
      });

      child.on("close", (code) => {
        finish(code);
      });
    });
  } finally {
    try {
      fs.rmSync(varsFile, { force: true });
    } catch {
      // ignore cleanup error
    }
  }
}
