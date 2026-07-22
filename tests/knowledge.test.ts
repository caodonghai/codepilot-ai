import { describe, it, expect } from 'vitest';

type KnowledgeType = 'component' | 'function' | 'pattern' | 'decision' | 'failure';
type KnowledgeStatus = 'active' | 'deprecated';
type KnowledgeConfidence = 'confirmed' | 'uncertain';

interface KnowledgeRecord {
  id: string;
  type: KnowledgeType;
  name: string;
  scope: string;
  source: string;
  summary: string;
  keywords: string[];
  usedIn: string[];
  status: KnowledgeStatus;
  confidence: KnowledgeConfidence;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeIndexRecord extends KnowledgeRecord {
  file: string;
  searchText: string;
}

function buildKnowledgeSearchText(record: KnowledgeRecord) {
  return [
    record.id,
    record.type,
    record.name,
    record.scope,
    record.source,
    record.summary,
    ...record.keywords,
    ...record.usedIn,
  ].join(' ').toLowerCase();
}

function scoreKnowledgeRecord(record: KnowledgeIndexRecord, terms: string[]) {
  let score = 0;
  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (!normalized) continue;
    if (record.id.toLowerCase().includes(normalized)) score += 8;
    if (record.name.toLowerCase().includes(normalized)) score += 6;
    if (record.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))) score += 5;
    if (record.summary.toLowerCase().includes(normalized)) score += 3;
    if (record.searchText.includes(normalized)) score += 1;
  }
  if (record.status === 'active') score += 1;
  if (record.confidence === 'confirmed') score += 1;
  return score;
}

function tokenizeKnowledgeText(text: string) {
  const normalized = text.toLowerCase();
  const tokens = normalized.match(/[a-z0-9_.:/@-]+|[\u4e00-\u9fa5]{2,}/g) ?? [];
  const seen = new Set<string>();
  return tokens.filter((token) => {
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

describe('buildKnowledgeSearchText', () => {
  it('should combine all fields into search text', () => {
    const record: KnowledgeRecord = {
      id: 'component:button:ui',
      type: 'component',
      name: 'Button',
      scope: 'ui',
      source: 'packages/ui',
      summary: 'A reusable button component',
      keywords: ['button', 'ui', 'component'],
      usedIn: ['apps/web/src/components'],
      status: 'active',
      confidence: 'confirmed',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    const searchText = buildKnowledgeSearchText(record);
    expect(searchText).toContain('button');
    expect(searchText).toContain('component');
    expect(searchText).toContain('ui');
    expect(searchText).toBe(searchText.toLowerCase());
  });
});

describe('scoreKnowledgeRecord', () => {
  const record: KnowledgeIndexRecord = {
    id: 'component:my-button:ui',
    type: 'component',
    name: 'MyButton',
    scope: 'ui',
    source: 'packages/ui',
    summary: 'A custom button component for the UI',
    keywords: ['button', 'ui', 'component'],
    usedIn: ['apps/web/src/components'],
    status: 'active',
    confidence: 'confirmed',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    file: 'knowledge/components.jsonl',
    searchText: 'component:my-button:ui component mybutton ui packages/ui a custom button component for the ui button ui component apps/web/src/components',
  };

  it('should score based on multiple field matches', () => {
    expect(scoreKnowledgeRecord(record, ['ui'])).toBe(19);
  });

  it('should score name match', () => {
    expect(scoreKnowledgeRecord(record, ['mybutton'])).toBe(9);
  });

  it('should score keyword match', () => {
    const record2 = { ...record, searchText: '', summary: '', id: 'test', name: 'Other', scope: 'other', source: 'other' };
    expect(scoreKnowledgeRecord(record2, ['button'])).toBe(7);
  });

  it('should add bonus for active status', () => {
    const inactiveRecord = { ...record, status: 'deprecated' as const };
    expect(scoreKnowledgeRecord(record, ['test'])).toBe(
      scoreKnowledgeRecord(inactiveRecord, ['test']) + 1
    );
  });

  it('should add bonus for confirmed confidence', () => {
    const uncertainRecord = { ...record, confidence: 'uncertain' as const };
    expect(scoreKnowledgeRecord(record, ['test'])).toBe(
      scoreKnowledgeRecord(uncertainRecord, ['test']) + 1
    );
  });

  it('should return base score for no content match but with status bonuses', () => {
    expect(scoreKnowledgeRecord(record, ['nonexistent'])).toBe(2);
  });

  it('should accumulate scores for multiple terms', () => {
    const score = scoreKnowledgeRecord(record, ['button', 'ui']);
    expect(score).toBeGreaterThan(scoreKnowledgeRecord(record, ['button']));
    expect(score).toBeGreaterThan(scoreKnowledgeRecord(record, ['ui']));
  });
});

describe('tokenizeKnowledgeText', () => {
  it('should extract English tokens', () => {
    const tokens = tokenizeKnowledgeText('MyButton component for UI');
    expect(tokens).toContain('mybutton');
    expect(tokens).toContain('component');
    expect(tokens).toContain('ui');
  });

  it('should extract Chinese tokens as contiguous blocks', () => {
    const tokens = tokenizeKnowledgeText('用户登录组件 UserLogin');
    expect(tokens).toContain('用户登录组件');
    expect(tokens).toContain('userlogin');
  });

  it('should extract separate Chinese phrases when separated', () => {
    const tokens = tokenizeKnowledgeText('用户登录 组件 UserLogin');
    expect(tokens).toContain('用户登录');
    expect(tokens).toContain('组件');
  });

  it('should deduplicate tokens', () => {
    const tokens = tokenizeKnowledgeText('button button ui ui');
    expect(tokens.filter((t) => t === 'button').length).toBe(1);
    expect(tokens.filter((t) => t === 'ui').length).toBe(1);
  });
});
