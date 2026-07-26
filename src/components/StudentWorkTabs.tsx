"use client";

import { useState, type ReactNode } from "react";
import { SegmentedTabs } from "./ui";

/** 학생 선택 후 문서 입력 / 초안 생성 영역을 탭으로 구분 */
export function StudentWorkTabs({
  documents,
  drafts,
}: {
  documents: ReactNode;
  drafts: ReactNode;
}) {
  const [tab, setTab] = useState<"documents" | "drafts">("documents");

  return (
    <div>
      <SegmentedTabs
        className="no-print"
        tabs={[
          { id: "documents", label: "학생 문서" },
          { id: "drafts", label: "초안 생성" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className={tab === "documents" ? "block" : "hidden print:block"}>
        {documents}
      </div>
      <div
        className={`mt-4 ${tab === "drafts" ? "block" : "hidden print:block"}`}
      >
        {drafts}
      </div>
    </div>
  );
}
