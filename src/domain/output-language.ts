import type { OutputLanguage } from "./types";

const LATIN_ALLOWLIST = new Set([
  "ai",
  "api",
  "bls",
  "llm",
  "llms",
  "mvp",
  "okr",
  "roi",
  "ui",
  "ux",
]);

export function findOutputLanguageIssues(params: {
  language: OutputLanguage | undefined;
  fields: Array<{ label: string; text: string | undefined }>;
}): string[] {
  if (params.language === "en") {
    return params.fields
      .filter((field) => field.text && isMostlyChinese(field.text))
      .map((field) => `${field.label} is mostly Chinese: "${field.text!.slice(0, 80)}"`);
  }

  if (params.language !== "zh-CN") return [];
  return params.fields
    .filter((field) => field.text && isMostlyEnglish(field.text))
    .map((field) => `${field.label} is mostly English: "${field.text!.slice(0, 80)}"`);
}

function isMostlyEnglish(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;

  const cjkCount = (trimmed.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latinWords = (trimmed.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? [])
    .map((word) => word.toLowerCase())
    .filter((word) => !LATIN_ALLOWLIST.has(word)).length;

  return latinWords >= 4 && cjkCount < latinWords * 0.6;
}

function isMostlyChinese(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;

  const cjkCount = (trimmed.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latinWords = (trimmed.match(/[A-Za-z][A-Za-z'-]{2,}/g) ?? [])
    .map((word) => word.toLowerCase())
    .filter((word) => !LATIN_ALLOWLIST.has(word)).length;

  return cjkCount >= 4 && cjkCount >= latinWords * 2;
}
