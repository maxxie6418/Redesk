import type { BackupModuleId } from '@redesk/shared';

export interface BackupModuleDefinition {
  id: BackupModuleId;
  label: string;
  description: string;
  default_selected: boolean;
  sensitive: boolean;
  risky: boolean;
  dependencies: BackupModuleId[];
}

export const BACKUP_MODULES = [
  {
    id: 'settings.public',
    label: '系统设置',
    description: '普通设置、界面偏好、默认存储方式和不含密钥的外部服务配置。',
    default_selected: true,
    sensitive: false,
    risky: false,
    dependencies: [],
  },
  {
    id: 'settings.secrets',
    label: '敏感配置',
    description: 'LLM、OSS、WebDAV 等外部服务密钥类配置。',
    default_selected: false,
    sensitive: true,
    risky: true,
    dependencies: ['settings.public'],
  },
  {
    id: 'users.auth',
    label: '用户与登录配置',
    description: '用户、管理员、密码哈希和登录权限相关配置。',
    default_selected: false,
    sensitive: true,
    risky: true,
    dependencies: [],
  },
  {
    id: 'library.books',
    label: '书库数据',
    description: '书籍基础元数据、阅读状态、评分、简介、来源和软删除状态。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: [],
  },
  {
    id: 'library.taxonomy',
    label: '分类与标签',
    description: '分类、标签和书籍标签关系。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['library.books'],
  },
  {
    id: 'library.relations',
    label: '书籍关系',
    description: '书籍之间的主动关联、关系类型和关系说明。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['library.books'],
  },
  {
    id: 'assets.file_index',
    label: '文件索引',
    description: '文件名、大小、checksum、存储模式、云端对象 key、主文件和当前封面标记。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['library.books'],
  },
  {
    id: 'assets.book_blobs',
    label: '书籍文件本体',
    description: 'EPUB、PDF 等书籍文件内容。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['assets.file_index'],
  },
  {
    id: 'assets.cover_blobs',
    label: '封面文件本体',
    description: '本地封面图片文件内容。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['assets.file_index'],
  },
  {
    id: 'reading.progress',
    label: '阅读进度',
    description: '书籍阅读进度、当前 CFI 和最后阅读时间。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['library.books', 'assets.file_index'],
  },
  {
    id: 'reading.highlights',
    label: '高亮',
    description: '原文高亮、划线、位置、颜色和标记类型。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['library.books'],
  },
  {
    id: 'reading.notes',
    label: '笔记',
    description: '用户笔记的 HTML 与 Markdown 内容、位置和标记类型。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['library.books'],
  },
  {
    id: 'reading.bookmarks',
    label: '书签',
    description: '阅读书签、位置、标题和进度。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['library.books'],
  },
  {
    id: 'topics.workspace',
    label: '主题工作台',
    description: '主题、主题条目，以及主题与高亮、笔记、片段的引用关系。',
    default_selected: false,
    sensitive: false,
    risky: false,
    dependencies: ['library.books', 'reading.highlights', 'reading.notes'],
  },
  {
    id: 'database.snapshot',
    label: '数据库快照',
    description: 'SQLite 数据库文件快照，用于完整灾备和覆盖恢复。',
    default_selected: false,
    sensitive: false,
    risky: true,
    dependencies: [],
  },
] satisfies BackupModuleDefinition[];

export function getBackupModule(moduleId: BackupModuleId) {
  return BACKUP_MODULES.find((module) => module.id === moduleId);
}
