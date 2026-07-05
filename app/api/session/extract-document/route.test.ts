import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/session/extract-document", () => {
  it("extracts safe text document content for decision grounding", async () => {
    const formData = new FormData();
    formData.append("language", "en");
    formData.append(
      "file",
      new File(
        [
          "AI labor market report\n\nYoung workers face measurable exposure to automation and hiring pressure.",
        ],
        "ai-report.txt",
        { type: "text/plain" },
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/session/extract-document", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.77" },
        body: formData,
      }),
    );
    const payload = (await response.json()) as {
      title: string;
      kind: string;
      content: string;
      extractedCharacters: number;
    };

    expect(response.status).toBe(200);
    expect(payload.title).toBe("ai-report.txt");
    expect(payload.kind).toBe("text");
    expect(payload.content).toContain("automation and hiring pressure");
    expect(payload.extractedCharacters).toBeGreaterThan(40);
  });
});
