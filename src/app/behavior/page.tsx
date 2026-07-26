"use client";

import { useState } from "react";
import { ClassExcelPanel } from "@/components/ClassExcelPanel";
import { DocumentPanel } from "@/components/DocumentPanel";
import { DraftWorkbench } from "@/components/DraftWorkbench";
import { StudentPicker } from "@/components/StudentPicker";
import { StudentWorkTabs } from "@/components/StudentWorkTabs";
import { AppShell, Card } from "@/components/ui";
import { useAppStore } from "@/lib/store";

export default function BehaviorPage() {
  const { data } = useAppStore();
  const homeroom = data.settings.teacherClassName?.trim() || null;
  const [studentId, setStudentId] = useState("");

  return (
    <AppShell
      title="행동특성 및 발달상황"
      subtitle={
        homeroom
          ? `담임학급 «${homeroom}» 학생만 표시됩니다.`
          : "담임 전용. 설정에서 담임학급을 지정하면 해당 학급만 표시됩니다."
      }
    >
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Card title="학생">
            <StudentPicker
              value={studentId}
              onChange={setStudentId}
              lockClassName={homeroom}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <ClassExcelPanel section="behavior" lockClassName={homeroom} />
          {studentId ? (
            <StudentWorkTabs
              documents={
                <DocumentPanel studentId={studentId} section="behavior" />
              }
              drafts={
                <DraftWorkbench studentId={studentId} section="behavior" />
              }
            />
          ) : (
            <Card>
              <p className="text-sm text-[var(--ink-muted-48)]">
                왼쪽 명단에서 학생을 선택하세요.
              </p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
