import type { GameSnapshot } from "./types.ts";

export function winningMvp(snapshot: GameSnapshot) {
  if (!snapshot.winner) return null;
  return Object.values(snapshot.actors)
    .filter((actor) => actor.role === snapshot.winner)
    .sort((first, second) =>
      second.score - first.score ||
      (snapshot.winner === "ghost"
        ? second.kills - first.kills
        : second.ghostsEaten - first.ghostsEaten || second.fruitsEaten - first.fruitsEaten || second.pellets - first.pellets) ||
      first.name.localeCompare(second.name),
    )[0] ?? null;
}

export function mvpDetail(snapshot: GameSnapshot) {
  const mvp = winningMvp(snapshot);
  if (!mvp) return "";
  return mvp.role === "ghost"
    ? `${mvp.score.toLocaleString()} points · ${mvp.kills} capture${mvp.kills === 1 ? "" : "s"}`
    : `${mvp.score.toLocaleString()} points · ${mvp.pellets} dots · ${mvp.fruitsEaten} fruit · ${mvp.ghostsEaten} Ghost${mvp.ghostsEaten === 1 ? "" : "s"} eaten`;
}
