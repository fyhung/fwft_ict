import assert from "node:assert/strict";
import { Client } from "@colyseus/sdk";
import { startGameServer } from "../dist-server/server.js";

const port = 26789;
const endpoint = `http://127.0.0.1:${port}`;

const messageChannels = new WeakMap();

function messageChannel(room, type) {
  let channels = messageChannels.get(room);
  if (!channels) {
    channels = new Map();
    messageChannels.set(room, channels);
  }
  let channel = channels.get(type);
  if (!channel) {
    channel = { messages: [], waiters: [] };
    channels.set(type, channel);
    room.onMessage(type, (message) => {
      const waiterIndex = channel.waiters.findIndex((waiter) => waiter.predicate(message));
      if (waiterIndex >= 0) {
        const [waiter] = channel.waiters.splice(waiterIndex, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      } else {
        channel.messages.push(message);
        if (channel.messages.length > 100) channel.messages.shift();
      }
    });
  }
  return channel;
}

function nextMessage(room, type, predicate = () => true, timeoutMs = 5_000, label = type) {
  const channel = messageChannel(room, type);
  const existingIndex = channel.messages.findIndex(predicate);
  if (existingIndex >= 0) return Promise.resolve(channel.messages.splice(existingIndex, 1)[0]);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, timer: null };
    waiter.timer = setTimeout(() => {
      const waiterIndex = channel.waiters.indexOf(waiter);
      if (waiterIndex >= 0) channel.waiters.splice(waiterIndex, 1);
      reject(new Error(`Timed out waiting for ${label}.`));
    }, timeoutMs);
    channel.waiters.push(waiter);
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

  const styledOne = nextMessage(playerOne, "styleResult");
  playerOne.send("style", { colorId: "c48", cosmeticId: "crown" });
  assert.deepEqual(await styledOne, { ok: true });
  const styledTwo = nextMessage(playerTwo, "styleResult");
  playerTwo.send("style", { cosmeticId: "cat-ears" });
  assert.deepEqual(await styledTwo, { ok: true });

  const configuredLobby = nextMessage(host, "lobby", (message) =>
    message.livesPerPacman === 5 && message.roundDurationMs === 120_000,
    5_000,
    "custom round settings",
  );
  host.send("settings", { livesPerPacman: 5, roundDurationMs: 120_000 });
  await configuredLobby;
  const readyLobby = nextMessage(host, "lobby", (message) =>
    Object.keys(message.players).length === 2 &&
    Object.values(message.players).every((player) => player.lobby.ready && player.profile.cosmeticId),
    5_000,
    "both players ready",
  );
  playerOne.send("ready", true);
  playerTwo.send("ready", true);
  await readyLobby;
  host.send("pacmanCount", 1);
  const assignedLobby = nextMessage(host, "lobby", (message) =>
    Object.keys(message.players).length === 2 &&
    Object.values(message.players).every((player) => player.lobby.ready && player.assignment),
    5_000,
    "assigned roles",
  );
  host.send("randomize");
  await assignedLobby;

  const firstSnapshot = nextMessage(host, "snapshot", (message) => message.status === "playing", 5_000, "initial game snapshot");
  host.send("start");
  const initial = await firstSnapshot;
  assert.equal(Object.keys(initial.actors).length, 2);
  assert.equal(Object.values(initial.actors).filter((actor) => actor.role === "pacman").length, 1);
  assert.equal(initial.pacmanLives, 5);
  assert.equal(initial.roundEndsAt - initial.roundStartedAt, 120_000);
  assert.equal(initial.actors[playerOne.sessionId].colorId, "c48");
  assert.equal(initial.actors[playerOne.sessionId].cosmeticId, "crown");
  assert.equal(initial.actors[playerTwo.sessionId].cosmeticId, "cat-ears");

  const acknowledged = nextMessage(
    playerOne,
    "snapshot",
    (message) => (message.actors[playerOne.sessionId]?.lastInputSeq ?? 0) >= 1,
    5_000,
    "input acknowledgement snapshot",
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
    5_000,
    "accepted client position snapshot",
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
