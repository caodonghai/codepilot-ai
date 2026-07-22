import { describe, it, expect } from 'vitest';
import { kebabName, quoteShellArg } from '../src/utils/string';
import { textCorruptionScore, hasMojibake } from '../src/utils/encoding';

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