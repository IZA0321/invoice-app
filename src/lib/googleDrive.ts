/**
 * Google Drive API クライアント（ブラウザOAuth）
 */

const PARENT_FOLDER_ID = "10sI9KGIg-EVI86aAxo3SET1abOlfO4R0";
// drive スコープでユーザー作成フォルダも完全に検索・操作可能
const SCOPES = "https://www.googleapis.com/auth/drive";
const SCOPE_VERSION = "v2"; // スコープ変更時に古いトークンを無効化

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleGlobal = { accounts: { oauth2: { initTokenClient: (cfg: any) => any } } };
function gapi(): GoogleGlobal {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).google;
  if (!g?.accounts?.oauth2) throw new Error("Google Identity Services 未ロード");
  return g;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenClient: any = null;
let accessToken: string | null = null;
let gisLoaded = false;

const folderIdCache: Record<string, string> = {};

function getTokenClient(clientId: string, onToken: (token: string) => void, onError: (err: Error) => void) {
  return gapi().accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (resp: any) => {
      if (resp.access_token) {
        accessToken = resp.access_token;
        try {
          sessionStorage.setItem("izaGoogleToken", resp.access_token);
        } catch {}
        onToken(resp.access_token);
      } else {
        onError(new Error("Google認証に失敗しました"));
      }
    },
    error_callback: (err: { type?: string; message?: string }) => {
      onError(new Error(err.message || "Google認証エラー"));
    },
  });
}

async function loadGis(): Promise<void> {
  if (gisLoaded) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      gisLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error("Google Identity Services のロードに失敗しました"));
    document.head.appendChild(s);
  });
}

function clearAuth() {
  accessToken = null;
  try {
    sessionStorage.removeItem("izaGoogleToken");
  } catch {}
}

async function requestNewToken(clientId: string): Promise<string> {
  await loadGis();
  return new Promise((resolve, reject) => {
    try {
      tokenClient = getTokenClient(clientId, resolve, reject);
      tokenClient.requestAccessToken({ prompt: "" });
    } catch (e) {
      reject(e);
    }
  });
}

export async function ensureAuth(clientId: string): Promise<string> {
  if (accessToken) return accessToken;
  const storedVersion = sessionStorage.getItem("izaGoogleScopeVersion");
  if (storedVersion !== SCOPE_VERSION) {
    sessionStorage.removeItem("izaGoogleToken");
    sessionStorage.setItem("izaGoogleScopeVersion", SCOPE_VERSION);
    // フォルダIDキャッシュもクリア（新スコープで再検索）
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("izaDriveFolder_")) localStorage.removeItem(k);
      });
    } catch {}
  }
  const cached = sessionStorage.getItem("izaGoogleToken");
  if (cached) {
    accessToken = cached;
    return cached;
  }
  return requestNewToken(clientId);
}

/**
 * Drive API 呼び出し（401時は自動再認証してリトライ）
 */
async function driveFetch(
  clientId: string,
  url: string,
  init: RequestInit
): Promise<Response> {
  let token = await ensureAuth(clientId);
  let res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearAuth();
    token = await requestNewToken(clientId);
    res = await fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
    });
  }
  return res;
}

async function findFolderByName(clientId: string, parentId: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await driveFetch(clientId, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {});
  if (!res.ok) throw new Error(`フォルダ検索失敗: ${res.status}`);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function createFolder(clientId: string, name: string, parentId: string): Promise<string> {
  const res = await driveFetch(clientId, "https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!res.ok) throw new Error(`フォルダ作成失敗: ${res.status}`);
  const data = await res.json();
  return data.id;
}

export async function getOrCreateSubfolder(clientId: string, folderName: string): Promise<string> {
  if (folderIdCache[folderName]) return folderIdCache[folderName];

  // localStorageから過去に作成したフォルダIDを取得
  const storageKey = `izaDriveFolder_${folderName}`;
  try {
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      folderIdCache[folderName] = cached;
      return cached;
    }
  } catch {}

  // 親フォルダ内を検索（drive.fileスコープでは見つからないことがある）
  let id = await findFolderByName(clientId, PARENT_FOLDER_ID, folderName);
  if (!id) id = await createFolder(clientId, folderName, PARENT_FOLDER_ID);
  folderIdCache[folderName] = id;
  try { localStorage.setItem(storageKey, id); } catch {}
  return id;
}

export async function uploadPdfToDrive(opts: {
  clientId: string;
  pdfBlob: Blob;
  fileName: string;
  folderName: "領収書" | "請求書" | "見積書";
}): Promise<{ id: string; webViewLink: string }> {
  const folderId = await getOrCreateSubfolder(opts.clientId, opts.folderName);

  const metadata = {
    name: opts.fileName,
    mimeType: "application/pdf",
    parents: [folderId],
  };

  const boundary = "-------izaboundary" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metaPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const filePartHeader = `Content-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n`;

  const arrayBuf = await opts.pdfBlob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuf).reduce((acc, b) => acc + String.fromCharCode(b), "")
  );

  const body = delimiter + metaPart + delimiter + filePartHeader + base64 + closeDelim;

  const res = await driveFetch(
    opts.clientId,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`アップロード失敗: ${res.status} - ${errText}`);
  }
  return res.json();
}
