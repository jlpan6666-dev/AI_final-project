// ==========================================
// Google Drive 直接上傳（不開 Picker、學生看不到資料夾內容）
// 在自家 UI 選本機檔案 → 透過 Drive API resumable 上傳到老師指定的資料夾。
// 只用 OAuth 權杖（scope: drive.file），不需要 Picker API 或 API 金鑰。
// ==========================================
import { DRIVE } from '../driveConfig';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

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

// 從 Drive 資料夾連結或原始字串中取出資料夾 ID
export function extractFolderId(input) {
  if (!input) return '';
  const s = String(input).trim();
  const m = s.match(/folders\/([-\w]+)/) || s.match(/[?&]id=([-\w]+)/);
  if (m) return m[1];
  return s; // 視為已是資料夾 ID
}

// 取得 drive.file 存取權杖（第一次會跳出 Google 授權視窗，之後通常靜默取得）
async function getAccessToken() {
  await loadScript(GSI_SRC);
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

// 在指定父資料夾下建立資料夾，回傳 { id, name, webViewLink }
// parentFolderId 可為空 → 建在 Drive 根目錄
export async function createDriveFolder(name, parentFolderId) {
  const token = await getAccessToken();
  const body = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentFolderId ? { parents: [parentFolderId] } : {}),
  };
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`建立資料夾失敗 (${res.status}) ${txt}`);
  }
  return await res.json();
}

// 盡力把檔案設為「任何知道連結的人可讀」，方便老師與排行榜檢視（失敗則略過）
async function tryShareAnyone(fileId, token) {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch {
    /* 忽略分享失敗 */
  }
}

// 直接上傳本機檔案到指定資料夾，回傳 { id, name, url }
// onProgress(0~100) 回報上傳進度
export async function uploadFileToDrive(file, folderId, onProgress) {
  if (!folderId) throw new Error('NO_FOLDER');
  const token = await getAccessToken();

  // 1) 建立 resumable 上傳工作階段，取得上傳網址（Location）
  const sessionUrl = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink', true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.getResponseHeader('Location'));
      else reject(new Error(`建立上傳工作階段失敗（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error('網路錯誤（建立工作階段）'));
    xhr.send(JSON.stringify({ name: file.name, parents: [folderId] }));
  });
  if (!sessionUrl) throw new Error('未取得上傳網址');

  // 2) 將檔案內容 PUT 上去，並回報進度
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`上傳失敗（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error('網路錯誤（上傳）'));
    xhr.send(file);
  });

  await tryShareAnyone(result.id, token);
  return { id: result.id, name: result.name, url: result.webViewLink };
}
