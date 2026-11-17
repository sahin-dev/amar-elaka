import { APP_CONFIG, type IssueStatus } from "@/config/app-config";

export interface VoteLite {
  kind: "present" | "fixed";
  voterKey: string;
  /** True when the vote came from a signed-in account (not a guest). */
  isAccount: boolean;
  createdAt: Date;
}

export interface StatusInput {
  status: IssueStatus;
  /** Votes cast in the issue's current round only. */
  votes: VoteLite[];
  now?: Date;
}

export interface StatusResult {
  status: IssueStatus;
  /** True when the round should advance (on resolve / reopen) so people can vote again. */
  advanceRound: boolean;
}

export type CommunityCfg = {
  verifyThreshold: number;
  resolutionThreshold: number;
  resolutionWindowHours: number;
  reopenThreshold: number;
  fixedVoteRequiresAccount: boolean;
};

function distinct(votes: VoteLite[]): number {
  return new Set(votes.map((v) => v.voterKey)).size;
}

/**
 * Community status machine. Pure and deterministic so it is easy to test.
 *
 * - archived / under_review are moderator-controlled and never change here.
 * - A single vote can never resolve an issue (threshold is clamped to >= 2).
 * - Resolution needs N distinct qualifying "fixed" reports inside the window,
 *   and at least as many fixed reports as "present" confirmations in that window.
 * - A resolved issue reopens when N distinct "present" confirmations arrive
 *   in the post-resolution round.
 */
export function computeStatus(input: StatusInput, cfg: CommunityCfg = APP_CONFIG.community): StatusResult {
  const { status, votes } = input;
  const now = input.now ?? new Date();
  if (status === "archived" || status === "under_review") return { status, advanceRound: false };

  const resolutionThreshold = Math.max(2, cfg.resolutionThreshold);
  const windowStart = now.getTime() - cfg.resolutionWindowHours * 3_600_000;

  const present = votes.filter((v) => v.kind === "present");
  const fixedInWindow = votes.filter(
    (v) => v.kind === "fixed" && v.createdAt.getTime() >= windowStart && (!cfg.fixedVoteRequiresAccount || v.isAccount),
  );
  const presentInWindow = present.filter((v) => v.createdAt.getTime() >= windowStart);

  if (status === "community_resolved") {
    if (distinct(present) >= Math.max(1, cfg.reopenThreshold)) {
      return { status: "community_verified", advanceRound: true };
    }
    return { status, advanceRound: false };
  }

  const fixedCount = distinct(fixedInWindow);
  if (fixedCount >= resolutionThreshold && fixedCount >= distinct(presentInWindow)) {
    return { status: "community_resolved", advanceRound: true };
  }

  if (distinct(present) >= cfg.verifyThreshold) return { status: "community_verified", advanceRound: false };
  return { status, advanceRound: false };
}

export function isOpenStatus(s: IssueStatus): boolean {
  return s === "reported" || s === "community_verified" || s === "under_review";
}
