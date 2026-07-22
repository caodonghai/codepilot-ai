#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

function runNode(scriptPath, args, cwd) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
    },
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`Failed to start MsgFi AI CLI: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(typeof result.status === 'number' ? result.status : 1);
}

const args = process.argv.slice(2);
const packageRoot = path.dirname(path.dirname(__filename));
const packagedCli = path.join(packageRoot, 'dist', 'cli.cjs');

runNode(packagedCli, args, process.cwd());
