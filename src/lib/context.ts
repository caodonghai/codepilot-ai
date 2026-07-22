export interface GlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
  json?: boolean;
  locale?: string;
  configPath?: string;
  framework?: string;
  buildTool?: string;
  packageManager?: string;
  skipAi?: boolean;
  skipGit?: boolean;
}

let globalOptions: GlobalOptions = {};

function getEnvBool(key: string): boolean | undefined {
  const value = process.env[key];
  if (value === undefined) return undefined;
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvString(key: string): string | undefined {
  return process.env[key] || undefined;
}

function getCompatibleEnvBool(name: string): boolean | undefined {
  return getEnvBool(`CODEPILOT_${name}`) ?? getEnvBool(`MSGFI_AI_${name}`);
}

function getCompatibleEnvString(name: string): string | undefined {
  return getEnvString(`CODEPILOT_${name}`) ?? getEnvString(`MSGFI_AI_${name}`);
}

export function loadFromEnv(): void {
  const envOptions: GlobalOptions = {};

  const verbose = getCompatibleEnvBool('VERBOSE');
  if (verbose !== undefined) envOptions.verbose = verbose;

  const quiet = getCompatibleEnvBool('QUIET');
  if (quiet !== undefined) envOptions.quiet = quiet;

  const dryRun = getCompatibleEnvBool('DRY_RUN');
  if (dryRun !== undefined) envOptions.dryRun = dryRun;

  const json = getCompatibleEnvBool('JSON');
  if (json !== undefined) envOptions.json = json;

  const locale = getCompatibleEnvString('LOCALE');
  if (locale !== undefined) envOptions.locale = locale;

  const configPath = getCompatibleEnvString('CONFIG');
  if (configPath !== undefined) envOptions.configPath = configPath;

  const framework = getCompatibleEnvString('FRAMEWORK');
  if (framework !== undefined) envOptions.framework = framework;

  const buildTool = getCompatibleEnvString('BUILD_TOOL');
  if (buildTool !== undefined) envOptions.buildTool = buildTool;

  const packageManager = getCompatibleEnvString('PACKAGE_MANAGER');
  if (packageManager !== undefined) envOptions.packageManager = packageManager;

  const skipAi = getCompatibleEnvBool('SKIP_AI');
  if (skipAi !== undefined) envOptions.skipAi = skipAi;

  const skipGit = getCompatibleEnvBool('SKIP_GIT');
  if (skipGit !== undefined) envOptions.skipGit = skipGit;

  globalOptions = { ...globalOptions, ...envOptions };
}

export function setGlobalOptions(options: GlobalOptions): void {
  globalOptions = { ...globalOptions, ...options };
}

export function getGlobalOptions(): GlobalOptions {
  return { ...globalOptions };
}

export function getOption<K extends keyof GlobalOptions>(key: K): GlobalOptions[K] | undefined {
  return globalOptions[key];
}

export function isVerbose(): boolean {
  return globalOptions.verbose ?? false;
}

export function isQuiet(): boolean {
  return globalOptions.quiet ?? false;
}

export function isDryRun(): boolean {
  return globalOptions.dryRun ?? false;
}

export function isJsonOutput(): boolean {
  return globalOptions.json ?? false;
}

export function getLocale(): string | undefined {
  return globalOptions.locale;
}

export function getConfigPath(): string | undefined {
  return globalOptions.configPath;
}

export function getFramework(): string | undefined {
  return globalOptions.framework;
}

export function getBuildTool(): string | undefined {
  return globalOptions.buildTool;
}

export function getPackageManager(): string | undefined {
  return globalOptions.packageManager;
}

export function isSkipAi(): boolean {
  return globalOptions.skipAi ?? false;
}

export function isSkipGit(): boolean {
  return globalOptions.skipGit ?? false;
}

export function resetGlobalOptions(): void {
  globalOptions = {};
}
