export enum ErrorCode {
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  STATE_NOT_FOUND = 'STATE_NOT_FOUND',
  STATE_INVALID = 'STATE_INVALID',
  CHANGE_NOT_FOUND = 'CHANGE_NOT_FOUND',
  CHANGE_INVALID = 'CHANGE_INVALID',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  INTEGRATION_NOT_FOUND = 'INTEGRATION_NOT_FOUND',
  INTEGRATION_INVALID = 'INTEGRATION_INVALID',
  KNOWLEDGE_NOT_FOUND = 'KNOWLEDGE_NOT_FOUND',
  KNOWLEDGE_INVALID = 'KNOWLEDGE_INVALID',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_WRITE_FAILED = 'FILE_WRITE_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  GIT_ERROR = 'GIT_ERROR',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNSUPPORTED_TOOL = 'UNSUPPORTED_TOOL',
  UNSUPPORTED_MODE = 'UNSUPPORTED_MODE',
  UNSUPPORTED_TYPE = 'UNSUPPORTED_TYPE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class HarnessError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public cause?: Error,
  ) {
    super(message);
    this.name = 'HarnessError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      stack: this.stack,
    };
  }
}

export class ValidationError extends HarnessError {
  constructor(
    message: string,
    public issues: string[] = [],
  ) {
    super(ErrorCode.VALIDATION_FAILED, message);
    this.name = 'ValidationError';
  }
}

export class FileError extends HarnessError {
  constructor(
    code: ErrorCode,
    message: string,
    public filePath: string,
    cause?: Error,
  ) {
    super(code, message, cause);
    this.name = 'FileError';
  }
}

export class ChangeError extends HarnessError {
  constructor(
    code: ErrorCode,
    message: string,
    public change?: string,
    cause?: Error,
  ) {
    super(code, message, cause);
    this.name = 'ChangeError';
  }
}

export function handleError(error: unknown): void {
  if (error instanceof HarnessError) {
    console.error(`[${error.code}] ${error.message}`);
    if (error instanceof ValidationError && error.issues.length) {
      for (const issue of error.issues) {
        console.error(`  - ${issue}`);
      }
    }
  } else if (error instanceof Error) {
    console.error(`[ERROR] ${error.message}`);
  } else {
    console.error(`[ERROR] ${String(error)}`);
  }
}

export function safeExecute<T>(fn: () => T, fallback: T, errorCode?: ErrorCode): T {
  try {
    return fn();
  } catch (error) {
    if (errorCode) {
      console.warn(`[${errorCode}] ${(error as Error).message}`);
    }
    return fallback;
  }
}
