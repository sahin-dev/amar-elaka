import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { APP_CONFIG } from "@/config/app-config";
import { AppError } from "@/lib/errors";
import { fromGeoPoint } from "@/lib/geo";
import type { Locale } from "@/i18n";
import { getDummyHash, hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, type SessionUser } from "@/server/auth/session";
import { collections, getDb, isDuplicateKeyError } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import type { ProfileDoc } from "@/server/types";

export async function signup(
  input: { email: string; password: string; displayName: string },
  ctx: { ipKey: string; locale: Locale; now?: Date },
): Promise<{ user: SessionUser; token: string; expiresAt: Date; verificationSent: boolean }> {
  const now = ctx.now ?? new Date();
  const c = collections(await getDb());
  await enforceRateLimit(c.rateLimits, `signup:ip:${ctx.ipKey}`, APP_CONFIG.rateLimits.signupPerIp, now);

  const verificationToken = randomBytes(32).toString("base64url");
  const profile: ProfileDoc = {
    _id: randomUUID(),
    email: input.email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName,
    role: "resident",
    locale: ctx.locale,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    emailVerifiedAt: null,
    emailVerificationTokenHash: createHash("sha256").update(verificationToken).digest("hex"),
    emailVerificationExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  };
  try {
    await c.profiles.insertOne(profile);
  } catch (e) {
    if (isDuplicateKeyError(e)) throw new AppError("CONFLICT", "An account with this email already exists.", { fields: { email: "Already registered" } });
    throw e;
  }
  const session = await createSession(profile._id);
  const verificationSent = await sendVerificationEmail(profile.email, verificationToken, ctx.locale);
  return {
    user: { id: profile._id, email: profile.email, displayName: profile.displayName, role: profile.role, locale: profile.locale, emailVerified: false },
    verificationSent,
    ...session,
  };
}

export async function login(
  input: { email: string; password: string },
  ctx: { ipKey: string; now?: Date },
): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
  const now = ctx.now ?? new Date();
  const c = collections(await getDb());
  await enforceRateLimit(c.rateLimits, `login:ip:${ctx.ipKey}`, APP_CONFIG.rateLimits.loginPerIp, now);
  await enforceRateLimit(c.rateLimits, `login:email:${input.email}`, APP_CONFIG.rateLimits.loginPerEmail, now);

  const profile = await c.profiles.findOne({ email: input.email });
  // Verify against a dummy hash for unknown emails so timing does not reveal which emails exist.
  const ok = await verifyPassword(input.password, profile?.passwordHash ?? (await getDummyHash()));
  if (!profile || !ok) throw new AppError("UNAUTHENTICATED", "Email or password is incorrect.");

  await c.profiles.updateOne({ _id: profile._id }, { $set: { lastLoginAt: now } });
  const session = await createSession(profile._id);
  return {
    user: { id: profile._id, email: profile.email, displayName: profile.displayName, role: profile.role, locale: profile.locale, emailVerified: !!profile.emailVerifiedAt },
    ...session,
  };
}

/** A user may only ever update their own profile; the id comes from the session, never the request. */
export async function updateProfile(user: SessionUser, patch: { displayName?: string; locale?: Locale }): Promise<void> {
  const c = collections(await getDb());
  const $set: Partial<ProfileDoc> = { updatedAt: new Date() };
  if (patch.displayName !== undefined) $set.displayName = patch.displayName;
  if (patch.locale !== undefined) $set.locale = patch.locale;
  await c.profiles.updateOne({ _id: user.id }, { $set });
}

const hashVerificationToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function sendVerificationEmail(email: string, token: string, locale: Locale): Promise<boolean> {
  const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = locale === "bn" ? "AmarElaka ইমেইল যাচাই করুন" : "Verify your AmarElaka email";
  const html = locale === "bn"
    ? `<p>আপনার AmarElaka অ্যাকাউন্ট চালু করতে ইমেইলটি যাচাই করুন।</p><p><a href="${url}">ইমেইল যাচাই করুন</a></p><p>এই লিংকটি ২৪ ঘণ্টা পর মেয়াদোত্তীর্ণ হবে।</p>`
    : `<p>Verify your email to activate your AmarElaka account.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") return false;
    console.info(`[email-verification] ${url}`);
    return true;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject, html }),
    });
    return response.ok;
  } catch { return false; }
}

export async function resendVerification(user: SessionUser, ctx: { now?: Date; ipKey: string }): Promise<boolean> {
  const now = ctx.now ?? new Date();
  const c = collections(await getDb());
  await enforceRateLimit(c.rateLimits, `verification:user:${user.id}`, APP_CONFIG.rateLimits.verificationResendPerUser, now);
  await enforceRateLimit(c.rateLimits, `verification:ip:${ctx.ipKey}`, APP_CONFIG.rateLimits.verificationResendPerIp, now);
  const profile = await c.profiles.findOne({ _id: user.id });
  if (!profile || profile.emailVerifiedAt) return true;
  const token = randomBytes(32).toString("base64url");
  await c.profiles.updateOne({ _id: user.id, emailVerifiedAt: null }, { $set: {
    emailVerificationTokenHash: hashVerificationToken(token),
    emailVerificationExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    updatedAt: now,
  } });
  return sendVerificationEmail(profile.email, token, profile.locale);
}

export async function verifyEmail(token: string, now = new Date()): Promise<void> {
  const c = collections(await getDb());
  const result = await c.profiles.updateOne(
    { emailVerificationTokenHash: hashVerificationToken(token), emailVerificationExpiresAt: { $gt: now }, emailVerifiedAt: null },
    { $set: { emailVerifiedAt: now, updatedAt: now, emailVerificationTokenHash: null, emailVerificationExpiresAt: null } },
  );
  if (!result.modifiedCount) throw new AppError("CONFLICT", "This verification link is invalid, expired, or already used.");
}

export async function exportMyData(user: SessionUser) {
  const c = collections(await getDb());
  const profile = await c.profiles.findOne({ _id: user.id }, { projection: { passwordHash: 0, emailVerificationTokenHash: 0, emailVerificationExpiresAt: 0 } });
  const priv = await c.issuePrivate.find({ reporterId: user.id }).toArray();
  const ids = priv.map((p) => p._id);
  const [issues, exact, votes, flags] = await Promise.all([
    c.issues.find({ _id: { $in: ids } }).toArray(),
    c.issueExactLocations.find({ _id: { $in: ids } }).toArray(),
    c.issueVotes.find({ userId: user.id }).toArray(),
    c.issueFlags.find({ userId: user.id }).toArray(),
  ]);
  const exactById = new Map(exact.map((e) => [e._id, fromGeoPoint(e.location)]));
  return {
    exportedAt: new Date().toISOString(),
    profile,
    reports: issues.map((i) => ({
      id: i._id,
      category: i.category,
      title: i.title,
      description: i.description,
      status: i.status,
      visibility: i.moderationState,
      createdAt: i.createdAt,
      publicLocation: fromGeoPoint(i.location),
      exactLocation: exactById.get(i._id) ?? null,
    })),
    votes: votes.map((v) => ({ issueId: v.issueId, kind: v.kind, createdAt: v.createdAt })),
    flags: flags.map((f) => ({ issueId: f.issueId, reason: f.reason, details: f.details, createdAt: f.createdAt })),
  };
}

/**
 * Delete an account. Votes are kept but unlinked (so issue histories stay
 * consistent); reports are unlinked and optionally removed from public view.
 */
export async function deleteAccount(user: SessionUser, password: string, removeReports: boolean): Promise<void> {
  const c = collections(await getDb());
  const profile = await c.profiles.findOne({ _id: user.id });
  if (!profile) throw new AppError("NOT_FOUND", "Account not found.");
  if (!(await verifyPassword(password, profile.passwordHash))) {
    throw new AppError("UNAUTHENTICATED", "Password is incorrect.", { fields: { password: "Incorrect password" } });
  }
  const now = new Date();

  const priv = await c.issuePrivate.find({ reporterId: user.id }, { projection: { _id: 1 } }).toArray();
  const issueIds = priv.map((p) => p._id);
  if (removeReports && issueIds.length) {
    await c.issues.updateMany({ _id: { $in: issueIds }, moderationState: { $ne: "merged" } }, { $set: { moderationState: "removed", updatedAt: now } });
    await c.issueExactLocations.deleteMany({ _id: { $in: issueIds } });
    for (const id of issueIds) {
      await c.moderationEvents.insertOne({
        _id: randomUUID(),
        issueId: id,
        targetType: "issue",
        targetId: id,
        action: "account_deleted",
        actorId: "system",
        from: null,
        to: "removed",
        note: "Removed at the author's request during account deletion.",
        createdAt: now,
      });
    }
  }
  await c.issuePrivate.updateMany({ reporterId: user.id }, { $set: { reporterId: null } });

  // Unlink votes individually: each gets a fresh random key so the unique index still holds.
  const votes = await c.issueVotes.find({ userId: user.id }, { projection: { _id: 1 } }).toArray();
  for (const v of votes) {
    await c.issueVotes.updateOne({ _id: v._id }, { $set: { userId: null, voterKey: `d:${randomUUID()}` } });
  }
  const flags = await c.issueFlags.find({ userId: user.id }, { projection: { _id: 1 } }).toArray();
  for (const f of flags) {
    await c.issueFlags.updateOne({ _id: f._id }, { $set: { userId: null, flaggerKey: `d:${randomUUID()}` } });
  }
  await c.issuePhotos.updateMany({ uploadedBy: user.id }, { $set: { uploadedBy: null } });
  await c.sessions.deleteMany({ userId: user.id });
  await c.profiles.deleteOne({ _id: user.id });
}
