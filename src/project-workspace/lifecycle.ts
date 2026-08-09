import { projectSupportingTextWordCount } from "./policy.ts";

export type TusTransitionKind = "pause" | "resume" | "cancel";

export interface TransitionLease {
  readonly id: number;
  readonly kind: TusTransitionKind;
}

export class TransitionLeaseOwner {
  private sequence = 0;
  private activeLease: TransitionLease | null = null;

  get busy(): boolean {
    return this.activeLease !== null;
  }

  get active(): TransitionLease | null {
    return this.activeLease;
  }

  acquire(kind: TusTransitionKind): TransitionLease | null {
    if (this.activeLease) return null;
    const lease = Object.freeze({ id: ++this.sequence, kind });
    this.activeLease = lease;
    return lease;
  }

  release(lease: TransitionLease): boolean {
    if (this.activeLease?.id !== lease.id) return false;
    this.activeLease = null;
    return true;
  }
}

interface ResumeReadySnapshot {
  readonly canResume: boolean;
}

export function startTusResumeTransition<T>({
  owner,
  getSnapshot,
  resume,
  onSettled,
  onRejected,
}: {
  owner: TransitionLeaseOwner;
  getSnapshot: () => ResumeReadySnapshot;
  resume: () => Promise<T>;
  onSettled: (value: T) => void | Promise<void>;
  onRejected: () => void | Promise<void>;
}): boolean {
  if (!getSnapshot().canResume) return false;
  const lease = owner.acquire("resume");
  if (!lease) return false;

  let pending: Promise<T>;
  try {
    pending = resume();
  } catch {
    owner.release(lease);
    void onRejected();
    return true;
  }

  // resume() publishes `uploading` synchronously. The transfer promise remains
  // pending, but the short control-transition lease must not remain held.
  owner.release(lease);
  void pending.then(onSettled, onRejected);
  return true;
}

export function canStartTusTransition(
  snapshot: {
    readonly status: string;
    readonly canPause: boolean;
    readonly canResume: boolean;
  },
  transition: TusTransitionKind,
): boolean {
  if (transition === "pause") return snapshot.canPause;
  if (transition === "resume") return snapshot.canResume;
  return snapshot.status === "uploading" || snapshot.status === "paused";
}

export function learnerWorkspaceIdentity({
  projectCode,
  editableVersionId,
  currentVersionId,
}: {
  projectCode: string;
  editableVersionId: string | null;
  currentVersionId: string | null;
}): string {
  return `${projectCode}:${editableVersionId ?? currentVersionId ?? "none"}`;
}

export interface WorkspaceOperationToken {
  readonly identity: string;
  readonly generation: number;
}

export class WorkspaceOperationGuard {
  private generation = 0;
  private active = true;
  private readonly identity: string;

  constructor(identity: string) {
    this.identity = identity;
  }

  capture(): WorkspaceOperationToken {
    return Object.freeze({ identity: this.identity, generation: this.generation });
  }

  invalidate(): void {
    this.generation += 1;
    this.active = false;
  }

  isCurrent(token: WorkspaceOperationToken): boolean {
    return this.active
      && token.identity === this.identity
      && token.generation === this.generation;
  }
}

function normalizeWorkspaceText(value: string): string {
  return value.trim();
}

export function learnerTextReadiness({
  localLearnerNote,
  persistedLearnerNote,
  localSupportingText,
  persistedSupportingText,
  supportingTextMinWords,
  supportingTextMaxWords,
}: {
  localLearnerNote: string;
  persistedLearnerNote: string;
  localSupportingText: string;
  persistedSupportingText: string;
  supportingTextMinWords: number;
  supportingTextMaxWords: number;
}): {
  hasUnsavedText: boolean;
  persistedSupportingTextReady: boolean;
  persistedSupportingTextWordCount: number;
} {
  const hasUnsavedText = normalizeWorkspaceText(localLearnerNote)
      !== normalizeWorkspaceText(persistedLearnerNote)
    || normalizeWorkspaceText(localSupportingText)
      !== normalizeWorkspaceText(persistedSupportingText);
  const persistedSupportingTextWordCount = projectSupportingTextWordCount(
    persistedSupportingText,
  );
  const persistedSupportingTextReady = supportingTextMaxWords <= 0 || (
    persistedSupportingTextWordCount >= supportingTextMinWords
    && persistedSupportingTextWordCount <= supportingTextMaxWords
  );
  return {
    hasUnsavedText,
    persistedSupportingTextReady,
    persistedSupportingTextWordCount,
  };
}

export function staffReviewDraftKey(versionId: string): string {
  return versionId;
}

export type TransferCleanupEvent =
  | {
      kind: "finalization";
      status:
        | "success"
        | "auth-required"
        | "invalid"
        | "denied"
        | "rejected"
        | "cleanup-failed"
        | "error";
    }
  | { kind: "cancel"; confirmed: boolean };

export function shouldClearTerminalTransfer(
  event: TransferCleanupEvent,
): boolean {
  if (event.kind === "cancel") return event.confirmed;
  return event.status === "success"
    || event.status === "rejected"
    || event.status === "denied";
}
