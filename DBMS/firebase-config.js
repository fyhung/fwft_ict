// 在此貼上 DBMS Studio Web app 的 Firebase 設定物件。
// Firebase Console > 專案設定 > 你的應用程式 > DBMS Studio > SDK 設定。
// 這些 Web app 識別資料可安全地放在前端程式碼中；資料存取權限由
// Firebase Authentication 及 Firestore rules 保護。
export const firebaseConfig = {
  apiKey: "AIzaSyBorU1zGErbGgKCFFf6U7PULJqk2kkUYzY",
  authDomain: "fwft-ict.firebaseapp.com",
  projectId: "fwft-ict",
  storageBucket: "fwft-ict.firebasestorage.app", // Firebase 設定會包含此值；DBMS Studio 不會使用 Storage。
  messagingSenderId: "823970283860",
  appId: "1:823970283860:web:fb02b203dd7f96df4188c1"
};

// 留空即接受任何 Google 帳戶。如要將登入介面限制於指定的
// Google Workspace 網域，只輸入網域，例如 "school.edu.hk"。
// 如有設定，也必須在 Firebase security rules 執行相同網域限制。
export const allowedEmailDomain = "";
