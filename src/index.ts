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
} from './types';

export {
  root,
  defaultTools,
  coreFiles,
  dispatcherFlow,
  flowNames,
  skillFiles,
  requiredChangeFiles,
  mojibakePatterns,
  textFilesToCheck,
  changeTypes,
  knowledgeTypes,
  integrationNames,
  integrationModes,
  integrationGitSources,
  knowledgeFiles,
  phaseByFlow,
  parseTools,
  parseToolArgs,
  parseIntegrationName,
  parseIntegrationMode,
  parseChangeType,
  parseKnowledgeType,
} from './config/constants';

export {
  resolvePath,
  exists,
  ensureDir,
  writeFileIfMissing,
  writeGeneratedFile,
  readText,
  resolveInsideRoot,
} from './utils/file';

export {
  splitList,
  uniqueValues,
  kebabName,
  quoteShellArg,
  timestampForFile,
} from './utils/string';

export { textCorruptionScore, hasMojibake, fixMojibakeText } from './utils/encoding';

export {
  loadHarnessConfig,
  saveHarnessConfig,
  loadHarnessState,
  saveHarnessState,
  updateHarnessState,
  initHarness,
  buildChangeContext,
  getChangeName,
  writeRunEvent,
  writeTimestampedMarkdown,
  taskBoardPath,
} from './lib/state';

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
} from './commands/knowledge-core';

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
  defaultIntegrationConfig,
  integrationConfigPath,
  loadIntegrationConfig,
  saveIntegrationConfig,
  loadIntegrations,
  integrationSummary,
  inspectIntegrationHealth,
  assertIntegrationTargetPath,
  parseIntegrationSource,
  defaultIntegrationDownloadBase,
  resolveDownloadTarget,
  assertDownloadOutsideRepo,
  clearDirectoryContents,
  copyDirectoryRecursive,
} from './commands/integrations-core';

export {
  templateChangeFile,
  setupPackageScript,
  findTemplateRoot,
  writeFileIfMissingFromTemplate,
  seedProjectTemplates,
  collectCoreSummary,
  collectFlowSummary,
  collectSkillSummary,
} from './commands/templates';

export { setLocale, getLocale, t, detectLocale } from './lib/i18n';

export {
  Spinner,
  ProgressBar,
  logStep,
  logSuccess,
  logError,
  logWarning,
} from './commands/progress';

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

export type { ConfigValidationError, HarnessConfig, HarnessState } from './lib/config';

export {
  validateConfig,
  loadConfig,
  getDefaultConfig,
  saveConfig,
  updateConfig,
  loadState,
  getDefaultState,
  saveState,
  updateState,
  initConfig,
  getConfigPath,
  getStatePath,
  isConfigInitialized,
  resetConfig,
} from './lib/config';

export type {
  CommandHandler,
  CommandContext,
  ChangeCommandOptions,
  KnowledgeCommandOptions,
  IntegrationCommandOptions,
  FlowCommandOptions,
} from './commands/registry';

export {
  CommandRegistry,
  createChangeCommand,
  createKnowledgeCommand,
  createIntegrationCommand,
  createFlowCommand,
  createArchiveCommand,
} from './commands/registry';

export type { Factory, ContainerConfig } from './lib/di';

export {
  DependencyContainer,
  createDefaultContainer,
  globalContainer,
  resetGlobalContainer,
  getGlobalContainer,
  setGlobalContainer,
  inject,
  register,
  bind,
  singleton,
  transient,
} from './lib/di';
