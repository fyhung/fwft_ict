// Copy the Firebase configuration object for the DBMS Studio web app here.
// Firebase Console > Project settings > Your apps > DBMS Studio > SDK setup.
// These web-app identifiers are safe to include in client code; access is
// protected by Firebase Authentication and the Firestore rules.
export const firebaseConfig = {
  apiKey: "AIzaSyBorU1zGErbGgKCFFf6U7PULJqk2kkUYzY",
  authDomain: "fwft-ict.firebaseapp.com",
  projectId: "fwft-ict",
  storageBucket: "fwft-ict.firebasestorage.app", // Present in Firebase config; not used by DBMS Studio.
  messagingSenderId: "823970283860",
  appId: "1:823970283860:web:fb02b203dd7f96df4188c1"
};

// Leave blank to accept any Google account. To limit the sign-in UI to a
// Google Workspace domain, enter only the domain, for example "school.edu.hk".
// If used, also enforce the same domain in the Firebase security rules.
export const allowedEmailDomain = "";
