import { writeGeneratedFile, ensureDir } from '../utils/file';
import { timestampForFile } from '../utils/string';
import { loadHarnessState } from './state';

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

export function writeTimestampedMarkdown(directory: string, basename: string, content: string) {
  const createdAt = new Date().toISOString();
  const filePath = `${directory}/${timestampForFile(new Date(createdAt))}-${basename}.md`;
  ensureDir(...directory.split('/'));
  writeGeneratedFile(filePath, content);
  return filePath;
}
