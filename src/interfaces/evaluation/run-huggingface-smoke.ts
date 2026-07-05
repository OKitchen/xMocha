import { createJsonGenerationClient } from "../../infrastructure/llm/provider-factory";

async function main(): Promise<void> {
  process.env.XMOCHA_MODEL_PROVIDER = "huggingface";

  const { client, providerLabel } = createJsonGenerationClient();
  const startedAt = Date.now();
  const responseText = await client.generateJson(
    'Return only strict JSON with this exact shape: {"ok":true,"model":"string","note":"string"}',
  );
  const parsed = JSON.parse(responseText) as {
    ok?: boolean;
    model?: string;
    note?: string;
  };

  if (parsed.ok !== true) {
    throw new Error(
      `Hugging Face smoke response did not include ok=true: ${responseText}`,
    );
  }

  console.log("Hugging Face Router smoke test passed");
  console.log(`provider: ${providerLabel}`);
  console.log(`latencyMs: ${Date.now() - startedAt}`);
  console.log(`response: ${JSON.stringify(parsed)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
