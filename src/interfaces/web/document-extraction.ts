import { PDFParse } from "pdf-parse";

export type ExtractedDecisionDocument = {
  title: string;
  kind: "text" | "markdown" | "json" | "pdf" | "note";
  content: string;
  size: number;
  pageCount?: number;
  extractedCharacters: number;
};

const maxExtractedCharacters = 150_000;

export async function extractDecisionDocument(file: File): Promise<ExtractedDecisionDocument> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectDocumentKind(file);
  const title = file.name || "Uploaded document";
  const extracted =
    kind === "pdf"
      ? await extractPdfText(buffer)
      : { text: decodeTextDocument(buffer), pageCount: undefined };
  const rawText = extracted.text;
  const content = normalizeExtractedText(rawText).slice(0, maxExtractedCharacters);

  return {
    title,
    kind,
    content,
    size: file.size,
    pageCount: extracted.pageCount,
    extractedCharacters: content.length,
  };
}

function detectDocumentKind(file: File): ExtractedDecisionDocument["kind"] {
  const lowerName = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (lowerName.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) return "markdown";
  if (lowerName.endsWith(".json") || type === "application/json") return "json";
  if (
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".log") ||
    type.startsWith("text/")
  ) {
    return "text";
  }

  return "note";
}

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount?: number }> {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText({
      pageJoiner: "\n\n--- Page page_number of total_number ---\n\n",
    });
    return { text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

function decodeTextDocument(buffer: Buffer): string {
  const utf8Text = buffer.toString("utf8");
  if (!utf8Text.includes("\uFFFD")) return utf8Text;

  return buffer.toString("latin1");
}

export function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \f\v]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
