export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "EMAIL_NOT_VERIFIED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BAD_ORIGIN"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  EMAIL_NOT_VERIFIED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  BAD_ORIGIN: 403,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** An error whose message is safe to show to the client (no DB internals). */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly retryAfter?: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { fields?: Record<string, string>; retryAfter?: number; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.fields = opts.fields;
    this.retryAfter = opts.retryAfter;
    this.details = opts.details;
  }
}

/** Shape every API error response uses. */
export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; fields?: Record<string, string>; details?: Record<string, unknown> };
}
