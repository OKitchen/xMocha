import { describe, expect, it } from "vitest";

import {
  ODYSSEY_WORLD_PACK_ID,
  RED_CHAMBER_WORLD_PACK_ID,
  SHANHAIJING_WORLD_PACK_ID,
  listCuratedWorldPacks,
  odysseyWorldPack,
  shanhaijingWorldPack,
} from "./world-packs";
import { validateWorldPackQuality, getWorldPackQualityWarnings } from "./world-quality";
import { validateWorldPack } from "./world-validation";

describe("curated WorldPacks", () => {
  it("lists Red Chamber, Shanhai Jing, and Odyssey quick-start samples", () => {
    const ids = listCuratedWorldPacks().map((pack) => pack.worldPackId);

    expect(ids).toContain(RED_CHAMBER_WORLD_PACK_ID);
    expect(ids).toContain(SHANHAIJING_WORLD_PACK_ID);
    expect(ids).toContain(ODYSSEY_WORLD_PACK_ID);
  });

  it("keeps the Shanhai Jing sample valid and ready for quick play", () => {
    expect(validateWorldPack(shanhaijingWorldPack)).toEqual([]);
    expect(validateWorldPackQuality(shanhaijingWorldPack)).toEqual([]);
    expect(getWorldPackQualityWarnings(shanhaijingWorldPack)).toEqual([]);
    expect(shanhaijingWorldPack.worldTemplate).toBe("mythic_exploration");
    expect(shanhaijingWorldPack.openingScenario.suggestedGoals).toHaveLength(3);
  });

  it("keeps the Odyssey sample valid and ready for quick play", () => {
    expect(validateWorldPack(odysseyWorldPack)).toEqual([]);
    expect(validateWorldPackQuality(odysseyWorldPack)).toEqual([]);
    expect(getWorldPackQualityWarnings(odysseyWorldPack)).toEqual([]);
    expect(odysseyWorldPack.worldTemplate).toBe("mythic_exploration");
    expect(odysseyWorldPack.openingScenario.suggestedGoals).toHaveLength(3);
    expect(odysseyWorldPack.canonFacts.map((fact) => fact.id)).toContain("fact-noman-name");
  });
});
