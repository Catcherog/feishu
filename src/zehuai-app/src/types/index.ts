export type ProjectType = 'client' | 'creative'; // 客片 / 创作片

export type ClientProjectStage =
  | '获客建档' | '策划确认' | '拍摄执行' | '选片确认'
  | '修图交付' | '成片交付' | '分发发布' | '复盘归档';

export type CreativeProjectStage = '待拍摄' | '拍摄中' | '后期制作' | '待交付' | '已完成';
export type ProjectStatus = ClientProjectStage | CreativeProjectStage;
export type ClientStatus = '潜在客户' | '跟进中' | '已成交' | '已归档';

export const CLIENT_STATUSES: ClientStatus[] = ['潜在客户', '跟进中', '已成交', '已归档'];
export type PublishStatus = '待发布' | '发布中' | '已发布' | '已下架';
export type Platform = '小红书' | '抖音' | '朋友圈' | '微博' | 'B站';

export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientId: string;
  status: ProjectStatus;
  scheduledDate: string;
  location: string;
  progress: number;
  totalShots: number;
  completedShots: number;
  createdAt: string;
  deadline: string;
  notes: string;
  planningDocUrl?: string;
  selectionFolderUrl?: string;
  deliveryFolderUrl?: string;
  folderToken?: string;
  ownerId?: string;
  ownerName?: string;
  participants?: string[];
  type: ProjectType;
  stageProgress?: number; // 当前阶段序号（客片 1-8，创作 1-5）
  // 独立字段（原从备注标签解析，现为 Base 独立字段）
  makeupArtist?: string; // 化妆师
  series?: string; // 系列
  theme?: string; // 主题
  optionalModels?: string; // 可选模特
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  wechat: string;
  status: ClientStatus;
  source: string;
  lastContactDate: string;
  totalProjects: number;
  totalRevenue: number;
  tags: string[];
  createdAt: string;
  notes: string;
  followUpRecords: string;
  // 独立字段（Base 客户全生命周期管理表新增）
  preferredTime?: string; // 喜好时间
  shootPeopleCount?: number; // 拍摄人数
  completedShootCount?: number; // 已拍摄次数
  region?: string; // 地区
}

export interface PublishTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  platforms: Platform[];
  status: PublishStatus;
  deadline: string;
  coverUrl: string;
  copyText: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface DashboardStats {
  activeProjects: number;
  pendingPublishTasks: number;
  totalFinishedProducts: number;
  publishedCount: number;
  newClientsThisMonth: number;
}

export interface ProjectStats {
  headers: string[];
  rows: string[][];
  totalProjects: number;
  thisMonthShoots: number;
}

export interface PublishMatrix {
  headers: string[];
  rows: string[][];
}

export interface FeishuRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

export interface FeishuTableResponse {
  items: FeishuRecord[];
  total: number;
  has_more: boolean;
  page_token?: string;
}

export interface CloudBaseCallResult<T = unknown> {
  code: number;
  data: T;
  message: string;
  requestId: string;
}

export interface UserProfile {
  uid: string;
  phone: string;
  nickname: string;
  avatar: string;
  role: string;
  loginAt: string;
  /** 飞书用户唯一标识，用于后续 Contact API 查询角色 */
  open_id?: string;
}

export type AppRole = 'admin' | 'photographer' | 'post';

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: '主理人',
  photographer: '摄影师',
  post: '后期',
};

export interface UserPermission {
  role: AppRole;
  roleLabel: string;
  departmentIds: string[];
  departmentNames: string[];
  managedProjectIds: string[];
  userId?: string;
  userName?: string;
  roleSource?: 'department_id' | 'department_name' | 'default_admin' | 'fallback_offline';
}

export interface NotificationSetting {
  projectReminder: boolean;
  clientFollowUp: boolean;
  publishDeadline: boolean;
  dailyReport: boolean;
}

// ============ 飞书集成新增类型 ============

// 飞书通知类型
export type NotificationType =
  | 'project_status'
  | 'task_deadline'
  | 'client_followup'
  | 'publish_deadline'
  | 'approval';

export interface FeishuNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  content?: string;
  data?: Record<string, unknown>;
  targetChatId?: string;
  targetUserId?: string;
  projectId?: string;
  clientId?: string;
  taskId?: string;
  createdAt: string;
  read: boolean;
}

// 飞书任务类型
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface FeishuTask {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName?: string;
  dueDate: string;
  status: TaskStatus;
  projectId?: string;
  projectName?: string;
  createdAt: string;
}

// 文档引用类型
export type DocumentType = 'docx' | 'sheet' | 'bitable' | 'folder';

export interface DocumentRef {
  token: string;
  type: DocumentType;
  name: string;
  url: string;
  parentToken?: string;
  createdAt?: string;
  modifiedAt?: string;
}

// 自动化规则类型
export interface AutomationRule {
  id: string;
  trigger: {
    event: string;
    condition?: Record<string, unknown>;
  };
  actions: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
  enabled: boolean;
}

// 同步状态类型
export interface SyncStatus {
  lastSyncTime: string;
  totalRecords: number;
  tableId: string;
  isSyncing: boolean;
}

