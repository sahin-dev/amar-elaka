import type { IssueStatus, ModerationState } from "@/config/app-config";
import type { ModerationAction } from "@/lib/validation";

export interface ModerationSubject {
  status: IssueStatus;
  moderationState: ModerationState;
  previousStatus: IssueStatus | null;
  openFlags: number;
}

export interface ModerationPlan {
  set: Partial<{
    status: IssueStatus;
    moderationState: ModerationState;
    previousStatus: IssueStatus | null;
    possibleDuplicateOf: string[];
  }>;
  /** Re-run the community status machine after applying `set`. */
  recompute: boolean;
  /** What to do with open flags. */
  flags: "keep" | "dismiss" | "action";
  /** Public history entry, if the change is publicly visible. */
  publicUpdate: "archived" | "restored" | "under_review" | "review_cleared" | "merged" | null;
  from: string;
  to: string;
}

export type PlanResult = { ok: true; plan: ModerationPlan } | { ok: false; reason: string };

/**
 * Pure transition rules for moderator actions. Moderation state (visibility)
 * and public status are deliberately separate dimensions.
 */
export function planModerationAction(s: ModerationSubject, action: ModerationAction): PlanResult {
  const fail = (reason: string): PlanResult => ({ ok: false, reason });
  const ok = (plan: Omit<ModerationPlan, "flags"> & { flags?: ModerationPlan["flags"] }): PlanResult => ({
    ok: true,
    plan: { flags: "keep", ...plan },
  });

  if (s.moderationState === "merged" && action !== "approve") return fail("Merged reports cannot be changed.");
  if (s.moderationState === "removed") return fail("This report was removed by its author.");

  switch (action) {
    case "approve":
      if (s.moderationState === "merged") return fail("Merged reports cannot be approved.");
      return ok({
        set: { moderationState: "visible", possibleDuplicateOf: [] },
        recompute: false,
        publicUpdate: null,
        from: s.moderationState,
        to: "visible",
      });
    case "hide":
      if (s.moderationState === "hidden") return fail("Already hidden.");
      return ok({ set: { moderationState: "hidden" }, recompute: false, flags: "action", publicUpdate: null, from: s.moderationState, to: "hidden" });
    case "reject":
      if (s.moderationState === "rejected") return fail("Already rejected.");
      return ok({ set: { moderationState: "rejected" }, recompute: false, flags: "action", publicUpdate: null, from: s.moderationState, to: "rejected" });
    case "merge":
      return ok({ set: { moderationState: "merged" }, recompute: false, flags: "action", publicUpdate: "merged", from: s.moderationState, to: "merged" });
    case "archive":
      if (s.status === "archived") return fail("Already archived.");
      return ok({
        set: { status: "archived", previousStatus: s.status === "under_review" ? s.previousStatus : s.status },
        recompute: false,
        flags: "action",
        publicUpdate: "archived",
        from: s.status,
        to: "archived",
      });
    case "restore": {
      if (s.status !== "archived") return fail("Only archived reports can be restored.");
      const to = s.previousStatus ?? "reported";
      return ok({ set: { status: to, previousStatus: null }, recompute: true, publicUpdate: "restored", from: s.status, to });
    }
    case "mark_under_review":
      if (s.status === "under_review") return fail("Already under review.");
      if (s.status === "archived") return fail("Archived reports cannot be reviewed.");
      return ok({
        set: { status: "under_review", previousStatus: s.status },
        recompute: false,
        publicUpdate: "under_review",
        from: s.status,
        to: "under_review",
      });
    case "clear_review": {
      if (s.status !== "under_review") return fail("This report is not under review.");
      const to = s.previousStatus ?? "reported";
      return ok({
        set: { status: to, previousStatus: null },
        recompute: true,
        flags: "dismiss",
        publicUpdate: "review_cleared",
        from: s.status,
        to,
      });
    }
    case "dismiss_flags":
      if (s.openFlags === 0) return fail("There are no open flags.");
      return ok({ set: {}, recompute: false, flags: "dismiss", publicUpdate: null, from: "flags_open", to: "flags_dismissed" });
  }
}
