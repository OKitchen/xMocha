import { describe, it, expect } from "vitest";

import { findOutputLanguageIssues } from "./output-language";

describe("findOutputLanguageIssues", () => {
  it("returns no issues for English text in English language mode", () => {
    const issues = findOutputLanguageIssues({
      language: "en",
      fields: [{ label: "title", text: "This is purely English text with many words" }],
    });
    expect(issues).toEqual([]);
  });

  it("flags mostly-Chinese text in English mode", () => {
    const issues = findOutputLanguageIssues({
      language: "en",
      fields: [{ label: "title", text: "逐项核对名册，先不要公开追责" }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("mostly Chinese");
  });

  it("allows short romanized English with a Chinese proper name", () => {
    const issues = findOutputLanguageIssues({
      language: "en",
      fields: [{ label: "reaction", text: "Wang Xifeng questions Jia Rong in private." }],
    });
    expect(issues).toEqual([]);
  });

  it("returns no issues when language is undefined", () => {
    const issues = findOutputLanguageIssues({
      language: undefined,
      fields: [{ label: "title", text: "English text here with many words inside" }],
    });
    expect(issues).toEqual([]);
  });

  it("returns no issues when zh-CN text contains CJK characters", () => {
    const issues = findOutputLanguageIssues({
      language: "zh-CN",
      fields: [{ label: "title", text: "这是一段中文测试文本，用于验证语言检查" }],
    });
    expect(issues).toEqual([]);
  });

  it("flags mostly-English text in zh-CN mode", () => {
    const issues = findOutputLanguageIssues({
      language: "zh-CN",
      fields: [{
        label: "summary",
        text: "This is clearly English text with more than enough words to trigger the check",
      }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("summary");
    expect(issues[0]).toContain("mostly English");
  });

  it("skips empty or undefined text fields", () => {
    const issues = findOutputLanguageIssues({
      language: "zh-CN",
      fields: [
        { label: "title", text: undefined },
        { label: "summary", text: "" },
      ],
    });
    expect(issues).toEqual([]);
  });

  it("does not flag short text even if all-English", () => {
    const issues = findOutputLanguageIssues({
      language: "zh-CN",
      fields: [{ label: "title", text: "Short" }],
    });
    expect(issues).toEqual([]);
  });

  it("ignores allowlisted Latin words like AI, LLM, MVP", () => {
    const issues = findOutputLanguageIssues({
      language: "zh-CN",
      fields: [{
        label: "title",
        text: "这是关于 AI LLM MVP 的中文文本介绍说明文字",
      }],
    });
    expect(issues).toEqual([]);
  });

  it("checks multiple fields and reports each failing one", () => {
    const issues = findOutputLanguageIssues({
      language: "zh-CN",
      fields: [
        { label: "title", text: "This is a very long English title with many words inside it" },
        { label: "summary", text: "中文摘要没有问题" },
        { label: "consequence", text: "Another purely English field with plenty of words here too" },
      ],
    });
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain("title");
    expect(issues[1]).toContain("consequence");
  });
});
