// ==========================================
// Google Drive Picker / API 設定
// Client ID 與 API 金鑰放前端為正常做法：
//   - Client ID 本身非機密
//   - API 金鑰靠 Google Cloud Console 的「網域(HTTP 參照網址)限制」保護
// 注意：請勿在此放 client_secret（純前端不需要，也不該外洩）
// ==========================================
export const DRIVE = {
  clientId: '1011815467681-vsjs5ctae2ouqv384tqlp0dvveb9srta.apps.googleusercontent.com',
  // 目前共用 Firebase 的網頁 API 金鑰；若 Picker 失敗，改建一把限制為 Google Picker API 的專用金鑰
  apiKey: 'AIzaSyCh2PByMUxJCY3cmg36WvTE_3PXOyCxNBY',
  // App ID = GCP 專案編號（即 firebase 的 messagingSenderId）
  appId: '1011815467681',
  // 只取用「使用者透過本 App 開啟/建立的檔案」，非敏感範圍，免 Google 審查
  scope: 'https://www.googleapis.com/auth/drive.file',
};
