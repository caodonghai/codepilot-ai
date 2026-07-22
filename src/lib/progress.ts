export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private currentFrame = 0;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start() {
    this.currentFrame = 0;
    process.stdout.write(`\r${this.frames[0]} ${this.message}`);
    this.interval = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
    }, 100);
  }

  stop(success = true) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    const symbol = success ? '✓' : '✗';
    process.stdout.write(`\r${symbol} ${this.message}\n`);
  }

  update(message: string) {
    this.message = message;
  }
}

export class ProgressBar {
  private total: number;
  private current: number;
  private message: string;
  private width: number;

  constructor(message: string, total: number, width = 20) {
    this.message = message;
    this.total = total;
    this.current = 0;
    this.width = width;
  }

  update(current: number, message?: string) {
    this.current = Math.min(current, this.total);
    if (message) this.message = message;
    const percentage = Math.round((this.current / this.total) * 100);
    const filled = Math.round((this.current / this.total) * this.width);
    const bar = '█'.repeat(filled) + '░'.repeat(this.width - filled);
    process.stdout.write(`\r${this.message}: [${bar}] ${percentage}% (${this.current}/${this.total})`);
  }

  increment(message?: string) {
    this.update(this.current + 1, message);
  }

  complete(message?: string) {
    this.update(this.total, message);
    process.stdout.write('\n');
  }
}

export function logStep(message: string, indent = 0) {
  const prefix = indent ? '  '.repeat(indent) + '├─ ' : '';
  console.log(`${prefix}${message}`);
}

export function logSuccess(message: string, indent = 0) {
  const prefix = indent ? '  '.repeat(indent) + '├─ ' : '';
  console.log(`${prefix}✓ ${message}`);
}

export function logError(message: string, indent = 0) {
  const prefix = indent ? '  '.repeat(indent) + '├─ ' : '';
  console.log(`${prefix}✗ ${message}`);
}

export function logWarning(message: string, indent = 0) {
  const prefix = indent ? '  '.repeat(indent) + '├─ ' : '';
  console.log(`${prefix}⚠ ${message}`);
}
