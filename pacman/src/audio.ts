import type { GameEvent, GameEventType } from "./types.ts";

type SoundName = "beginning" | "chomp" | "eatfruit" | "eatghost" | "death" | "extrapac" | "intermission";

const SOUND_FILES: Record<SoundName, string> = {
  beginning: "pacman_beginning.wav",
  chomp: "pacman_chomp.wav",
  eatfruit: "pacman_eatfruit.wav",
  eatghost: "pacman_eatghost.wav",
  death: "pacman_death.wav",
  extrapac: "pacman_extrapac.wav",
  intermission: "pacman_intermission.wav",
};

const EVENT_SOUNDS: Partial<Record<GameEventType, SoundName>> = {
  "round-start": "beginning",
  pellet: "chomp",
  "power-pellet": "chomp",
  "fruit-eaten": "eatfruit",
  "ghost-eaten": "eatghost",
  "pacman-death": "death",
  "extra-life": "extrapac",
  "round-end": "intermission",
};

const VOLUMES: Record<SoundName, number> = {
  beginning: 0.62,
  chomp: 0.28,
  eatfruit: 0.7,
  eatghost: 0.72,
  death: 0.76,
  extrapac: 0.68,
  intermission: 0.58,
};

class GameSounds {
  private readonly pools = new Map<SoundName, HTMLAudioElement[]>();
  private readonly seen = new Set<string>();
  private lastChompAt = 0;
  private unlocked = false;

  constructor() {
    (Object.entries(SOUND_FILES) as Array<[SoundName, string]>).forEach(([name, file]) => {
      const size = name === "chomp" ? 3 : 2;
      const source = new URL(`./${file}`, document.baseURI).toString();
      const pool = Array.from({ length: size }, () => {
        const audio = new Audio(source);
        audio.preload = "auto";
        audio.volume = VOLUMES[name];
        return audio;
      });
      this.pools.set(name, pool);
    });
    const unlock = () => void this.unlock();
    window.addEventListener("pointerdown", unlock, { capture: true, once: true });
    window.addEventListener("keydown", unlock, { capture: true, once: true });
  }

  private async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    await Promise.allSettled([...this.pools.values()].map(async ([audio]) => {
      const volume = audio.volume;
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
    }));
  }

  handle(event: GameEvent) {
    const key = `${event.roundId}:${event.id}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!);
    const sound = EVENT_SOUNDS[event.type];
    if (!sound) return;
    if (sound === "chomp") {
      const now = performance.now();
      if (now - this.lastChompAt < 70) return;
      this.lastChompAt = now;
    }
    this.play(sound);
  }

  stopAll() {
    this.pools.forEach((pool) => pool.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    }));
  }

  private play(name: SoundName) {
    const pool = this.pools.get(name);
    if (!pool?.length) return;
    const audio = pool.find((item) => item.paused || item.ended) ?? pool[0];
    audio.currentTime = 0;
    audio.volume = VOLUMES[name];
    void audio.play().catch(() => {
      // Mobile browsers may suppress sound until the player touches the page.
    });
  }
}

export const gameSounds = new GameSounds();
