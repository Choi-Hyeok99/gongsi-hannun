export class InvalidInputError extends Error {
  readonly code = "INVALID_INPUT";
}

export class DataAccessError extends Error {
  readonly code = "DATA_ACCESS_ERROR";
}
