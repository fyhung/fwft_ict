# Firebase setup for DBMS Studio

DBMS Studio uses the existing Firebase project, but it should be registered as
its own third Web app. The existing applications and their data remain intact.

## 1. Register the third Web app

1. Open Firebase Console and select the existing `fwft-ict` project.
2. Open **Project settings > General**.
3. Under **Your apps**, select **Add app > Web** (`</>`).
4. Use the nickname `DBMS Studio`. Firebase Hosting registration is optional.
5. Select **Register app** and copy the complete `firebaseConfig` object.
6. Put its values into `DBMS/firebase-config.js`. The new app has its own
   `appId`; do not copy the `appId` from either existing app.

The Firebase web configuration is an application identifier, not a secret.
Security comes from Authentication plus the Firestore rules.

## 2. Enable Google authentication

1. Open **Build > Authentication > Sign-in method**.
2. Enable **Google**, select a support email, and save.
3. Under **Authentication > Settings > Authorized domains**, add every host
   that will serve the studio. For GitHub Pages this is `fyhung.github.io`.
   Keep `localhost` for local development.

To accept only a school Google Workspace account, set `allowedEmailDomain` in
`firebase-config.js`, then add the same email-domain condition to both sets of
security rules. The client-side setting alone is not an access-control rule.

## 3. Merge and publish Firestore rules

The shared Firebase project already serves other apps, so do not replace their
rules. Merge the `dbmsUsers` match block from `DBMS/firestore.rules` into the
existing `service cloud.firestore` block, then publish it in
**Firestore Database > Rules**.

The repository's combined `SQL_HW/firestore.rules` already contains the DBMS
block alongside the existing `progress` and `teachers` rules.

## 4. Firestore-only database storage

Cloud Storage is not required. The SQLite export is divided into Firestore
binary documents of approximately 700 KB beneath each user's project. The
maximum cloud-saved database size is 10 MB. Larger databases remain usable
locally and can still be downloaded as JSON backups.

Cloud autosave waits for eight seconds of inactivity to reduce Firestore write
usage. Local IndexedDB autosave remains immediate. Only the current snapshot is
kept; replaced chunk documents are deleted after a successful save.

The Spark-plan Firestore quotas are shared by all apps in the Firebase project,
so monitor **Firestore Database > Usage**. As of August 2026, the free quota is
1 GiB stored data, 50,000 reads per day, 20,000 writes per day, 20,000 deletes
per day, and 10 GiB outbound transfer per month.

## 5. Test before releasing

Serve the repository through HTTP; ES modules do not work reliably by opening
`index.html` directly as a `file://` URL.

Test this sequence:

1. Open DBMS Studio and confirm local table creation still works.
2. Select **Google sign-in** and sign in as test user A.
3. Select **Save to cloud** and confirm the button changes to `Cloud saved · v1`.
4. Change a record, wait a few seconds, and confirm the revision increases.
5. Open a private/incognito window, sign in as the same user, select
   **My projects**, and open the database.
6. Sign in as test user B and confirm user A's project is not listed or
   accessible.
7. Confirm **Download**, **Import**, and offline local saving still work.
