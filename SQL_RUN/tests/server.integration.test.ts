import { afterAll, describe, expect, it } from "vitest";
import { Client } from "colyseus.js";
import { startGameServer } from "../server/index";
import type { PoseMessage, RoomSnapshot } from "../src/protocol";

describe("LAN server integration", () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterAll(async () => {
    await closeServer?.();
  });

  it("creates a host room, admits two players, authorizes start, and resets", async () => {
    const server = await startGameServer({ port: 0, hostname: "127.0.0.1" });
    closeServer = server.close;
    const endpoint = `http://127.0.0.1:${server.port}`;
    const bootstrap = await fetch(`${endpoint}/api/host-bootstrap`).then((response) => response.json()) as { roomCode: string; hostToken: string };
    const host = await new Client(endpoint).create("sql_run", { roomCode: bootstrap.roomCode, hostToken: bootstrap.hostToken, role: "host" });
    host.onMessage("snapshot", () => undefined);
    host.onMessage("welcome", () => undefined);
    host.onMessage("game_error", () => undefined);
    const alice = await new Client(endpoint).joinById(host.roomId, { roomCode: bootstrap.roomCode, name: "Alice" });
    alice.onMessage("snapshot", () => undefined);
    alice.onMessage("welcome", () => undefined);
    const bob = await new Client(endpoint).joinById(host.roomId, { roomCode: bootstrap.roomCode, name: "Bob" });
    bob.onMessage("snapshot", () => undefined);
    bob.onMessage("welcome", () => undefined);

    const lobby = waitForSnapshot(host, (state) => state.players.length === 2);
    host.send("sync", {});
    expect((await lobby).players.map((player) => player.name).sort()).toEqual(["Alice", "Bob"]);

    const ready = waitForSnapshot(host, (state) => state.players.length === 2 && state.players.every((player) => player.ready));
    alice.send("player", { type: "set_ready", ready: true });
    bob.send("player", { type: "set_ready", ready: true });
    await ready;
    const prepared = waitForSnapshot(host, (state) => state.phase === "prepare");
    host.send("host", { type: "start_game", plateDifficulty: "nightmare", decisionSeconds: 2, questionLevel: "hard" });
    const preparedSnapshot = await prepared;
    expect(preparedSnapshot.mission?.level).toBe("hard");
    expect(preparedSnapshot.section?.plates.length).toBeGreaterThanOrEqual(4);
    expect(preparedSnapshot.settings).toEqual({ plateDifficulty: "nightmare", decisionSeconds: 2 });

    const poseUpdate = new Promise<PoseMessage>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for pose update.")), 2_000);
      host.onMessage("pose", (pose: PoseMessage) => {
        clearTimeout(timeout);
        resolve(pose);
      });
    });
    alice.send("player", { type: "move_pose", sectionId: preparedSnapshot.section!.id, x: .55, y: .72, sequence: 1, clientTime: Date.now() });
    expect(await poseUpdate).toMatchObject({ x: .55, y: .72 });

    const reset = waitForSnapshot(host, (state) => state.phase === "lobby");
    host.send("host", { type: "reset_game" });
    expect((await reset).players.every((player) => !player.ready)).toBe(true);
    await Promise.all([alice.leave(), bob.leave(), host.leave()]);
  }, 15_000);
});

function waitForSnapshot(room: Awaited<ReturnType<Client["create"]>>, predicate: (snapshot: RoomSnapshot) => boolean): Promise<RoomSnapshot> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for snapshot.")), 5_000);
    room.onMessage("snapshot", (snapshot: RoomSnapshot) => {
      if (!predicate(snapshot)) return;
      clearTimeout(timeout);
      resolve(snapshot);
    });
  });
}
