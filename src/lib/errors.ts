export class HarnessError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'HarnessError';
    this.code = code;
    this.details = details;
  }
}

export class ConfigError extends HarnessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

export class ChangeError extends HarnessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CHANGE_ERROR', details);
    this.name = 'ChangeError';
  }
}

export class IntegrationError extends HarnessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INTEGRATION_ERROR', details);
    this.name = 'IntegrationError';
  }
}

export class KnowledgeError extends HarnessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'KNOWLEDGE_ERROR', details);
    this.name = 'KnowledgeError';
  }
}

export class TemplateError extends HarnessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TEMPLATE_ERROR', details);
    this.name = 'TemplateError';
  }
}

export class ValidationError extends HarnessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class LockError extends HarnessError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'LOCK_ERROR', details);
    this.name = 'LockError';
  }
}

export interface ErrorHandlerOptions {
  exitOnError?: boolean;
  showDetails?: boolean;
}

export class ErrorHandler {
  private options: ErrorHandlerOptions;

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      exitOnError: true,
      showDetails: true,
      ...options,
    };
  }

  handle(error: unknown): void {
    if (error instanceof HarnessError) {
      this.handleHarnessError(error);
    } else if (error instanceof Error) {
      this.handleGenericError(error);
    } else {
      this.handleUnknownError(error);
    }

    if (this.options.exitOnError) {
      process.exitCode = 1;
    }
  }

  private handleHarnessError(error: HarnessError): void {
    console.error(`\n\x1b[31m${error.name}: ${error.message}\x1b[0m`);
    console.error(`  Code: \x1b[33m${error.code}\x1b[0m`);

    if (this.options.showDetails && error.details) {
      console.error(`  Details:`);
      for (const [key, value] of Object.entries(error.details)) {
        console.error(`    ${key}: ${JSON.stringify(value, null, 2)}`);
      }
    }
  }

  private handleGenericError(error: Error): void {
    console.error(`\n\x1b[31mError: ${error.message}\x1b[0m`);
    if (this.options.showDetails && error.stack) {
      console.error(`  Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
    }
  }

  private handleUnknownError(error: unknown): void {
    console.error(`\n\x1b[31mUnknown error: ${JSON.stringify(error)}\x1b[0m`);
  }

  static create(options?: ErrorHandlerOptions): ErrorHandler {
    return new ErrorHandler(options);
  }
}

export const errorHandler = new ErrorHandler();

export function handleError(error: unknown): void {
  errorHandler.handle(error);
}

export function wrapAsync<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((error) => {
    handleError(error);
    throw error;
  });
}

export function wrapSync<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    handleError(error);
    throw error;
  }
}

export { errorHandler as default };
