"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, StatusMark } from "@/src/design-system";
import {
  UNEXPECTED_WORKSPACE_ERROR_MESSAGE,
  parseCriterionPoints,
} from "@/src/project-workspace/client-state";
import { staffReviewDraftKey } from "@/src/project-workspace/lifecycle";
import type {
  StaffProjectWorkspaceProjection,
  StaffReviewAssignmentProjection,
} from "@/src/project-workspace/types";
import { requestProjectFileDownloadAction } from "@/src/server/project-file-download-action";
import {
  assignProjectReviewerAction,
  beginProjectReviewAction,
  decideProjectReviewAction,
} from "@/src/server/project-workspace-actions";

type StaffProjection = Extract<StaffProjectWorkspaceProjection, { kind: "staff" }>;

interface CriterionDraft {
  criterionNumber: number;
  awardedPoints: string;
  comment: string;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function initialCriteria(
  assignment: StaffReviewAssignmentProjection,
): CriterionDraft[] {
  return assignment.criteria.map((criterion) => ({
    criterionNumber: criterion.number,
    awardedPoints: "",
    comment: "",
  }));
}

export function StaffProjectWorkspace({ projection }: { projection: StaffProjection }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewerSelection, setReviewerSelection] = useState<Record<string, string>>(
    Object.fromEntries(projection.assignmentQueue.map((item) => [
      item.submissionId,
      item.assignedReviewerId ?? "",
    ])),
  );
  const [summary, setSummary] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<Record<string, string>>({});
  const [criteria, setCriteria] = useState<Record<string, CriterionDraft[]>>(
    Object.fromEntries(projection.assignments.map((assignment) => [
      staffReviewDraftKey(assignment.versionId),
      initialCriteria(assignment),
    ])),
  );
  const busyRef = useRef(false);

