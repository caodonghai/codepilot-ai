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
  resolvePath,
  exists,
  ensureDir,
  writeFileIfMissing,
  writeGeneratedFile,
  readText,
  parseTools,
  parseToolArgs,
  parseIntegrationName,
  parseIntegrationMode,
  parseChangeType,
  parseKnowledgeType,
  splitList,
  uniqueValues,
  kebabName,
  quoteShellArg,
  timestampForFile,
  textCorruptionScore,
  hasMojibake,
  fixMojibakeText,
  resolveInsideRoot,
} from './lib/utils';

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

export type { ErrorHandlerOptions } from './lib/errors';

export {
  HarnessError,
  ConfigError,
  ChangeError,
  IntegrationError,
  KnowledgeError,
  TemplateError,
  ValidationError,
  LockError,
  ErrorHandler,
  errorHandler,
  handleError,
  wrapAsync,
  wrapSync,
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
