import { z } from "zod";
import { APP_CONFIG, CATEGORY_IDS, ISSUE_STATUSES } from "@/config/app-config";
import { countLinks, detectPersonalInfo } from "@/lib/personal-info";

const R = APP_CONFIG.reports;
const B = APP_CONFIG.bounds;

/** Collapse whitespace and strip control characters from user text. */
export function cleanText(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim();
}

const text = (min: number, max: number) =>
  z
    .string({ required_error: "Required" })
    .transform(cleanText)
    .pipe(z.string().min(min, `Must be at least ${min} characters`).max(max, `Must be at most ${max} characters`));

export const uuidSchema = z.string().uuid("Invalid ID");

export const latSchema = z.coerce.number().finite().min(B.minLat, "Location must be in Bangladesh").max(B.maxLat, "Location must be in Bangladesh");
export const lngSchema = z.coerce.number().finite().min(B.minLng, "Location must be in Bangladesh").max(B.maxLng, "Location must be in Bangladesh");

/** Report creation. Photo is validated separately (binary). */
export const createReportSchema = z
  .object({
    category: z.enum(CATEGORY_IDS, { errorMap: () => ({ message: "Choose a category" }) }),
    title: text(R.titleMin, R.titleMax),
    description: z
      .string()
      .optional()
      .default("")
      .transform(cleanText)
      .pipe(z.string().max(R.descriptionMax, `Must be at most ${R.descriptionMax} characters`)),
    lat: latSchema,
    lng: lngSchema,
    /** User acknowledged the possible-duplicate warning and wants to submit anyway. */
    acknowledgeDuplicate: z
      .union([z.boolean(), z.literal("true"), z.literal("false"), z.literal("on")])
      .optional()
      .transform((v) => v === true || v === "true" || v === "on"),
    /** Honeypot: real people never fill this hidden field. */
    website: z.string().optional().default(""),
  })
  .superRefine((v, ctx) => {
    const all = `${v.title}\n${v.description}`;
    const pii = detectPersonalInfo(all);
    if (pii.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [detectPersonalInfo(v.title).length ? "title" : "description"],
        message: "Remove phone numbers, email addresses or ID numbers before submitting",
      });
    }
    if (countLinks(all) > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["description"], message: "Links are not allowed in reports" });
    }
  });
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const voteSchema = z.object({ kind: z.enum(["present", "fixed"]) });

const pollOptionSchema = z.string().transform(cleanText).pipe(z.string().min(1, "Option is required").max(80));
export const createPollSchema = z.object({
  topic: z.enum(["government", "society", "local", "other"]),
  question: z.string().transform(cleanText).pipe(z.string().min(8).max(180)),
  context: z.string().optional().default("").transform(cleanText).pipe(z.string().max(1000)),
  sourceUrl: z.string().optional().default("").transform((s) => s.trim()).pipe(z.string().max(500)).refine((s) => {
    if (!s) return true;
    try { return ["http:", "https:"].includes(new URL(s).protocol); } catch { return false; }
  }, "Enter a full http or https link"),
  options: z.array(pollOptionSchema).min(2).max(5),
  closesAt: z.string().optional().default("").transform((s) => s.trim()).refine((s) => !s || Number.isFinite(Date.parse(s)), "Enter a valid closing date"),
}).superRefine((v, ctx) => {
  const normalized = v.options.map((x) => x.toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Each option must be different" });
  if (v.closesAt && Date.parse(v.closesAt) <= Date.now()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["closesAt"], message: "Closing time must be in the future" });
});
export type CreatePollInput = z.infer<typeof createPollSchema>;

export const pollVoteSchema = z.object({ optionId: uuidSchema });
export const pollStatusSchema = z.object({ status: z.enum(["open", "closed"]) });

export const FLAG_REASONS = [
  "inaccurate",
  "duplicate",
  "personal_info",
  "offensive",
  "spam",
  "wrong_location",
  "correction_request",
  "other",
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export const flagSchema = z.object({
  reason: z.enum(FLAG_REASONS),
  details: z.string().optional().default("").transform(cleanText).pipe(z.string().max(500)),
});

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const password = z.string().min(10, "Use at least 10 characters").max(128, "Use at most 128 characters");

export const signupSchema = z.object({
  email,
  password,
  displayName: z.string().optional().default("").transform(cleanText).pipe(z.string().max(40)),
  acceptGuidelines: z.literal(true, { errorMap: () => ({ message: "You must accept the community guidelines" }) }),
});

export const loginSchema = z.object({ email, password: z.string().min(1, "Required").max(128) });
export const verifyEmailSchema = z.object({ token: z.string().min(32).max(200) });

export const updateProfileSchema = z.object({
  displayName: z.string().transform(cleanText).pipe(z.string().max(40)).optional(),
  locale: z.enum(["en", "bn"]).optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Required").max(128),
  removeReports: z.boolean().default(false),
});

export const MODERATION_ACTIONS = [
  "approve",
  "hide",
  "reject",
  "merge",
  "archive",
  "restore",
  "mark_under_review",
  "clear_review",
  "dismiss_flags",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const moderationActionSchema = z
  .object({
    action: z.enum(MODERATION_ACTIONS),
    note: z.string().optional().default("").transform(cleanText).pipe(z.string().max(1000)),
    targetIssueId: uuidSchema.optional(),
  })
  .refine((v) => v.action !== "merge" || !!v.targetIssueId, { path: ["targetIssueId"], message: "Choose the issue to merge into" });

export const photoModerationSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().optional().default("").transform(cleanText).pipe(z.string().max(1000)),
});

export const listIssuesQuerySchema = z.object({
  bbox: z.string().optional(),
  category: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean) : []))
    .pipe(z.array(z.enum(CATEGORY_IDS)).max(CATEGORY_IDS.length)),
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean) : []))
    .pipe(z.array(z.enum(ISSUE_STATUSES)).max(ISSUE_STATUSES.length)),
  area: z.string().max(80).regex(/^[a-z0-9-]*$/).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(APP_CONFIG.pagination.maxPageSize).default(APP_CONFIG.pagination.pageSize),
  near: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return undefined;
      const [lat, lng] = s.split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid near" });
        return z.NEVER;
      }
      return { lat: lat!, lng: lng! };
    }),
});
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;

/** Turn a ZodError into a flat { field: message } map for forms. */
export function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
