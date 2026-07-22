#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const packageRoot = path.dirname(__dirname);
const tsconfigPath = path.join(packageRoot, 'tsconfig.json');

console.log('Running type check...');
const typeCheckResult = spawnSync('npx', ['tsc', '--noEmit', '-p', tsconfigPath], {
  cwd: packageRoot,
  stdio: 'inherit',
});

if (typeCheckResult.status !== 0) {
  process.exit(typeCheckResult.status);
}

console.log('Type check passed.');

const distDir = path.join(packageRoot, 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

console.log('Compiling TypeScript...');
const compileResult = spawnSync('npx', ['tsc', '-p', tsconfigPath], {
  cwd: packageRoot,
  stdio: 'inherit',
});

if (compileResult.status !== 0) {
  process.exit(compileResult.status);
}

const cliSource = fs.readFileSync(path.join(distDir, 'cli.js'), 'utf8');
fs.writeFileSync(path.join(distDir, 'cli.cjs'), `#!/usr/bin/env node\n${cliSource}`, 'utf8');

fs.unlinkSync(path.join(distDir, 'cli.js'));

console.log('Built dist/cli.cjs and dist/');
