import {
  PROJECT_UPLOAD_BUCKET_ID,
  PROJECT_UPLOAD_CAPABILITY_LIMITS,
  PROJECT_UPLOAD_MIME_TYPES,
  type ProjectUploadCapability,
  type ProjectUploadMime,
} from "./types.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/u;
const TUS_ENDPOINT_PATH = "/storage/v1/upload/resumable";

export const PROJECT_TUS_TRANSFER_LIMITS = Object.freeze({
  minimumBytes: PROJECT_UPLOAD_CAPABILITY_LIMITS.standardMaximumBytes + 1,
  maximumBytes: PROJECT_UPLOAD_CAPABILITY_LIMITS.absoluteMaximumBytes,
  chunkSizeBytes: 6 * 1024 * 1024,
  cacheControlSeconds: 3_600,
  maximumAttemptsPerCapability: 2,
  minimumRemainingCapabilityMilliseconds: 30_000,
  maximumIssuedAtClockSkewMilliseconds: 5 * 60 * 1000,
  maximumPreviousUploadAgeMilliseconds: 24 * 60 * 60 * 1000,
  maximumPreviousUploadFutureSkewMilliseconds: 5 * 60 * 1000,
  requestRetryDelaysMilliseconds: Object.freeze([0, 1_500, 3_000]),
});

export type ProjectTusTransferStatus =
  | "idle"
  | "validating"
  | "uploading"
  | "paused"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ProjectTusTransferErrorCode =
  | "controller-disposed"
  | "transfer-active"
  | "capability-reused"
  | "invalid-capability"
  | "invalid-file"
  | "unsupported-transfer-mode"
  | "capability-expired"
  | "unsupported-browser"
  | "unsafe-endpoint"
  | "unsafe-resume-url"
  | "bad-request"
  | "unauthorized"
  | "forbidden"
  | "timeout"
  | "conflict"
  | "too-large"
  | "locked"
  | "rate-limited"
  | "server-error"
  | "network-error"
  | "invalid-storage-response"
  | "termination-failed"
  | "retry-unavailable"
  | "unknown-error";

export type ProjectTusTransferProgress =
  | {
      kind: "none";
      loadedBytes: null;
      totalBytes: null;
      percentage: null;
    }
  | {
      kind: "determinate";
      loadedBytes: number;
      totalBytes: number;
      percentage: number;
    }
  | {
      kind: "complete";
      loadedBytes: number;
      totalBytes: number;
      percentage: 100;
    };

export interface ProjectTusTransferSnapshot {
  readonly status: ProjectTusTransferStatus;
  readonly message: string;
  readonly attempt: number;
  readonly maximumAttempts: number;
  readonly canRetry: boolean;
  readonly canPause: boolean;
  readonly canResume: boolean;
  readonly resumedPreviousUpload: boolean;
  readonly errorCode: ProjectTusTransferErrorCode | null;
  readonly objectPath: string | null;
  readonly uploadUrl: string | null;
  readonly progress: ProjectTusTransferProgress;
}

export interface ProjectTusPreviousUpload {
  size: number | null;
  metadata: Record<string, string>;
  creationTime: string;
  urlStorageKey: string;
  uploadUrl: string | null;
  parallelUploadUrls: string[] | null;
}

export interface ProjectTusUploadSuccess {
  uploadUrl: string | null;
}

export interface ProjectTusUploadSessionInput {
  capability: ProjectUploadCapability;
  file: File;
  onProgress(bytesUploaded: number, bytesTotal: number): void;
  onSuccess(result: ProjectTusUploadSuccess): void;
  onError(error: unknown): void;
  onUploadUrlAvailable(uploadUrl: string): void;
}

export interface ProjectTusUploadSession {
  findPreviousUploads(): Promise<ProjectTusPreviousUpload[]>;
  resumeFromPreviousUpload(previousUpload: ProjectTusPreviousUpload): void;
  start(): void;
  pause(): Promise<void>;
  cancel(): Promise<void>;
  getUploadUrl(): string | null;
}

