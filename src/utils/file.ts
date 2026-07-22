import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { root } from '../config/constants';

export function resolvePath(...segments: string[]) {
  return path.join(root, ...segments);
}

export function exists(...segments: string[]) {
  return fs.existsSync(resolvePath(...segments));
}

export function ensureDir(...segments: string[]) {
  fs.mkdirSync(resolvePath(...segments), { recursive: true });
}

export function writeFileIfMissing(relativePath: string, content: string) {
  const filePath = resolvePath(relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

export function writeGeneratedFile(relativePath: string, content: string) {
  const filePath = resolvePath(relativePath);
  writeFileAtomic(filePath, content);
}

export function writeFileAtomic(filePath: string, content: string | Buffer) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx');
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function readText(relativePath: string) {
  return fs.readFileSync(resolvePath(relativePath), 'utf8');
}

export function resolveInsideRoot(relativePath: string) {
  const fullPath = path.resolve(root, relativePath);
  const rootPath = path.resolve(root);
  if (fullPath !== rootPath && !fullPath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Refusing path outside repository: ${relativePath}`);
  }
  return fullPath;
}
