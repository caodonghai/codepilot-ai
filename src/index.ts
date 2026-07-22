export type {
  ToolName,
  HarnessStatus,
  HarnessPhase,
  HarnessResult,
  HarnessTaskStatus,
  HarnessTask,
  HarnessTaskBoard,
  ChangeType,
  KnowledgeType,
  KnowledgeStatus,
  KnowledgeConfidence,
  IntegrationName,
  IntegrationMode,
  IntegrationConfig,
  KnowledgeRecord,
  KnowledgeIndexRecord,
  HarnessConfig,
  HarnessState,
  ProjectInfo,
  ProjectFramework,
  BuildTool,
  PackageManager,
  ProjectType,
} from './types';

export {
  loadHarnessConfig,
  saveHarnessConfig,
  loadHarnessState,
  saveHarnessState,
  updateHarnessState,
  initHarness,
  buildChangeContext,
  getChangeName,
  setCurrentChange,
} from './lib/state';

export { writeRunEvent, writeTimestampedMarkdown } from './lib/events';

export {
  taskBoardPath,
  loadTaskBoard,
  saveTaskBoard,
  parseMarkdownTasks,
  syncTaskBoard,
  findTask,
  updateMarkdownTaskCheck,
  taskSummary,
  selectNextTask,
} from './lib/task';

export {
  normalizeKnowledgeRecord,
  knowledgeFilePath,
  readKnowledgeFile,
  writeKnowledgeFile,
  readAllKnowledgeRecords,
  mergeKnowledgeRecords,
  dedupeKnowledgeRecords,
  tokenizeKnowledgeText,
  buildKnowledgeSearchText,
  buildKnowledgeIndex,
  loadKnowledgeIndex,
  scoreKnowledgeRecord,
  searchKnowledge,
  collectChangedFilesForKnowledge,
  extractKnowledgeNames,
  extractReferencedFiles,
  buildKnowledgeAddCommand,
} from './lib/knowledge';

export {
  archiveChange,
  restoreChange,
  deleteArchivedChange,
  listChanges,
  listArchivedChanges,
  validateChangeStructure,
  changeDirectoryPath,
  archiveDirectoryPath,
} from './lib/change';

export {
  templateChangeFile,
  setupPackageScript,
  setupGitignore,
  gitignoreMarker,
  gitignoreRules,
  findTemplateRoot,
  writeFileIfMissingFromTemplate,
  seedProjectTemplates,
} from './commands/templates';

export { setLocale, getLocale, t, detectLocale } from './lib/i18n';

export type { LogLevel } from './lib/logger';
export { Logger, logger, setLogLevel, getLogLevel } from './lib/logger';

export {
  ErrorCode,
  HarnessError,
  ValidationError,
  FileError,
  ChangeError,
  handleError,
  safeExecute,
} from './lib/errors';

export {
  resolvePath,
  exists,
  ensureDir,
  writeFileIfMissing,
  writeGeneratedFile,
  readText,
} from './utils/file';

export {
  splitList,
  uniqueValues,
  kebabName,
  quoteShellArg,
  timestampForFile,
} from './utils/string';

export {
  textCorruptionScore,
  hasMojibake,
  fixMojibakeText,
  collectEncodingIssues,
  readChangeText,
} from './utils/encoding';
