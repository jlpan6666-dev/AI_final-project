// ==========================================
// Google Drive Picker 流程（純前端，scope: drive.file）
// 讓使用者「上傳新檔」或「挑選既有檔案」到自己的 Drive，
// 回傳 { id, name, url }；並盡力把檔案設為「知道連結者可讀」方便老師批改。
// ==========================================
import { DRIVE } from '../driveConfig';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';

let pickerReady = false;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`載入失敗：${src}`));
    document.head.appendChild(s);
  });
}

async function ensureLibsLoaded() {
  await loadScript(GSI_SRC);
  await loadScript(GAPI_SRC);
  if (!pickerReady) {
    await new Promise((resolve) => window.gapi.load('picker', { callback: resolve }));
    pickerReady = true;
  }
}

// 取得 drive.file 的存取權杖（會跳出 Google 授權視窗）
function requestAccessToken() {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: DRIVE.clientId,
      scope: DRIVE.scope,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// 盡力把檔案設為「任何知道連結的人可讀」（學校帳號可能停用外部分享，失敗則略過）
async function tryShareAnyone(fileId, token) {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch {
    /* 忽略分享失敗，連結本人仍可開 */
  }
}

// 從 Drive 資料夾連結或原始字串中取出資料夾 ID
export function extractFolderId(input) {
  if (!input) return '';
  const s = String(input).trim();
  const m = s.match(/folders\/([-\w]+)/) || s.match(/[?&]id=([-\w]+)/);
  if (m) return m[1];
  return s; // 視為已是資料夾 ID
}

// 主流程：上傳/挑選檔案「到指定資料夾」，回傳 { id, name, url }；取消回傳 null
// folderId 為必填（強制繳交到老師指定的資料夾）
export async function pickFromDrive(folderId) {
  if (!folderId) throw new Error('NO_FOLDER');
  await ensureLibsLoaded();
  const token = await requestAccessToken();
  const { google } = window;

  return new Promise((resolve, reject) => {
    try {
      // 上傳檢視指定 parent 資料夾，檔案會直接進老師的繳交資料夾
      const uploadView = new google.picker.DocsUploadView().setParent(folderId);

      const picker = new google.picker.PickerBuilder()
        .setOAuthToken(token)
        .setDeveloperKey(DRIVE.apiKey)
        .setAppId(DRIVE.appId)
        .setTitle('上傳專案檔案到課程繳交資料夾')
        .addView(uploadView)
        .setCallback(async (data) => {
          const action = data[google.picker.Response.ACTION];
          if (action === google.picker.Action.PICKED) {
            const doc = data[google.picker.Response.DOCUMENTS][0];
            const fileId = doc[google.picker.Document.ID];
            const name = doc[google.picker.Document.NAME];
            const url = doc[google.picker.Document.URL];
            await tryShareAnyone(fileId, token);
            resolve({ id: fileId, name, url });
          } else if (action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();

      picker.setVisible(true);
    } catch (err) {
      reject(err);
    }
  });
}
