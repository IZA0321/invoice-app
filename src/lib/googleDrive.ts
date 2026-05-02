/**
 * Google Drive API クライアント（ブラウザOAuth）
 *
 * 親フォルダ「ビジネス書類」配下に「領収書/請求書/見積書」サブフォルダを
 * 自動検出してPDFをアップロードする。
 */

const PARENT_FOLDER_ID = "10sI9KGIg-EVI86aAxo3SET1abOlfO4R0";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

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

function getTokenClient(clientId: string, onToken: (token: string) => void) {
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
      }
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

export async function ensureAuth(clientId: string): Promise<string> {
  if (accessToken) return accessToken;
  const cached = sessionStorage.getItem("izaGoogleToken");
  if (cached) {
    accessToken = cached;
    return cached;
  }
  await loadGis();
  return new Promise((resolve, reject) => {
    try {
      tokenClient = getTokenClient(clientId, (token) => resolve(token));
      tokenClient.requestAccessToken({ prompt: "" });
    } catch (e) {
      reject(e);
    }
  });
}

async function findFolderByName(parentId: string, name: string, token: string): Promise<string | null> {
  const q = encodeURIComponent(`'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`フォルダ検索失敗: ${res.status}`);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId: string, token: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
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

export async function getOrCreateSubfolder(folderName: string, token: string): Promise<string> {
  if (folderIdCache[folderName]) return folderIdCache[folderName];
  let id = await findFolderByName(PARENT_FOLDER_ID, folderName, token);
  if (!id) id = await createFolder(folderName, PARENT_FOLDER_ID, token);
  folderIdCache[folderName] = id;
  return id;
}

export async function uploadPdfToDrive(opts: {
  clientId: string;
  pdfBlob: Blob;
  fileName: string;
  folderName: "領収書" | "請求書" | "見積書";
}): Promise<{ id: string; webViewLink: string }> {
  const token = await ensureAuth(opts.clientId);
  const folderId = await getOrCreateSubfolder(opts.folderName, token);

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

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      sessionStorage.removeItem("izaGoogleToken");
      accessToken = null;
    }
    const errText = await res.text();
    throw new Error(`アップロード失敗: ${res.status} - ${errText}`);
  }
  return res.json();
}