export interface ProjectTusUploadTransport {
  readonly endpoint: string;
  readonly supported: boolean;
  readonly canStorePreviousUploads: boolean;
  createSession(input: ProjectTusUploadSessionInput): ProjectTusUploadSession;
}

export interface ProjectTusTransferController {
  getSnapshot(): ProjectTusTransferSnapshot;
  subscribe(listener: (snapshot: ProjectTusTransferSnapshot) => void): () => void;
  start(
    file: File,
    capability: ProjectUploadCapability,
  ): Promise<ProjectTusTransferSnapshot>;
  pause(): Promise<ProjectTusTransferSnapshot>;
  resume(): Promise<ProjectTusTransferSnapshot>;
  retry(): Promise<ProjectTusTransferSnapshot>;
  cancel(): Promise<ProjectTusTransferSnapshot>;
  reset(): boolean;
  dispose(): Promise<void>;
}

export interface ProjectTusTransferControllerOptions {
  now?: () => number;
}

export interface ProjectTusTransferValidationFailure {
  ok: false;
  code: Extract<
    ProjectTusTransferErrorCode,
    | "invalid-capability"
    | "invalid-file"
    | "unsupported-transfer-mode"
    | "capability-expired"
  >;
  message: string;
}

export interface ProjectTusTransferValidationSuccess {
  ok: true;
}

export type ProjectTusTransferValidationResult =
  | ProjectTusTransferValidationFailure
  | ProjectTusTransferValidationSuccess;

interface ErrorClassification {
  code: ProjectTusTransferErrorCode;
  message: string;
  retryable: boolean;
}

const idleProgress: ProjectTusTransferProgress = Object.freeze({
  kind: "none",
  loadedBytes: null,
  totalBytes: null,
  percentage: null,
});

