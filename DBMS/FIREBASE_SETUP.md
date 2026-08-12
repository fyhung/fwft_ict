# DBMS Studio Firebase 設定指南

DBMS Studio 可使用現有的 Firebase 專案，但應註冊為獨立的第三個 Web app。這項操作不會影響現有應用程式及其資料。

## 1. 註冊第三個 Web app

1. 開啟 Firebase Console，選擇現有的 `fwft-ict` 專案。
2. 開啟 **專案設定 > 一般**。
3. 在 **你的應用程式** 下選擇 **新增應用程式 > Web** (`</>`)。
4. 建議暱稱使用 `DBMS Studio`；Firebase Hosting 並非必要。
5. 選擇 **註冊應用程式**，複製完整的 `firebaseConfig` 物件。
6. 將設定值填入 `DBMS/firebase-config.js`。新 app 有自己的 `appId`，不要沿用另外兩個 app 的 `appId`。

Firebase Web 設定是應用程式識別資料，並非密碼。真正的資料保護來自 Authentication 及 Firestore rules。

## 2. 啟用 Google Authentication

1. 開啟 **建構 > Authentication > 登入方式**。
2. 啟用 **Google**，選擇支援電子郵件，然後儲存。
3. 在 **Authentication > 設定 > 已授權網域** 加入所有會提供工作室的網站網域。使用 GitHub Pages 時加入 `fyhung.github.io`；本機開發則保留 `localhost`。

如只容許學校的 Google Workspace 帳戶，請在 `firebase-config.js` 設定 `allowedEmailDomain`，並在兩套 security rules 中加入相同的電子郵件網域條件。只設定前端選項並不能真正限制資料存取。

## 3. 合併及發佈 Firestore rules

同一個 Firebase 專案已有其他 app 使用，因此不要直接覆蓋原有 rules。請將 `DBMS/firestore.rules` 中的 `dbmsUsers` match 區塊合併到現有的 `service cloud.firestore` 區塊，再到 **Firestore Database > 規則** 發佈。

Repository 內的 `SQL_HW/firestore.rules` 已經把 DBMS 區塊與原有的 `progress`、`teachers` rules 合併。

## 4. 只用 Firestore 儲存資料庫

本工作室不需要 Cloud Storage，也不需要開通付費 billing plan。SQLite 匯出資料會分割成約 700 KB 的 Firestore binary documents，存放在每位使用者的專案之下。每個雲端資料庫上限為 10 MB；較大的資料庫仍可在本機使用，並可下載 JSON 備份。

雲端自動儲存會在停止操作八秒後進行，以減少 Firestore write 用量；本機 IndexedDB 則會立即自動儲存。系統只保留目前 snapshot，成功儲存後會刪除已被取代的 chunk documents。

Spark plan 的 Firestore 配額由同一 Firebase 專案內所有 app 共用，請在 **Firestore Database > 用量** 查看目前配額及用量；Firebase 日後可能調整免費額度。

## 5. 發佈前測試

請透過 HTTP 提供此 repository；直接以 `file://` 開啟 `index.html` 時，ES modules 未必能正常運作。

建議依次測試：

1. 開啟 DBMS Studio，確認本機建立資料表功能正常。
2. 選擇 **Google 登入**，以測試帳戶 A 登入。
3. 選擇 **儲存至雲端**，確認按鈕顯示已儲存及 revision 版本。
4. 修改一筆資料，等候數秒，確認 revision 增加。
5. 開啟私密／無痕視窗，以同一帳戶登入，再從 **我的專案** 開啟資料庫。
6. 改用測試帳戶 B 登入，確認不能看到或存取帳戶 A 的專案。
7. 確認 **下載**、**匯入**及離線本機儲存仍然正常。

## 6. 工作室內建說明

開啟 DBMS Studio 後，選擇標題列的 **說明**，即可閱讀涵蓋所有分頁、按鈕、欄位設定、SQL、ER 圖、儲存及驗證功能的完整繁體中文指南。
