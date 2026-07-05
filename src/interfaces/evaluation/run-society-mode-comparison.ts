import { spawnSync } from "node:child_process";

type SocietyMode = "template" | "structured";

function main(): void {
  const modes: SocietyMode[] = ["template", "structured"];
  let hasFailure = false;

  for (const mode of modes) {
    console.log(`\n=== xMocha society mode comparison: ${mode} ===\n`);

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/interfaces/evaluation/run-core-evaluation.ts"],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        env: {
          ...process.env,
          XMOCHA_EVAL_MODE: process.env.XMOCHA_EVAL_MODE ?? "smoke",
          XMOCHA_SOCIETY_SIMULATOR: mode,
        },
      },
    );

    if ((result.status ?? 1) !== 0) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

main();
