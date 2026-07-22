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
  ]
    .join(' ')
    .toLowerCase();
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
  it('应将所有字段合并为搜索文本', () => {
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
    searchText:
      'component:my-button:ui component mybutton ui packages/ui a custom button component for the ui button ui component apps/web/src/components',
  };

  it('应根据多个字段匹配进行评分', () => {
    expect(scoreKnowledgeRecord(record, ['ui'])).toBe(19);
  });

  it('应评分名称匹配', () => {
    expect(scoreKnowledgeRecord(record, ['mybutton'])).toBe(9);
  });

  it('应评分关键词匹配', () => {
    const record2 = {
      ...record,
      searchText: '',
      summary: '',
      id: 'test',
      name: 'Other',
      scope: 'other',
      source: 'other',
    };
    expect(scoreKnowledgeRecord(record2, ['button'])).toBe(7);
  });

  it('应为活跃状态加分', () => {
    const inactiveRecord = { ...record, status: 'deprecated' as const };
    expect(scoreKnowledgeRecord(record, ['test'])).toBe(
      scoreKnowledgeRecord(inactiveRecord, ['test']) + 1,
    );
  });

  it('应为已确认置信度加分', () => {
    const uncertainRecord = { ...record, confidence: 'uncertain' as const };
    expect(scoreKnowledgeRecord(record, ['test'])).toBe(
      scoreKnowledgeRecord(uncertainRecord, ['test']) + 1,
    );
  });

  it('应返回基本分数（无内容匹配但有状态奖励）', () => {
    expect(scoreKnowledgeRecord(record, ['nonexistent'])).toBe(2);
  });

  it('应为多个术语累积评分', () => {
    const score = scoreKnowledgeRecord(record, ['button', 'ui']);
    expect(score).toBeGreaterThan(scoreKnowledgeRecord(record, ['button']));
    expect(score).toBeGreaterThan(scoreKnowledgeRecord(record, ['ui']));
  });
});

describe('tokenizeKnowledgeText', () => {
  it('应提取英文 tokens', () => {
    const tokens = tokenizeKnowledgeText('MyButton component for UI');
    expect(tokens).toContain('mybutton');
    expect(tokens).toContain('component');
    expect(tokens).toContain('ui');
  });

  it('应将中文 tokens 提取为连续块', () => {
    const tokens = tokenizeKnowledgeText('用户登录组件 UserLogin');
    expect(tokens).toContain('用户登录组件');
    expect(tokens).toContain('userlogin');
  });

  it('应提取分隔的中文短语', () => {
    const tokens = tokenizeKnowledgeText('用户登录 组件 UserLogin');
    expect(tokens).toContain('用户登录');
    expect(tokens).toContain('组件');
  });

  it('应去重 tokens', () => {
    const tokens = tokenizeKnowledgeText('button button ui ui');
    expect(tokens.filter((t) => t === 'button').length).toBe(1);
    expect(tokens.filter((t) => t === 'ui').length).toBe(1);
  });
});
