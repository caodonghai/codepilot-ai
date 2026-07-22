import { writeGeneratedFile, ensureDir } from '../../utils/file';
import { timestampForFile } from '../../utils/string';
import { loadHarnessConfig, saveHarnessConfig, loadHarnessState } from '../../lib/state';

export function setCurrentChange(change: string) {
  const config = loadHarnessConfig();
  saveHarnessConfig({
    version: config.version ?? 1,
    profile: config.profile ?? 'lightweight',
    currentChange: change,
    tools: config.tools ?? ['codex', 'trae', 'qoder', 'cursor'],
    checks: config.checks ?? ['ai:validate', 'ai:report'],
    strictChecks: config.strictChecks ?? ['eslint', 'ai:validate', 'ai:report'],
  });
}

export function writeRunEvent(kind: string, payload: Record<string, unknown>) {
  const state = loadHarnessState();
  const createdAt = new Date().toISOString();
  const event = {
    createdAt,
    kind,
    activeChange: state.activeChange ?? null,
    activeFlow: state.activeFlow ?? null,
    status: state.status ?? null,
    ...payload,
  };
  ensureDir('harness', 'runs');
  writeGeneratedFile(
    `harness/runs/${timestampForFile(new Date(createdAt))}-${kind}.json`,
    `${JSON.stringify(event, null, 2)}\n`,
  );
  return event;
}

export function getChangeName(input?: string): string | null {
  if (input) return input;
  const config = loadHarnessConfig();
  return typeof config.currentChange === 'string' ? config.currentChange : null;
}
