"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChange = exports.deleteArchivedChange = exports.restoreChange = exports.archiveChange = exports.listArchivedChanges = exports.listChanges = exports.validateChangeStructure = exports.archiveDirectoryPath = exports.changeDirectoryPath = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
function changeDirectoryPath(change) {
    return (0, utils_1.resolvePath)('openspec', 'changes', change);
}
exports.changeDirectoryPath = changeDirectoryPath;
function archiveDirectoryPath(change) {
    return (0, utils_1.resolvePath)('openspec', 'archive', change);
}
exports.archiveDirectoryPath = archiveDirectoryPath;
function validateChangeStructure(change) {
    const changeDir = changeDirectoryPath(change);
    if (!fs_1.default.existsSync(changeDir)) {
        return { valid: false, errors: [`Change directory not found: openspec/changes/${change}`] };
    }
    const errors = [];
    const missingFiles = utils_1.requiredChangeFiles.filter((file) => !fs_1.default.existsSync(path_1.default.join(changeDir, file)));
    if (missingFiles.length) {
        errors.push(`Missing required files: ${missingFiles.join(', ')}`);
    }
    for (const file of utils_1.requiredChangeFiles) {
        const filePath = path_1.default.join(changeDir, file);
        if (fs_1.default.existsSync(filePath)) {
            const content = fs_1.default.readFileSync(filePath, 'utf8');
            if (!content.trim()) {
                errors.push(`Empty file: openspec/changes/${change}/${file}`);
            }
        }
    }
    return { valid: errors.length === 0, errors };
}
exports.validateChangeStructure = validateChangeStructure;
function listChanges() {
    const changesDir = (0, utils_1.resolvePath)('openspec', 'changes');
    if (!fs_1.default.existsSync(changesDir))
        return [];
    const changes = [];
    for (const entry of fs_1.default.readdirSync(changesDir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const changeDir = path_1.default.join(changesDir, entry.name);
        const proposalPath = path_1.default.join(changeDir, 'proposal.md');
        let type = 'default';
        let createdAt = '';
        if (fs_1.default.existsSync(proposalPath)) {
            const content = fs_1.default.readFileSync(proposalPath, 'utf8');
            const typeMatch = content.match(/^## Type\s*\n\s*(\w+)/m);
            if (typeMatch)
                type = typeMatch[1];
            const stats = fs_1.default.statSync(proposalPath);
            createdAt = stats.birthtime.toISOString().slice(0, 10);
        }
        changes.push({
            name: entry.name,
            type: utils_1.changeTypes.includes(type) ? type : 'default',
            createdAt,
            status: 'active',
        });
    }
    return changes;
}
exports.listChanges = listChanges;
function listArchivedChanges() {
    const archiveDir = (0, utils_1.resolvePath)('openspec', 'archive');
    if (!fs_1.default.existsSync(archiveDir))
        return [];
    const changes = [];
    for (const entry of fs_1.default.readdirSync(archiveDir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const changeDir = path_1.default.join(archiveDir, entry.name);
        const proposalPath = path_1.default.join(changeDir, 'proposal.md');
        let type = 'default';
        let createdAt = '';
        if (fs_1.default.existsSync(proposalPath)) {
            const content = fs_1.default.readFileSync(proposalPath, 'utf8');
            const typeMatch = content.match(/^## Type\s*\n\s*(\w+)/m);
            if (typeMatch)
                type = typeMatch[1];
            const stats = fs_1.default.statSync(proposalPath);
            createdAt = stats.birthtime.toISOString().slice(0, 10);
        }
        const archiveInfoPath = path_1.default.join(changeDir, '.archive-info.json');
        let completedAt;
        if (fs_1.default.existsSync(archiveInfoPath)) {
            try {
                const archiveInfo = JSON.parse(fs_1.default.readFileSync(archiveInfoPath, 'utf8'));
                completedAt = archiveInfo.completedAt;
            }
            catch {
            }
        }
        changes.push({
            name: entry.name,
            type: utils_1.changeTypes.includes(type) ? type : 'default',
            createdAt,
            completedAt,
            status: 'archived',
        });
    }
    return changes;
}
exports.listArchivedChanges = listArchivedChanges;
function archiveChange(change) {
    const sourceDir = changeDirectoryPath(change);
    if (!fs_1.default.existsSync(sourceDir)) {
        throw new Error(`Change not found: ${change}`);
    }
    const validation = validateChangeStructure(change);
    if (!validation.valid) {
        throw new Error(`Cannot archive incomplete change: ${validation.errors.join('; ')}`);
    }
    const targetDir = archiveDirectoryPath(change);
    (0, utils_1.ensureDir)('openspec', 'archive');
    if (fs_1.default.existsSync(targetDir)) {
        throw new Error(`Change already archived: ${change}`);
    }
    copyDirectoryRecursive(sourceDir, targetDir);
    const archiveInfo = {
        archivedAt: new Date().toISOString(),
        completedAt: new Date().toISOString().slice(0, 10),
        change,
    };
    (0, utils_1.writeGeneratedFile)(path_1.default.join('openspec', 'archive', change, '.archive-info.json'), `${JSON.stringify(archiveInfo, null, 2)}\n`);
    fs_1.default.rmSync(sourceDir, { recursive: true, force: true });
    return { archivedAt: archiveInfo.archivedAt, targetDir: path_1.default.relative((0, utils_1.resolvePath)('.'), targetDir) };
}
exports.archiveChange = archiveChange;
function restoreChange(change) {
    const sourceDir = archiveDirectoryPath(change);
    if (!fs_1.default.existsSync(sourceDir)) {
        throw new Error(`Archived change not found: ${change}`);
    }
    const targetDir = changeDirectoryPath(change);
    if (fs_1.default.existsSync(targetDir)) {
        throw new Error(`Change already exists: ${change}`);
    }
    copyDirectoryRecursive(sourceDir, targetDir);
    const archiveInfoPath = path_1.default.join(targetDir, '.archive-info.json');
    if (fs_1.default.existsSync(archiveInfoPath)) {
        fs_1.default.unlinkSync(archiveInfoPath);
    }
    return { restoredAt: new Date().toISOString(), targetDir: path_1.default.relative((0, utils_1.resolvePath)('.'), targetDir) };
}
exports.restoreChange = restoreChange;
function deleteArchivedChange(change) {
    const archiveDir = archiveDirectoryPath(change);
    if (!fs_1.default.existsSync(archiveDir)) {
        throw new Error(`Archived change not found: ${change}`);
    }
    fs_1.default.rmSync(archiveDir, { recursive: true, force: true });
    return { deletedAt: new Date().toISOString() };
}
exports.deleteArchivedChange = deleteArchivedChange;
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
function createChange(change, type = 'default') {
    const changeDir = changeDirectoryPath(change);
    if (fs_1.default.existsSync(changeDir)) {
        throw new Error(`Change already exists: ${change}`);
    }
    (0, utils_1.ensureDir)('openspec', 'changes', change);
    const { templateChangeFile } = require('./templates');
    for (const file of utils_1.requiredChangeFiles) {
        (0, utils_1.writeGeneratedFile)(path_1.default.join('openspec', 'changes', change, file), templateChangeFile(change, file, type));
    }
    const notesPath = path_1.default.join('openspec', 'changes', change, 'notes.md');
    if (!fs_1.default.existsSync(notesPath)) {
        (0, utils_1.writeGeneratedFile)(notesPath, templateChangeFile(change, 'notes.md', type));
    }
    return { createdAt: new Date().toISOString(), changeDir: path_1.default.relative((0, utils_1.resolvePath)('.'), changeDir) };
}
exports.createChange = createChange;
