"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ProgressBar, StatusMark } from "@/src/design-system";
import {
  PROJECT_FILE_LIMITS,
  projectSupportingTextWordCount,
} from "@/src/project-workspace/policy";
import {
  FINALIZATION_RETRY_MESSAGE,
  UNEXPECTED_WORKSPACE_ERROR_MESSAGE,
  finalizationKeepsRetry,
  isReusableIntentConflict,
  isTusSessionOpen,
} from "@/src/project-workspace/client-state";
import {
  TransitionLeaseOwner,
  WorkspaceOperationGuard,
  canStartTusTransition,
  learnerTextReadiness,
  learnerWorkspaceIdentity,
  shouldClearTerminalTransfer,
  startTusResumeTransition,
} from "@/src/project-workspace/lifecycle";
import type {
  LearnerProjectWorkspaceProjection,
  ProjectSubmissionStatus,
  ProjectWorkspaceMutationResult,
} from "@/src/project-workspace/types";
import { createSupabaseProjectStandardTransferController } from "@/src/project-upload/supabase-standard-transfer";
import { createSupabaseProjectTusTransferController } from "@/src/project-upload/supabase-tus-transfer";
import type {
  ProjectStandardTransferController,
  ProjectStandardTransferSnapshot,
  ProjectTusTransferController,
  ProjectTusTransferSnapshot,
} from "@/src/project-upload";
import {
  createProjectDraftAction,
  createProjectRevisionDraftAction,
  finalizeProjectWorkspaceUploadAction,
  requestLearnerProjectFileDownloadAction,
  requestProjectWorkspaceUploadCapabilityAction,
  resubmitProjectAction,
  submitProjectAction,
  updateProjectDraftAction,
} from "@/src/server/project-workspace-actions";

const STATUS_LABELS: Readonly<Record<ProjectSubmissionStatus, string>> = {
  draft: "Черновик",
  submitted: "Отправлен",
  under_review: "На проверке",
  revisions_required: "Нужны правки",
  resubmitted: "Отправлен повторно",
  accepted: "Принят",
  not_accepted: "Не принят",
};

const DECISION_LABELS = {
  revisions_required: "Нужны правки",
  accepted: "Принят",
  not_accepted: "Не принят",
} as const;

function formatBytes(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 1,
  }).format(value / (1024 * 1024));
}

function fileValidationMessage(
  file: File,
  projection: Extract<LearnerProjectWorkspaceProjection, { kind: "learner" }>,
): string | null {
  const extension = file.name.toLowerCase().endsWith(".pdf")
    ? ".pdf"
    : file.name.toLowerCase().endsWith(".png")
      ? ".png"
      : null;
  const mime = file.type.toLowerCase();
  if (!extension || !projection.policy.allowedMimeTypes.includes(mime as "application/pdf" | "image/png")) {
    return projection.projectCode === "M08_P08"
      ? "Для M08 выберите PDF."
      : "Выберите PDF или PNG.";
  }
  if ((mime === "application/pdf" && extension !== ".pdf")
    || (mime === "image/png" && extension !== ".png")) {
    return "Расширение файла не соответствует его MIME-типу.";
  }
  if (file.size < 1 || file.size > projection.policy.maxFileBytes) {
    return "Размер файла должен быть не больше 40 MiB.";
  }
  return null;
}

function resultMessage(result: ProjectWorkspaceMutationResult): string {
  return result.message;
}

