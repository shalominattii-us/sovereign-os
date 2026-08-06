export class CybercoreError extends Error {
  constructor(message, { code = "CYBERCORE_ERROR", details = null, cause = null } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

export class InputValidationError extends CybercoreError {
  constructor(message, details = null) {
    super(message, { code: "INPUT_VALIDATION_ERROR", details });
  }
}

export class StateTransitionError extends CybercoreError {
  constructor(message, details = null) {
    super(message, { code: "STATE_TRANSITION_ERROR", details });
  }
}

export class AuthorizationError extends CybercoreError {
  constructor(message, details = null) {
    super(message, { code: "AUTHORIZATION_ERROR", details });
  }
}

export class StorageError extends CybercoreError {
  constructor(message, details = null, cause = null) {
    super(message, { code: "STORAGE_ERROR", details, cause });
  }
}
