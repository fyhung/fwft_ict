# SQL Run 1.0.1 — 課室 LAN Firewall 修正版

## 開始遊戲

1. 將 `SQL-Run-1.0.1-firewall-fix-x64.exe` 複製到教師的 Windows x64 電腦（不要使用 v1.0.0 或同資料夾內的舊測試 EXE）。
2. 雙擊 EXE；首次啟動會展開到固定的 `%LOCALAPPDATA%\SQL Run\1.0.1`，之後會重用同一位置，讓 Windows Firewall 規則保持有效。
3. 若 Windows SmartScreen 出現，確認檔案來源後選擇「其他資訊」→「仍要執行」。本版本未有數碼簽署。
4. Windows Firewall 詢問時允許 SQL Run。若使用手機 hotspot 而 Windows 把它分類為 Public，請只在可信任的私人 hotspot 上同時勾選 **Public networks**；一般課室私人 LAN 則只勾選 **Private networks**。
5. 教師主機頁會自動透過 `127.0.0.1:2567` 開啟。
6. 學生裝置必須與教師電腦連接相同 Wi-Fi／LAN，然後掃描主機頁的 QR code，或輸入畫面上的 LAN 網址。
7. 學生輸入姓名、按準備；所有人準備後，教師選擇踏板難度、作答時間及題目級別，再開始比賽。
8. 學生用畫面方向鍵（或電腦的 WASD／方向鍵）自由移動；角色中心走出地板外框即淘汰。

## 連線疑難

- QR 網址應顯示教師電腦的實體 IPv4，例如 `192.168.x.x` 或 `10.x.x.x`，不應是 localhost。
- 若有多張網卡，請在主機頁選擇正確的 Wi-Fi／Ethernet 位址。
- 關閉 VPN；確認 Wi-Fi 沒有開啟 AP／Client Isolation。
- 學校訪客網絡可能禁止裝置互相連接，請改用允許區域連線的私人網絡。
- 若 2567 埠已被其他程式使用，先關閉該程式再重新啟動 SQL Run。
- v1.0.1 會排除 Proton/TUN/TAP `/32` 虛擬位址；QR 應只顯示實體 Wi-Fi／Ethernet IPv4。

## 版本資料

- 版本：1.0.1
- 平台：Windows x64
- Node.js：教師電腦不需要安裝
- 檔案：`SQL-Run-1.0.1-firewall-fix-x64.exe`
- SHA-256：`C61F39FBB7E9CC91F037DD82983F55B486E50376BA8E79C7F84B2C3DB7F7701D`
