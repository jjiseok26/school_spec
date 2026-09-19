import type { AppData } from "@/lib/types";

const FOLDER_NAME = "schoolspec";
const BACKUP_FILE_NAME = "school_spec_backup.json";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

const SESSION_KEY = "school_spec_google_session";
const SESSION_EVENT = "school-spec-google-session";
const GIS_SCRIPT = "https://accounts.google.com/gsi/client";

export type GoogleSession = {
  accessToken: string;
  expiresAt: number;
  email: string;
  name: string;
};

type DriveFile = {
  id: string;
  name: string;
};

function getClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";
}

export function isGoogleDriveConfigured() {
  return Boolean(getClientId());
}

function notifySessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function subscribeGoogleSession(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY) listener();
  };
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", listener);
  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", listener);
  };
}

function readSession(): GoogleSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleSession;
    if (!parsed?.accessToken || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: GoogleSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  notifySessionChange();
}

export function getGoogleSession(): GoogleSession | null {
  const session = readSession();
  if (!session) return null;
  if (Date.now() >= session.expiresAt - 60_000) {
    writeSession(null);
    return null;
  }
  return session;
}

export function clearGoogleSession() {
  const session = readSession();
  if (session?.accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(session.accessToken);
    } catch {
      /* ignore */
    }
  }
  writeSession(null);
}

function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저에서만 사용할 수 있습니다."));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google 로그인 스크립트를 불러오지 못했습니다.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google 로그인 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

async function fetchUserInfo(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Google 계정 정보를 가져오지 못했습니다.");
  }
  const json = (await res.json()) as { email?: string; name?: string };
  return {
    email: json.email?.trim() || "",
    name: json.name?.trim() || "",
  };
}

export async function connectGoogleAccount(forceConsent = false): Promise<GoogleSession> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error(
      "Google OAuth Client ID가 없습니다. NEXT_PUBLIC_GOOGLE_CLIENT_ID를 설정하세요.",
    );
  }

  await loadGisScript();
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google 로그인 모듈을 초기화하지 못했습니다.");
  }

  const tokenResponse = await new Promise<GoogleTokenResponse>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                "Google 로그인에 실패했습니다.",
            ),
          );
          return;
        }
        resolve(response);
      },
      error_callback: (error) => {
        reject(
          new Error(error.message || "Google 로그인 창이 닫혔거나 실패했습니다."),
        );
      },
    });
    client.requestAccessToken({ prompt: forceConsent ? "consent" : "" });
  });

  if (!tokenResponse.access_token) {
    throw new Error("액세스 토큰을 받지 못했습니다.");
  }

  const profile = await fetchUserInfo(tokenResponse.access_token);
  const expiresInSec = Number(tokenResponse.expires_in) || 3600;
  const session: GoogleSession = {
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + expiresInSec * 1000,
    email: profile.email,
    name: profile.name,
  };
  writeSession(session);
  return session;
}

async function ensureAccessToken(): Promise<GoogleSession> {
  const existing = getGoogleSession();
  if (existing) return existing;
  return connectGoogleAccount(false);
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const session = await ensureAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    writeSession(null);
    throw new Error("Google 로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }
  return res;
}

async function findFolderId(): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await driveFetch(
    `/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=5`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive 폴더 조회 실패: ${text || res.status}`);
  }
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files?.[0]?.id ?? null;
}

async function createFolder(): Promise<string> {
  const res = await driveFetch("/files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive 폴더 생성 실패: ${text || res.status}`);
  }
  const json = (await res.json()) as DriveFile;
  return json.id;
}

async function ensureFolderId(): Promise<string> {
  const existing = await findFolderId();
  if (existing) return existing;
  return createFolder();
}

async function findBackupFileId(folderId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
  );
  const res = await driveFetch(
    `/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=5`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive 파일 조회 실패: ${text || res.status}`);
  }
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files?.[0]?.id ?? null;
}

async function uploadBackup(
  content: string,
  folderId: string,
  fileId?: string | null,
) {
  const session = await ensureAccessToken();
  const metadata = fileId
    ? { name: BACKUP_FILE_NAME }
    : {
        name: BACKUP_FILE_NAME,
        parents: [folderId],
      };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append(
    "file",
    new Blob([content], { type: "application/json;charset=utf-8" }),
  );

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const res = await fetch(url, {
    method: fileId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body: form,
  });

  if (res.status === 401) {
    writeSession(null);
    throw new Error("Google 로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive 저장 실패: ${text || res.status}`);
  }
  return (await res.json()) as { id: string; name: string; modifiedTime?: string };
}

export async function saveAppDataToGoogleDrive(data: AppData) {
  const folderId = await ensureFolderId();
  const fileId = await findBackupFileId(folderId);
  const payload = JSON.stringify(data, null, 2);
  const result = await uploadBackup(payload, folderId, fileId);
  return {
    folderName: FOLDER_NAME,
    fileName: BACKUP_FILE_NAME,
    fileId: result.id,
    modifiedTime: result.modifiedTime ?? null,
  };
}

export async function loadAppDataFromGoogleDrive(): Promise<AppData> {
  const folderId = await ensureFolderId();
  const fileId = await findBackupFileId(folderId);
  if (!fileId) {
    throw new Error(
      `Google Drive «${FOLDER_NAME}» 폴더에 «${BACKUP_FILE_NAME}» 파일이 없습니다. 먼저 저장해 주세요.`,
    );
  }

  const session = await ensureAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } },
  );
  if (res.status === 401) {
    writeSession(null);
    throw new Error("Google 로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive 불러오기 실패: ${text || res.status}`);
  }

  const text = await res.text();
  let parsed: AppData;
  try {
    parsed = JSON.parse(text) as AppData;
  } catch {
    throw new Error("Drive 파일이 JSON 형식이 아닙니다.");
  }
  if (parsed?.version !== 1) {
    throw new Error("지원하지 않는 JSON 형식입니다.");
  }
  return parsed;
}
