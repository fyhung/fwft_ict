import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  Bytes,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig, allowedEmailDomain } from "./firebase-config.js";

const configured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const CHUNK_SIZE = 700 * 1024;
const MAX_DATABASE_SIZE = 10 * 1024 * 1024;

function announce(detail) {
  window.dispatchEvent(new CustomEvent("dbms-cloud-state", { detail }));
}

if (!configured) {
  announce({ configured: false, user: null, api: null });
} else {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    if (allowedEmailDomain) provider.setCustomParameters({ prompt: "select_account", hd: allowedEmailDomain });

    const assertDomain = user => {
      if (!allowedEmailDomain) return;
      const domain = String(user?.email || "").split("@")[1]?.toLowerCase();
      if (domain !== allowedEmailDomain.toLowerCase()) {
        const error = new Error(`Please use your ${allowedEmailDomain} Google account.`);
        error.code = "auth/domain-not-allowed";
        throw error;
      }
    };

    const requireUser = () => {
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in with Google first.");
      assertDomain(user);
      return user;
    };

    const chunkRef = (uid, projectId, snapshotId, index) =>
      doc(firestore, "dbmsUsers", uid, "projects", projectId, "chunks", `${snapshotId}_${String(index).padStart(3, "0")}`);

    const deleteSnapshot = async (uid, projectId, snapshotId, chunkCount) => {
      if (!snapshotId || !Number.isInteger(chunkCount) || chunkCount < 1) return;
      for (let start = 0; start < chunkCount; start += 400) {
        const batch = writeBatch(firestore);
        for (let index = start; index < Math.min(start + 400, chunkCount); index++) {
          batch.delete(chunkRef(uid, projectId, snapshotId, index));
        }
        await batch.commit();
      }
    };

    const api = {
      async signIn() {
        const result = await signInWithPopup(auth, provider);
        try {
          assertDomain(result.user);
        } catch (error) {
          await signOut(auth);
          throw error;
        }
        return result.user;
      },

      signOut() {
        return signOut(auth);
      },

      async listProjects() {
        const user = requireUser();
        const projects = collection(firestore, "dbmsUsers", user.uid, "projects");
        const snapshot = await getDocs(query(projects, orderBy("updatedAt", "desc")));
        return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      },

      async loadProject(projectId) {
        const user = requireUser();
        const projectRef = doc(firestore, "dbmsUsers", user.uid, "projects", projectId);
        const projectSnapshot = await getDoc(projectRef);
        if (!projectSnapshot.exists()) throw new Error("That cloud project no longer exists.");
        const metadata = projectSnapshot.data();
        const chunkCount = Number(metadata.chunkCount || 0);
        if (!metadata.snapshotId || !Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 16) {
          throw new Error("This cloud project has an invalid database snapshot.");
        }
        const chunks = await Promise.all(Array.from({ length: chunkCount }, async (_, index) => {
          const chunkSnapshot = await getDoc(chunkRef(user.uid, projectId, metadata.snapshotId, index));
          if (!chunkSnapshot.exists()) throw new Error(`Database chunk ${index + 1} is missing.`);
          const value = chunkSnapshot.data().data;
          const bytes = value?.toUint8Array?.();
          if (!bytes) throw new Error(`Database chunk ${index + 1} is invalid.`);
          return bytes;
        }));
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        if (totalSize > MAX_DATABASE_SIZE) throw new Error("The cloud database exceeds the 10 MB limit.");
        const bytes = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        return { id: projectId, ...metadata, bytes };
      },

      async saveProject({ projectId, expectedRevision, name, bytes, ui }) {
        const user = requireUser();
        if (bytes.byteLength > MAX_DATABASE_SIZE) {
          throw new Error("Cloud saving supports databases up to 10 MB. Download a JSON backup for larger projects.");
        }
        const id = projectId || crypto.randomUUID();
        const snapshotId = crypto.randomUUID();
        const chunkCount = Math.max(1, Math.ceil(bytes.byteLength / CHUNK_SIZE));
        // Keep each commit comfortably below Firestore's 10 MiB API request
        // limit; a full 10 MB database therefore uses several small commits.
        for (let start = 0; start < chunkCount; start += 6) {
          const chunkBatch = writeBatch(firestore);
          for (let index = start; index < Math.min(start + 6, chunkCount); index++) {
            const chunk = bytes.slice(index * CHUNK_SIZE, Math.min((index + 1) * CHUNK_SIZE, bytes.byteLength));
            chunkBatch.set(chunkRef(user.uid, id, snapshotId, index), {
              ownerId: user.uid,
              snapshotId,
              index,
              data: Bytes.fromUint8Array(chunk)
            });
          }
          await chunkBatch.commit();
        }

        const projectRef = doc(firestore, "dbmsUsers", user.uid, "projects", id);
        try {
          let previousSnapshotId = null;
          let previousChunkCount = 0;
          const revision = await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(projectRef);
            const existing = snapshot.exists() ? snapshot.data() : null;
            previousSnapshotId = existing?.snapshotId || null;
            previousChunkCount = Number(existing?.chunkCount || 0);
            const currentRevision = Number(existing?.revision || 0);
            if ((existing && expectedRevision == null) ||
                (expectedRevision != null && currentRevision !== Number(expectedRevision))) {
              const conflict = new Error("A newer cloud version exists.");
              conflict.code = "dbms/revision-conflict";
              throw conflict;
            }
            const nextRevision = currentRevision + 1;
            const data = {
              ownerId: user.uid,
              name: String(name || "Untitled database").slice(0, 120),
              snapshotId,
              chunkCount,
              revision: nextRevision,
              sizeBytes: bytes.byteLength,
              updatedAt: serverTimestamp(),
              ui
            };
            if (!existing) data.createdAt = serverTimestamp();
            transaction.set(projectRef, data, { merge: true });
            return nextRevision;
          });
          if (previousSnapshotId && previousSnapshotId !== snapshotId) {
            await deleteSnapshot(user.uid, id, previousSnapshotId, previousChunkCount).catch(() => {});
          }
          return { id, revision, snapshotId, chunkCount };
        } catch (error) {
          // The new chunks are not referenced when metadata fails. Remove them
          // when possible; a failed cleanup may leave a small orphan snapshot.
          await deleteSnapshot(user.uid, id, snapshotId, chunkCount).catch(() => {});
          throw error;
        }
      }
    };

    window.dbmsCloud = api;
    onAuthStateChanged(auth, async user => {
      if (user && allowedEmailDomain) {
        try {
          assertDomain(user);
        } catch (error) {
          await signOut(auth);
          announce({ configured: true, user: null, api, error });
          return;
        }
      }
      announce({ configured: true, user, api });
    });
  } catch (error) {
    announce({ configured: true, user: null, api: null, error });
  }
}
