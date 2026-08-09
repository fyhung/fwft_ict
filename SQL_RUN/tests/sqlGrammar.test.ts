import { describe, expect, it } from "vitest";
import { missions } from "../server/game/missions";
import { nextGrammarState, validateMissionTokens } from "../server/game/sqlGrammar";

describe("SQL grammar", () => {
  it("accepts all 40 bundled SQL missions", () => {
    expect(missions).toHaveLength(40);
    for (const mission of missions) expect(validateMissionTokens(mission.tokens), mission.id).toBe(true);
  });

  it("rejects a clause in the wrong place", () => {
    expect(nextGrammarState("start", { kind: "keyword", value: "WHERE" })).toBeNull();
    expect(nextGrammarState("after_field", { kind: "keyword", value: "FROM" })).toBe("after_from");
  });
});
