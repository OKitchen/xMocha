import { describe, it, expect } from "vitest";

import {
  validateWorldPackQuality,
  getWorldPackQualityWarnings,
  assertWorldSourceTextIsUsable,
  preprocessWorldSourceText,
} from "./world-quality";
import type { WorldPack, WorldPackDraft } from "./world-types";

function makeMinimalDraft(overrides: Partial<WorldPackDraft> = {}): WorldPackDraft {
  return {
    schemaVersion: "world-pack-v1",
    visibility: "curated",
    sourceType: "narrative",
    title: "Test World",
    language: "zh-CN",
    premise: "A test scenario",
    timeAnchor: "Present day",
    sourceAttribution: { label: "Test", rightsBasis: "public-domain" },
    canonFacts: [],
    rules: [],
    locations: [],
    characters: [
      {
        id: "char-xifeng",
        name: "王熙凤",
        playable: true,
        identity: "荣国府的当家少奶奶",
        personality: ["机敏"],
        goals: ["管理好宁国府"],
        capabilities: ["调度下人"],
        limitations: [],
        knownFactIds: [],
        unknownFactIds: [],
      },
    ],
    relationships: [],
    openingScenario: {
      id: "opening-1",
      title: "The beginning",
      locationId: "loc-1",
      activeCharacterIds: ["char-xifeng"],
      event: "Story begins",
      suggestedGoals: ["管理好宁国府"],
    },
    ...overrides,
  };
}

