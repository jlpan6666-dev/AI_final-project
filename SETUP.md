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

## 三、Drive 檔案上傳（下一階段 / Phase 6）

目前「檔案」欄位先採「貼上 Google Drive 連結」。
若要做到「在網頁內直接選檔上傳到 Drive」（Option C），需先在 Google Cloud Console 完成：

1. 進入專案 `ai-final-project-a69b4` 的 Google Cloud Console。
2. 啟用 **Google Drive API**、**Google Picker API**。
3. 設定 **OAuth 同意畫面**，範圍加入 `https://www.googleapis.com/auth/drive.file`（非受限範圍，免繁複審查）。
4. 建立 **OAuth 2.0 用戶端 ID**（網頁應用程式），授權來源加入 Vercel 網址與 `http://localhost`。
5. 建立 **API 金鑰**（給 Picker 用）。
6. 把「用戶端 ID」與「API 金鑰」提供給開發者接入。

---

## 四、本機開發

```bash
npm install
npm run dev
```

Vercel 部署已加入 [`vercel.json`](vercel.json) 的 SPA rewrite，重新整理子頁面（例如 `/course/xxx`）不會 404。
