import { describe, it, expect } from "vitest";

import {
  inferDilemmaKindFromText,
  collectSessionDecisionText,
} from "./dilemma-kind";

describe("inferDilemmaKindFromText", () => {
  it("detects career-related dilemmas", () => {
    expect(inferDilemmaKindFromText("Should I take this new job offer?")).toBe("career");
    expect(inferDilemmaKindFromText("我应该跳槽还是留在现在的公司？")).toBe("career");
    expect(inferDilemmaKindFromText("My manager wants me to take a promotion")).toBe("career");
    expect(inferDilemmaKindFromText("考虑离职去做AI相关的工作")).toBe("career");
  });

  it("detects project-related dilemmas", () => {
    expect(inferDilemmaKindFromText("Should I start my own startup?")).toBe("project");
    expect(inferDilemmaKindFromText("我要不要开始自己的副业项目？")).toBe("project");
    expect(inferDilemmaKindFromText("Thinking about building an MVP for my side project")).toBe("project");
  });

  it("detects relationship-related dilemmas", () => {
    expect(inferDilemmaKindFromText("Should I break up with my partner?")).toBe("relationship");
    expect(inferDilemmaKindFromText("我们要不要结婚？")).toBe("relationship");
  });

  it("detects relocation-related dilemmas", () => {
    expect(inferDilemmaKindFromText("Should I relocate to a new city?")).toBe("relocation");
    expect(inferDilemmaKindFromText("我在考虑搬家到另一个城市")).toBe("relocation");
  });

  it("detects food-related dilemmas", () => {
    expect(inferDilemmaKindFromText("今天午饭吃什么？")).toBe("food");
    expect(inferDilemmaKindFromText("What should I eat for dinner tonight?")).toBe("food");
    expect(inferDilemmaKindFromText("要不要叫外卖？")).toBe("food");
  });

  it("returns general for unrecognized text", () => {
    expect(inferDilemmaKindFromText("What color should I paint my room?")).toBe("general");
    expect(inferDilemmaKindFromText("一般性的问题")).toBe("general");
  });
});

describe("collectSessionDecisionText", () => {
  it("aggregates dilemma and canonical path text", () => {
    const text = collectSessionDecisionText({
      dilemma: "Should I take this job?",
      canonicalPath: [
        {
          id: "b1",
          turn: 1,
          title: "Accept offer",
          summary: "Take the new role",
          consequence: "Higher salary",
          score: 0.7,
          timeHorizon: "1-3 months",
          riskProfile: "low",
          keyUncertainty: "Culture fit",
        },
      ],
      userAuthoredActions: [],
      userProvidedData: undefined,
    } as any);

    expect(text).toContain("should i take this job");
    expect(text).toContain("accept offer");
    expect(text).toContain("higher salary");
  });
});
