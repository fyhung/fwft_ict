import { networkInterfaces } from "node:os";

interface AddressCandidate {
  adapter: string;
  address: string;
  score: number;
}

export function localIPv4Addresses(interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces()): string[] {
  const physical = /wi-?fi|wireless|wlan|ethernet/i;
  const virtual = /virtual|vmware|vbox|hyper-v|wsl|tailscale|zerotier|vpn|proton|protun|\btun\b|\btap\b|loopback|docker/i;
  const candidates: AddressCandidate[] = [];
  for (const [adapter, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal || entry.address.startsWith("169.254.")) continue;
      if (virtual.test(adapter) || entry.netmask === "255.255.255.255" || entry.mac === "00:00:00:00:00:00") continue;
      candidates.push({ adapter, address: entry.address, score: (physical.test(adapter) ? 2 : 0) - (virtual.test(adapter) ? 4 : 0) });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.adapter.localeCompare(b.adapter)).map((candidate) => candidate.address);
}

export function makeRoomCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(random() * alphabet.length)] ?? "X").join("");
}

export function makeSecret(random: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => random().toString(36).slice(2)).join("");
}
