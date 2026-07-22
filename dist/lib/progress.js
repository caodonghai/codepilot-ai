"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logWarning = exports.logError = exports.logSuccess = exports.logStep = exports.ProgressBar = exports.Spinner = void 0;
class Spinner {
    constructor(message) {
        this.interval = null;
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.currentFrame = 0;
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
    update(message) {
        this.message = message;
    }
}
exports.Spinner = Spinner;
class ProgressBar {
    constructor(message, total, width = 20) {
        this.message = message;
        this.total = total;
        this.current = 0;
        this.width = width;
    }
    update(current, message) {
        this.current = Math.min(current, this.total);
        if (message)
            this.message = message;
        const percentage = Math.round((this.current / this.total) * 100);
        const filled = Math.round((this.current / this.total) * this.width);
        const bar = '█'.repeat(filled) + '░'.repeat(this.width - filled);
        process.stdout.write(`\r${this.message}: [${bar}] ${percentage}% (${this.current}/${this.total})`);
    }
    increment(message) {
        this.update(this.current + 1, message);
    }
    complete(message) {
        this.update(this.total, message);
        process.stdout.write('\n');
    }
}
exports.ProgressBar = ProgressBar;
function logStep(message, indent = 0) {
    const prefix = indent ? '  '.repeat(indent) + '├─ ' : '';
    console.log(`${prefix}${message}`);
}
exports.logStep = logStep;
function logSuccess(message, indent = 0) {
    const prefix = indent ? '  '.repeat(indent) + '├─ ' : '';
    console.log(`${prefix}✓ ${message}`);
}
exports.logSuccess = logSuccess;
function logError(message, indent = 0) {
    const prefix = indent ? '  '.repeat(indent) + '├─ ' : '';
    console.log(`${prefix}✗ ${message}`);
}
exports.logError = logError;
function logWarning(message, indent = 0) {
    const prefix = indent ? '  '.repeat(indent) + '├─ ' : '';
    console.log(`${prefix}⚠ ${message}`);
}
exports.logWarning = logWarning;
