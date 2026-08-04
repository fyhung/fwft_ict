import type { NetworkSnapshot } from "./protocol.ts";
import type { GameSnapshot } from "./types.ts";

type PelletState = Pick<GameSnapshot, "pellets" | "powerPellets">;

export function createNetworkSnapshot(snapshot: GameSnapshot, previous: PelletState | null): NetworkSnapshot {
  const { pellets, powerPellets, ...gameplay } = snapshot;
  if (!previous) return { ...gameplay, pellets: [...pellets], powerPellets: [...powerPellets] };

  const pelletSet = new Set(pellets);
  const powerPelletSet = new Set(powerPellets);
  return {
    ...gameplay,
    removedPellets: previous.pellets.filter((key) => !pelletSet.has(key)),
    removedPowerPellets: previous.powerPellets.filter((key) => !powerPelletSet.has(key)),
  };
}

export function mergeNetworkSnapshot(previous: GameSnapshot | null, update: NetworkSnapshot): GameSnapshot {
  const {
    pellets: fullPellets,
    powerPellets: fullPowerPellets,
    removedPellets = [],
    removedPowerPellets = [],
    ...gameplay
  } = update;
  const removedPelletSet = new Set(removedPellets);
  const removedPowerPelletSet = new Set(removedPowerPellets);
  return {
    ...gameplay,
    pellets: fullPellets ? [...fullPellets] : (previous?.pellets ?? []).filter((key) => !removedPelletSet.has(key)),
    powerPellets: fullPowerPellets
      ? [...fullPowerPellets]
      : (previous?.powerPellets ?? []).filter((key) => !removedPowerPelletSet.has(key)),
  };
}
