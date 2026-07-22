export interface GlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
  json?: boolean;
  locale?: string;
}

let globalOptions: GlobalOptions = {};

export function setGlobalOptions(options: GlobalOptions): void {
  globalOptions = { ...globalOptions, ...options };
}

export function getGlobalOptions(): GlobalOptions {
  return { ...globalOptions };
}

export function getOption<K extends keyof GlobalOptions>(key: K): GlobalOptions[K] {
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

export function resetGlobalOptions(): void {
  globalOptions = {};
}
