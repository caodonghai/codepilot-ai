import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger, setLogLevel, getLogLevel, LogLevel } from '../src/lib/logger';

describe('logger 模块', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLogLevel('info');
  });

  test('getLogLevel 返回当前日志级别', () => {
    expect(getLogLevel()).toBe('info');
  });

  test('setLogLevel 设置日志级别', () => {
    setLogLevel('debug');
    expect(getLogLevel()).toBe('debug');
  });

  test('logger.info 在 info 级别输出', () => {
    logger.info('test info');
    expect(console.log).toHaveBeenCalled();
    const args = vi.mocked(console.log).mock.calls[0];
    expect(args).toContain('test info');
  });

  test('logger.warn 在 info 级别输出', () => {
    logger.warn('test warn');
    expect(console.warn).toHaveBeenCalled();
    const args = vi.mocked(console.warn).mock.calls[0];
    expect(args).toContain('test warn');
  });

  test('logger.error 在 info 级别输出', () => {
    logger.error('test error');
    expect(console.error).toHaveBeenCalled();
    const args = vi.mocked(console.error).mock.calls[0];
    expect(args).toContain('test error');
  });

  test('logger.debug 在 info 级别不输出', () => {
    logger.debug('test debug');
    expect(console.debug).not.toHaveBeenCalled();
  });

  test('logger.debug 在 debug 级别输出', () => {
    setLogLevel('debug');
    logger.debug('test debug');
    expect(console.debug).toHaveBeenCalled();
    const args = vi.mocked(console.debug).mock.calls[0];
    expect(args).toContain('test debug');
  });

  test('logger.info 在 silent 级别不输出', () => {
    setLogLevel('error');
    logger.info('test info');
    expect(console.log).not.toHaveBeenCalled();
  });

  test('logger.warn 在 silent 级别不输出', () => {
    setLogLevel('error');
    logger.warn('test warn');
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('logger.error 在 silent 级别不输出', () => {
    setLogLevel('error');
    logger.error('test error');
    expect(console.error).toHaveBeenCalled();
  });

  test('logger.info 包含时间戳', () => {
    logger.info('test');
    const args = vi.mocked(console.log).mock.calls[0];
    expect(args[0]).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
  });

  test('logger.warn 包含时间戳', () => {
    logger.warn('test');
    const args = vi.mocked(console.warn).mock.calls[0];
    expect(args[0]).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
  });

  test('logger.error 包含时间戳', () => {
    logger.error('test');
    const args = vi.mocked(console.error).mock.calls[0];
    expect(args[0]).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
  });

  test('setLogLevel 忽略无效级别', () => {
    setLogLevel('invalid' as LogLevel);
    expect(getLogLevel()).toBe('info');
  });
});
