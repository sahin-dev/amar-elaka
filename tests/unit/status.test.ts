import { describe, expect, it } from "vitest";
import { computeStatus, type CommunityCfg, type VoteLite } from "@/lib/status";
import { planModerationAction } from "@/lib/moderation-rules";

const cfg: CommunityCfg = {
  verifyThreshold: 2,
  resolutionThreshold: 2,
  resolutionWindowHours: 48,
  reopenThreshold: 2,
  fixedVoteRequiresAccount: true,
};
const now = new Date("2026-06-10T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);
const v = (kind: VoteLite["kind"], key: string, hoursAgo = 1, isAccount = true): VoteLite => ({
  kind,
  voterKey: key,
  isAccount,
  createdAt: ago(hoursAgo),
});

describe("community status machine", () => {
  it("stays Reported with a single confirmation", () => {
    expect(computeStatus({ status: "reported", votes: [v("present", "u:a")], now }, cfg).status).toBe("reported");
  });

  it("becomes Community verified after two distinct confirmations", () => {
    const r = computeStatus({ status: "reported", votes: [v("present", "u:a"), v("present", "g:b", 1, false)], now }, cfg);
    expect(r).toEqual({ status: "community_verified", advanceRound: false });
  });

  it("a single fixed vote never resolves, even if threshold is misconfigured to 1", () => {
    const r = computeStatus({ status: "reported", votes: [v("fixed", "u:a")], now }, { ...cfg, resolutionThreshold: 1 });
    expect(r.status).toBe("reported");
  });

  it("resolves with two account fixed reports within the window", () => {
    const r = computeStatus({ status: "community_verified", votes: [v("fixed", "u:a"), v("fixed", "u:b")], now }, cfg);
    expect(r).toEqual({ status: "community_resolved", advanceRound: true });
  });

  it("ignores guest fixed reports when accounts are required", () => {
    const r = computeStatus({ status: "reported", votes: [v("fixed", "g:a", 1, false), v("fixed", "g:b", 1, false)], now }, cfg);
    expect(r.status).toBe("reported");
  });

  it("ignores fixed reports outside the 48h window", () => {
    const r = computeStatus({ status: "reported", votes: [v("fixed", "u:a", 60), v("fixed", "u:b", 1)], now }, cfg);
    expect(r.status).toBe("reported");
  });

  it("does not resolve while more people confirm it is still present", () => {
    const votes = [v("fixed", "u:a"), v("fixed", "u:b"), v("present", "u:c"), v("present", "u:d"), v("present", "u:e")];
    expect(computeStatus({ status: "community_verified", votes, now }, cfg).status).toBe("community_verified");
  });

  it("counts the same voter only once", () => {
    expect(computeStatus({ status: "reported", votes: [v("fixed", "u:a"), v("fixed", "u:a")], now }, cfg).status).toBe("reported");
  });

  it("reopens a resolved issue after credible new confirmations", () => {
    expect(computeStatus({ status: "community_resolved", votes: [v("present", "u:a")], now }, cfg).status).toBe("community_resolved");
    const r = computeStatus({ status: "community_resolved", votes: [v("present", "u:a"), v("present", "u:b")], now }, cfg);
    expect(r).toEqual({ status: "community_verified", advanceRound: true });
  });

  it("never changes moderator-controlled states", () => {
    const votes = [v("fixed", "u:a"), v("fixed", "u:b")];
    expect(computeStatus({ status: "archived", votes, now }, cfg).status).toBe("archived");
    expect(computeStatus({ status: "under_review", votes, now }, cfg).status).toBe("under_review");
  });
});

describe("moderation transition rules", () => {
  const base = { status: "reported" as const, moderationState: "visible" as const, previousStatus: null, openFlags: 2 };

  it("archive remembers the previous status and restore returns to it", () => {
    const a = planModerationAction({ ...base, status: "community_verified" }, "archive");
    expect(a.ok && a.plan.set).toEqual({ status: "archived", previousStatus: "community_verified" });
    const r = planModerationAction({ ...base, status: "archived", previousStatus: "community_verified" }, "restore");
    expect(r.ok && r.plan.set.status).toBe("community_verified");
  });

  it("rejects invalid transitions", () => {
    expect(planModerationAction({ ...base, status: "archived" }, "archive").ok).toBe(false);
    expect(planModerationAction(base, "restore").ok).toBe(false);
    expect(planModerationAction(base, "clear_review").ok).toBe(false);
    expect(planModerationAction({ ...base, openFlags: 0 }, "dismiss_flags").ok).toBe(false);
    expect(planModerationAction({ ...base, moderationState: "merged" }, "hide").ok).toBe(false);
  });

  it("hiding actions open flags; clearing review dismisses them and recomputes", () => {
    const h = planModerationAction(base, "hide");
    expect(h.ok && h.plan.flags).toBe("action");
    const c = planModerationAction({ ...base, status: "under_review", previousStatus: "reported" }, "clear_review");
    expect(c.ok && c.plan.flags).toBe("dismiss");
    expect(c.ok && c.plan.recompute).toBe(true);
  });

  it("moderation state and public status are independent", () => {
    const h = planModerationAction({ ...base, status: "community_verified" }, "hide");
    expect(h.ok && h.plan.set.status).toBeUndefined();
  });
});
