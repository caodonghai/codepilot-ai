type Locale = 'zh-CN' | 'en-US';

interface Translations {
  [key: string]: string;
}

const zhCN: Translations = {
  'change.created': '变更已创建',
  'change.archived': '变更已归档',
  'change.restored': '变更已恢复',
  'change.deleted': '变更已删除',
  'change.not_found': '变更不存在',
  'change.already_exists': '变更已存在',
  'change.incomplete': '变更不完整，无法归档',
  'change.already_archived': '变更已归档',
  
  'validation.passed': '验证通过',
  'validation.failed': '验证失败',
  'validation.missing_files': '缺少必需文件',
  'validation.empty_files': '存在空文件',
  
  'knowledge.added': '知识记录已添加',
  'knowledge.suggestions': '知识建议',
  'knowledge.search_results': '搜索结果',
  'knowledge.no_results': '未找到匹配的知识',
  'knowledge.index_rebuilt': '知识库索引已重建',
  
  'sync.completed': '同步完成',
  'sync.skipped': '跳过同步',
  
  'check.passed': '检查通过',
  'check.failed': '检查失败',
  
  'init.completed': '初始化完成',
  'init.script_added': '已添加 package.json 脚本',
  
  'task.marked_doing': '任务已标记为进行中',
  'task.marked_done': '任务已标记为完成',
  'task.marked_blocked': '任务已标记为阻塞',
  'task.not_found': '未找到任务',
  
  'doctor.checking': '正在检查环境...',
  'doctor.ok': '检查通过',
  'doctor.warning': '检查警告',
  'doctor.error': '检查错误',
  
  'encoding.issues_found': '发现编码问题',
  'encoding.no_issues': '未发现编码问题',
  'encoding.fixed': '编码问题已修复',
  
  'interactive.change_name': '请输入变更名称:',
  'interactive.change_type': '请选择变更类型 (default/bugfix/feature/ui-change/refactor):',
  'interactive.change_description': '请输入变更描述:',
  
  'progress.checking': '正在检查...',
  'progress.syncing': '正在同步...',
  'progress.building_index': '正在构建索引...',
  'progress.completed': '完成',
  
  'error.general': '发生错误',
  'error.timeout': '操作超时',
  'error.permission': '权限不足',
};

const enUS: Translations = {
  'change.created': 'Change created',
  'change.archived': 'Change archived',
  'change.restored': 'Change restored',
  'change.deleted': 'Change deleted',
  'change.not_found': 'Change not found',
  'change.already_exists': 'Change already exists',
  'change.incomplete': 'Change is incomplete, cannot archive',
  'change.already_archived': 'Change already archived',
  
  'validation.passed': 'Validation passed',
  'validation.failed': 'Validation failed',
  'validation.missing_files': 'Missing required files',
  'validation.empty_files': 'Empty files found',
  
  'knowledge.added': 'Knowledge record added',
  'knowledge.suggestions': 'Knowledge suggestions',
  'knowledge.search_results': 'Search results',
  'knowledge.no_results': 'No matching knowledge found',
  'knowledge.index_rebuilt': 'Knowledge index rebuilt',
  
  'sync.completed': 'Sync completed',
  'sync.skipped': 'Sync skipped',
  
  'check.passed': 'Check passed',
  'check.failed': 'Check failed',
  
  'init.completed': 'Initialization completed',
  'init.script_added': 'Package.json script added',
  
  'task.marked_doing': 'Task marked as doing',
  'task.marked_done': 'Task marked as done',
  'task.marked_blocked': 'Task marked as blocked',
  'task.not_found': 'Task not found',
  
  'doctor.checking': 'Checking environment...',
  'doctor.ok': 'Check passed',
  'doctor.warning': 'Check warning',
  'doctor.error': 'Check error',
  
  'encoding.issues_found': 'Encoding issues found',
  'encoding.no_issues': 'No encoding issues found',
  'encoding.fixed': 'Encoding issues fixed',
  
  'interactive.change_name': 'Enter change name:',
  'interactive.change_type': 'Select change type (default/bugfix/feature/ui-change/refactor):',
  'interactive.change_description': 'Enter change description:',
  
  'progress.checking': 'Checking...',
  'progress.syncing': 'Syncing...',
  'progress.building_index': 'Building index...',
  'progress.completed': 'Completed',
  
  'error.general': 'An error occurred',
  'error.timeout': 'Operation timed out',
  'error.permission': 'Permission denied',
};

const translations: Record<Locale, Translations> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

let currentLocale: Locale = 'zh-CN';

export function setLocale(locale: string) {
  if (locale === 'zh-CN' || locale === 'en-US') {
    currentLocale = locale;
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, data?: Record<string, string>): string {
  const translation = translations[currentLocale][key] || translations['en-US'][key] || key;
  if (!data) return translation;
  return translation.replace(/\{\{(\w+)\}\}/g, (_, placeholder) => data[placeholder] || placeholder);
}

export function detectLocale(): Locale {
  const envLang = process.env.LANG || process.env.LANGUAGE || '';
  if (envLang.toLowerCase().includes('zh') || envLang.toLowerCase().includes('cn')) {
    return 'zh-CN';
  }
  return 'en-US';
}

setLocale(detectLocale());
