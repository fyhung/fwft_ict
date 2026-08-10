import { describe, expect, it } from "vitest";
import { localIPv4Addresses, makeRoomCode } from "../server/network";

describe("room codes", () => {
  it("uses five camera-friendly characters", () => {
    expect(makeRoomCode(() => 0)).toBe("AAAAA");
    expect(makeRoomCode(() => 0.999)).toMatch(/^[A-Z2-9]{5}$/);
  });
});

describe("LAN address selection", () => {
  it("excludes Proton/TUN /32 adapters and keeps the physical Wi-Fi address", () => {
    const entry = (address: string, netmask: string, mac: string) => ({ address, netmask, family: "IPv4" as const, mac, internal: false, cidr: `${address}/24` });
    expect(localIPv4Addresses({
      ProTUN: [entry("10.2.0.2", "255.255.255.255", "00:00:00:00:00:00")],
      "Wi-Fi": [entry("10.106.215.85", "255.255.255.0", "aa:bb:cc:dd:ee:ff")],
    })).toEqual(["10.106.215.85"]);
  });
});
