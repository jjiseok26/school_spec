"use client";

import { useEffect, useState } from "react";
import {
  clearGoogleSession,
  connectGoogleAccount,
  getGoogleSession,
  isGoogleDriveConfigured,
  loadAppDataFromGoogleDrive,
  saveAppDataToGoogleDrive,
  subscribeGoogleSession,
  type GoogleSession,
} from "@/lib/googleDrive";
import { useAppStore } from "@/lib/store";
import { btnPrimary, btnSecondary, Card } from "@/components/ui";

export function GoogleDriveBackup({
  onMessage,
}: {
  onMessage: (message: string) => void;
}) {
  const { exportData, importData } = useAppStore();
  const [session, setSession] = useState<GoogleSession | null>(null);
  const [busy, setBusy] = useState<"login" | "save" | "load" | null>(null);
  const configured = isGoogleDriveConfigured();

  useEffect(() => {
    const sync = () => setSession(getGoogleSession());
    sync();
    return subscribeGoogleSession(sync);
  }, []);

  async function onLogin() {
    setBusy("login");
    try {
      const next = await connectGoogleAccount(true);
      setSession(next);
      onMessage(
        next.email
          ? `Google 로그인 완료: ${next.email}`
          : "Google 로그인 완료",
      );
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Google 로그인 실패");
    } finally {
      setBusy(null);
    }
  }

  function onLogout() {
    clearGoogleSession();
    setSession(null);
    onMessage("Google 계정 연결을 해제했습니다.");
  }

  async function onSave() {
    setBusy("save");
    try {
      // Drive 백업은 API 키 포함 (사용자 본인 Drive)
      const payload = exportData(true);
      const result = await saveAppDataToGoogleDrive(payload);
      setSession(getGoogleSession());
      onMessage(
        `Google Drive «${result.folderName}/${result.fileName}»에 저장했습니다.`,
      );
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Drive 저장 실패");
    } finally {
      setBusy(null);
    }
  }

  async function onLoad() {
    if (
      !window.confirm(
        "Google Drive 백업으로 현재 브라우저 데이터를 덮어쓸까요?\n(API 키 포함)",
      )
    ) {
      return;
    }
    setBusy("load");
    try {
      const incoming = await loadAppDataFromGoogleDrive();
      importData(incoming, true);
      setSession(getGoogleSession());
      onMessage("Google Drive에서 불러오기를 완료했습니다.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Drive 불러오기 실패");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Google Drive 동기화">
      {!configured ? (
        <p className="text-sm text-[var(--ink-muted-48)]">
          Google Drive를 쓰려면 환경 변수{" "}
          <code className="rounded bg-[var(--parchment)] px-1 py-0.5 text-xs">
            NEXT_PUBLIC_GOOGLE_CLIENT_ID
          </code>
          를 설정한 뒤 다시 배포하세요. Google Cloud Console에서 OAuth 클라이언트
          (웹)를 만들고, 승인된 JavaScript 출처에 이 사이트 주소를 등록하면
          됩니다.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-[var(--ink-muted-48)]">
            Google 로그인 후 Drive에{" "}
            <strong className="font-medium text-[var(--ink)]">schoolspec</strong>{" "}
            폴더를 만들고{" "}
            <strong className="font-medium text-[var(--ink)]">
              school_spec_backup.json
            </strong>
            으로 저장·불러옵니다. 로그인되면 화면 상단 버튼도{" "}
            <strong className="font-medium text-[var(--ink)]">
              Google에 저장 / Google에서 불러오기
            </strong>
            로 바뀝니다. API 키도 함께 저장됩니다.
          </p>

          <div className="mb-3 rounded-xl border border-[var(--hairline)] bg-[var(--parchment)] px-3 py-2 text-sm">
            {session ? (
              <p className="text-[var(--ink)]">
                연결됨:{" "}
                <strong className="font-semibold">
                  {session.name || session.email || "Google 계정"}
                </strong>
                {session.email && session.name ? (
                  <span className="text-[var(--ink-muted-48)]">
                    {" "}
                    ({session.email})
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-[var(--ink-muted-48)]">
                Google 계정에 연결되어 있지 않습니다.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!session ? (
              <button
                type="button"
                className={btnPrimary}
                disabled={busy !== null}
                onClick={() => void onLogin()}
              >
                {busy === "login" ? "로그인 중…" : "Google로 로그인"}
              </button>
            ) : (
              <button
                type="button"
                className={btnSecondary}
                disabled={busy !== null}
                onClick={onLogout}
              >
                연결 해제
              </button>
            )}
            <button
              type="button"
              className={btnPrimary}
              disabled={busy !== null}
              onClick={() => void onSave()}
            >
              {busy === "save" ? "저장 중…" : "Drive에 저장"}
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy !== null}
              onClick={() => void onLoad()}
            >
              {busy === "load" ? "불러오는 중…" : "Drive에서 불러오기"}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
