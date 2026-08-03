import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  signInAnonymously,
  type Auth,
} from "firebase/auth";
import {
  getDatabase,
  onChildAdded,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type { Admission, Direction, GameSnapshot, JoinRequest, PlayerRecord, RoomData } from "./types.ts";

export const CLIENT_VERSION = "0.1.0";
export const MAX_PLAYERS = 30;

export interface Backend {
  auth: Auth;
  db: Database;
  uid: string;
}

function env(name: keyof ImportMetaEnv) {
  return import.meta.env[name]?.trim();
}

export function firebaseConfigured(): boolean {
  return Boolean(
    env("VITE_FIREBASE_API_KEY") &&
      env("VITE_FIREBASE_AUTH_DOMAIN") &&
      env("VITE_FIREBASE_DATABASE_URL") &&
      env("VITE_FIREBASE_PROJECT_ID") &&
      env("VITE_FIREBASE_APP_ID"),
  );
}

export async function connectBackend(): Promise<Backend> {
  if (!firebaseConfigured()) throw new Error("Firebase is not configured. Copy .env.example to .env and add the Web app values.");
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: env("VITE_FIREBASE_API_KEY"),
        authDomain: env("VITE_FIREBASE_AUTH_DOMAIN"),
        databaseURL: env("VITE_FIREBASE_DATABASE_URL"),
        projectId: env("VITE_FIREBASE_PROJECT_ID"),
        appId: env("VITE_FIREBASE_APP_ID"),
      });

  // A player identity should belong to this tab, not every tab using the same
  // browser profile. Avoiding the default IndexedDB-backed persistence also
  // lets Chrome Guest/private windows join when durable storage is hidden.
  let auth: Auth;
  try {
    auth = initializeAuth(app, {
      persistence: [browserSessionPersistence, inMemoryPersistence],
      popupRedirectResolver: undefined,
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/already-initialized") throw error;
    auth = getAuth(app);
  }
  if (!auth.currentUser) await signInAnonymously(auth);
  if (!auth.currentUser) throw new Error("Anonymous sign-in did not return a user.");
  return { auth, db: getDatabase(app), uid: auth.currentUser.uid };
}

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function roomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

export async function createRoom(backend: Backend): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = roomCode();
    const initial: RoomData = {
      meta: {
        hostUid: backend.uid,
        status: "lobby",
        createdAt: serverTimestamp(),
        roundId: 0,
        joinLocked: false,
        clientVersion: CLIENT_VERSION,
      },
      config: {
        maxPlayers: MAX_PLAYERS,
        pacmanCount: 1,
        roundDurationMs: 5 * 60_000,
        mapId: "crowd-01",
      },
    };
    const result = await runTransaction(ref(backend.db, `rooms/${code}`), (current) => (current === null ? initial : undefined), {
      applyLocally: false,
    });
    if (result.committed) return code;
  }
  throw new Error("Could not reserve a room code. Please try again.");
}

export function watchRoom(backend: Backend, code: string, listener: (room: RoomData | null) => void): Unsubscribe {
  return onValue(ref(backend.db, `rooms/${code}`), (snapshot) => listener(snapshot.val() as RoomData | null));
}

export function watchAdmission(
  backend: Backend,
  code: string,
  listener: (admission: Admission | null) => void,
): Unsubscribe {
  return onValue(ref(backend.db, `rooms/${code}/admissions/${backend.uid}`), (snapshot) =>
    listener(snapshot.val() as Admission | null),
  );
}

export async function submitJoinRequest(backend: Backend, code: string, request: Omit<JoinRequest, "requestedAt">) {
  await set(ref(backend.db, `rooms/${code}/joinRequests/${backend.uid}`), {
    ...request,
    requestedAt: serverTimestamp(),
  });
}