describe("validateWorldPackQuality", () => {
  it("returns no issues for a valid draft", () => {
    const draft = makeMinimalDraft();
    const issues = validateWorldPackQuality(draft);
    expect(issues).toEqual([]);
  });

  it("detects replacement characters in source content", () => {
    const draft = makeMinimalDraft();
    const issues = validateWorldPackQuality(draft, "some text \uFFFD more text");
    expect(issues.some((i) => i.code === "REPLACEMENT_CHARACTER")).toBe(true);
  });

  it("detects replacement characters in pack fields", () => {
    const draft = makeMinimalDraft({ premise: "premise with \uFFFD inside" });
    const issues = validateWorldPackQuality(draft);
    expect(issues.some((i) => i.code === "REPLACEMENT_CHARACTER")).toBe(true);
  });

  it("flags low-confidence Chinese character names (stopwords)", () => {
    const draft = makeMinimalDraft({
      characters: [
        {
          id: "char-bad",
          name: "他们",
          playable: true,
          identity: "Someone",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
      ],
    });
    const issues = validateWorldPackQuality(draft);
    expect(issues.some((i) => i.code === "LOW_CONFIDENCE_CHARACTER_NAME")).toBe(true);
  });

  it("accepts good Chinese character names", () => {
    const draft = makeMinimalDraft({
      characters: [
        {
          id: "char-ok",
          name: "贾宝玉",
          playable: true,
          identity: "主角",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
      ],
    });
    const issues = validateWorldPackQuality(draft);
    expect(issues.some((i) => i.code === "LOW_CONFIDENCE_CHARACTER_NAME")).toBe(false);
  });

  it("flags low-confidence character names used in opening scenario", () => {
    const draft = makeMinimalDraft({
      characters: [
        {
          id: "char-bad",
          name: "他们",
          playable: true,
          identity: "Someone",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
      ],
      openingScenario: {
        id: "o1",
        title: "Start",
        locationId: "loc-1",
        activeCharacterIds: ["char-bad"],
        event: "Begin",
        suggestedGoals: [],
      },
    });
    const issues = validateWorldPackQuality(draft);
    expect(issues.some((i) => i.code === "LOW_CONFIDENCE_OPENING_CHARACTER")).toBe(true);
  });

  it("accepts valid English lore character names", () => {
    const draft = makeMinimalDraft({
      sourceType: "lore",
      language: "en",
      characters: [
        {
          id: "char-astrid",
          name: "Astrid",
          playable: true,
          identity: "A warrior",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
      ],
    });
    const issues = validateWorldPackQuality(draft);
    expect(issues.some((i) => i.code === "LOW_CONFIDENCE_CHARACTER_NAME")).toBe(false);
  });

  it("accepts valid Latin-script lore names with diacritics", () => {
    const draft = makeMinimalDraft({
      sourceType: "lore",
      language: "en",
      characters: [
        {
          id: "char-nuwa",
          name: "Nüwa",
          playable: true,
          identity: "A mythic figure",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
      ],
    });
    const issues = validateWorldPackQuality(draft);
    expect(issues.some((i) => i.code === "LOW_CONFIDENCE_CHARACTER_NAME")).toBe(false);
  });

  it("flags English sentence-fragment character names", () => {
    const draft = makeMinimalDraft({
      sourceType: "narrative",
      language: "en",
      characters: [
        {
          id: "char-every",
          name: "Every",
          playable: true,
          identity: "Sentence fragment",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
        {
          id: "char-tonight",
          name: "Tonight",
          playable: true,
          identity: "Time phrase",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
      ],
      openingScenario: {
        id: "o1",
        title: "Start",
        locationId: "loc-1",
        activeCharacterIds: ["char-every", "char-tonight"],
        event: "Begin",
        suggestedGoals: ["Find out why Every is important."],
      },
    });
    const issues = validateWorldPackQuality(draft);

    expect(issues.filter((i) => i.code === "LOW_CONFIDENCE_CHARACTER_NAME")).toHaveLength(2);
    expect(issues.some((i) => i.code === "LOW_CONFIDENCE_OPENING_CHARACTER")).toBe(true);
  });
});

describe("getWorldPackQualityWarnings", () => {
  it("warns about generic relationship graphs", () => {
    const draft = makeMinimalDraft({
      characters: [
        {
          id: "a",
          name: "角色甲",
          playable: true,
          identity: "Test",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
        {
          id: "b",
          name: "角色乙",
          playable: false,
          identity: "Test",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
      ],
      relationships: [
        {
          sourceCharacterId: "a",
          targetCharacterId: "b",
          kind: "source-linked auto",
          affinity: 0,
          tension: 0,
          publicContext: "auto",
        },
      ],
    });
    const warnings = getWorldPackQualityWarnings(draft);
    expect(warnings.some((w) => w.code === "GENERIC_RELATIONSHIP_GRAPH")).toBe(true);
  });

  it("does not warn when relationships are real", () => {
    const draft = makeMinimalDraft({
      characters: [
        {
          id: "a",
          name: "角色甲",
          playable: true,
          identity: "Test",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
        {
          id: "b",
          name: "角色乙",
          playable: false,
          identity: "Test",
          personality: [],
          goals: [],
          capabilities: [],
          limitations: [],
          knownFactIds: [],
          unknownFactIds: [],
        },
      ],
      relationships: [
        {
          sourceCharacterId: "a",
          targetCharacterId: "b",
          kind: "rival",
          affinity: -2,
          tension: 3,
          publicContext: "They have a deep rivalry over resources.",
        },
      ],
    });
    const warnings = getWorldPackQualityWarnings(draft);
    expect(warnings.some((w) => w.code === "GENERIC_RELATIONSHIP_GRAPH")).toBe(false);
  });
});

describe("assertWorldSourceTextIsUsable", () => {
  it("does not throw for clean text", () => {
    expect(() => assertWorldSourceTextIsUsable("Clean text here")).not.toThrow();
  });

  it("throws when text has replacement characters", () => {
    expect(() => assertWorldSourceTextIsUsable("Text with \uFFFD char")).toThrow();
  });
});

describe("preprocessWorldSourceText", () => {
  it("returns content unchanged when no replacement characters", () => {
    const result = preprocessWorldSourceText("Clean text");
    expect(result.content).toBe("Clean text");
    expect(result.warnings).toEqual([]);
  });

  it("replaces a few replacement characters with placeholders", () => {
    const text = "Some \uFFFD text \uFFFD here" + "a".repeat(5000);
    const result = preprocessWorldSourceText(text);
    expect(result.content).not.toContain("\uFFFD");
    expect(result.content).toContain("□");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("SOURCE_REPLACEMENT_CHARACTERS_REPLACED");
  });

  it("throws when too many replacement characters", () => {
    const text = "\uFFFD".repeat(100);
    expect(() => preprocessWorldSourceText(text)).toThrow();
  });
});
