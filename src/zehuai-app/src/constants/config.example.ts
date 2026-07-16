// 环境相关常量配置（脱敏模板）
// 真实值请在本地 config.ts 中配置（已被 .gitignore 排除）
// 复制本文件为 config.ts 并填入真实值后才能运行 APP

/** 模板库文件夹 token（用于"从模板创建"功能） */
export const TEMPLATE_FOLDER_TOKEN = ''; // 请在飞书云盘中配置真实 folder_token

/** 项目归档库文件夹 token（项目创建自动化时使用） */
export const PROJECT_ARCHIVE_FOLDER_TOKEN = 'FOLDER_TOKEN_PLACEHOLDER';

// ============ 飞书 OAuth 登录配置 ============

/** 飞书应用 App ID（非秘密，可入 App；app_secret 仅存在云函数环境变量） */
export const FEISHU_APP_ID = 'FEISHU_APP_ID_PLACEHOLDER';

/** 飞书开放平台 API 基础地址 */
export const FEISHU_API_BASE = 'https://open.feishu.cn';

/** OAuth 授权页端点 */
export const FEISHU_AUTHORIZE_URL = `${FEISHU_API_BASE}/open-apis/authen/v1/authorize`;

/** OAuth 重定向 URI（注册在飞书开放平台，HTTPS 地址，云函数回调页） */
export const FEISHU_REDIRECT_URI = 'https://YOUR_CLOUD_FUNCTION_DOMAIN/feishu-auth';

/** App 自定义 URL scheme（与 app.json scheme 一致，用于 openAuthSessionAsync 监听回调） */
export const APP_URL_SCHEME = 'zehuai://oauth/callback';

/** OAuth 授权所需 scope（空格分隔）；offline_access 用于获取 refresh_token */
export const FEISHU_OAUTH_SCOPES = [
  'contact:user.base:readonly',
  'contact:contact.base:readonly',
  'contact:user.employee_id:readonly',
  'bitable:app',
  'sheets:spreadsheet',
  'drive:drive:readonly',
  'wiki:wiki:readonly',
  'im:message',
  'task:task:readonly',
  'offline_access',
].join(' ');

// ============ 飞书资源 token（非秘密） ============

/** 多维表格 App Token（主数据源） */
export const BITABLE_APP_TOKEN = 'SOURCE_BASE_ALIAS';

/** 知识库 Space ID（泽怀影像知识库） */
export const WIKI_SPACE_ID = 'WIKI_SPACE_ID_PLACEHOLDER';

/** 云盘根目录 folder_token */
export const DRIVE_ROOT_FOLDER_TOKEN = 'FOLDER_TOKEN_PLACEHOLDER';

// ============ Bitable 表 ID 映射 ============

export const TABLE_IDS = {
  /** 客户全生命周期管理表 */
  clients: 'V1_CLIENTS_TABLE_ALIAS',
  /** 拍摄项目全流程管理表 */
  projects: 'V1_PROJECTS_TABLE_ALIAS',
  /** 成品发布与运营数据表 */
  publishTasks: 'V1_PUBLISH_TASKS_TABLE_ALIAS',
  /** 跨平台发布总看板 */
  publishDashboard: 'V1_PUBLISH_DASHBOARD_TABLE_ALIAS',
  /** 资源子表 */
  venue: 'V1_VENUE_TABLE_ALIAS',
  makeup: 'V1_MAKEUP_TABLE_ALIAS',
  model: 'V1_MODEL_TABLE_ALIAS',
  costume: 'V1_COSTUME_TABLE_ALIAS',
  retouch: 'V1_RETOUCH_TABLE_ALIAS',
  /** 应急资源子表 */
  emergency: 'V1_EMERGENCY_TABLE_ALIAS',
  /** 素材库目录管理表（自动化规则#11触发表） */
  materialLibrary: 'V1_MATERIAL_LIBRARY_TABLE_ALIAS',
  /** 资源总库主表（自动化规则#12触发表 + 项目表"关联资源ID"的关联目标） */
  resourceMaster: 'V1_RESOURCE_MASTER_TABLE_ALIAS',
  /** 知识库目录管理表（自动化规则#12目标表） */
  knowledgeBase: 'V1_KNOWLEDGE_BASE_TABLE_ALIAS',
  /** 爆款调研库表 */
  trendingResearch: 'V1_TRENDING_RESEARCH_TABLE_ALIAS',
  /** 全场景话术库表 */
  scripts: 'V1_SCRIPTS_TABLE_ALIAS',
  /** 总览说明表（SOP 规则速查） */
  sopRules: 'V1_SOP_RULES_TABLE_ALIAS',
  /** SOP迭代优化管理表 */
  sopManagement: 'V1_SOP_MANAGEMENT_TABLE_ALIAS',
} as const;

// ============ 电子表格 token ============

/** 项目统计表 */
export const PROJECT_STATS_SHEET_TOKEN = 'SHEET_TOKEN_PLACEHOLDER';
/** 成品发布情况表 */
export const PUBLISH_MATRIX_SHEET_TOKEN = 'SHEET_TOKEN_PLACEHOLDER';

// ============ 角色映射（飞书部门 ID → APP 角色） ============

/**
 * 飞书部门 ID → AppRole 精确映射表。
 * 当部门 ID 未在此表中配置时，会使用 DEPARTMENT_NAME_KEYWORD_MAP 按部门名称关键词兜底匹配。
 * 如需精确映射，请通过飞书开放平台 API 查询部门 ID 后填入。
 * 示例：'od-xxx': 'admin'
 */
export const DEPARTMENT_ROLE_MAP: Record<string, 'admin' | 'photographer' | 'post'> = {
  // 当前依赖 DEPARTMENT_NAME_KEYWORD_MAP 的关键词兜底机制进行角色判定
  // 如需精确部门ID映射，请查询飞书通讯录部门ID后在此添加
};

/** 默认部门名关键词 → 角色兜底映射（部门 ID 未命中时按名称匹配） */
export const DEPARTMENT_NAME_KEYWORD_MAP: Array<{ keywords: string[]; role: 'admin' | 'photographer' | 'post' }> = [
  { keywords: ['管理', '老板', '总'], role: 'admin' },
  { keywords: ['摄影', '拍摄'], role: 'photographer' },
  { keywords: ['后期', '修图', '剪辑'], role: 'post' },
  { keywords: ['运营', '发布'], role: 'post' },
];
