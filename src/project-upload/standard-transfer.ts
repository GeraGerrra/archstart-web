import {
  PROJECT_UPLOAD_BUCKET_ID,
  PROJECT_UPLOAD_CAPABILITY_LIMITS,
  PROJECT_UPLOAD_MIME_TYPES,
  type ProjectUploadCapability,
  type ProjectUploadMime,
} from "./types.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const PROJECT_STANDARD_TRANSFER_LIMITS = Object.freeze({
  maximumAttemptsPerCapability: 2,
  minimumRemainingCapabilityMilliseconds: 30_000,
  maximumIssuedAtClockSkewMilliseconds: 5 * 60 * 1000,
  cacheControlSeconds: 3_600,
});

export type ProjectStandardTransferStatus =
  | "idle"
  | "validating"
  | "uploading"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ProjectStandardTransferErrorCode =
  | "controller-disposed"
  | "transfer-active"
  | "capability-reused"
  | "invalid-capability"
  | "invalid-file"
  | "unsupported-transfer-mode"
  | "capability-expired"
  | "bad-request"
  | "unauthorized"
  | "forbidden"
  | "timeout"
  | "conflict"
  | "too-large"
  | "rate-limited"
  | "server-error"
  | "network-error"
  | "invalid-storage-response"
  | "retry-unavailable"
  | "unknown-error";

export type ProjectStandardTransferProgress =
  | {
      kind: "none";
      loadedBytes: null;
      totalBytes: null;
      percentage: null;
    }
  | {
      kind: "indeterminate";
      loadedBytes: null;
      totalBytes: number;
      percentage: null;
    }
  | {
      kind: "complete";
      loadedBytes: number;
      totalBytes: number;
      percentage: 100;
    };

export interface ProjectStandardTransferSnapshot {
  readonly status: ProjectStandardTransferStatus;
  readonly message: string;
  readonly attempt: number;
  readonly maximumAttempts: number;
  readonly canRetry: boolean;
  readonly errorCode: ProjectStandardTransferErrorCode | null;
  readonly objectPath: string | null;
  readonly progress: ProjectStandardTransferProgress;
}

export interface ProjectStandardUploadTransportInput {
  capability: ProjectUploadCapability;
  file: File;
  signal: AbortSignal;
}

export interface ProjectStandardUploadTransportResult {
  path: string;
  fullPath: string | null;
}

export interface ProjectStandardUploadTransport {
  upload(
    input: ProjectStandardUploadTransportInput,
  ): Promise<ProjectStandardUploadTransportResult>;
}

export interface ProjectStandardTransferController {
  getSnapshot(): ProjectStandardTransferSnapshot;
  subscribe(listener: (snapshot: ProjectStandardTransferSnapshot) => void): () => void;
  start(
    file: File,
    capability: ProjectUploadCapability,
  ): Promise<ProjectStandardTransferSnapshot>;
  retry(): Promise<ProjectStandardTransferSnapshot>;
  cancel(): boolean;
  reset(): boolean;
  dispose(): void;
}

export interface ProjectStandardTransferControllerOptions {
  now?: () => number;
}

export interface ProjectStandardTransferValidationFailure {
  ok: false;
  code: Extract<
    ProjectStandardTransferErrorCode,
    | "invalid-capability"
    | "invalid-file"
    | "unsupported-transfer-mode"
    | "capability-expired"
  >;
  message: string;
}

export interface ProjectStandardTransferValidationSuccess {
  ok: true;
}

export type ProjectStandardTransferValidationResult =
  | ProjectStandardTransferValidationFailure
  | ProjectStandardTransferValidationSuccess;

interface ErrorClassification {
  code: ProjectStandardTransferErrorCode;
  message: string;
  retryable: boolean;
}

const idleProgress: ProjectStandardTransferProgress = Object.freeze({
  kind: "none",
  loadedBytes: null,
  totalBytes: null,
  percentage: null,
});

