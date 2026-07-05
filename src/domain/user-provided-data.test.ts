import { describe, expect, it } from "vitest";

import { normalizeUserProvidedDataInput } from "./user-provided-data";

describe("normalizeUserProvidedDataInput", () => {
  it("keeps AI labor-market report facts ahead of generic macro report noise", () => {
    const pack = normalizeUserProvidedDataInput(
      {
        sources: [
          {
            kind: "pdf",
            title: "An AI Job Apocalypse.pdf",
            content: `
              • We raised our sequential 2H26 GDP growth forecast to 2% in 3Q26.
              consumer spending growth at just 1.5%.

              Rapid improvements in AI capabilities and growing corporate adoption have led to
              predictions that the technology could lead to large-scale job losses before the end
              of the decade.

              Briggs expects significant labor displacement but only temporarily as new jobs are
              created and workers adapt.

              Young workers and occupations with high AI exposure face more hiring pressure than
              lower-exposure roles.
            `,
          },
        ],
      },
      {
        dilemma: "Should I stay in my current role or move toward AI-native work?",
      },
    );

    const summaries = pack?.factItems.slice(0, 4).map((fact) => fact.summary) ?? [];

    expect(summaries.join(" ")).toContain("large-scale job losses");
    expect(summaries.join(" ")).toContain("labor displacement");
    expect(summaries[0]).not.toContain("GDP growth");
    expect(pack?.derivedBrief.activeOptions.join(" ")).not.toContain("corporate adoption");
  });

  it("uses English inferred options and stakeholders for English dilemmas", () => {
    const pack = normalizeUserProvidedDataInput(
      {
        rawText: "I have a startup offer, but my current platform role is stable.",
      },
      {
        dilemma: "Should I accept the startup offer, or stay in my current stable role?",
        language: "en",
      },
    );

    expect(pack?.derivedBrief.activeOptions).toContain("Accept the startup offer");
    expect(pack?.derivedBrief.activeOptions).toContain("Stay in the current stable role");
    expect(pack?.derivedBrief.keyStakeholders).toContain("Startup founding team");
    expect(pack?.derivedBrief.keyStakeholders).toContain("Current employer and team");
    expect(pack?.derivedBrief.keyStakeholders).toContain("Professional network and future employers");
    expect(pack?.derivedBrief.keyStakeholders.join(" ")).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("keeps Chinese inferred options and stakeholders for Chinese dilemmas", () => {
    const pack = normalizeUserProvidedDataInput(
      {
        rawText: "我有一个创业公司 offer，但现在岗位稳定。",
      },
      {
        dilemma: "我应该接受创业公司 offer，还是留在目前稳定岗位？",
        language: "zh-CN",
      },
    );

    expect(pack?.derivedBrief.activeOptions).toContain("接受创业公司 offer");
    expect(pack?.derivedBrief.activeOptions).toContain("留在目前稳定岗位");
    expect(pack?.derivedBrief.keyStakeholders).toContain("创业公司创始团队");
    expect(pack?.derivedBrief.keyStakeholders).toContain("当前雇主和团队");
    expect(pack?.derivedBrief.keyStakeholders).toContain("职业网络与未来招聘方");
  });
});