export function ProjectWorkspace({
  projection,
}: {
  projection: LearnerProjectWorkspaceProjection;
}) {
  if (projection.kind === "anonymous") {
    return (
      <section className="asa-project-workspace asa-project-workspace--gate" aria-labelledby="project-workspace-title">
        <div>
          <span className="asa-kicker">ЛИЧНЫЙ ПРОЕКТ</span>
          <h2 id="project-workspace-title">Войдите, чтобы работать над сдачей</h2>
          <p>Инструкции проекта остаются открытыми. Личные версии, файлы и обратная связь загружаются только после входа.</p>
        </div>
        <Button href={projection.signInHref} variant="dark">Войти и продолжить</Button>
      </section>
    );
  }

  if (projection.kind === "onboarding-required") {
    return (
      <section className="asa-project-workspace asa-project-workspace--gate" aria-labelledby="project-workspace-title">
        <div>
          <span className="asa-kicker">ЛИЧНЫЙ ПРОЕКТ</span>
          <h2 id="project-workspace-title">Завершите настройку профиля</h2>
          <p>После короткого onboarding здесь появится ваш черновик. До этого личные проектные записи не создаются.</p>
        </div>
        <Button href={projection.onboardingHref} variant="dark">Завершить настройку</Button>
      </section>
    );
  }

  const workspaceIdentity = learnerWorkspaceIdentity({
    projectCode: projection.projectCode,
    editableVersionId: projection.editableVersion?.id ?? null,
    currentVersionId: projection.currentVersion?.id ?? null,
  });
  return (
    <LearnerWorkspace
      key={workspaceIdentity}
      projection={projection}
      workspaceIdentity={workspaceIdentity}
    />
  );
}

