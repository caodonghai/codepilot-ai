import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger, setLogLevel, getLogLevel } from '../src/lib/logger';

describe('logger module', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('Logger constructor sets default config', () => {
    const log = new Logger();
    expect(log.getLevel()).toBe('info');
  });

  test('Logger constructor uses provided config', () => {
    const log = new Logger({ level: 'debug', color: false });
    expect(log.getLevel()).toBe('debug');
  });

  test('setLevel changes log level', () => {
    const log = new Logger();
    log.setLevel('warn');
    expect(log.getLevel()).toBe('warn');
  });

  test('shouldLog returns true for higher or equal level', () => {
    const log = new Logger({ level: 'info' });
    expect(log['shouldLog']('info')).toBe(true);
    expect(log['shouldLog']('warn')).toBe(true);
    expect(log['shouldLog']('error')).toBe(true);
    expect(log['shouldLog']('debug')).toBe(false);
  });

  test('info logs message at info level', () => {
    const log = new Logger({ level: 'info', timestamp: false });
    log.info('test message');
    expect(console.log).toHaveBeenCalled();
  });

  test('debug does not log when level is info', () => {
    const log = new Logger({ level: 'info' });
    log.debug('test message');
    expect(console.debug).not.toHaveBeenCalled();
  });

  test('debug logs when level is debug', () => {
    const log = new Logger({ level: 'debug', timestamp: false });
    log.debug('test message');
    expect(console.debug).toHaveBeenCalled();
  });

  test('warn logs message', () => {
    const log = new Logger({ level: 'info', timestamp: false });
    log.warn('test warning');
    expect(console.warn).toHaveBeenCalled();
  });

  test('error logs message', () => {
    const log = new Logger({ level: 'info', timestamp: false });
    log.error('test error');
    expect(console.error).toHaveBeenCalled();
  });

  test('success logs with checkmark', () => {
    const log = new Logger({ level: 'info', timestamp: false });
    log.success('test success');
    expect(console.log).toHaveBeenCalled();
  });

  test('step logs with arrow', () => {
    const log = new Logger({ level: 'info', timestamp: false });
    log.step('test step');
    expect(console.log).toHaveBeenCalled();
  });

  test('static create returns new Logger', () => {
    const log = Logger.create({ level: 'debug' });
    expect(log).toBeInstanceOf(Logger);
    expect(log.getLevel()).toBe('debug');
  });

  test('global logger functions work', () => {
    setLogLevel('warn');
    expect(getLogLevel()).toBe('warn');
    logger.info('test');
    expect(console.log).not.toHaveBeenCalled();
  });
});