export function processJoinRequests(backend: Backend, code: string, onError: (error: Error) => void): Unsubscribe {
  return onChildAdded(ref(backend.db, `rooms/${code}/joinRequests`), (snapshot) => {
    const joiningUid = snapshot.key;
    if (!joiningUid) return;
    void runTransaction(
      ref(backend.db, `rooms/${code}`),
      (rawRoom) => {
        const room = rawRoom as RoomData | null;
        if (!room || room.meta.hostUid !== backend.uid) return undefined;
        if (room.admissions?.[joiningUid]?.status === "granted") {
          if (room.joinRequests) delete room.joinRequests[joiningUid];
          return room;
        }
        if (room.admissions?.[joiningUid]?.status === "rejected") delete room.admissions[joiningUid];
        const request = room.joinRequests?.[joiningUid];
        if (!request) return room;
        const reject = (reason: string) => {
          room.admissions ??= {};
          room.admissions[joiningUid] = { status: "rejected", reason, seatId: null };
          if (room.joinRequests) delete room.joinRequests[joiningUid];
          return room;
        };
        if (room.meta.status !== "lobby" || room.meta.joinLocked) return reject("The game has already started.");
        const players = room.players ?? {};
        if (Object.keys(players).length >= Math.min(MAX_PLAYERS, room.config.maxPlayers)) return reject("The room is full.");
        const trimmedName = request.name.trim().slice(0, 16);
        if (!trimmedName) return reject("Enter a name.");
        if (Object.values(players).some((player) => player.profile.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
          return reject("That name is already in use.");
        }
        if (!/^c(?:0\d|[1-5]\d|6[0-3])$/.test(request.colorId)) return reject("Choose a valid color.");
        if (room.colorClaims?.[request.colorId]) return reject("That color was just taken. Choose another.");
        const seats = room.seats ?? {};
        const seatId = Array.from({ length: MAX_PLAYERS }, (_, index) => `s${String(index).padStart(2, "0")}`).find(
          (candidate) => !seats[candidate],
        );
        if (!seatId) return reject("The room is full.");

        room.players ??= {};
        room.seats ??= {};
        room.colorClaims ??= {};
        room.admissions ??= {};
        room.players[joiningUid] = {
          seatId,
          profile: { name: trimmedName, colorId: request.colorId },
          presence: { online: true, lastSeenAt: serverTimestamp() },
          lobby: { ready: false, joinedAt: serverTimestamp() },
        } satisfies PlayerRecord;
        room.seats[seatId] = joiningUid;
        room.colorClaims[request.colorId] = joiningUid;
        room.admissions[joiningUid] = { status: "granted", reason: null, seatId };
        delete room.joinRequests![joiningUid];
        return room;
      },
      { applyLocally: false },
    ).catch((error: unknown) => onError(error instanceof Error ? error : new Error(String(error))));
  });
}

export async function registerPresence(backend: Backend, code: string) {
  const presenceRef = ref(backend.db, `rooms/${code}/players/${backend.uid}/presence`);
  await onDisconnect(presenceRef).set({ online: false, lastSeenAt: serverTimestamp() });
  await set(presenceRef, { online: true, lastSeenAt: serverTimestamp() });
}

export async function setReady(backend: Backend, code: string, ready: boolean) {
  await set(ref(backend.db, `rooms/${code}/players/${backend.uid}/lobby/ready`), ready);
}

export async function updatePacmanCount(backend: Backend, code: string, count: number) {
  await set(ref(backend.db, `rooms/${code}/config/pacmanCount`), count);
}

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  const random = crypto.getRandomValues(new Uint32Array(Math.max(1, result.length)));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = random[index] % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export async function randomizeRoles(backend: Backend, code: string) {
  await runTransaction(ref(backend.db, `rooms/${code}`), (rawRoom) => {
    const room = rawRoom as RoomData | null;
    if (!room || room.meta.hostUid !== backend.uid || room.meta.status !== "lobby") return undefined;
    const players = room.players ?? {};
    const uids = shuffled(Object.keys(players));
    if (uids.length < 2) return room;
    const pacmanCount = Math.max(1, Math.min(uids.length - 1, Math.round(room.config.pacmanCount)));
    room.config.pacmanCount = pacmanCount;
    uids.forEach((uid, index) => {
      players[uid].assignment = {
        role: index < pacmanCount ? "pacman" : "ghost",
        spawnId: `${index < pacmanCount ? "p" : "g"}${String(index < pacmanCount ? index : index - pacmanCount).padStart(2, "0")}`,
      };
    });
    return room;
  });
}

export async function beginRound(backend: Backend, code: string, snapshot: GameSnapshot) {
  await update(ref(backend.db, `rooms/${code}`), {
    "meta/status": "playing",
    "meta/joinLocked": true,
    inputs: null,
    authoritative: snapshot,
  });
}

export async function publishSnapshot(backend: Backend, code: string, snapshot: GameSnapshot) {
  if (snapshot.status === "results") {
    await runTransaction(
      ref(backend.db, `rooms/${code}`),
      (rawRoom) => {
        const room = rawRoom as RoomData | null;
        if (!room || room.meta.roundId !== snapshot.roundId || room.meta.status !== "playing") return undefined;
        room.authoritative = structuredClone(snapshot);
        room.meta.status = "results";
        return room;
      },
      { applyLocally: false },
    );
  } else {
    await set(ref(backend.db, `rooms/${code}/authoritative`), structuredClone(snapshot));
  }
}

export function watchInputs(
  backend: Backend,
  code: string,
  listener: (inputs: Record<string, { seq: number; direction: Direction; clientTime: number }>) => void,
) {
  return onValue(ref(backend.db, `rooms/${code}/inputs`), (snapshot) => listener(snapshot.val() ?? {}));
}

export async function sendDirection(backend: Backend, code: string, direction: Direction, seq: number) {
  await set(ref(backend.db, `rooms/${code}/inputs/${backend.uid}`), { seq, direction, clientTime: Date.now() });
}

export async function resetToLobby(backend: Backend, code: string, keepTeams: boolean) {
  await runTransaction(ref(backend.db, `rooms/${code}`), (rawRoom) => {
    const room = rawRoom as RoomData | null;
    if (!room || room.meta.hostUid !== backend.uid) return undefined;
    room.meta.status = "lobby";
    room.meta.joinLocked = false;
    room.meta.roundId += 1;
    delete room.authoritative;
    delete room.inputs;
    Object.values(room.players ?? {}).forEach((player) => {
      player.lobby.ready = false;
      if (!keepTeams) delete player.assignment;
    });
    return room;
  });
}

export async function closeRoom(backend: Backend, code: string) {
  await update(ref(backend.db, `rooms/${code}/meta`), { status: "closed", joinLocked: true });
}