function LearnerWorkspace({
  projection,
  workspaceIdentity,
}: {
  projection: Extract<LearnerProjectWorkspaceProjection, { kind: "learner" }>;
  workspaceIdentity: string;
}) {
  const router = useRouter();
  const [learnerNote, setLearnerNote] = useState(projection.editableVersion?.learnerNote ?? "");
  const [supportingText, setSupportingText] = useState(projection.editableVersion?.supportingText ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [mutationBusy, setMutationBusy] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [tusTransitionBusy, setTusTransitionBusy] = useState(false);
  const [filePickerGeneration, setFilePickerGeneration] = useState(0);
  const [pendingFinalizationIntentId, setPendingFinalizationIntentId] = useState<string | null>(null);
  const [standardSnapshot, setStandardSnapshot] = useState<ProjectStandardTransferSnapshot | null>(null);
  const [tusSnapshot, setTusSnapshot] = useState<ProjectTusTransferSnapshot | null>(null);
  const busyRef = useRef(false);
  const transferRef = useRef(false);
  const finalizingRef = useRef(false);
  const tusTransitionRef = useRef(new TransitionLeaseOwner());
  const operationGuardRef = useRef(new WorkspaceOperationGuard(workspaceIdentity));
  const pendingFinalizationIntentIdRef = useRef<string | null>(null);
  const standardControllerRef = useRef<ProjectStandardTransferController | null>(null);
  const tusControllerRef = useRef<ProjectTusTransferController | null>(null);
  const tusIntentIdRef = useRef<string | null>(null);
  const tusReusedIntentRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    operationGuardRef.current.invalidate();
    unsubscribeRef.current?.();
    standardControllerRef.current?.dispose();
    void tusControllerRef.current?.dispose();
  }, []);

  function clearTerminalTransferState(): void {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    const standardController = standardControllerRef.current;
    const tusController = tusControllerRef.current;
    standardControllerRef.current = null;
    tusControllerRef.current = null;
    tusIntentIdRef.current = null;
    tusReusedIntentRef.current = false;
    pendingFinalizationIntentIdRef.current = null;
    transferRef.current = false;
    setPendingFinalizationIntentId(null);
    setStandardSnapshot(null);
    setTusSnapshot(null);
    setSelectedFile(null);
    setFilePickerGeneration((current) => current + 1);
    standardController?.dispose();
    void tusController?.dispose();
  }

  const wordCount = projectSupportingTextWordCount(supportingText);
  const requiresSupportingText = projection.policy.supportingTextMaxWords > 0;
  const localSupportingTextReady = !requiresSupportingText || (
    wordCount >= projection.policy.supportingTextMinWords
    && wordCount <= projection.policy.supportingTextMaxWords
  );
  const textReadiness = learnerTextReadiness({
    localLearnerNote: learnerNote,
    persistedLearnerNote: projection.editableVersion?.learnerNote ?? "",
    localSupportingText: supportingText,
    persistedSupportingText: projection.editableVersion?.supportingText ?? "",
    supportingTextMinWords: projection.policy.supportingTextMinWords,
    supportingTextMaxWords: projection.policy.supportingTextMaxWords,
  });
  const lessonsReady = projection.completedLessons === projection.requiredLessons;
  const fileReady = Boolean(projection.activeFile);
  const canSend = Boolean(
    projection.editableVersion
    && fileReady
    && lessonsReady
    && !textReadiness.hasUnsavedText
    && textReadiness.persistedSupportingTextReady,
  );
  const tusSessionOpen = isTusSessionOpen(tusSnapshot);
  const uploadLocked = tusSessionOpen || Boolean(pendingFinalizationIntentId);
  const active = mutationBusy || transferBusy || finalizing || tusTransitionBusy;
  const interactionLocked = active || uploadLocked;
  const accept = projection.projectCode === "M08_P08"
    ? "application/pdf,.pdf"
    : "application/pdf,image/png,.pdf,.png";

  async function runMutation(
    action: () => Promise<ProjectWorkspaceMutationResult>,
  ): Promise<void> {
    if (busyRef.current || transferRef.current) return;
    busyRef.current = true;
    setMutationBusy(true);
    setMessage("");
    try {
      const result = await action();
      setMessage(resultMessage(result));
      if (result.status === "success") router.refresh();
    } catch {
      setMessage(UNEXPECTED_WORKSPACE_ERROR_MESSAGE);
    } finally {
      busyRef.current = false;
      setMutationBusy(false);
    }
  }

  async function finalizeTransfer(intentId: string): Promise<void> {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    pendingFinalizationIntentIdRef.current = intentId;
    setPendingFinalizationIntentId(intentId);
    setFinalizing(true);
    setMessage("Передача завершена. Проверяем содержимое файла…");
    try {
      const result = await finalizeProjectWorkspaceUploadAction({ intentId });
      setMessage(result.message);
      if (shouldClearTerminalTransfer({ kind: "finalization", status: result.status })) {
        clearTerminalTransferState();
      } else if (!finalizationKeepsRetry(result)) {
        pendingFinalizationIntentIdRef.current = null;
        setPendingFinalizationIntentId(null);
      }
      if (result.status === "success") router.refresh();
    } catch {
      setMessage(FINALIZATION_RETRY_MESSAGE);
    } finally {
      finalizingRef.current = false;
      setFinalizing(false);
    }
  }

  async function startUpload(): Promise<void> {
    if (
      transferRef.current
      || busyRef.current
      || pendingFinalizationIntentIdRef.current
      || isTusSessionOpen(tusControllerRef.current?.getSnapshot() ?? null)
      || !selectedFile
      || !projection.editableVersion
      || projection.activeFile
    ) return;
    const validationMessage = fileValidationMessage(selectedFile, projection);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    transferRef.current = true;
    const operation = operationGuardRef.current.capture();
    setTransferBusy(true);
    setMessage("Подготавливаем безопасное разрешение на загрузку…");
    try {
      const capabilityResult = await requestProjectWorkspaceUploadCapabilityAction({
        versionId: projection.editableVersion.id,
        originalFilename: selectedFile.name,
        declaredMime: selectedFile.type.toLowerCase(),
        declaredSizeBytes: selectedFile.size,
      });
      if (!operationGuardRef.current.isCurrent(operation)) return;
      if (capabilityResult.status !== "success") {
        setMessage(capabilityResult.message);
        return;
      }

      unsubscribeRef.current?.();
      if (capabilityResult.capability.transferMode === "standard") {
        const controller = createSupabaseProjectStandardTransferController();
        standardControllerRef.current = controller;
        tusControllerRef.current = null;
        setTusSnapshot(null);
        unsubscribeRef.current = controller.subscribe(setStandardSnapshot);
        const snapshot = await controller.start(selectedFile, capabilityResult.capability);
        if (snapshot.status === "succeeded") {
          await finalizeTransfer(capabilityResult.capability.intentId);
        } else if (isReusableIntentConflict(snapshot, capabilityResult.capability.reusedIntent)) {
          await finalizeTransfer(capabilityResult.capability.intentId);
        } else {
          setMessage(snapshot.message);
        }
      } else {
        const controller = createSupabaseProjectTusTransferController();
        tusControllerRef.current = controller;
        tusIntentIdRef.current = capabilityResult.capability.intentId;
        tusReusedIntentRef.current = capabilityResult.capability.reusedIntent;
        standardControllerRef.current = null;
        setStandardSnapshot(null);
        unsubscribeRef.current = controller.subscribe(setTusSnapshot);
        const snapshot = await controller.start(selectedFile, capabilityResult.capability);
        if (snapshot.status === "succeeded") {
          await finalizeTransfer(capabilityResult.capability.intentId);
        } else if (isReusableIntentConflict(snapshot, capabilityResult.capability.reusedIntent)) {
          await finalizeTransfer(capabilityResult.capability.intentId);
        } else {
          setMessage(snapshot.message);
          if (!isTusSessionOpen(snapshot)) {
            tusControllerRef.current = null;
            tusIntentIdRef.current = null;
            tusReusedIntentRef.current = false;
          }
        }
      }
    } catch {
      if (operationGuardRef.current.isCurrent(operation)) {
        setMessage(UNEXPECTED_WORKSPACE_ERROR_MESSAGE);
      }
    } finally {
      transferRef.current = false;
      if (operationGuardRef.current.isCurrent(operation)) setTransferBusy(false);
    }
  }

  async function settleTusTransition(
    controller: ProjectTusTransferController,
    intentId: string,
    snapshot: ProjectTusTransferSnapshot,
  ): Promise<void> {
    if (tusControllerRef.current !== controller) return;
    if (snapshot.status === "succeeded") {
      await finalizeTransfer(intentId);
    } else if (isReusableIntentConflict(snapshot, tusReusedIntentRef.current)) {
      await finalizeTransfer(intentId);
    } else {
      setMessage(snapshot.message);
    }
  }

  async function controlTusUpload(
    transition: "pause" | "resume" | "cancel",
  ): Promise<void> {
    const controller = tusControllerRef.current;
    const intentId = tusIntentIdRef.current;
    if (
      !controller
      || !intentId
      || tusTransitionRef.current.busy
      || finalizingRef.current
      || !canStartTusTransition(controller.getSnapshot(), transition)
    ) return;

    if (transition === "resume") {
      startTusResumeTransition({
        owner: tusTransitionRef.current,
        getSnapshot: () => controller.getSnapshot(),
        resume: () => controller.resume(),
        onSettled: (snapshot) => settleTusTransition(controller, intentId, snapshot),
        onRejected: () => {
          if (tusControllerRef.current === controller) {
            setMessage(UNEXPECTED_WORKSPACE_ERROR_MESSAGE);
          }
        },
      });
      setTusTransitionBusy(tusTransitionRef.current.busy);
      return;
    }

    const lease = tusTransitionRef.current.acquire(transition);
    if (!lease) return;
    setTusTransitionBusy(true);
    try {
      const snapshot = await controller[transition]();
      await settleTusTransition(controller, intentId, snapshot);
      if (transition === "cancel" && snapshot.status === "cancelled") {
        if (shouldClearTerminalTransfer({ kind: "cancel", confirmed: true })) {
          clearTerminalTransferState();
        }
      }
    } catch {
      setMessage(UNEXPECTED_WORKSPACE_ERROR_MESSAGE);
    } finally {
      if (tusTransitionRef.current.release(lease)) setTusTransitionBusy(false);
    }
  }

  function cancelStandardUpload(): void {
    const controller = standardControllerRef.current;
    if (!controller || finalizingRef.current || !controller.cancel()) return;
    setMessage("Передача отменена.");
    if (shouldClearTerminalTransfer({ kind: "cancel", confirmed: true })) {
      clearTerminalTransferState();
    }
  }

  async function downloadFile(fileId: string): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setMutationBusy(true);
    setMessage("");
    try {
      const result = await requestLearnerProjectFileDownloadAction({ fileId });
      setMessage(result.message);
      if (result.status === "success") window.location.assign(result.signedUrl);
    } catch {
      setMessage(UNEXPECTED_WORKSPACE_ERROR_MESSAGE);
    } finally {
      busyRef.current = false;
      setMutationBusy(false);
    }
  }

  const statusLabel = projection.status === "none"
    ? "Проект ещё не начат"
    : STATUS_LABELS[projection.status];
  const reviewDownloadFile = projection.currentFile ?? projection.activeFile;
  const immutable = projection.status === "submitted"
    || projection.status === "under_review"
    || projection.status === "resubmitted"
    || projection.status === "accepted";
  const revisionReadOnly = projection.status === "revisions_required"
    || projection.status === "not_accepted";

  return (
    <section className="asa-project-workspace" aria-labelledby="project-workspace-title">
      <header className="asa-project-workspace__header">
        <div>
          <span className="asa-kicker">ЛИЧНЫЙ ПРОЕКТ</span>
          <h2 id="project-workspace-title">Рабочее пространство</h2>
          <p>{projection.projectCode} · один основной файл на каждую версию</p>
        </div>
        <div className="asa-project-workspace__status">
          <StatusMark
            status={projection.status === "accepted" ? "complete" : projection.status === "none" ? "available" : "in-progress"}
            label={statusLabel}
          />
          {projection.currentVersion ? <span>Версия {projection.currentVersion.number}</span> : null}
        </div>
      </header>

      <div className="asa-project-workspace__readiness" aria-label="Готовность проекта">
        <div>
          <span>Уроки модуля</span>
          <strong>{projection.completedLessons} / {projection.requiredLessons}</strong>
        </div>
        <div>
          <span>Основной файл</span>
          <strong>{fileReady ? "Принят" : "Не загружен"}</strong>
        </div>
        <div>
          <span>{requiresSupportingText ? "Текст M02" : "Сопроводительный текст"}</span>
          <strong>{requiresSupportingText ? `${wordCount} слов` : "Не требуется"}</strong>
        </div>
      </div>

      <div className="asa-project-workspace__policy">
        <strong>Правила файла</strong>
        <p>
          До 40 MiB. {projection.projectCode === "M08_P08"
            ? "Только PDF, 8–10 страниц."
            : "PDF на 1 страницу или PNG ровно 1920 × 1080."}
          {requiresSupportingText ? " Отдельный текст: 120–180 слов." : ""}
        </p>
      </div>

      {projection.status === "none" ? (
        <div className="asa-project-workspace__primary-action">
          <p>Создайте первый черновик. Пользователь и статус определяются сервером.</p>
          <Button
            variant="dark"
            disabled={interactionLocked}
            onClick={() => void runMutation(() => createProjectDraftAction({ projectCode: projection.projectCode }))}
          >
            Создать черновик
          </Button>
        </div>
      ) : null}

      {(projection.status === "revisions_required" || projection.status === "not_accepted")
        && !projection.editableVersion ? (
          <div className="asa-project-workspace__primary-action">
            <p>Обратная связь сохранена у предыдущей версии. Создайте отдельный черновик правок.</p>
            <Button
              variant="dark"
              disabled={interactionLocked || !projection.submissionId}
              onClick={() => projection.submissionId
                && void runMutation(() => createProjectRevisionDraftAction({ submissionId: projection.submissionId }))}
            >
              Создать новую версию
            </Button>
          </div>
        ) : null}

      {projection.editableVersion ? (
        <div className="asa-project-workspace__editor">
          <form
            className="asa-project-workspace__form"
            onSubmit={(event) => {
              event.preventDefault();
              void runMutation(() => updateProjectDraftAction({
                versionId: projection.editableVersion!.id,
                learnerNote,
                supportingText,
              }));
            }}
          >
            <label>
              Заметка учащегося <small>необязательно, до 2000 знаков</small>
              <textarea
                value={learnerNote}
                maxLength={PROJECT_FILE_LIMITS.noteMaximumCharacters}
                rows={4}
                disabled={interactionLocked}
                onChange={(event) => setLearnerNote(event.target.value)}
              />
            </label>
            {requiresSupportingText ? (
              <label>
                Сопроводительный текст M02 <small>{wordCount} / 120–180 слов</small>
                <textarea
                  value={supportingText}
                  maxLength={PROJECT_FILE_LIMITS.supportingTextMaximumCharacters}
                  rows={8}
                  aria-invalid={!localSupportingTextReady}
                  disabled={interactionLocked}
                  onChange={(event) => setSupportingText(event.target.value)}
                />
              </label>
            ) : null}
            <Button type="submit" disabled={interactionLocked}>Сохранить текст</Button>
          </form>

          <div className="asa-project-workspace__file">
            <h3>Основной файл · версия {projection.editableVersion.number}</h3>
            {projection.activeFile ? (
              <div className="asa-project-workspace__fixed-file">
                <div>
                  <strong>{projection.activeFile.originalFilename}</strong>
                  <span>{formatBytes(projection.activeFile.sizeBytes)} · файл закреплён за версией</span>
                </div>
                <Button
                  disabled={interactionLocked}
                  onClick={() => void downloadFile(projection.activeFile!.id)}
                >
                  Скачать
                </Button>
              </div>
            ) : (
              <>
                <label className="asa-project-workspace__picker">
                  <span>Выберите один файл</span>
                  <input
                    key={filePickerGeneration}
                    type="file"
                    accept={accept}
                    disabled={interactionLocked}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setSelectedFile(file);
                      setMessage(file ? fileValidationMessage(file, projection) ?? "Файл готов к загрузке." : "");
                    }}
                  />
                  <small>{selectedFile ? `${selectedFile.name} · ${formatBytes(selectedFile.size)}` : "PDF / PNG · максимум 40 MiB"}</small>
                </label>
                <Button variant="dark" disabled={interactionLocked || !selectedFile} onClick={() => void startUpload()}>
                  Загрузить и проверить
                </Button>
              </>
            )}

            {standardSnapshot ? (
              <div className="asa-project-workspace__transfer" aria-live="polite">
                <strong>Стандартная загрузка</strong>
                <p>{standardSnapshot.message}</p>
                {standardSnapshot.status === "uploading" ? <progress aria-label="Стандартная загрузка" /> : null}
                {standardSnapshot.status === "uploading" ? (
                  <Button disabled={finalizing} onClick={cancelStandardUpload}>
                    Отменить
                  </Button>
                ) : null}
              </div>
            ) : null}

            {tusSnapshot ? (
              <div className="asa-project-workspace__transfer" aria-live="polite">
                <strong>Возобновляемая TUS-загрузка</strong>
                <p>{tusSnapshot.message}</p>
                {tusSnapshot.progress.kind !== "none" ? (
                  <ProgressBar
                    label="Передача файла"
                    value={tusSnapshot.progress.percentage}
                    max={100}
                  />
                ) : null}
                <div className="asa-project-workspace__transfer-actions">
                  <Button disabled={!tusSnapshot.canPause || tusTransitionBusy || finalizing} onClick={() => void controlTusUpload("pause")}>
                    Пауза
                  </Button>
                  <Button disabled={!tusSnapshot.canResume || tusTransitionBusy || finalizing} onClick={() => void controlTusUpload("resume")}>
                    Продолжить
                  </Button>
                  <Button
                    disabled={!(tusSnapshot.status === "uploading" || tusSnapshot.status === "paused") || tusTransitionBusy || finalizing}
                    onClick={() => void controlTusUpload("cancel")}
                  >
                    Отменить
                  </Button>
                </div>
              </div>
            ) : null}

            {pendingFinalizationIntentId ? (
              <div className="asa-project-workspace__transfer" aria-live="polite">
                <strong>Проверка переданного файла не завершена</strong>
                <p>Новый файл заблокирован, пока сервер не подтвердит или не отклонит эту передачу.</p>
                <Button
                  variant="dark"
                  disabled={finalizing || tusTransitionBusy}
                  onClick={() => void finalizeTransfer(pendingFinalizationIntentId)}
                >
                  Повторить проверку файла
                </Button>
              </div>
            ) : null}
          </div>

          <div className="asa-project-workspace__submit">
            <div>
              <strong>{canSend ? "Проект готов к отправке" : "Проверьте готовность"}</strong>
              <p>{textReadiness.hasUnsavedText
                ? "Сначала сохраните текст. Отправка использует только сохранённую сервером версию."
                : "Финальное решение о готовности принимает база данных: нужны 5 уроков, принятый файл и корректный сохранённый текст M02."}</p>
            </div>
            <Button
              variant="dark"
              disabled={interactionLocked || !canSend}
              onClick={() => {
                if (!projection.editableVersion || !window.confirm("Отправить эту версию? После отправки она станет неизменяемой.")) return;
                const action = projection.status === "draft" ? submitProjectAction : resubmitProjectAction;
                void runMutation(() => action({ versionId: projection.editableVersion!.id }));
              }}
            >
              {projection.status === "draft" ? "Отправить проект" : "Отправить повторно"}
            </Button>
          </div>
        </div>
      ) : null}

      {immutable ? (
        <div className="asa-project-workspace__immutable">
          <strong>{statusLabel}</strong>
          <p>Текущая версия доступна только для чтения. Редактирование и замена файла отключены.</p>
          {reviewDownloadFile ? (
            <Button disabled={active} onClick={() => void downloadFile(reviewDownloadFile.id)}>
              Скачать отправленный файл
            </Button>
          ) : null}
        </div>
      ) : null}

      {revisionReadOnly && projection.currentFile ? (
        <div className="asa-project-workspace__immutable">
          <strong>Предыдущая отправленная версия</strong>
          <p>Файл доступен только для чтения; удалить или заменить его нельзя.</p>
          <Button disabled={active} onClick={() => void downloadFile(projection.currentFile!.id)}>
            Скачать предыдущий отправленный файл
          </Button>
        </div>
      ) : null}

      {projection.review ? (
        <section className="asa-project-workspace__review" aria-labelledby="learner-review-title">
          <header>
            <div>
              <span className="asa-kicker">ОБРАТНАЯ СВЯЗЬ</span>
              <h3 id="learner-review-title">{DECISION_LABELS[projection.review.decision]}</h3>
            </div>
            <strong>{projection.review.score} / 100</strong>
          </header>
          <p>{projection.review.summary}</p>
          <ol>
            {projection.review.criteria.map((criterion) => (
              <li key={criterion.number}>
                <span>{String(criterion.number).padStart(2, "0")}</span>
                <div>
                  <strong>{criterion.title}</strong>
                  <p>{criterion.description}</p>
                  {criterion.comment ? <small>{criterion.comment}</small> : null}
                </div>
                <b>{criterion.awardedPoints} / {criterion.maxPoints}</b>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {message ? <p className="asa-project-workspace__message" aria-live="polite">{message}</p> : null}
    </section>
  );
}
