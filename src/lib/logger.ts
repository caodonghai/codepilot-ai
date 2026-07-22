export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level?: LogLevel;
  color?: boolean;
  timestamp?: boolean;
}

const colors: Record<LogLevel, string> = {
  debug: '\x1b[34m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const levelSymbols: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private config: LoggerConfig;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: 'info',
      color: true,
      timestamp: true,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = this.config.level || 'info';
    return levelPriority[level] >= levelPriority[currentLevel];
  }

  private format(level: LogLevel, ...args: unknown[]): string[] {
    const parts: string[] = [];

    if (this.config.timestamp) {
      const now = new Date();
      const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);
      parts.push(`[${timestamp}]`);
    }

    if (this.config.color) {
      parts.push(`${colors[level]}${levelSymbols[level]}\x1b[0m`);
    } else {
      parts.push(levelSymbols[level]);
    }

    return [
      ...parts,
      ...args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg))),
    ];
  }

  debug(...args: unknown[]): void {
    if (!this.shouldLog('debug')) return;
    console.debug(...this.format('debug', ...args));
  }

  info(...args: unknown[]): void {
    if (!this.shouldLog('info')) return;
    console.log(...this.format('info', ...args));
  }

  warn(...args: unknown[]): void {
    if (!this.shouldLog('warn')) return;
    console.warn(...this.format('warn', ...args));
  }

  error(...args: unknown[]): void {
    if (!this.shouldLog('error')) return;
    console.error(...this.format('error', ...args));
  }

  success(message: string): void {
    if (!this.shouldLog('info')) return;
    const prefix = this.config.color ? '\x1b[32m✓\x1b[0m' : '✓';
    console.log(`${prefix} ${message}`);
  }

  step(message: string): void {
    if (!this.shouldLog('info')) return;
    const prefix = this.config.color ? '\x1b[36m→\x1b[0m' : '→';
    console.log(`${prefix} ${message}`);
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level || 'info';
  }

  static create(config?: LoggerConfig): Logger {
    return new Logger(config);
  }
}

export const logger = new Logger();

export function setLogLevel(level: LogLevel): void {
  if (['debug', 'info', 'warn', 'error'].includes(level)) {
    logger.setLevel(level);
  }
}

export function getLogLevel(): LogLevel {
  return logger.getLevel();
}

export { logger as default };