function frozenSnapshot(
  value: ProjectStandardTransferSnapshot,
): ProjectStandardTransferSnapshot {
  return Object.freeze({
    ...value,
    progress: Object.freeze({ ...value.progress }),
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function finiteDate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function expectedExtension(mime: ProjectUploadMime): ".pdf" | ".png" {
  return mime === "application/pdf" ? ".pdf" : ".png";
}

function safeObjectPath(
  capability: ProjectUploadCapability,
  extension: ".pdf" | ".png",
): boolean {
  const path = capability.objectPath;
  if (
    typeof path !== "string"
    || path.startsWith("/")
    || path.endsWith("/")
    || path.includes("\\")
    || path.includes("//")
  ) {
    return false;
  }

  const segments = path.split("/");
  if (segments.length !== 4 || segments.some((segment) => segment === "." || segment === "..")) {
    return false;
  }

  const [userId, submissionId, versionId, filename] = segments;
  if (
    !userId
    || !submissionId
    || !versionId
    || !filename
    || !UUID_PATTERN.test(userId)
    || !UUID_PATTERN.test(submissionId)
    || !UUID_PATTERN.test(versionId)
    || versionId.toLowerCase() !== capability.versionId.toLowerCase()
  ) {
    return false;
  }

  return filename.toLowerCase()
    === `${capability.plannedFileId.toLowerCase()}${extension}`;
}

export function validateProjectStandardTransferInput(
  file: File,
  capability: ProjectUploadCapability,
  now = Date.now(),
): ProjectStandardTransferValidationResult {
  if (!file || typeof file.name !== "string" || typeof file.type !== "string") {
    return {
      ok: false,
      code: "invalid-file",
      message: "Не удалось прочитать выбранный файл.",
    };
  }

  if (
    !capability
    || !UUID_PATTERN.test(text(capability.intentId))
    || !UUID_PATTERN.test(text(capability.plannedFileId))
    || !UUID_PATTERN.test(text(capability.versionId))
    || capability.bucketId !== PROJECT_UPLOAD_BUCKET_ID
    || typeof capability.uploadToken !== "string"
    || capability.uploadToken.length < 20
    || typeof capability.originalFilename !== "string"
    || typeof capability.declaredSizeBytes !== "number"
    || !Number.isSafeInteger(capability.declaredSizeBytes)
    || !PROJECT_UPLOAD_MIME_TYPES.includes(capability.declaredMime)
  ) {
    return {
      ok: false,
      code: "invalid-capability",
      message: "Разрешение на загрузку повреждено. Подготовьте его заново.",
    };
  }

  if (capability.transferMode !== "standard") {
    return {
      ok: false,
      code: "unsupported-transfer-mode",
      message: "Для этого файла требуется возобновляемая загрузка.",
    };
  }

  if (
    capability.declaredSizeBytes < PROJECT_UPLOAD_CAPABILITY_LIMITS.minimumBytes
    || capability.declaredSizeBytes
      > PROJECT_UPLOAD_CAPABILITY_LIMITS.standardMaximumBytes
  ) {
    return {
      ok: false,
      code: "invalid-capability",
      message: "Размер файла не соответствует стандартному режиму загрузки.",
    };
  }

  const extension = expectedExtension(capability.declaredMime);
  if (
    capability.originalFilename.length < 1
    || capability.originalFilename.length
      > PROJECT_UPLOAD_CAPABILITY_LIMITS.originalFilenameMaximumCharacters
    || capability.originalFilename.includes("/")
    || capability.originalFilename.includes("\\")
    || !capability.originalFilename.toLowerCase().endsWith(extension)
    || !safeObjectPath(capability, extension)
  ) {
    return {
      ok: false,
      code: "invalid-capability",
      message: "Путь или имя файла не прошли безопасную проверку.",
    };
  }

  if (
    file.name !== capability.originalFilename
    || file.type.toLowerCase() !== capability.declaredMime
    || file.size !== capability.declaredSizeBytes
    || file.size < PROJECT_UPLOAD_CAPABILITY_LIMITS.minimumBytes
    || file.size > PROJECT_UPLOAD_CAPABILITY_LIMITS.standardMaximumBytes
  ) {
    return {
      ok: false,
      code: "invalid-file",
      message: "Выбранный файл не совпадает с подготовленным разрешением.",
    };
  }

  const issuedAt = finiteDate(capability.issuedAt);
  const capabilityExpiresAt = finiteDate(capability.capabilityExpiresAt);
  const intentExpiresAt = finiteDate(capability.intentExpiresAt);
  if (
    issuedAt === null
    || capabilityExpiresAt === null
    || intentExpiresAt === null
    || issuedAt > now + PROJECT_STANDARD_TRANSFER_LIMITS.maximumIssuedAtClockSkewMilliseconds
    || issuedAt > capabilityExpiresAt
    || capabilityExpiresAt > intentExpiresAt
    || capabilityExpiresAt - now
      < PROJECT_STANDARD_TRANSFER_LIMITS.minimumRemainingCapabilityMilliseconds
  ) {
    return {
      ok: false,
      code: "capability-expired",
      message: "Срок разрешения истёк. Подготовьте загрузку заново.",
    };
  }

  return { ok: true };
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d{3}$/u.test(value)) return Number(value);
  return null;
}

function errorRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}

function statusFromError(error: unknown): number | null {
  const record = errorRecord(error);
  if (!record) return null;

  for (const key of ["statusCode", "status", "status_code"]) {
    const status = numberFromUnknown(record[key]);
    if (status !== null) return status;
  }

  return statusFromError(record.originalError ?? record.cause);
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  const record = errorRecord(error);
  return record ? text(record.message) : "";
}

function isAbortError(error: unknown): boolean {
  return (typeof DOMException !== "undefined" && error instanceof DOMException)
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function classifyError(error: unknown): ErrorClassification {
  const status = statusFromError(error);
  const message = messageFromError(error).toLowerCase();

  if (
    status === 409
    || message.includes("already exists")
    || message.includes("asset already")
  ) {
    return {
      code: "conflict",
      message: "Файл по этому пути уже существует. Запросите новое разрешение.",
      retryable: false,
    };
  }
  if (status === 400) {
    return {
      code: "bad-request",
      message: "Storage отклонил запрос. Подготовьте новое разрешение.",
      retryable: false,
    };
  }
  if (status === 401) {
    return {
      code: "unauthorized",
      message: "Разрешение на загрузку недействительно или истекло.",
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      code: "forbidden",
      message: "Загрузка запрещена для этого пути.",
      retryable: false,
    };
  }
  if (status === 413) {
    return {
      code: "too-large",
      message: "Storage отклонил файл из-за его размера.",
      retryable: false,
    };
  }
  if (status === 408) {
    return {
      code: "timeout",
      message: "Storage не ответил вовремя. Разрешена одна повторная попытка.",
      retryable: true,
    };
  }
  if (status === 429) {
    return {
      code: "rate-limited",
      message: "Storage временно ограничил запросы. Разрешена одна повторная попытка.",
      retryable: true,
    };
  }
  if (status !== null && status >= 500) {
    return {
      code: "server-error",
      message: "Storage временно недоступен. Разрешена одна повторная попытка.",
      retryable: true,
    };
  }
  if (
    message.includes("unexpected upload path")
    || message.includes("unexpected storage path")
  ) {
    return {
      code: "invalid-storage-response",
      message: "Storage вернул неожиданный путь. Подготовьте новое разрешение.",
      retryable: false,
    };
  }
  if (
    message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("network error")
    || message.includes("fetch failed")
    || message.includes("load failed")
  ) {
    return {
      code: "network-error",
      message: "Соединение прервалось. Разрешена одна повторная попытка.",
      retryable: true,
    };
  }

  return {
    code: "unknown-error",
    message: "Загрузка не завершилась. Подготовьте новое разрешение.",
    retryable: false,
  };
}

function capabilityKey(capability: ProjectUploadCapability): string {
  return `${capability.intentId}:${capability.plannedFileId}:${capability.objectPath}`;
}

export function createProjectStandardTransferController(
  transport: ProjectStandardUploadTransport,
  options: ProjectStandardTransferControllerOptions = {},
): ProjectStandardTransferController {
  const now = options.now ?? Date.now;
  const maximumAttempts =
    PROJECT_STANDARD_TRANSFER_LIMITS.maximumAttemptsPerCapability;

  const listeners = new Set<(snapshot: ProjectStandardTransferSnapshot) => void>();
  const startedCapabilities = new Set<string>();
  let disposed = false;
  let operationId = 0;
  let abortController: AbortController | null = null;
  let activePromise: Promise<ProjectStandardTransferSnapshot> | null = null;
  let retainedFile: File | null = null;
  let retainedCapability: ProjectUploadCapability | null = null;
  let state = frozenSnapshot({
    status: "idle",
    message: "Файл ещё не передаётся.",
    attempt: 0,
    maximumAttempts,
    canRetry: false,
    errorCode: null,
    objectPath: null,
    progress: idleProgress,
  });

  function publish(next: ProjectStandardTransferSnapshot): ProjectStandardTransferSnapshot {
    state = frozenSnapshot(next);
    for (const listener of listeners) {
      try {
        listener(state);
      } catch {
        // Observers cannot take ownership of or break a Storage transfer.
      }
    }
    return state;
  }

  function failure(
    code: ProjectStandardTransferErrorCode,
    message: string,
    canRetry: boolean,
    attempt = state.attempt,
  ): ProjectStandardTransferSnapshot {
    return publish({
      status: "failed",
      message,
      attempt,
      maximumAttempts,
      canRetry,
      errorCode: code,
      objectPath: retainedCapability?.objectPath ?? null,
      progress: idleProgress,
    });
  }

  async function execute(): Promise<ProjectStandardTransferSnapshot> {
    if (!retainedFile || !retainedCapability) {
      return failure("retry-unavailable", "Повторная попытка недоступна.", false);
    }

    const validation = validateProjectStandardTransferInput(
      retainedFile,
      retainedCapability,
      now(),
    );
    if (!validation.ok) {
      return failure(validation.code, validation.message, false);
    }

    const attempt = state.attempt + 1;
    const localOperationId = ++operationId;
    abortController = new AbortController();
    const signal = abortController.signal;

    publish({
      status: "uploading",
      message: "Файл передаётся напрямую в защищённое хранилище.",
      attempt,
      maximumAttempts,
      canRetry: false,
      errorCode: null,
      objectPath: retainedCapability.objectPath,
      progress: {
        kind: "indeterminate",
        loadedBytes: null,
        totalBytes: retainedFile.size,
        percentage: null,
      },
    });

    try {
      const result = await transport.upload({
        capability: retainedCapability,
        file: retainedFile,
        signal,
      });

      if (localOperationId !== operationId) return state;
      abortController = null;

      if (signal.aborted) {
        return publish({
          status: "cancelled",
          message: "Передача отменена. Для новой попытки подготовьте новое разрешение.",
          attempt,
          maximumAttempts,
          canRetry: false,
          errorCode: null,
          objectPath: retainedCapability.objectPath,
          progress: idleProgress,
        });
      }

      if (result.path !== retainedCapability.objectPath) {
        return failure(
          "invalid-storage-response",
          "Storage вернул неожиданный путь. Подготовьте новое разрешение.",
          false,
          attempt,
        );
      }

      return publish({
        status: "succeeded",
        message: "Файл передан. Проверка содержимого будет выполнена отдельно.",
        attempt,
        maximumAttempts,
        canRetry: false,
        errorCode: null,
        objectPath: result.path,
        progress: {
          kind: "complete",
          loadedBytes: retainedFile.size,
          totalBytes: retainedFile.size,
          percentage: 100,
        },
      });
    } catch (error) {
      if (localOperationId !== operationId) return state;
      abortController = null;

      if (signal.aborted || isAbortError(error)) {
        return publish({
          status: "cancelled",
          message: "Передача отменена. Для новой попытки подготовьте новое разрешение.",
          attempt,
          maximumAttempts,
          canRetry: false,
          errorCode: null,
          objectPath: retainedCapability.objectPath,
          progress: idleProgress,
        });
      }

      const classified = classifyError(error);
      return failure(
        classified.code,
        classified.message,
        classified.retryable && attempt < maximumAttempts,
        attempt,
      );
    }
  }

  return {
    getSnapshot: () => state,

    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async start(file, capability) {
      if (disposed) {
        return failure(
          "controller-disposed",
          "Контроллер загрузки уже закрыт.",
          false,
          0,
        );
      }
      if (state.status === "uploading" || state.status === "validating") {
        return activePromise ?? state;
      }

      const safeObjectPath = capability && typeof capability.objectPath === "string"
        ? capability.objectPath
        : null;
      publish({
        status: "validating",
        message: "Проверяем файл и разрешение.",
        attempt: 0,
        maximumAttempts,
        canRetry: false,
        errorCode: null,
        objectPath: safeObjectPath,
        progress: idleProgress,
      });

      const validation = validateProjectStandardTransferInput(file, capability, now());
      if (!validation.ok) {
        retainedFile = null;
        retainedCapability = null;
        return failure(validation.code, validation.message, false, 0);
      }

      const key = capabilityKey(capability);
      if (startedCapabilities.has(key)) {
        return failure(
          "capability-reused",
          "Это разрешение уже использовалось в текущей сессии.",
          false,
          0,
        );
      }

      startedCapabilities.add(key);
      retainedFile = file;
      retainedCapability = capability;
      const execution = execute();
      activePromise = execution;
      try {
        return await execution;
      } finally {
        if (activePromise === execution) activePromise = null;
      }
    },

    async retry() {
      if (disposed) {
        return failure(
          "controller-disposed",
          "Контроллер загрузки уже закрыт.",
          false,
        );
      }
      if (state.status !== "failed" || !state.canRetry) {
        return state;
      }
      const execution = execute();
      activePromise = execution;
      try {
        return await execution;
      } finally {
        if (activePromise === execution) activePromise = null;
      }
    },

    cancel() {
      if (disposed || state.status !== "uploading" || !abortController) return false;
      operationId += 1;
      abortController.abort();
      abortController = null;
      publish({
        status: "cancelled",
        message: "Передача отменена. Для новой попытки подготовьте новое разрешение.",
        attempt: state.attempt,
        maximumAttempts,
        canRetry: false,
        errorCode: null,
        objectPath: retainedCapability?.objectPath ?? null,
        progress: idleProgress,
      });
      return true;
    },

    reset() {
      if (disposed || state.status === "uploading" || state.status === "validating") {
        return false;
      }
      retainedFile = null;
      retainedCapability = null;
      publish({
        status: "idle",
        message: "Файл ещё не передаётся.",
        attempt: 0,
        maximumAttempts,
        canRetry: false,
        errorCode: null,
        objectPath: null,
        progress: idleProgress,
      });
      return true;
    },

    dispose() {
      if (disposed) return;
      const wasActive = state.status === "uploading" || state.status === "validating";
      disposed = true;
      operationId += 1;
      abortController?.abort();
      abortController = null;
      activePromise = null;
      if (wasActive) {
        publish({
          status: "cancelled",
          message: "Передача остановлена вместе с закрытием контроллера.",
          attempt: state.attempt,
          maximumAttempts,
          canRetry: false,
          errorCode: null,
          objectPath: retainedCapability?.objectPath ?? null,
          progress: idleProgress,
        });
      }
      listeners.clear();
      retainedFile = null;
      retainedCapability = null;
    },
  };
}
