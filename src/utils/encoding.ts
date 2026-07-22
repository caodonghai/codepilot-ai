import { mojibakePatterns } from '../config/constants';

export function textCorruptionScore(text: string) {
  const patternScore = mojibakePatterns.reduce((score, pattern) => {
    const matches = text.split(pattern).length - 1;
    return score + matches * 10;
  }, 0);
  const controlScore = (text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length * 20;
  return patternScore + controlScore;
}

export function hasMojibake(text: string) {
  return textCorruptionScore(text) > 0;
}

export function fixMojibakeText(text: string) {
  const buffer = Buffer.from(text, 'latin1');
  const decoded = buffer.toString('utf8');
  const beforeScore = textCorruptionScore(text);
  const afterScore = textCorruptionScore(decoded);
  return afterScore < beforeScore ? decoded : text;
}