// 资源库类型（客户资源子表已删除，客户数据走 Client 全生命周期管理表）
export type ResourceCategory =
  | 'venue'
  | 'makeup'
  | 'model'
  | 'costume'
  | 'retouch'
  | 'emergency';

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  venue: '场地',
  makeup: '妆造',
  model: '模特',
  costume: '服装',
  retouch: '修图',
  emergency: '应急',
};

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  'venue',
  'makeup',
  'model',
  'costume',
  'retouch',
  'emergency',
];

export interface Resource {
  id: string;
  category: ResourceCategory;
  name: string;
  contact: string;
  price: number;
  priceText: string;
  status: string;
  location: string;
  style: string;
  notes: string;
  tags: string[];
  createdAt: string;
  // 独立字段（Base 资源子表新增）
  address?: string; // 详细地址（妆造师）
  priority?: string; // 优先级 S/A/B（妆造师/模特）
  portfolioUrl?: string; // 作品链接（妆造师/模特）
  size?: string; // 服装尺码（模特）
}

// 项目详情扩展（用于文档和任务关联）
export interface ProjectDetail extends Project {
  documents: DocumentRef[];
  tasks: FeishuTask[];
  chatId?: string;
  folderToken?: string;
}

// ============ Wiki SOP 类型 ============

export type SOPPhase = 'client' | 'project-plan' | 'shooting' | 'post' | 'publish';

export interface WikiNode {
  node_token: string;
  title: string;
  parent_node_token?: string;
  obj_type?: string;
  obj_token?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SOPItem {
  nodeToken: string;
  title: string;
  url: string;
}

// ============ SOP 检查清单类型 ============

export interface SOPChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  required: boolean;
}

export interface SOPChecklist {
  id: string;
  projectType: ProjectType;
  stage: ProjectStatus;
  title: string;
  items: SOPChecklistItem[];
  wikiUrl?: string;
}

export interface ChecklistProgress {
  projectId: string;
  checklistId: string;
  checkedItems: string[];
  updatedAt: string;
}

// ============ 知识库模块类型 ============

/** 知识库目录管理表条目 */
export interface KnowledgeEntry {
  id: string;
  title: string; // 知识标题
  keywords: string[]; // 核心关键词（多选 select）
  scenarios: string[]; // 适用场景（多选 select）
  detailUrl: string; // 知识详情（URL，关联飞书文档/教程）
  relatedProjectIds: string[]; // 关联项目 ID（link 字段，提取 record_id 数组）
  notes: string; // 备注
  knowledgeId: string; // 知识 ID（自动编号，如 ZS001）
  updatedAt: string; // 最后更新时间
}

/** 全场景话术库表条目 */
export interface ScriptEntry {
  id: string;
  scene: string; // 话术场景（单选）
  target: string; // 适用对象（单选）
  goal: string; // 话术核心目标
  content: string; // 话术全文
  conversion: string; // 转化效果（单选：高转化/中转化/低转化/待优化）
  cautions: string; // 注意事项
  notes: string; // 备注
  scriptId: string; // 话术 ID（自动编号，如 HS001）
  relatedClientIds: string[]; // 关联客户阶段（link → clients）
  updatedAt: string; // 版本更新时间
}

/** 总览说明表条目（SOP 规则速查） */
export interface SOPRule {
  id: string;
  category: string; // 规则类别
  name: string; // 规则名称
  content: string; // 规则详细内容
  example: string; // 示例
}

/** 爆款调研库表条目 */
export interface TrendingCase {
  id: string;
  title: string; // 爆款标题
  platform: string; // 所属平台（单选：小红书/抖音/视频号）
  elements: string[]; // 核心爆款元素（多选）
  tags: string; // 热门标签/话题
  copywriting: string; // 全文文案
  url: string; // 爆款笔记链接
  reusablePoints: string; // 可复用点
  interactionData: string; // 互动数据
  publishedAt: string; // 发布时间
  researchId: string; // 调研 ID（自动编号，如 DY001）
  relatedProjectIds: string[]; // 被引用的项目（link → projects）
  relatedPublishIds: string[]; // 被引用的成品（link → publishTasks）
}

// ============ 知识库筛选枚举常量 ============

/** 知识库核心关键词选项（从 Base select 选项提取，仅保留中文） */
export const KNOWLEDGE_KEYWORDS = [
  '拍摄技巧', '后期修图', '运营推广', '客户沟通', '资源管理',
] as const;

/** 知识库适用场景选项 */
export const KNOWLEDGE_SCENARIOS = [
  '拍摄前准备', '拍摄执行', '后期制作', '运营推广', '客户服务',
] as const;

/** 话术场景选项（9 个） */
export const SCRIPT_SCENES = [
  '客户咨询', '预约成交', '拍摄前对接', '拍摄执行', '成片交付',
  '售后维护', '资源首次触达', '资源档期确认', '资源合作对接',
] as const;

/** 话术适用对象选项（6 个） */
export const SCRIPT_TARGETS = [
  '客户', '场地资源', '妆造资源', '模特资源', '修图师资源', '其他资源',
] as const;

/** 话术转化效果选项（4 个） */
export const SCRIPT_CONVERSIONS = [
  '高转化', '中转化', '低转化', '待优化',
] as const;

/** 爆款参考所属平台选项（3 个） */
export const TRENDING_PLATFORMS = [
  '小红书', '抖音', '视频号',
] as const;

/** 爆款参考核心元素选项（8 个） */
export const TRENDING_ELEMENTS = [
  '风格', '妆造', '场景', '文案结构', '拍摄手法', 'BGM', '话题', '情绪价值',
] as const;
