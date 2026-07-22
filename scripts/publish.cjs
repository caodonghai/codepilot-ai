#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const packageRoot = path.dirname(__dirname);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const allowedReleases = new Set(['patch', 'minor', 'major']);

// `publish` is also an npm lifecycle event. The child marker prevents the
// orchestrator from recursively running when this script invokes `npm publish`.
if (process.env.CODEPILOT_PUBLISH_CHILD === '1') process.exit(0);

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('用法: npm run publish [-- patch|minor|major] [--yes]');
  console.log('交互模式使用上下方向键选择版本，默认 patch，按回车确认。');
  console.log('依次执行构建、打包检查、版本升级、Git 提交/推送和 npm 发布。');
  process.exit(0);
}

function run(command, args, options = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
    shell: false,
    env: { ...process.env, ...options.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture ? String(result.stderr || result.stdout || '').trim() : '';
    throw new Error(`${command} 执行失败${detail ? `：${detail}` : ''}`);
  }
  return options.capture ? String(result.stdout || '').trim() : '';
}

function ask(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('非交互环境必须传入版本类型，例如：npm run publish -- patch');
  }
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    terminal.question(question, (answer) => {
      terminal.close();
      resolve(answer.trim().toLowerCase());
    }),
  );
}

function selectWithArrows() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('非交互环境必须传入版本类型，例如：npm run publish -- patch --yes');
  }
  const choices = ['patch', 'minor', 'major'];
  let selectedIndex = 0;
  readline.emitKeypressEvents(process.stdin);

  return new Promise((resolve, reject) => {
    const wasRaw = process.stdin.isRaw;
    const render = () => {
      const options = choices
        .map((choice, index) => (index === selectedIndex ? `❯ ${choice}` : `  ${choice}`))
        .join('   ');
      process.stdout.write(`\r\x1b[2K选择升级类型（↑/↓，回车确认）：${options}`);
    };
    const cleanup = () => {
      process.stdin.off('keypress', onKeypress);
      if (typeof process.stdin.setRawMode === 'function') process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onKeypress = (_value, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('已取消发布。'));
        return;
      }
      if (key.name === 'up') selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
      if (key.name === 'down') selectedIndex = (selectedIndex + 1) % choices.length;
      if (key.name === 'return' || key.name === 'enter') {
        const selected = choices[selectedIndex];
        cleanup();
        resolve(selected);
        return;
      }
      render();
    };

    if (typeof process.stdin.setRawMode === 'function') process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', onKeypress);
    render();
  });
}

function nextVersion(current, release) {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`不支持的当前版本格式：${current}`);
  let [, major, minor, patch] = match.map(Number);
  if (release === 'major') [major, minor, patch] = [major + 1, 0, 0];
  if (release === 'minor') [minor, patch] = [minor + 1, 0];
  if (release === 'patch') patch += 1;
  return `${major}.${minor}.${patch}`;
}

async function selectRelease() {
  const argument = process.argv.slice(2).find((value) => allowedReleases.has(value));
  if (argument) return argument;
  return selectWithArrows();
}

async function main() {
  run(npmCommand, ['run', 'build']);
  run(npmCommand, ['pack', '--dry-run', '--ignore-scripts']);

  const branch = run('git', ['branch', '--show-current'], { capture: true });
  if (!branch) throw new Error('当前处于 detached HEAD，不能自动发布。');
  const status = run('git', ['status', '--porcelain'], { capture: true });
  if (status) throw new Error('Git 工作区存在未提交变更，请先提交或暂存处理后再发布。');
  run('git', ['remote', 'get-url', 'origin'], { capture: true });
  run(npmCommand, ['whoami'], { capture: true });

  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const release = await selectRelease();
  const targetVersion = nextVersion(packageJson.version, release);
  const confirmation = process.argv.includes('--yes')
    ? 'yes'
    : await ask(
        `将 ${packageJson.name} 从 ${packageJson.version} 升级到 ${targetVersion}，提交并推送到 origin/${branch} 后发布 npm。输入 yes/y 继续：`,
      );
  if (!['yes', 'y'].includes(confirmation)) throw new Error('已取消发布。');

  run(npmCommand, ['version', release, '-m', 'chore(release): v%s']);
  run('git', ['push', 'origin', 'HEAD', '--follow-tags']);
  run(npmCommand, ['publish', '--provenance', '--access', 'public'], {
    env: { CODEPILOT_PUBLISH_CHILD: '1' },
  });

  console.log(`\n发布完成：${packageJson.name}@${targetVersion}`);
}

main().catch((error) => {
  console.error(`\n发布失败：${error.message}`);
  process.exitCode = 1;
});
