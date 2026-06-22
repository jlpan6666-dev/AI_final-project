// ==========================================
// Google Drive 上傳設定
// 採「自家 UI 直接上傳」(Drive API resumable)，只需要 OAuth 用戶端 ID 與 scope。
// 不再需要 API 金鑰或 Google Picker API（那是舊的 Picker 流程才需要）。
// Client ID 放前端為正常做法；請勿放 client_secret。
// ==========================================
export const DRIVE = {
  clientId: '1011815467681-vsjs5ctae2ouqv384tqlp0dvveb9srta.apps.googleusercontent.com',
  // 只取用「使用者透過本 App 建立的檔案」，非敏感範圍，免 Google 審查
  scope: 'https://www.googleapis.com/auth/drive.file',
};
