import { describe, expect, it } from "vitest";
import { makeRoomCode } from "../server/network";

describe("room codes", () => {
  it("uses five camera-friendly characters", () => {
    expect(makeRoomCode(() => 0)).toBe("AAAAA");
    expect(makeRoomCode(() => 0.999)).toMatch(/^[A-Z2-9]{5}$/);
  });
});
