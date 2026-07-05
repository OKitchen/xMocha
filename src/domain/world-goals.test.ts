import { describe, it, expect } from "vitest";

import { buildWorldChapterGoalSuggestions } from "./world-goals";

function makeWorld(overrides: Partial<Parameters<typeof buildWorldChapterGoalSuggestions>[0]["world"]> = {}) {
  return {
    openingScenario: {
      suggestedGoals: ["Survive the first night"],
    },
    characters: [
      {
        id: "char-a",
        name: "Alice",
        goals: ["Find the artifact"],
      },
    ],
    ...overrides,
  };
}

describe("buildWorldChapterGoalSuggestions", () => {
  it("returns up to 3 suggestions by default", () => {
    const suggestions = buildWorldChapterGoalSuggestions({
      world: makeWorld(),
      characterId: "char-a",
      language: "en",
    });
    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it("respects the limit parameter", () => {
    const suggestions = buildWorldChapterGoalSuggestions({
      world: makeWorld(),
      characterId: "char-a",
      language: "en",
      limit: 1,
    });
    expect(suggestions).toHaveLength(1);
  });

  it("uses character goals when available", () => {
    const suggestions = buildWorldChapterGoalSuggestions({
      world: makeWorld(),
      characterId: "char-a",
      language: "en",
    });
    expect(suggestions.some((s) => s.includes("Alice"))).toBe(true);
  });

  it("uses actorNameOverride when provided", () => {
    const suggestions = buildWorldChapterGoalSuggestions({
      world: makeWorld(),
      characterId: "char-a",
      actorNameOverride: "CustomName",
      language: "en",
    });
    expect(suggestions.some((s) => s.includes("CustomName"))).toBe(true);
  });

  it("generates Chinese suggestions when language is zh-CN", () => {
    const suggestions = buildWorldChapterGoalSuggestions({
      world: makeWorld({
        openingScenario: { suggestedGoals: [] },
        characters: [{ id: "char-a", name: "角色甲", goals: [] }],
      }),
      characterId: "char-a",
      language: "zh-CN",
    });
    expect(suggestions.some((s) => /的身份/.test(s))).toBe(true);
  });

  it("falls back to default templates when no character goals exist", () => {
    const suggestions = buildWorldChapterGoalSuggestions({
      world: makeWorld({
        openingScenario: { suggestedGoals: [] },
        characters: [],
      }),
      language: "en",
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes("this role"))).toBe(true);
  });

  it("deduplicates identical suggestions", () => {
    const world = makeWorld({
      openingScenario: { suggestedGoals: ["Find the artifact"] },
      characters: [{ id: "char-a", name: "Alice", goals: ["Find the artifact"] }],
    });
    const suggestions = buildWorldChapterGoalSuggestions({
      world,
      characterId: "char-a",
      language: "en",
      limit: 10,
    });
    const unique = new Set(suggestions);
    expect(unique.size).toBe(suggestions.length);
  });

  it("filters CJK goals from English suggestions", () => {
    const world = makeWorld({
      openingScenario: { suggestedGoals: ["管理宁国府", "Find the temple"] },
      characters: [{ id: "char-a", name: "Alice", goals: [] }],
    });
    const suggestions = buildWorldChapterGoalSuggestions({
      world,
      characterId: "char-a",
      language: "en",
      limit: 10,
    });
    for (const suggestion of suggestions) {
      expect(/[\u3400-\u9fff]/.test(suggestion)).toBe(false);
    }
  });

  it("uses mythic exploration defaults when English source goals are filtered", () => {
    const suggestions = buildWorldChapterGoalSuggestions({
      world: makeWorld({
        worldTemplate: "mythic_exploration",
        openingScenario: { suggestedGoals: ["让东海承认女娃之名"] },
        characters: [{ id: "jingwei", name: "精卫", goals: ["继续填海誓愿"] }],
      }),
      characterId: "jingwei",
      actorNameOverride: "Jingwei",
      language: "en",
    });

    expect(suggestions[0]).toContain("East Sea");
    expect(suggestions.some((suggestion) => suggestion.includes("wood and stone"))).toBe(true);
  });

  it("uses localized Odyssey defaults when Chinese source goals are unavailable", () => {
    const suggestions = buildWorldChapterGoalSuggestions({
      world: makeWorld({
        worldPackId: "odyssey-cyclops-v1",
        worldTemplate: "mythic_exploration",
        openingScenario: { suggestedGoals: ["Escape the cave"] },
        characters: [{ id: "odysseus", name: "Odysseus", goals: ["Save surviving crew members"] }],
      }),
      characterId: "odysseus",
      actorNameOverride: "奥德修斯",
      language: "zh-CN",
      limit: 3,
    });

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toContain("波吕斐摩斯洞穴");
    expect(suggestions.some((suggestion) => /Save|Escape|East Sea|精卫/.test(suggestion))).toBe(false);
  });
});
