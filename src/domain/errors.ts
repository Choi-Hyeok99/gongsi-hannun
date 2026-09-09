export class InvalidInputError extends Error {
  readonly code = "INVALID_INPUT";
}

export class DataAccessError extends Error {
  readonly code = "DATA_ACCESS_ERROR";
}

export type ExternalServiceErrorCode = "RATE_LIMITED" | "UNAVAILABLE" | "INVALID_RESPONSE" | "TIMEOUT";

export class ExternalServiceError extends Error {
  constructor(readonly code: ExternalServiceErrorCode, message: string) {
    super(message);
  }
}
