#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const packageRoot = path.dirname(__dirname);
const sourcePath = path.join(packageRoot, 'src', 'cli.ts');
const outputPath = path.join(packageRoot, 'dist', 'cli.cjs');

console.log('Running type check...');
const srcDir = path.join(packageRoot, 'src');
const tsFiles = [];
function collectTsFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsFiles(fullPath);
    } else if (entry.name.endsWith('.ts')) {
      tsFiles.push(fullPath);
    }
  }
}
collectTsFiles(srcDir);

const program = ts.createProgram(tsFiles, {
  noEmit: true,
  skipLibCheck: true,
  esModuleInterop: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  target: ts.ScriptTarget.ES2019,
  module: ts.ModuleKind.CommonJS,
});
const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length > 0) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => packageRoot,
    getNewLine: () => '\n',
  };
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
  process.exit(1);
}

console.log('Type check passed.');

const distDir = path.join(packageRoot, 'dist');
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

function compileFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
    },
    fileName: filePath,
  });
  const relativePath = path.relative(srcDir, filePath);
  const outputFilePath = path.join(distDir, relativePath.replace('.ts', '.js'));
  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  fs.writeFileSync(outputFilePath, result.outputText, 'utf8');
}

for (const tsFile of tsFiles) {
  compileFile(tsFile);
}

const cliSource = fs.readFileSync(sourcePath, 'utf8');
const cliResult = ts.transpileModule(cliSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
    esModuleInterop: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    skipLibCheck: true,
  },
  fileName: sourcePath,
});

fs.writeFileSync(outputPath, `#!/usr/bin/env node\n${cliResult.outputText}`, 'utf8');
console.log(`Built dist/cli.cjs and dist/lib/`);
