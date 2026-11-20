import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDemoPortalServer } from "./app.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load root .env.local if present so local demo credentials stay out of source control
function loadLocalEnv() {
  const candidates = [
    path.resolve(__dirname, ".env.local"),
    path.resolve(__dirname, "..", ".env.local"),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadLocalEnv();

const port = Number(process.env.PORT || 3001);
startDemoPortalServer(port).then(() => {
  console.log(
    `LASTCALL Controlled Demo Billing Portal running at http://localhost:${port}`,
  );
});
