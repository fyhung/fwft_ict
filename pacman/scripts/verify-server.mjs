import assert from "node:assert/strict";
import { Client } from "@colyseus/sdk";
import { startGameServer } from "../dist-server/server.js";

const port = 26789;
const endpoint = `http://127.0.0.1:${port}`;

function nextMessage(room, type, predicate = () => true, timeoutMs = 3_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${type}.`));
    }, timeoutMs);
    const unsubscribe = room.onMessage(type, (message) => {
      if (!predicate(message)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(message);
    });
  });
}

const server = await startGameServer({ port, hostname: "127.0.0.1", devMode: true });
let host;
let playerOne;
let playerTwo;

try {
  const client = new Client(endpoint);
  host = await client.create("maze_chase", { mode: "host" });
  playerOne = await client.joinById(host.roomId, { mode: "player" });
  playerTwo = await client.joinById(host.roomId, { mode: "player" });
  // Consume unrelated room traffic so the SDK does not warn while each test
  // temporarily waits for only one specific message type.
  [host, playerOne, playerTwo].forEach((room) => room.onMessage("*", () => {}));

  const joinedOne = nextMessage(playerOne, "joinResult");
  playerOne.send("join", { name: "Alice", colorId: "c00" });
  assert.deepEqual(await joinedOne, { ok: true });

  const joinedTwo = nextMessage(playerTwo, "joinResult");
  playerTwo.send("join", { name: "Bob", colorId: "c01" });
  assert.deepEqual(await joinedTwo, { ok: true });

  playerOne.send("ready", true);
  playerTwo.send("ready", true);
  host.send("pacmanCount", 1);
  const assignedLobby = nextMessage(host, "lobby", (message) =>
    Object.keys(message.players).length === 2 &&
    Object.values(message.players).every((player) => player.lobby.ready && player.assignment),
  );
  host.send("randomize");
  await assignedLobby;

  const firstSnapshot = nextMessage(host, "snapshot", (message) => message.status === "playing");
  host.send("start");
  const initial = await firstSnapshot;
  assert.equal(Object.keys(initial.actors).length, 2);
  assert.equal(Object.values(initial.actors).filter((actor) => actor.role === "pacman").length, 1);

  const acknowledged = nextMessage(
    playerOne,
    "snapshot",
    (message) => (message.actors[playerOne.sessionId]?.lastInputSeq ?? 0) >= 1,
  );
  playerOne.send("direction", { seq: 1, direction: "left", clientTime: Date.now() });
  const moved = await acknowledged;
  assert.equal(moved.actors[playerOne.sessionId].lastInputSeq, 1);

  const initialPlayerX = initial.actors[playerOne.sessionId].x;
  const initialPlayerY = initial.actors[playerOne.sessionId].y;
  const targetPlayerX = initialPlayerX + 0.1;
  const acceptedPosition = nextMessage(
    host,
    "snapshot",
    (message) => Math.abs(message.actors[playerOne.sessionId]?.x - targetPlayerX) < 0.001,
  );
  playerOne.send("position", {
    seq: 1,
    x: targetPlayerX,
    y: initialPlayerY,
    direction: "right",
    wantedDirection: "right",
    clientTime: performance.now(),
  });
  await acceptedPosition;

  const rejectedTeleport = nextMessage(playerOne, "correction");
  playerOne.send("position", {
    seq: 1,
    x: initialPlayerX + 10,
    y: initialPlayerY,
    direction: "right",
    wantedDirection: "right",
    clientTime: performance.now(),
  });
  const correction = await rejectedTeleport;
  assert.ok(Math.abs(correction.actor.x - targetPlayerX) < 0.001);

  console.log("Server verification passed: joining, roles, client position acceptance, teleport rejection, rules, snapshots, and input acknowledgement work.");
} finally {
  await Promise.allSettled([playerOne?.leave(), playerTwo?.leave(), host?.leave()]);
  await server.close();
}
