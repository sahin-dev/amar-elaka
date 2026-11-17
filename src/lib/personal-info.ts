/**
 * Lightweight detection of personal data people should not publish.
 * This is a safety net, not a guarantee; moderators remain the backstop.
 */
const BD_PHONE = /(?:\+?88[\s-]?)?0?1[3-9](?:[\s-]?\d){8}/;
const BN_DIGIT_PHONE = /(?:\+?৮৮[\s-]?)?০?১[৩-৯](?:[\s-]?[০-৯]){8}/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Bangladesh NID numbers are 10, 13 or 17 digits.
const NID = /(?:^|\D)(?:\d{17}|\d{13}|\d{10})(?:\D|$)/;

export type PersonalInfoKind = "phone" | "email" | "id_number";

export function detectPersonalInfo(text: string): PersonalInfoKind[] {
  const found: PersonalInfoKind[] = [];
  if (BD_PHONE.test(text) || BN_DIGIT_PHONE.test(text)) found.push("phone");
  if (EMAIL.test(text)) found.push("email");
  if (!found.includes("phone") && NID.test(text)) found.push("id_number");
  return found;
}

const URL_RE = /https?:\/\/|www\./gi;
export function countLinks(text: string): number {
  return (text.match(URL_RE) ?? []).length;
}
