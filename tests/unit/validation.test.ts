import { describe, expect, it } from "vitest";
import { createReportSchema, flagSchema, listIssuesQuerySchema, moderationActionSchema, signupSchema } from "@/lib/validation";
import { detectPersonalInfo } from "@/lib/personal-info";

const valid = {
  category: "pothole",
  title: "Deep pothole near the bus stop",
  description: "Motorbikes swerve around it.",
  lat: "23.8012",
  lng: "90.3678",
};

describe("report validation", () => {
  it("accepts a valid report and coerces coordinates", () => {
    const r = createReportSchema.parse(valid);
    expect(r.lat).toBeCloseTo(23.8012);
    expect(r.acknowledgeDuplicate).toBe(false);
  });

  it("requires a known category", () => {
    expect(createReportSchema.safeParse({ ...valid, category: "aliens" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...valid, category: undefined }).success).toBe(false);
  });

  it("enforces title length after trimming whitespace", () => {
    expect(createReportSchema.safeParse({ ...valid, title: "   short   " }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...valid, title: "x".repeat(101) }).success).toBe(false);
  });

  it("rejects locations outside Bangladesh and non-numeric coordinates", () => {
    expect(createReportSchema.safeParse({ ...valid, lat: "51.5", lng: "-0.12" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...valid, lat: "abc" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...valid, lat: undefined }).success).toBe(false);
  });

  it("rejects phone numbers, emails and links in public text", () => {
    expect(createReportSchema.safeParse({ ...valid, description: "Call 01712-345678 for details" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...valid, description: "ফোন ০১৭১২৩৪৫৬৭৮" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...valid, description: "mail me a@b.com" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...valid, description: "see https://spam.example" }).success).toBe(false);
  });

  it("allows ordinary numbers such as road numbers", () => {
    expect(detectPersonalInfo("Road 12, House 7, near Section 10")).toEqual([]);
    expect(createReportSchema.safeParse({ ...valid, title: "Pothole on Road 12, Section 10" }).success).toBe(true);
  });

  it("strips control characters", () => {
    const r = createReportSchema.parse({ ...valid, title: "Broken light\u0000 at corner" });
    expect(r.title).toBe("Broken light at corner");
  });

  it("caps description length", () => {
    expect(createReportSchema.safeParse({ ...valid, description: "a".repeat(1001) }).success).toBe(false);
  });
});

describe("other schemas", () => {
  it("validates flag reasons", () => {
    expect(flagSchema.safeParse({ reason: "spam" }).success).toBe(true);
    expect(flagSchema.safeParse({ reason: "because" }).success).toBe(false);
  });

  it("requires a target for merge", () => {
    expect(moderationActionSchema.safeParse({ action: "merge" }).success).toBe(false);
    expect(moderationActionSchema.safeParse({ action: "hide" }).success).toBe(true);
  });

  it("requires accepting guidelines and a reasonable password at signup", () => {
    expect(signupSchema.safeParse({ email: "a@b.co", password: "short", acceptGuidelines: true }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", password: "long enough pw", acceptGuidelines: false }).success).toBe(false);
    const ok = signupSchema.parse({ email: "  A@B.CO ", password: "long enough pw", acceptGuidelines: true });
    expect(ok.email).toBe("a@b.co");
  });

  it("bounds list pagination", () => {
    expect(listIssuesQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(listIssuesQuerySchema.parse({}).page).toBe(1);
    expect(listIssuesQuerySchema.safeParse({ category: "pothole,nope" }).success).toBe(false);
    expect(listIssuesQuerySchema.safeParse({ area: "../etc" }).success).toBe(false);
  });
});
