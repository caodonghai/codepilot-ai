import fs from 'fs';
import os from 'os';
import path from 'path';

export default function setup() {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codepilot-ai-tests-'));
  process.env.CODEPILOT_ROOT = testRoot;

  return () => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    delete process.env.CODEPILOT_ROOT;
  };
}