  async function run(action: () => Promise<{ status: string; message: string }>): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await action();
      setMessage(result.message);
      if (result.status === "success") router.refresh();
    } catch {
      setMessage(UNEXPECTED_WORKSPACE_ERROR_MESSAGE);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function download(fileId: string): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await requestProjectFileDownloadAction({ fileId });
      setMessage(result.message);
      if (result.status === "success") window.location.assign(result.signedUrl);
    } catch {
      setMessage(UNEXPECTED_WORKSPACE_ERROR_MESSAGE);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="asa-review-workspace asa-container">
      <header className="asa-review-workspace__hero">
        <div>
          <span className="asa-kicker">ПРОВЕРКА ПРОЕКТОВ</span>
          <h1>Рабочее пространство команды</h1>
          <p>Приватные назначения, файлы и рубрики доступны только активным reviewer/admin после серверной проверки роли.</p>
        </div>
        <StatusMark status="in-progress" label={projection.role === "admin" ? "Администратор" : "Проверяющий"} />
      </header>

      {projection.role === "admin" ? (
        <section className="asa-review-workspace__section" aria-labelledby="assignment-title">
          <header>
            <span className="asa-kicker">ADMIN</span>
            <h2 id="assignment-title">Назначение и переназначение</h2>
            <p>Показываются отправленные и повторно отправленные проекты. В списке сотрудников — только отображаемые имена.</p>
          </header>
          {projection.assignmentQueue.length ? (
            <ol className="asa-review-assignment-list">
              {projection.assignmentQueue.map((item) => (
                <li key={item.submissionId}>
                  <div className="asa-review-assignment-list__identity">
                    <span>{item.projectCode}</span>
                    <div>
                      <strong>{item.learnerDisplayName}</strong>
                      <small>Версия {item.versionNumber} · {formatDate(item.submittedAt)}</small>
                    </div>
                  </div>
                  <label>
                    Проверяющий
                    <select
                      value={reviewerSelection[item.submissionId] ?? ""}
                      disabled={busy}
                      onChange={(event) => setReviewerSelection((current) => ({
                        ...current,
                        [item.submissionId]: event.target.value,
                      }))}
                    >
                      <option value="">Не назначен</option>
                      {projection.reviewers.map((reviewer) => (
                        <option key={reviewer.id} value={reviewer.id}>{reviewer.displayName}</option>
                      ))}
                    </select>
                    {item.assignedReviewerName ? <small>Сейчас: {item.assignedReviewerName}</small> : null}
                  </label>
                  <Button
                    disabled={busy || !reviewerSelection[item.submissionId]}
                    onClick={() => {
                      const reviewerId = reviewerSelection[item.submissionId];
                      if (reviewerId) {
                        void run(() => assignProjectReviewerAction({
                          submissionId: item.submissionId,
                          reviewerId,
                        }));
                      }
                    }}
                  >
                    {item.assignedReviewerId ? "Переназначить" : "Назначить"}
                  </Button>
                </li>
              ))}
            </ol>
          ) : <p className="asa-review-workspace__empty">Нет проектов, ожидающих назначения.</p>}
        </section>
      ) : null}

      <section className="asa-review-workspace__section" aria-labelledby="reviews-title">
        <header>
          <span className="asa-kicker">МОИ НАЗНАЧЕНИЯ</span>
          <h2 id="reviews-title">Проекты для проверки</h2>
          <p>Здесь находятся только активные назначения текущего сотрудника.</p>
        </header>
        {projection.assignments.length ? (
          <ol className="asa-review-project-list">
            {projection.assignments.map((assignment) => {
              const reviewDraftKey = staffReviewDraftKey(assignment.versionId);
              const criterionDrafts = criteria[reviewDraftKey] ?? initialCriteria(assignment);
              const rubricReady = assignment.criteria.length === 5
                && assignment.criteria.every((criterion, index) => criterion.number === index + 1);
              return (
                <li key={reviewDraftKey} className="asa-review-project">
                  <header className="asa-review-project__header">
                    <div>
                      <span>{assignment.projectCode}</span>
                      <h3>{assignment.learnerDisplayName}</h3>
                      <p>Версия {assignment.versionNumber} · {formatDate(assignment.submittedAt)}</p>
                    </div>
                    <StatusMark
                      status={assignment.status === "under_review" ? "in-progress" : "available"}
                      label={assignment.status === "under_review" ? "Проверка начата" : "Ожидает начала"}
                    />
                  </header>
                  <div className="asa-review-project__file">
                    <div>
                      <strong>{assignment.file.originalFilename}</strong>
                      <span>Приватный основной файл</span>
                    </div>
                    <Button disabled={busy} onClick={() => void download(assignment.file.id)}>
                      Скачать
                    </Button>
                  </div>
                  {assignment.learnerNote ? (
                    <section className="asa-review-project__submission-text" aria-label="Заметка учащегося">
                      <strong>Заметка учащегося</strong>
                      <p>{assignment.learnerNote}</p>
                    </section>
                  ) : null}
                  {assignment.projectCode === "M02_P02" && assignment.supportingText ? (
                    <section className="asa-review-project__submission-text" aria-label="Сопроводительный текст M02">
                      <strong>Сопроводительный текст M02</strong>
                      <p>{assignment.supportingText}</p>
                    </section>
                  ) : null}
                  {assignment.status !== "under_review" ? (
                    <Button
                      variant="dark"
                      disabled={busy}
                      onClick={() => void run(() => beginProjectReviewAction({ submissionId: assignment.submissionId }))}
                    >
                      Начать проверку
                    </Button>
                  ) : rubricReady ? (
                    <form
                      className="asa-review-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const normalizedCriteria = criterionDrafts.map((criterion, index) => {
                          const maxPoints = assignment.criteria[index]?.maxPoints ?? -1;
                          const awardedPoints = parseCriterionPoints(
                            criterion.awardedPoints,
                            maxPoints,
                          );
                          return awardedPoints !== null
                            ? {
                                criterion_number: criterion.criterionNumber,
                                awarded_points: awardedPoints,
                                comment: criterion.comment,
                              }
                            : null;
                        });
                        if (normalizedCriteria.some((criterion) => criterion === null)) {
                          setMessage("Проверьте целые баллы по каждому из пяти критериев.");
                          return;
                        }
                        void run(() => decideProjectReviewAction({
                          submissionId: assignment.submissionId,
                          decision: decision[reviewDraftKey] ?? "",
                          summary: summary[reviewDraftKey] ?? "",
                          criteria: normalizedCriteria,
                        }));
                      }}
                    >
                      <ol className="asa-review-rubric">
                        {assignment.criteria.map((criterion, index) => (
                          <li key={criterion.number}>
                            <div className="asa-review-rubric__copy">
                              <span>{String(criterion.number).padStart(2, "0")}</span>
                              <div>
                                <strong>{criterion.title}</strong>
                                <p>{criterion.description}</p>
                              </div>
                            </div>
                            <label>
                              Баллы из {criterion.maxPoints}
                              <input
                                type="number"
                                min={0}
                                max={criterion.maxPoints}
                                step={1}
                                required
                                inputMode="numeric"
                                value={criterionDrafts[index]?.awardedPoints ?? ""}
                                disabled={busy}
                                onChange={(event) => setCriteria((current) => ({
                                  ...current,
                                  [reviewDraftKey]: criterionDrafts.map((draft, draftIndex) =>
                                    draftIndex === index
                                      ? { ...draft, awardedPoints: event.target.value }
                                      : draft),
                                }))}
                              />
                            </label>
                            <label>
                              Комментарий <small>необязательно</small>
                              <textarea
                                rows={3}
                                maxLength={2_000}
                                value={criterionDrafts[index]?.comment ?? ""}
                                disabled={busy}
                                onChange={(event) => setCriteria((current) => ({
                                  ...current,
                                  [reviewDraftKey]: criterionDrafts.map((draft, draftIndex) =>
                                    draftIndex === index
                                      ? { ...draft, comment: event.target.value }
                                      : draft),
                                }))}
                              />
                            </label>
                          </li>
                        ))}
                      </ol>
                      <label>
                        Итог проверки
                        <textarea
                          rows={7}
                          required
                          maxLength={5_000}
                          value={summary[reviewDraftKey] ?? ""}
                          disabled={busy}
                          onChange={(event) => setSummary((current) => ({
                            ...current,
                            [reviewDraftKey]: event.target.value,
                          }))}
                        />
                      </label>
                      <label>
                        Решение
                        <select
                          required
                          value={decision[reviewDraftKey] ?? ""}
                          disabled={busy}
                          onChange={(event) => setDecision((current) => ({
                            ...current,
                            [reviewDraftKey]: event.target.value,
                          }))}
                        >
                          <option value="">Выберите решение</option>
                          <option value="revisions_required">Нужны правки</option>
                          <option value="accepted">Принять</option>
                          <option value="not_accepted">Не принять</option>
                        </select>
                      </label>
                      <Button type="submit" variant="dark" disabled={busy}>
                        Сохранить решение
                      </Button>
                    </form>
                  ) : (
                    <p className="asa-review-workspace__empty">Активная рубрика не содержит ровно пять критериев. Решение заблокировано.</p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : <p className="asa-review-workspace__empty">Активных назначений сейчас нет.</p>}
      </section>

      {message ? <p className="asa-review-workspace__message" aria-live="polite">{message}</p> : null}
    </section>
  );
}
