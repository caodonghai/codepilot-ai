#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { spawnSync } = require('child_process');

const packageRoot = path.dirname(__dirname);
const sourcePath = path.join(packageRoot, 'src', 'cli.ts');
const outputPath = path.join(packageRoot, 'dist', 'cli.cjs');

console.log('Running type check...');
const typeCheckResult = spawnSync(
  'npx',
  ['tsc', '--noEmit', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'NodeJs', '--target', 'ES2019', '--module', 'CommonJS'],
  { cwd: packageRoot, stdio: 'inherit' }
);

if (typeCheckResult.status !== 0) {
  console.error('Type check failed.');
  process.exit(1);
}

console.log('Type check passed.');

const source = fs.readFileSync(sourcePath, 'utf8');
const result = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
    esModuleInterop: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    skipLibCheck: true,
  },
  fileName: sourcePath,
});

if (result.diagnostics?.length) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => packageRoot,
    getNewLine: () => '\n',
  };
  console.error(ts.formatDiagnosticsWithColorAndContext(result.diagnostics, host));
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `#!/usr/bin/env node\n${result.outputText}`, 'utf8');
console.log(`Built ${path.relative(packageRoot, outputPath)}`);