function frozenSnapshot(
  value: ProjectTusTransferSnapshot,
): ProjectTusTransferSnapshot {
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
  if (
    segments.length !== 4
    || segments.some((segment) => segment === "." || segment === "..")
  ) {
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

export function validateProjectTusTransferInput(
  file: File,
  capability: ProjectUploadCapability,
  now = Date.now(),
): ProjectTusTransferValidationResult {
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

  if (capability.transferMode !== "tus") {
    return {
      ok: false,
      code: "unsupported-transfer-mode",
      message: "Этот файл должен использовать стандартную загрузку.",
    };
  }

  if (
    capability.declaredSizeBytes < PROJECT_TUS_TRANSFER_LIMITS.minimumBytes
    || capability.declaredSizeBytes > PROJECT_TUS_TRANSFER_LIMITS.maximumBytes
  ) {
    return {
      ok: false,
      code: "invalid-capability",
      message: "Размер файла не соответствует возобновляемому режиму загрузки.",
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
    || file.size < PROJECT_TUS_TRANSFER_LIMITS.minimumBytes
    || file.size > PROJECT_TUS_TRANSFER_LIMITS.maximumBytes
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
    || issuedAt
      > now + PROJECT_TUS_TRANSFER_LIMITS.maximumIssuedAtClockSkewMilliseconds
    || issuedAt > capabilityExpiresAt
    || capabilityExpiresAt > intentExpiresAt
    || capabilityExpiresAt - now
      < PROJECT_TUS_TRANSFER_LIMITS.minimumRemainingCapabilityMilliseconds
  ) {
    return {
      ok: false,
      code: "capability-expired",
      message: "Срок разрешения истёк. Подготовьте загрузку заново.",
    };
  }

  return { ok: true };
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function containsEncodedPathControl(value: string): boolean {
  return /%(?:2e|2f|5c)/iu.test(value);
}

export function isSafeProjectTusEndpoint(endpoint: string): boolean {
  const parsed = parseUrl(endpoint);
  if (
    !parsed
    || parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.search
    || parsed.hash
    || parsed.pathname !== TUS_ENDPOINT_PATH
  ) {
    return false;
  }

  const suffix = ".storage.supabase.co";
  if (!parsed.hostname.endsWith(suffix)) return false;
  const projectRef = parsed.hostname.slice(0, -suffix.length);
  return PROJECT_REF_PATTERN.test(projectRef);
}

export function isSafeProjectTusUploadUrl(
  uploadUrl: string,
  endpoint: string,
): boolean {
  if (
    typeof uploadUrl !== "string"
    || uploadUrl.includes("\\")
    || containsEncodedPathControl(uploadUrl)
  ) {
    return false;
  }

  const endpointUrl = parseUrl(endpoint);
  const candidate = parseUrl(uploadUrl);
  if (
    !endpointUrl
    || !candidate
    || !isSafeProjectTusEndpoint(endpoint)
    || candidate.protocol !== "https:"
    || candidate.origin !== endpointUrl.origin
    || candidate.username
    || candidate.password
    || candidate.port
    || candidate.search
    || candidate.hash
    || !candidate.pathname.startsWith(`${endpointUrl.pathname}/`)
  ) {
    return false;
  }

  const suffix = candidate.pathname.slice(endpointUrl.pathname.length + 1);
  if (!suffix || suffix.includes("//")) return false;

  let decoded: string;
  try {
    decoded = decodeURIComponent(suffix);
  } catch {
    return false;
  }

  return !decoded.includes("\\")
    && decoded.split("/").every(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    );
}

export function isSafeProjectTusPreviousUpload(
  previous: ProjectTusPreviousUpload,
  file: File,
  capability: ProjectUploadCapability,
  endpoint: string,
  now = Date.now(),
): boolean {
  const createdAt = finiteDate(previous.creationTime);
  if (
    previous.size !== file.size
    || createdAt === null
    || createdAt
      > now + PROJECT_TUS_TRANSFER_LIMITS.maximumPreviousUploadFutureSkewMilliseconds
    || now - createdAt
      > PROJECT_TUS_TRANSFER_LIMITS.maximumPreviousUploadAgeMilliseconds
    || !previous.urlStorageKey
    || !previous.uploadUrl
    || !isSafeProjectTusUploadUrl(previous.uploadUrl, endpoint)
    || (previous.parallelUploadUrls?.length ?? 0) !== 0
  ) {
    return false;
  }

  return previous.metadata.bucketName === PROJECT_UPLOAD_BUCKET_ID
    && previous.metadata.objectName === capability.objectPath
    && previous.metadata.contentType === capability.declaredMime
    && previous.metadata.cacheControl
      === String(PROJECT_TUS_TRANSFER_LIMITS.cacheControlSeconds);
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

function statusFromResponse(value: unknown): number | null {
  const record = errorRecord(value);
  if (!record) return null;
  const getter = record.getStatus;
  if (typeof getter === "function") {
    try {
      return numberFromUnknown(getter.call(value));
    } catch {
      return null;
    }
  }
  return null;
}

export function projectTusStatusFromError(error: unknown): number | null {
  const record = errorRecord(error);
  if (!record) return null;

  for (const key of ["statusCode", "status", "status_code"]) {
    const status = numberFromUnknown(record[key]);
    if (status !== null) return status;
  }

  const responseStatus = statusFromResponse(record.originalResponse);
  if (responseStatus !== null) return responseStatus;

  return projectTusStatusFromError(record.originalError ?? record.cause);
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  const record = errorRecord(error);
  return record ? text(record.message) : "";
}

function classifyError(error: unknown): ErrorClassification {
  const status = projectTusStatusFromError(error);
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
  if (status === 423) {
    return {
      code: "locked",
      message: "TUS-сессия временно занята. Разрешена одна повторная попытка.",
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
  if (message.includes("unsafe tus upload url")) {
    return {
      code: "unsafe-resume-url",
      message: "Storage вернул небезопасный адрес загрузки.",
      retryable: false,
    };
  }
  if (
    status === 0
    || message.includes("failed to fetch")
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

export function shouldRetryProjectTusRequest(error: unknown): boolean {
  return classifyError(error).retryable;
}

function capabilityKey(capability: ProjectUploadCapability): string {
  return `${capability.intentId}:${capability.plannedFileId}:${capability.objectPath}`;
}

function progressAt(
  loadedBytes: number,
  totalBytes: number,
): ProjectTusTransferProgress {
  const safeTotal = Math.max(1, Math.floor(totalBytes));
  const safeLoaded = Math.min(safeTotal, Math.max(0, Math.floor(loadedBytes)));
  const percentage = Math.min(99, Math.max(0, Math.floor(
    (safeLoaded / safeTotal) * 100,
  )));
  return {
    kind: "determinate",
    loadedBytes: safeLoaded,
    totalBytes: safeTotal,
    percentage,
  };
}

export function createProjectTusTransferController(
  transport: ProjectTusUploadTransport,
  options: ProjectTusTransferControllerOptions = {},
): ProjectTusTransferController {
  const now = options.now ?? Date.now;
  const maximumAttempts = PROJECT_TUS_TRANSFER_LIMITS.maximumAttemptsPerCapability;
  const listeners = new Set<(snapshot: ProjectTusTransferSnapshot) => void>();
  const startedCapabilities = new Set<string>();

  let disposed = false;
  let operationId = 0;
  let callbackOperationId = 0;
  let activePromise: Promise<ProjectTusTransferSnapshot> | null = null;
  let activeResolve: ((snapshot: ProjectTusTransferSnapshot) => void) | null = null;
  let session: ProjectTusUploadSession | null = null;
  let retainedFile: File | null = null;
  let retainedCapability: ProjectUploadCapability | null = null;
  let resumedPreviousUpload = false;
  let state = frozenSnapshot({
    status: "idle",
    message: "Файл ещё не передаётся.",
    attempt: 0,
    maximumAttempts,
    canRetry: false,
    canPause: false,
    canResume: false,
    resumedPreviousUpload: false,
    errorCode: null,
    objectPath: null,
    uploadUrl: null,
    progress: idleProgress,
  });

  function publish(next: ProjectTusTransferSnapshot): ProjectTusTransferSnapshot {
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

  function settle(snapshot = state): ProjectTusTransferSnapshot {
    const resolve = activeResolve;
    activeResolve = null;
    activePromise = null;
    resolve?.(snapshot);
    return snapshot;
  }

  function beginActivePromise(): Promise<ProjectTusTransferSnapshot> {
    const promise = new Promise<ProjectTusTransferSnapshot>((resolve) => {
      activeResolve = resolve;
    });
    activePromise = promise;
    return promise;
  }

  function failure(
    code: ProjectTusTransferErrorCode,
    message: string,
    canRetry: boolean,
    attempt = state.attempt,
    progress = state.progress,
  ): ProjectTusTransferSnapshot {
    return publish({
      status: "failed",
      message,
      attempt,
      maximumAttempts,
      canRetry,
      canPause: false,
      canResume: false,
      resumedPreviousUpload,
      errorCode: code,
      objectPath: retainedCapability?.objectPath ?? null,
      uploadUrl: session?.getUploadUrl() ?? state.uploadUrl,
      progress,
    });
  }

  function handleProgress(
    localOperationId: number,
    bytesUploaded: number,
    bytesTotal: number,
  ): void {
    if (
      localOperationId !== operationId
      || state.status !== "uploading"
      || !retainedFile
      || !Number.isFinite(bytesUploaded)
      || !Number.isFinite(bytesTotal)
      || bytesTotal !== retainedFile.size
    ) {
      return;
    }

    publish({
      ...state,
      progress: progressAt(bytesUploaded, bytesTotal),
    });
  }

  function handleUploadUrl(
    localOperationId: number,
    uploadUrl: string,
  ): void {
    if (localOperationId !== operationId || state.status !== "uploading") return;
    if (!isSafeProjectTusUploadUrl(uploadUrl, transport.endpoint)) {
      void failUnsafeUploadUrl(localOperationId);
      return;
    }
    publish({
      ...state,
      uploadUrl,
    });
  }

  async function failUnsafeUploadUrl(localOperationId: number): Promise<void> {
    if (localOperationId !== operationId) return;
    const unsafeSession = session;
    operationId += 1;
    callbackOperationId = 0;
    session = null;
    try {
      await unsafeSession?.cancel();
    } catch {
      // The unsafe URL is terminal whether or not remote termination succeeds.
    }
    const snapshot = failure(
      "unsafe-resume-url",
      "Storage вернул небезопасный адрес загрузки.",
      false,
    );
    settle(snapshot);
  }

  function handleSuccess(
    localOperationId: number,
    result: ProjectTusUploadSuccess,
  ): void {
    if (
      localOperationId !== operationId
      || state.status !== "uploading"
      || !retainedFile
      || !retainedCapability
    ) {
      return;
    }

    const uploadUrl = result.uploadUrl ?? session?.getUploadUrl() ?? null;
    if (!uploadUrl || !isSafeProjectTusUploadUrl(uploadUrl, transport.endpoint)) {
      void failUnsafeUploadUrl(localOperationId);
      return;
    }

    session = null;
    const snapshot = publish({
      status: "succeeded",
      message: "Файл передан. Проверка содержимого будет выполнена отдельно.",
      attempt: state.attempt,
      maximumAttempts,
      canRetry: false,
      canPause: false,
      canResume: false,
      resumedPreviousUpload,
      errorCode: null,
      objectPath: retainedCapability.objectPath,
      uploadUrl,
      progress: {
        kind: "complete",
        loadedBytes: retainedFile.size,
        totalBytes: retainedFile.size,
        percentage: 100,
      },
    });
    settle(snapshot);
  }

  function handleError(localOperationId: number, error: unknown): void {
    if (localOperationId !== operationId || state.status !== "uploading") return;
    session = null;
    const classified = classifyError(error);
    const snapshot = failure(
      classified.code,
      classified.message,
      classified.retryable && state.attempt < maximumAttempts,
    );
    settle(snapshot);
  }

  async function createAndStartAttempt(): Promise<ProjectTusTransferSnapshot> {
    if (!retainedFile || !retainedCapability) {
      return failure("retry-unavailable", "Повторная попытка недоступна.", false);
    }

    const validation = validateProjectTusTransferInput(
      retainedFile,
      retainedCapability,
      now(),
    );
    if (!validation.ok) {
      return failure(validation.code, validation.message, false);
    }
    if (!transport.supported) {
      return failure(
        "unsupported-browser",
        "Этот браузер не поддерживает возобновляемую загрузку.",
        false,
      );
    }
    if (!isSafeProjectTusEndpoint(transport.endpoint)) {
      return failure(
        "unsafe-endpoint",
        "Адрес возобновляемой загрузки не прошёл проверку.",
        false,
      );
    }

    const attempt = state.attempt + 1;
    if (attempt > maximumAttempts) {
      return failure("retry-unavailable", "Лимит попыток исчерпан.", false);
    }

    const localOperationId = ++operationId;
    callbackOperationId = localOperationId;
    resumedPreviousUpload = false;
    const promise = beginActivePromise();

    publish({
      status: "uploading",
      message: "Подготавливаем возобновляемую передачу в защищённое хранилище.",
      attempt,
      maximumAttempts,
      canRetry: false,
      canPause: true,
      canResume: false,
      resumedPreviousUpload: false,
      errorCode: null,
      objectPath: retainedCapability.objectPath,
      uploadUrl: null,
      progress: progressAt(0, retainedFile.size),
    });

    try {
      // A transport is untrusted browser code and may invoke callbacks while
      // createSession() is still on the stack. Buffer those callbacks until the
      // returned session is assigned, so a synchronous success/error cannot leave
      // a terminal controller with a newly resurrected session reference.
      let callbackBuffer: Array<() => void> | null = [];
      const dispatchCallback = (callback: () => void): void => {
        if (callbackBuffer) {
          callbackBuffer.push(callback);
          return;
        }
        callback();
      };

      session = transport.createSession({
        capability: retainedCapability,
        file: retainedFile,
        onProgress: (bytesUploaded, bytesTotal) => {
          dispatchCallback(() => {
            handleProgress(callbackOperationId, bytesUploaded, bytesTotal);
          });
        },
        onSuccess: (result) => {
          dispatchCallback(() => {
            handleSuccess(callbackOperationId, result);
          });
        },
        onError: (error) => {
          dispatchCallback(() => {
            handleError(callbackOperationId, error);
          });
        },
        onUploadUrlAvailable: (uploadUrl) => {
          dispatchCallback(() => {
            handleUploadUrl(callbackOperationId, uploadUrl);
          });
        },
      });

      const bufferedCallbacks = callbackBuffer;
      callbackBuffer = null;
      for (const callback of bufferedCallbacks) callback();

      if (localOperationId !== operationId || state.status !== "uploading") {
        return promise;
      }

      if (transport.canStorePreviousUploads) {
        const previousUploads = await session.findPreviousUploads();
        if (localOperationId !== operationId || state.status !== "uploading") {
          return promise;
        }

        const safeUploads = previousUploads.filter((previous) =>
          isSafeProjectTusPreviousUpload(
            previous,
            retainedFile as File,
            retainedCapability as ProjectUploadCapability,
            transport.endpoint,
            now(),
          )
        );
        if (safeUploads.length !== previousUploads.length) {
          await failUnsafeUploadUrl(localOperationId);
          return promise;
        }

        const previous = safeUploads.sort((left, right) =>
          Date.parse(right.creationTime) - Date.parse(left.creationTime)
        )[0];
        if (previous) {
          session.resumeFromPreviousUpload(previous);
          resumedPreviousUpload = true;
          publish({
            ...state,
            message: "Продолжаем ранее начатую защищённую передачу.",
            resumedPreviousUpload: true,
            uploadUrl: previous.uploadUrl,
          });
        }
      }

      if (localOperationId === operationId && state.status === "uploading") {
        session.start();
      }
    } catch (error) {
      handleError(localOperationId, error);
    }

    return promise;
  }

  function resumeCurrentSession(): Promise<ProjectTusTransferSnapshot> {
    if (!session || !retainedFile || !retainedCapability) return Promise.resolve(state);

    const validation = validateProjectTusTransferInput(
      retainedFile,
      retainedCapability,
      now(),
    );
    if (!validation.ok) {
      return Promise.resolve(failure(validation.code, validation.message, false));
    }

    const localOperationId = ++operationId;
    callbackOperationId = localOperationId;
    const promise = beginActivePromise();
    publish({
      ...state,
      status: "uploading",
      message: "Возобновляем защищённую передачу.",
      canPause: true,
      canResume: false,
      errorCode: null,
    });
    try {
      session.start();
    } catch (error) {
      handleError(localOperationId, error);
    }
    return promise;
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
          idleProgress,
        );
      }
      if (state.status === "uploading" || state.status === "validating") {
        return activePromise ?? state;
      }

      publish({
        status: "validating",
        message: "Проверяем файл и разрешение.",
        attempt: 0,
        maximumAttempts,
        canRetry: false,
        canPause: false,
        canResume: false,
        resumedPreviousUpload: false,
        errorCode: null,
        objectPath: capability && typeof capability.objectPath === "string"
          ? capability.objectPath
          : null,
        uploadUrl: null,
        progress: idleProgress,
      });

      const validation = validateProjectTusTransferInput(file, capability, now());
      if (!validation.ok) {
        retainedFile = null;
        retainedCapability = null;
        return failure(validation.code, validation.message, false, 0, idleProgress);
      }
      if (!transport.supported) {
        return failure(
          "unsupported-browser",
          "Этот браузер не поддерживает возобновляемую загрузку.",
          false,
          0,
          idleProgress,
        );
      }
      if (!isSafeProjectTusEndpoint(transport.endpoint)) {
        return failure(
          "unsafe-endpoint",
          "Адрес возобновляемой загрузки не прошёл проверку.",
          false,
          0,
          idleProgress,
        );
      }

      const key = capabilityKey(capability);
      if (startedCapabilities.has(key)) {
        return failure(
          "capability-reused",
          "Это разрешение уже использовалось в текущей сессии.",
          false,
          0,
          idleProgress,
        );
      }

      startedCapabilities.add(key);
      retainedFile = file;
      retainedCapability = capability;
      return createAndStartAttempt();
    },

    async pause() {
      if (disposed || state.status !== "uploading" || !session) return state;
      const pausedSession = session;
      operationId += 1;
      callbackOperationId = 0;
      try {
        await pausedSession.pause();
      } catch (error) {
        const classified = classifyError(error);
        const snapshot = failure(
          classified.code,
          classified.message,
          classified.retryable && state.attempt < maximumAttempts,
        );
        return settle(snapshot);
      }

      const snapshot = publish({
        ...state,
        status: "paused",
        message: "Передача приостановлена. Её можно продолжить.",
        canRetry: false,
        canPause: false,
        canResume: true,
        errorCode: null,
        uploadUrl: pausedSession.getUploadUrl() ?? state.uploadUrl,
      });
      return settle(snapshot);
    },

    async resume() {
      if (disposed || state.status !== "paused") return state;
      return resumeCurrentSession();
    },

    async retry() {
      if (disposed) {
        return failure(
          "controller-disposed",
          "Контроллер загрузки уже закрыт.",
          false,
        );
      }
      if (state.status !== "failed" || !state.canRetry) return state;
      session = null;
      return createAndStartAttempt();
    },

    async cancel() {
      if (
        disposed
        || (state.status !== "uploading" && state.status !== "paused")
        || !session
      ) {
        return state;
      }

      const cancelledSession = session;
      operationId += 1;
      callbackOperationId = 0;
      session = null;
      try {
        await cancelledSession.cancel();
      } catch {
        const snapshot = failure(
          "termination-failed",
          "Не удалось подтвердить удаление незавершённой TUS-сессии.",
          false,
        );
        return settle(snapshot);
      }

      const snapshot = publish({
        ...state,
        status: "cancelled",
        message: "Передача отменена, незавершённая TUS-сессия удалена.",
        canRetry: false,
        canPause: false,
        canResume: false,
        errorCode: null,
        uploadUrl: cancelledSession.getUploadUrl() ?? state.uploadUrl,
      });
      return settle(snapshot);
    },

    reset() {
      if (
        disposed
        || state.status === "uploading"
        || state.status === "validating"
        || state.status === "paused"
      ) {
        return false;
      }
      retainedFile = null;
      retainedCapability = null;
      session = null;
      resumedPreviousUpload = false;
      publish({
        status: "idle",
        message: "Файл ещё не передаётся.",
        attempt: 0,
        maximumAttempts,
        canRetry: false,
        canPause: false,
        canResume: false,
        resumedPreviousUpload: false,
        errorCode: null,
        objectPath: null,
        uploadUrl: null,
        progress: idleProgress,
      });
      return true;
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      operationId += 1;
      callbackOperationId = 0;
      const activeSession = session;
      session = null;
      if (activeSession && (state.status === "uploading" || state.status === "paused")) {
        try {
          await activeSession.pause();
        } catch {
          // Disposal never escalates authority or attempts remote termination.
        }
      }
      if (state.status === "uploading" || state.status === "paused") {
        settle(publish({
          ...state,
          status: "cancelled",
          message: "Контроллер закрыт; незавершённую передачу можно восстановить позже.",
          canRetry: false,
          canPause: false,
          canResume: false,
          errorCode: null,
        }));
      }
      listeners.clear();
      retainedFile = null;
      retainedCapability = null;
    },
  };
}
