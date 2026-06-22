# 課程系統 — 部署與設定指南

本次改版把原本的「單一上傳排行榜」升級為「課程制繳交平台」。
流程：Google 登入 → 填基本資料 → 輸入課程代碼加入課程 → 繳交/編輯專案。

---

## 一、必做：在 Firebase 後台設定

### 1. 部署 Firestore 安全規則
專案根目錄的 [`firestore.rules`](firestore.rules) 是新的權限規則。請擇一方式部署：

- **Firebase 主控台**：Firestore Database → 規則（Rules）→ 把 `firestore.rules` 內容整段貼上 → 發布。
- 或用 CLI：`firebase deploy --only firestore:rules`

### 2. 建立「管理密碼文件」（管理者綁定用）
這份文件讓密碼**只存在資料庫、永不出現在前端原始碼或 F12**。
在 Firestore 手動建立：

- 集合（Collection）：`config`
- 文件 ID（Document ID）：`admin`
- 欄位：`secret`（字串）= `minar7917`

> 規則已設定 `config` 用戶端完全不可讀寫，只有規則引擎能在綁定時比對，因此密碼不會外洩。

### 3. 綁定第一位超級管理者
1. 用你的 Google 帳號登入網站。
2. 進入 `/admin`（或點右上角，第一次會顯示「成為管理者」畫面）。
3. 輸入密碼 `minar7917` → 你的帳號即綁定為「超級管理者」。

完成後，密碼其實已可停用——之後新增管理者都改用名單/申請流程。

---

## 二、管理者制度說明

| 層級 | 權限 |
|---|---|
| 超級管理者 super | 課程 CRUD ＋ 新增/移除一般管理者 ＋ 審核升級申請 |
| 一般管理者 admin | 課程 CRUD；可「申請」升級為 super |

- 超級管理者在後台用 **email** 新增一般管理者（對方需先用 Google 登入過一次，系統才有其帳號）。
- 一般管理者要變成 super：在後台送出申請 → 任一現任 super 同意 → **加入** super（既有 super 全部保留，可多位並存）。
- 緊急救援：可直接在 Firebase 後台修改 `admins` 集合（後台以擁有者權限操作，不受規則限制）。

---

## 三、Drive 檔案上傳（Phase 6，已完成）

當課程勾選「檔案上傳」欄位時，學生會看到「從 Google Drive 上傳／選擇檔案」按鈕，
透過 Google Picker（scope `drive.file`）把檔案上傳到自己的 Drive，系統只保存連結。

設定值放在 [`src/driveConfig.js`](src/driveConfig.js)：
- `clientId`：OAuth 2.0 用戶端 ID
- `apiKey`：給 Picker 用的 API 金鑰（目前共用 Firebase 網頁金鑰）
- `appId`：GCP 專案編號（`1011815467681`）

### Google Cloud Console 需完成（一次性）
1. 專案 `ai-final-project-a69b4` 中啟用 **Google Drive API**、**Google Picker API**。
2. OAuth 同意畫面：使用者類型「外部」、**已發布 (In production)**、資料存取加入 `https://www.googleapis.com/auth/drive.file`（非敏感範圍，免審查）。**不要上傳 logo**，以免觸發強制驗證。
3. OAuth 2.0 用戶端 ID（網頁應用程式）的「已授權 JavaScript 來源」需含：
   `http://localhost:5173` 與 `https://ai-final-project-ten.vercel.app`。
4. 若 API 金鑰有設「API 限制」，務必把 **Google Picker API** 勾入，否則 Picker 會失敗。

### 注意事項
- 系統會盡力把檔案權限設為「知道連結者可讀」方便老師批改；但**學校 Google Workspace 若停用外部分享**，此步驟可能失敗，屆時老師需請學生手動分享，或學生改用個人 Gmail 的 Drive。
- 共用 Firebase API 金鑰可運作；若日後想分離，可在 Console 另建一把限制為 Google Picker API 的金鑰，替換 `driveConfig.js` 的 `apiKey` 即可。

---

## 四、本機開發

```bash
npm install
npm run dev
```

Vercel 部署已加入 [`vercel.json`](vercel.json) 的 SPA rewrite，重新整理子頁面（例如 `/course/xxx`）不會 404。
