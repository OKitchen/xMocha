import { spawn } from "node:child_process";

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const [command, ...args] = process.argv.slice(2);

if (command !== "dev" && command !== "start") {
  throw new Error('Expected Next.js command "dev" or "start".');
}

const databaseHostname = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL).hostname
  : undefined;
const noProxy = [
  process.env.NO_PROXY,
  process.env.no_proxy,
  "localhost",
  "127.0.0.1",
  databaseHostname,
]
  .filter(Boolean)
  .join(",");

const childEnv = {
  ...process.env,
  NO_PROXY: noProxy,
  no_proxy: noProxy,
};
const nodeOptions = sanitizeNodeOptions(childEnv.NODE_OPTIONS);
childEnv.NODE_OPTIONS = nodeOptions;

const child = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", command, ...args],
  {
    env: childEnv,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});

function sanitizeNodeOptions(value) {
  if (!value) return "";
  return value
    .split(/\s+/)
    .filter((option) => option && !option.startsWith("--env-file"))
    .join(" ");
}
