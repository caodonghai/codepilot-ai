"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectOfficialValidateCommand = exports.copyDirectoryRecursive = exports.clearDirectoryContents = exports.assertDownloadOutsideRepo = exports.resolveDownloadTarget = exports.defaultIntegrationDownloadBase = exports.parseIntegrationSource = exports.assertIntegrationTargetPath = exports.integrationSummary = exports.inspectIntegrationHealth = exports.loadIntegrations = exports.saveIntegrationConfig = exports.loadIntegrationConfig = exports.integrationConfigPath = exports.defaultIntegrationConfig = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
function defaultIntegrationConfig(name) {
    return {
        name,
        mode: 'lightweight',
        officialInstalled: false,
        officialPath: `harness/integrations/${name}/official`,
        cachePath: `harness/integrations/${name}/cache`,
        updatedAt: new Date().toISOString(),
    };
}
exports.defaultIntegrationConfig = defaultIntegrationConfig;
function integrationConfigPath(name) {
    return `harness/integrations/${name}/config.json`;
}
exports.integrationConfigPath = integrationConfigPath;
function loadIntegrationConfig(name) {
    const relativePath = integrationConfigPath(name);
    if (!(0, utils_1.exists)(relativePath))
        return defaultIntegrationConfig(name);
    try {
        return {
            ...defaultIntegrationConfig(name),
            ...JSON.parse((0, utils_1.readText)(relativePath)),
            name,
        };
    }
    catch (error) {
        console.error(`Invalid ${relativePath}: ${error.message}`);
        return defaultIntegrationConfig(name);
    }
}
exports.loadIntegrationConfig = loadIntegrationConfig;
function saveIntegrationConfig(config) {
    (0, utils_1.writeGeneratedFile)(integrationConfigPath(config.name), `${JSON.stringify({
        ...config,
        updatedAt: new Date().toISOString(),
    }, null, 2)}\n`);
}
exports.saveIntegrationConfig = saveIntegrationConfig;
function loadIntegrations() {
    return Object.fromEntries(utils_1.integrationNames.map((name) => [name, loadIntegrationConfig(name)]));
}
exports.loadIntegrations = loadIntegrations;
function inspectIntegrationHealth(name, config) {
    if (!config)
        config = loadIntegrationConfig(name);
    const officialPath = (0, utils_1.resolvePath)(config.officialPath);
    if (!config.officialInstalled) {
        return {
            health: 'not_installed',
            usable: false,
            reason: 'officialInstalled is false',
            evidence: [],
            missing: [],
        };
    }
    if (!fs_1.default.existsSync(officialPath)) {
        return {
            health: 'missing',
            usable: false,
            reason: `Missing ${config.officialPath}`,
            evidence: [],
            missing: [config.officialPath],
        };
    }
    const evidence = [];
    const missing = [];
    const has = (relativePath) => {
        const fullPath = path_1.default.join(officialPath, relativePath);
        if (fs_1.default.existsSync(fullPath)) {
            evidence.push(`${config === null || config === void 0 ? void 0 : config.officialPath}/${relativePath}`);
            return true;
        }
        missing.push(`${config === null || config === void 0 ? void 0 : config.officialPath}/${relativePath}`);
        return false;
    };
    if (name === 'openspec') {
        has('README.md');
        has('package.json');
    }
    else {
        has('README.md');
        if (fs_1.default.existsSync(path_1.default.join(officialPath, 'skills'))
            || fs_1.default.existsSync(path_1.default.join(officialPath, 'commands'))
            || fs_1.default.existsSync(path_1.default.join(officialPath, 'superpowers'))) {
            evidence.push(`${config === null || config === void 0 ? void 0 : config.officialPath}/skills|commands|superpowers`);
        }
        else {
            missing.push(`${config === null || config === void 0 ? void 0 : config.officialPath}/skills or commands or superpowers`);
        }
    }
    const usable = evidence.length > 0 && (name === 'superpowers' ? evidence.length >= 2 : true);
    return {
        health: usable ? 'usable' : 'incomplete',
        usable,
        reason: usable ? 'Repo-local official resources look usable.' : `Repo-local official resources are incomplete: ${missing.join(', ')}`,
        evidence,
        missing,
    };
}
exports.inspectIntegrationHealth = inspectIntegrationHealth;
function integrationSummary() {
    return utils_1.integrationNames.map((name) => {
        const config = loadIntegrationConfig(name);
        const installed = config.officialInstalled ? 'installed' : 'not installed';
        const health = inspectIntegrationHealth(name, config);
        return `- ${name}: ${config.mode} (${installed}, health=${health.health}, repo-local only: ${config.officialPath})`;
    }).join('\n');
}
exports.integrationSummary = integrationSummary;
function assertIntegrationTargetPath(name, relativePath) {
    const expectedPrefix = path_1.default.resolve((0, utils_1.resolvePath)('.'), 'harness', 'integrations', name);
    const fullPath = path_1.default.resolve((0, utils_1.resolvePath)('.'), relativePath);
    if (fullPath !== expectedPrefix && !fullPath.startsWith(`${expectedPrefix}${path_1.default.sep}`)) {
        throw new Error(`Refusing integration path outside harness/integrations/${name}: ${relativePath}`);
    }
    return fullPath;
}
exports.assertIntegrationTargetPath = assertIntegrationTargetPath;
function parseIntegrationSource(source) {
    if (!source)
        return null;
    if (!source.startsWith('local:')) {
        throw new Error('Only local:<path> sources are supported in v0.8. Network and global installs are intentionally unsupported.');
    }
    const sourcePath = source.slice('local:'.length).trim();
    if (!sourcePath)
        throw new Error('local:<path> source is required.');
    const fullPath = path_1.default.resolve(sourcePath);
    if (!fs_1.default.existsSync(fullPath))
        throw new Error(`Local source does not exist: ${sourcePath}`);
    if (!fs_1.default.statSync(fullPath).isDirectory())
        throw new Error(`Local source must be a directory: ${sourcePath}`);
    return fullPath;
}
exports.parseIntegrationSource = parseIntegrationSource;
function defaultIntegrationDownloadBase() {
    return path_1.default.resolve((0, utils_1.resolvePath)('.'), '..', '_ai-official-sources');
}
exports.defaultIntegrationDownloadBase = defaultIntegrationDownloadBase;
function resolveDownloadTarget(name, to) {
    const base = to ? path_1.default.resolve(to) : defaultIntegrationDownloadBase();
    return path_1.default.join(base, name);
}
exports.resolveDownloadTarget = resolveDownloadTarget;
function assertDownloadOutsideRepo(target, allowInsideRepo) {
    const rootPath = path_1.default.resolve((0, utils_1.resolvePath)('.'));
    if (!allowInsideRepo && (target === rootPath || target.startsWith(`${rootPath}${path_1.default.sep}`))) {
        throw new Error('Refusing to download official sources inside the repository. Use --allow-inside-repo only if you know what you are doing.');
    }
}
exports.assertDownloadOutsideRepo = assertDownloadOutsideRepo;
function clearDirectoryContents(directory) {
    fs_1.default.mkdirSync(directory, { recursive: true });
    for (const item of fs_1.default.readdirSync(directory)) {
        fs_1.default.rmSync(path_1.default.join(directory, item), { recursive: true, force: true });
    }
}
exports.clearDirectoryContents = clearDirectoryContents;
function copyDirectoryRecursive(source, target) {
    fs_1.default.mkdirSync(target, { recursive: true });
    for (const entry of fs_1.default.readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path_1.default.join(source, entry.name);
        const targetPath = path_1.default.join(target, entry.name);
        if (entry.isDirectory()) {
            copyDirectoryRecursive(sourcePath, targetPath);
        }
        else if (entry.isFile()) {
            fs_1.default.copyFileSync(sourcePath, targetPath);
        }
    }
}
exports.copyDirectoryRecursive = copyDirectoryRecursive;
function detectOfficialValidateCommand(name, officialPath) {
    var _a;
    const packageJsonPath = path_1.default.join(officialPath, 'package.json');
    if (!fs_1.default.existsSync(packageJsonPath))
        return null;
    const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, 'utf8'));
    if ((_a = packageJson === null || packageJson === void 0 ? void 0 : packageJson.scripts) === null || _a === void 0 ? void 0 : _a.validate) {
        return {
            command: process.platform === 'win32' ? 'cmd' : 'sh',
            args: process.platform === 'win32' ? ['/c', 'npm run validate'] : ['-lc', 'npm run validate'],
            display: 'npm run validate',
        };
    }
    if (name === 'openspec' && (packageJson === null || packageJson === void 0 ? void 0 : packageJson.bin)) {
        const firstBin = typeof packageJson.bin === 'string' ? packageJson.bin : Object.values(packageJson.bin)[0];
        if (typeof firstBin === 'string') {
            return {
                command: process.execPath,
                args: [firstBin, 'validate'],
                display: `node ${firstBin} validate`,
            };
        }
    }
    return null;
}
exports.detectOfficialValidateCommand = detectOfficialValidateCommand;
