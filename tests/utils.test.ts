import { describe, it, expect } from 'vitest';

function kebabName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function quoteShellArg(value: string) {
  if (/^[A-Za-z0-9_./:@\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

const mojibakePatterns = [
  '\u7ead',
  '\u93c4',
  '\u95be\u6735',
  '\u7035\u7858',
  '\u8dfa\u5ba0',
  '\u7a0b\u5b2a',
  '\u9286?',
  '\u9225?',
  '\u20ac?',
  '\u951f',
  '\ufffd',
];

function textCorruptionScore(text: string) {
  const patternScore = mojibakePatterns.reduce((score, pattern) => {
    const matches = text.split(pattern).length - 1;
    return score + matches * 10;
  }, 0);
  const controlScore = (text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length * 20;
  return patternScore + controlScore;
}

function hasMojibake(text: string) {
  return textCorruptionScore(text) > 0;
}

describe('kebabName', () => {
  it('should convert to kebab-case', () => {
    expect(kebabName('My Feature')).toBe('my-feature');
    expect(kebabName('  Hello World  ')).toBe('hello-world');
    expect(kebabName('Feature_Name_123')).toBe('feature-name-123');
  });

  it('should handle Chinese characters', () => {
    expect(kebabName('用户登录功能')).toBe('用户登录功能');
    expect(kebabName('中文-English混合')).toBe('中文-english混合');
  });

  it('should remove special characters', () => {
    expect(kebabName('Feature@#$%^')).toBe('feature');
    expect(kebabName('test--case')).toBe('test-case');
  });
});

describe('quoteShellArg', () => {
  it('should return simple values as-is', () => {
    expect(quoteShellArg('simple')).toBe('simple');
    expect(quoteShellArg('path/to/file')).toBe('path/to/file');
    expect(quoteShellArg('file.txt')).toBe('file.txt');
  });

  it('should quote values with spaces', () => {
    expect(quoteShellArg('hello world')).toBe('"hello world"');
    expect(quoteShellArg('my file.txt')).toBe('"my file.txt"');
  });

  it('should escape double quotes', () => {
    expect(quoteShellArg('file "name".txt')).toBe('"file \\"name\\".txt"');
  });

  it('should handle empty string', () => {
    expect(quoteShellArg('')).toBe('""');
  });
});

describe('hasMojibake', () => {
  it('should detect mojibake patterns', () => {
    expect(hasMojibake('\u7ead')).toBe(true);
    expect(hasMojibake('\ufffd')).toBe(true);
    expect(hasMojibake('\u93c4')).toBe(true);
  });

  it('should not detect normal text', () => {
    expect(hasMojibake('正常文本')).toBe(false);
    expect(hasMojibake('normal text')).toBe(false);
    expect(hasMojibake('12345')).toBe(false);
  });

  it('should detect control characters', () => {
    expect(hasMojibake('hello\u0000world')).toBe(true);
    expect(hasMojibake('test\u000Btest')).toBe(true);
  });
});
