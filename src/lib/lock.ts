import fs from 'fs';
import crypto from 'crypto';
import { logger } from './logger';
import { resolvePath } from '../utils/file';

const LOCK_FILE = '.harness.lock';

export interface LockInfo {
  pid: number;
  timestamp: number;
  owner: string;
  token?: string;
}

let heldLock: LockInfo | null = null;

export function acquireLock(owner: string, timeout: number = 5000): boolean {
  const lockPath = resolvePath(LOCK_FILE);
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const lockInfo: LockInfo = {
        pid: process.pid,
        timestamp: Date.now(),
        owner,
        token: crypto.randomUUID(),
      };

      fs.writeFileSync(lockPath, JSON.stringify(lockInfo), { flag: 'wx' });
      heldLock = lockInfo;
      logger.debug(`Lock acquired by ${owner} (pid: ${process.pid})`);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        logger.error(`Failed to acquire lock: ${(error as Error).message}`);
        return false;
      }

      const existingLock = readLockFile(lockPath);
      if (existingLock && isStaleLock(existingLock)) {
        logger.warn(`Detected stale lock, removing...`);
        removeLockIfUnchanged(lockPath, existingLock);
        continue;
      }

      logger.debug(`Lock held by ${existingLock?.owner} (pid: ${existingLock?.pid}), waiting...`);
      sleep(100);
    }
  }

  logger.error(`Timeout waiting for lock (${timeout}ms)`);
  return false;
}

export function releaseLock(): void {
  const lockPath = resolvePath(LOCK_FILE);
  const expected = heldLock;
  if (!expected) return;
  try {
    if (!removeLockIfUnchanged(lockPath, expected)) return;
    heldLock = null;
    logger.debug(`Lock released by pid: ${process.pid}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(`Failed to release lock: ${(error as Error).message}`);
    }
  }
}

export function isLocked(): boolean {
  const lockPath = resolvePath(LOCK_FILE);
  return fs.existsSync(lockPath);
}

export function getLockOwner(): string | null {
  const lockPath = resolvePath(LOCK_FILE);
  const lockInfo = readLockFile(lockPath);
  return lockInfo?.owner ?? null;
}

function readLockFile(lockPath: string): LockInfo | null {
  try {
    const content = fs.readFileSync(lockPath, 'utf8');
    return JSON.parse(content) as LockInfo;
  } catch {
    return null;
  }
}

function isStaleLock(lockInfo: LockInfo, maxAge: number = 30000): boolean {
  const age = Date.now() - lockInfo.timestamp;
  if (age > maxAge) {
    return true;
  }

  try {
    process.kill(lockInfo.pid, 0);
    return false;
  } catch {
    return true;
  }
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function sameLock(left: LockInfo | null, right: LockInfo): boolean {
  if (!left) return false;
  if (left.token || right.token) return left.token === right.token;
  return left.pid === right.pid && left.timestamp === right.timestamp && left.owner === right.owner;
}

function removeLockIfUnchanged(lockPath: string, expected: LockInfo): boolean {
  const current = readLockFile(lockPath);
  if (!sameLock(current, expected)) return false;
  try {
    fs.unlinkSync(lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export function withLock<T>(owner: string, fn: () => T): T | null {
  if (!acquireLock(owner)) {
    return null;
  }

  try {
    return fn();
  } finally {
    releaseLock();
  }
}

export async function withLockAsync<T>(owner: string, fn: () => Promise<T>): Promise<T | null> {
  if (!acquireLock(owner)) {
    return null;
  }

  try {
    return await fn();
  } finally {
    releaseLock();
  }
}
