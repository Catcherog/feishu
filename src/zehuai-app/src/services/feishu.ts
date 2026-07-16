import { bitableGet, bitableCreate, bitableUpdate, bitableGetRecordById, feishuRequest } from './feishuDirectApi';
import { markPendingSync } from './pendingSync';
import { addNotification } from './notificationStore';
import { getLastSyncTime, getSyncingState } from './syncState';
import { formatDateTime } from '../utils/format';
import {
  BITABLE_APP_TOKEN,
  TABLE_IDS,
  WIKI_SPACE_ID,
  PROJECT_STATS_SHEET_TOKEN,
  PUBLISH_MATRIX_SHEET_TOKEN,
  DEPARTMENT_ROLE_MAP,
  DEPARTMENT_NAME_KEYWORD_MAP,
} from '../constants/config';
import { Project, Client, PublishTask, FeishuTask, TaskStatus, DocumentRef, DocumentType, SyncStatus, Resource, ResourceCategory, ProjectStats, PublishMatrix, SOPPhase, WikiNode, SOPItem, AppRole, UserPermission, KnowledgeEntry, ScriptEntry, SOPRule, TrendingCase, FeishuRecord } from '../types';

// ============ 数据映射 ============

function extractText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return new Date(val).toISOString();
  if (Array.isArray(val)) {
    const texts = val.filter((v: Record<string, unknown>) => v.text).map((v: Record<string, unknown>) => v.text);
    return texts.filter(Boolean).join(', ');
  }
  return String(val);
}

function parseDateSafe(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function mapBitableRecordToProject(item: { record_id: string; fields: Record<string, unknown> }): Project {
  const f = item.fields;

  const notes = (f['备注'] || '') as string;

  // 关联客户 ID 是 link 类型，值为数组 [{record_id, ...}]
  const linkedClient = f['关联客户 ID'];
  let clientId = '';
  if (Array.isArray(linkedClient) && linkedClient.length > 0) {
    clientId = (linkedClient[0].record_id || '') as string;
  }
  // 客户名称现为独立字段，优先读取；为空时回退到关联客户的文本
  const clientNameField = extractText(f['客户名称']);
  let clientName = clientNameField
    || (Array.isArray(linkedClient) && linkedClient.length > 0
      ? ((linkedClient[0].text || linkedClient[0].name || '') as string)
      : '');

  // 项目负责人：优先 Bitable User（人员）字段格式 {id: "ou_xxx", name: "张三"}
  const linkedOwner = f['项目负责人'] || f['负责人'];
  let ownerId = '';
  let ownerName = '';
  if (Array.isArray(linkedOwner) && linkedOwner.length > 0) {
    const firstOwner = linkedOwner[0] as Record<string, unknown>;
    ownerId = (firstOwner.id || firstOwner.open_id || firstOwner.user_id || firstOwner.record_id || '') as string;
    ownerName = (firstOwner.name || firstOwner.text || '') as string;
  } else {
    ownerName = extractText(linkedOwner) || extractText(f['负责人姓名'] || f['摄影师'] || f['项目负责人ID']);
    ownerId = extractText(f['项目负责人ID'] || f['负责人ID']);
  }

  // 化妆师现为独立字段
  const makeupArtist = extractText(f['化妆师']);

  // 参与人/团队成员（用于后期负责人等角色判断）
  const participants: string[] = [];
  const participantField = f['参与人'] || f['团队成员'] || f['后期负责人'];
  if (Array.isArray(participantField)) {
    participantField.forEach((p: any) => {
      const pid = p?.id || p?.open_id || p?.user_id;
      const pname = p?.name || p?.text;
      if (pid) participants.push(String(pid));
      if (pname && !participants.includes(String(pname))) participants.push(String(pname));
    });
  } else if (participantField) {
    const text = extractText(participantField);
    if (text) participants.push(...text.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean));
  }
  // 可选模特现为独立字段
  const optionalModels = extractText(f['可选模特']);
  if (optionalModels) {
    participants.push(optionalModels);
  }

  // 系列、主题现为独立字段
  const series = extractText(f['系列']);
  const theme = extractText(f['主题']);

  // 项目名称 fallback：为空或 "/" 时从主题/系列/客户名称回退
  let projectName = (f['项目名称'] || '') as string;
  if (!projectName || projectName === '/' || projectName.trim() === '') {
    projectName = theme || series || clientName || '未命名项目';
  }

  // 项目状态是 select 类型，值为字符串
  const rawStatus = (f['项目状态'] || '待拍摄') as string;
  // 策划案文件支持文本链接或 attachment 类型
  const planningDoc = Array.isArray(f['策划案文件']) && f['策划案文件'].length > 0
    ? ((f['策划案文件'][0].file_token || f['策划案文件'][0].url || '') as string)
    : extractText(f['策划案文件']);
  return {
    id: item.record_id,
    name: projectName,
    clientName: clientName || extractText(linkedClient),
    clientId,
    status: rawStatus as Project['status'],
    scheduledDate: extractText(f['拍摄档期']),
    location: (f['拍摄地点'] || '') as string,
    progress: Number(f['进度'] || 0),
    totalShots: Number(f['总拍摄数'] || 0),
    completedShots: Number(f['已完成拍摄数'] || 0),
    createdAt: extractText(f['创建时间']),
    deadline: extractText(f['精修交付时间']),
    notes,
    planningDocUrl: planningDoc,
    selectionFolderUrl: (f['素材库超链接'] || '') as string,
    deliveryFolderUrl: extractText(f['项目云盘文件夹']),
    folderToken: '',
    ownerId,
    ownerName,
    participants,
    makeupArtist,
    series,
    theme,
    optionalModels,
    type: 'creative',
  };
}

function mapBitableRecordToClient(item: { record_id: string; fields: Record<string, unknown> }): Client {
  const f = item.fields;
  // 关联项目 ID 是 link 类型，若存在则 totalProjects 取数组长度
  const linkedProjects = f['关联项目 ID'];
  const totalProjects = Array.isArray(linkedProjects) ? linkedProjects.length : 0;
  return {
    id: item.record_id,
    name: (f['客户姓名'] || '') as string,
    phone: (f['联系方式'] || '') as string,
    wechat: (f['微信号'] || '') as string,
    status: (f['客户状态'] || '潜在客户') as Client['status'],
    source: (f['来源渠道'] || '') as string,
    lastContactDate: extractText(f['咨询时间']),
    totalProjects,
    totalRevenue: Number(f['成交金额'] || 0),
    tags: [],
    createdAt: extractText(f['创建时间'] || f['录入日期']),
    notes: (f['备注'] || '') as string,
    followUpRecords: (f['跟进记录'] || '') as string,
    // 独立字段（原无独立字段，现 Base 已新增）
    preferredTime: extractText(f['喜好时间']),
    shootPeopleCount: Number(f['拍摄人数'] || 0),
    completedShootCount: Number(f['已拍摄次数'] || 0),
    region: (f['地区'] || '') as string,
  };
}

function mapBitableRecordToPublishTask(item: { record_id: string; fields: Record<string, unknown> }): PublishTask {
  const f = item.fields;
  // 所属项目是 link 类型，值为数组 [{record_id, text, name}]
  const linkedProject = f['所属项目'];
  let projectName = '';
  let projectId = '';
  if (Array.isArray(linkedProject) && linkedProject.length > 0) {
    projectId = (linkedProject[0].record_id || '') as string;
    projectName = (linkedProject[0].text || linkedProject[0].name || '') as string;
  }
  // 所属平台是 select 类型（单选）
  const platform = (f['所属平台'] || '') as string;
  // 发布状态是 select 类型
  const rawStatus = (f['发布状态'] || '待发布') as string;
  // 成品文件是 attachment 类型
  const hasAttachment = Array.isArray(f['成品文件']) && f['成品文件'].length > 0;
  return {
    id: item.record_id,
    title: (f['发布标题'] || f['成品 ID'] || '') as string,
    projectId,
    projectName: projectName || extractText(linkedProject),
    platforms: (platform ? [platform] : []) as PublishTask['platforms'],
    status: rawStatus as PublishTask['status'],
    deadline: extractText(f['计划发布时间']),
    coverUrl: hasAttachment ? 'attachment' : '',
    copyText: (f['发布文案'] || '') as string,
    publishedAt: extractText(f['实际发布时间']),
    viewCount: Number(f['播放量'] || f['view_count'] || 0),
    likeCount: Number(f['点赞数'] || f['like_count'] || 0),
    commentCount: Number(f['评论数'] || f['comment_count'] || 0),
  };
}

// 资源分类 → Base 子表 ID 映射（客户资源子表已删除，client 分类已移除）
const RESOURCE_TABLE_IDS: Record<ResourceCategory, string> = {
  venue: TABLE_IDS.venue,
  makeup: TABLE_IDS.makeup,
  model: TABLE_IDS.model,
  costume: TABLE_IDS.costume,
  retouch: TABLE_IDS.retouch,
  emergency: TABLE_IDS.emergency,
};

function mapBitableRecordToResource(
  item: { record_id: string; fields: Record<string, unknown> },
  category: ResourceCategory
): Resource {
  const f = item.fields;
  const rawName = (f['名称'] || f['姓名'] || f['资源名称'] || f['场地名称'] || f['服装名称/品牌'] || f['服装名称'] || f['艺名/昵称'] || '') as string;
  const name = (!rawName || rawName === '/' || rawName === '-') ? '' : rawName;
  const contact = extractText(f['联系方式'] || f['电话'] || f['手机号'] || f['微信'] || f['微信号'] || '');
  const rawPrice = f['价格'] || f['单价'] || f['价格/小时'] || f['参考报价'] || f['租金'] || f['妆造报价'] || f['报价'] || 0;
  const price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice) || 0;
  // 状态/合作状态/服装状态均为 select 类型，Base 返回 [{text: "已合作"}] 数组形式，用 extractText 处理
  const status = extractText(f['服装状态'] || f['合作状态'] || f['状态'] || f['库存状态'] || '');
  const location = (f['所在地'] || f['地址'] || f['地点'] || f['位置'] || f['拍摄地点'] || '') as string;
  const address = (f['详细地址'] || '') as string;
  const priority = extractText(f['优先级']);
  const portfolioUrl = extractText(f['作品链接']);
  const size = (f['服装尺码'] || f['尺码'] || '') as string;
  const style = (f['风格'] || f['擅长风格'] || f['类型'] || f['服装类型'] || f['服装类别'] || f['来源渠道'] || '') as string;
  const notes = (f['备注'] || '') as string;

  const tags: string[] = [];
  if (location.trim()) tags.push(location.trim());
  if (style.trim()) tags.push(style.trim());

  let priceText = '';
  if (price > 0) {
    if (price >= 10000) {
      priceText = `¥${(price / 10000).toFixed(1)}万`;
    } else {
      priceText = `¥${price.toLocaleString('zh-CN')}`;
    }
  }

  return {
    id: item.record_id,
    category,
    name,
    contact,
    price,
    priceText,
    status,
    location,
    style,
    notes,
    tags,
    createdAt: extractText(f['创建时间'] || f['录入日期']),
    address,
    priority,
    portfolioUrl,
    size,
  };
}

// ============ 知识库模块 Mapper ============

/** 从飞书 link 字段提取 record_id 数组（link 字段格式为 [{ record_id, ... }] 或 [{ text, record_ids: [id] }]） */
function extractLinkIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const v = item as Record<string, unknown>;
    if (typeof v.record_id === 'string') {
      ids.push(v.record_id);
    } else if (Array.isArray(v.record_ids)) {
      for (const id of v.record_ids) {
        if (typeof id === 'string') ids.push(id);
      }
    }
  }
  return ids;
}

function mapBitableRecordToKnowledge(record: FeishuRecord): KnowledgeEntry {
  const f = record.fields || {};
  return {
    id: record.record_id,
    title: extractText(f['知识标题']),
    keywords: extractText(f['核心关键词']).split(',').map(s => s.trim()).filter(Boolean),
    scenarios: extractText(f['适用场景']).split(',').map(s => s.trim()).filter(Boolean),
    detailUrl: extractText(f['知识详情']),
    relatedProjectIds: extractLinkIds(f['关联项目 ID']),
    notes: extractText(f['备注']),
    knowledgeId: extractText(f['知识 ID']),
    updatedAt: extractText(f['最后更新时间']),
  };
}

function mapBitableRecordToScript(record: FeishuRecord): ScriptEntry {
  const f = record.fields || {};
  return {
    id: record.record_id,
    scene: extractText(f['话术场景']),
    target: extractText(f['适用对象']),
    goal: extractText(f['话术核心目标']),
    content: extractText(f['话术全文']),
    conversion: extractText(f['转化效果']),
    cautions: extractText(f['注意事项']),
    notes: extractText(f['备注']),
    scriptId: extractText(f['话术 ID']),
    relatedClientIds: extractLinkIds(f['关联客户阶段']),
    updatedAt: extractText(f['版本更新时间']) || extractText(f['最后更新时间']),
  };
}

function mapBitableRecordToSOPRule(record: FeishuRecord): SOPRule {
  const f = record.fields || {};
  return {
    id: record.record_id,
    category: extractText(f['规则类别']),
    name: extractText(f['规则名称']),
    content: extractText(f['规则详细内容']),
    example: extractText(f['示例']),
  };
}

function mapBitableRecordToTrendingCase(record: FeishuRecord): TrendingCase {
  const f = record.fields || {};
  return {
    id: record.record_id,
    title: extractText(f['爆款标题']),
    platform: extractText(f['所属平台']),
    elements: extractText(f['核心爆款元素']).split(',').map(s => s.trim()).filter(Boolean),
    tags: extractText(f['热门标签/话题']),
    copywriting: extractText(f['全文文案']),
    url: extractText(f['爆款笔记链接']),
    reusablePoints: extractText(f['可复用点']),
    interactionData: extractText(f['互动数据']),
    publishedAt: extractText(f['发布时间']),
    researchId: extractText(f['调研 ID']),
    relatedProjectIds: extractLinkIds(f['被引用的项目']),
    relatedPublishIds: extractLinkIds(f['被引用的成品']),
  };
}

// ============ 查询接口 ============

export async function getProjects(params?: {
  status?: string;
  filter?: string;
  pageSize?: number;
}): Promise<{ data: Project[]; total: number }> {
  const res = await bitableGet(BITABLE_APP_TOKEN, TABLE_IDS.projects, {
    pageSize: params?.pageSize || 100,
    filter: params?.filter,
  });

  let items = (res.items || []).map(mapBitableRecordToProject);

  // 当传入 filter 时不再做客户端 status 过滤（避免双重过滤），仅保留 status 单独使用时的客户端过滤
  if (params?.status && !params?.filter) {
    items = items.filter(p => p.status === params.status);
  }

  return { data: items, total: items.length };
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  try {
    const record = await bitableGetRecordById(BITABLE_APP_TOKEN, TABLE_IDS.projects, projectId);
    return mapBitableRecordToProject(record);
  } catch (e) {
    console.warn('查询单条项目失败:', e);
    return null;
  }
}

export async function getClients(params?: {
  status?: string;
  keyword?: string;
  pageSize?: number;
}): Promise<{ data: Client[]; total: number }> {
  const res = await bitableGet(BITABLE_APP_TOKEN, TABLE_IDS.clients, {
    pageSize: params?.pageSize || 100,
  });

  let items = (res.items || []).map(mapBitableRecordToClient);

  if (params?.status) {
    items = items.filter(c => c.status === params.status);
  }
  if (params?.keyword) {
    const kw = params.keyword.toLowerCase();
    items = items.filter(c => c.name.toLowerCase().includes(kw) || c.phone.includes(kw));
  }

  return { data: items, total: items.length };
}

export async function getPublishTasks(params?: {
  status?: string;
  filter?: string;
  pageSize?: number;
}): Promise<{ data: PublishTask[]; total: number }> {
  const res = await bitableGet(BITABLE_APP_TOKEN, TABLE_IDS.publishTasks, {
    pageSize: params?.pageSize || 100,
    filter: params?.filter,
  });

  let items = (res.items || []).map(mapBitableRecordToPublishTask);

  // 当传入 filter 时不再做客户端 status 过滤（避免双重过滤），仅保留 status 单独使用时的客户端过滤
  if (params?.status && !params?.filter) {
    items = items.filter(t => t.status === params.status);
  }

  return { data: items, total: items.length };
}

export async function getUserRole(openId?: string, _phone?: string): Promise<UserPermission> {
  const fallback: UserPermission = {
    role: 'photographer',
    roleLabel: '',
    departmentIds: [],
    departmentNames: [],
    managedProjectIds: [],
    userId: openId,
    userName: '',
    roleSource: 'fallback_offline',
  };

  if (!openId) return fallback;

  try {
    const res = await feishuRequest<{
      user?: {
        name?: string;
        avatar?: { avatar_72?: string };
        mobile?: string;
        department_ids?: string[];
      };
    }>('GET', '/open-apis/contact/v3/users/' + openId, {
      query: { user_id_type: 'open_id' },
    });

    const user = res?.user || {};
    const departmentIds = user.department_ids || [];

    let role: AppRole = 'admin';
    let roleMatched = false;
    let roleSource: UserPermission['roleSource'] = 'default_admin';

    for (const deptId of departmentIds) {
      const mapped = DEPARTMENT_ROLE_MAP[deptId];
      if (mapped) {
        role = mapped;
        roleMatched = true;
        roleSource = 'department_id';
        break;
      }
    }

    const departmentNames: string[] = [];
    if (!roleMatched && departmentIds.length > 0) {
      try {
        const primaryDeptId = departmentIds[0];
        const deptRes = await feishuRequest<{
          department?: { name?: string };
        }>('GET', '/open-apis/contact/v3/departments/' + primaryDeptId, {
          query: { department_id_type: 'department_id' },
        });
        const deptName = deptRes?.department?.name || '';
        if (deptName) {
          departmentNames.push(deptName);
          for (const rule of DEPARTMENT_NAME_KEYWORD_MAP) {
            if (rule.keywords.some((kw) => deptName.includes(kw))) {
              role = rule.role;
              roleMatched = true;
              roleSource = 'department_name';
              break;
            }
          }
        }
      } catch (deptErr) {
        console.warn('查询部门名称失败，跳过关键词匹配:', deptErr);
      }
    }

    const validRoles: AppRole[] = ['admin', 'photographer', 'post'];
    return {
      role: validRoles.includes(role) ? role : 'photographer',
      roleLabel: '',
      departmentIds,
      departmentNames,
      managedProjectIds: [],
      userId: openId,
      userName: user.name || '',
      roleSource,
    };
  } catch (e) {
    console.warn('getUserRole 失败，降级为 photographer (离线模式):', e);
    return fallback;
  }
}

export async function getResources(
  category: ResourceCategory,
  params?: {
    keyword?: string;
    pageSize?: number;
  }
): Promise<{ data: Resource[]; total: number }> {
  const tableId = RESOURCE_TABLE_IDS[category];
  const res = await bitableGet(BITABLE_APP_TOKEN, tableId, {
    pageSize: params?.pageSize || 100,
  });

  let items = (res.items || []).map((item) => mapBitableRecordToResource(item, category));

  if (params?.keyword) {
    const kw = params.keyword.toLowerCase();
    items = items.filter(
      (r) =>
        r.name.toLowerCase().includes(kw) ||
        r.contact.toLowerCase().includes(kw) ||
        r.notes.toLowerCase().includes(kw) ||
        r.tags.some((tag) => tag.toLowerCase().includes(kw))
    );
  }

  return { data: items, total: items.length };
}

// ============ 知识库模块查询 ============

export async function getKnowledgeEntries(params?: {
  keyword?: string;
  keywords?: string[];
  scenarios?: string[];
  pageSize?: number;
}): Promise<{ data: KnowledgeEntry[]; total: number }> {
  try {
    // 构造 filter：核心关键词或适用场景的精确匹配
    const conditions: string[] = [];
    if (params?.keywords && params.keywords.length > 0) {
      // multi-select 字段使用 CurrentValue.Contains 语法
      const conds = params.keywords.map(k => `CurrentValue.[核心关键词].Contains("${k}")`);
      conditions.push(`OR(${conds.join(',')})`);
    }
    if (params?.scenarios && params.scenarios.length > 0) {
      const conds = params.scenarios.map(s => `CurrentValue.[适用场景].Contains("${s}")`);
      conditions.push(`OR(${conds.join(',')})`);
    }
    const filter = conditions.length > 0 ? `AND(${conditions.join(',')})` : undefined;

    const res = await bitableGet(BITABLE_APP_TOKEN, TABLE_IDS.knowledgeBase, {
      pageSize: params?.pageSize || 100,
      filter,
    });
    let items = (res.items || []).map(mapBitableRecordToKnowledge);

    // 客户端 keyword 模糊搜索（按知识标题）
    if (params?.keyword) {
      const kw = params.keyword.toLowerCase();
      items = items.filter(k => k.title.toLowerCase().includes(kw));
    }
    return { data: items, total: items.length };
  } catch (e) {
    console.warn('getKnowledgeEntries 失败:', e);
    return { data: [], total: 0 };
  }
}

export async function getScriptLibrary(params?: {
  scene?: string;
  target?: string;
  conversion?: string;
  keyword?: string;
  pageSize?: number;
}): Promise<{ data: ScriptEntry[]; total: number }> {
  try {
    const conditions: string[] = [];
    if (params?.scene) conditions.push(`CurrentValue.[话术场景]="${params.scene}"`);
    if (params?.target) conditions.push(`CurrentValue.[适用对象]="${params.target}"`);
    if (params?.conversion) conditions.push(`CurrentValue.[转化效果]="${params.conversion}"`);
    const filter = conditions.length > 0 ? `AND(${conditions.join(',')})` : undefined;

    const res = await bitableGet(BITABLE_APP_TOKEN, TABLE_IDS.scripts, {
      pageSize: params?.pageSize || 100,
      filter,
    });
    let items = (res.items || []).map(mapBitableRecordToScript);

    // 客户端 keyword 模糊搜索（话术核心目标 + 话术全文）
    if (params?.keyword) {
      const kw = params.keyword.toLowerCase();
      items = items.filter(s =>
        s.goal.toLowerCase().includes(kw) || s.content.toLowerCase().includes(kw)
      );
    }
    return { data: items, total: items.length };
  } catch (e) {
    console.warn('getScriptLibrary 失败:', e);
    return { data: [], total: 0 };
  }
}

export async function getSOPRules(params?: {
  category?: string;
  pageSize?: number;
}): Promise<{ data: SOPRule[]; total: number }> {
  try {
    // 总览说明表无 select 字段，规则类别为 text，无法服务端筛选，统一客户端过滤
    const res = await bitableGet(BITABLE_APP_TOKEN, TABLE_IDS.sopRules, {
      pageSize: params?.pageSize || 100,
    });
    let items = (res.items || []).map(mapBitableRecordToSOPRule);

    if (params?.category) {
      items = items.filter(r => r.category === params.category);
    }
    return { data: items, total: items.length };
  } catch (e) {
    console.warn('getSOPRules 失败:', e);
    return { data: [], total: 0 };
  }
}

export async function getTrendingResearch(params?: {
  platform?: string;
  elements?: string[];
  keyword?: string;
  pageSize?: number;
}): Promise<{ data: TrendingCase[]; total: number }> {
  try {
    const conditions: string[] = [];
    if (params?.platform) conditions.push(`CurrentValue.[所属平台]="${params.platform}"`);
    if (params?.elements && params.elements.length > 0) {
      const conds = params.elements.map(el => `CurrentValue.[核心爆款元素].Contains("${el}")`);
      conditions.push(`OR(${conds.join(',')})`);
    }
    const filter = conditions.length > 0 ? `AND(${conditions.join(',')})` : undefined;

    const res = await bitableGet(BITABLE_APP_TOKEN, TABLE_IDS.trendingResearch, {
      pageSize: params?.pageSize || 100,
      filter,
    });
    let items = (res.items || []).map(mapBitableRecordToTrendingCase);

    // 客户端 keyword 模糊搜索（爆款标题 + 可复用点）
    if (params?.keyword) {
      const kw = params.keyword.toLowerCase();
      items = items.filter(c =>
        c.title.toLowerCase().includes(kw) || c.reusablePoints.toLowerCase().includes(kw)
      );
    }
    return { data: items, total: items.length };
  } catch (e) {
    console.warn('getTrendingResearch 失败:', e);
    return { data: [], total: 0 };
  }
}

// ============ 仪表盘统计 ============

export async function getDashboardStats(): Promise<{
  activeProjects: number;
  pendingPublishTasks: number;
  totalFinishedProducts: number;
  publishedCount: number;
  newClientsThisMonth: number;
}> {
  const [projects, clients, publish] = await Promise.all([
    // 使用服务端 filter 排除"已完成"和"已归档"项目，pageSize 降至 100
    getProjects({
      pageSize: 100,
      filter: 'AND(CurrentValue.[项目状态] != "已完成", CurrentValue.[项目状态] != "已归档")',
    }),
    getClients({ pageSize: 500 }),
    // publish 不传 filter，需全部数据计算多个统计（待发布、已发布、成品总数）
    getPublishTasks({ pageSize: 500 }),
  ]);

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const newClientsThisMonth = clients.data.filter(
    (c) => !!c.createdAt && c.createdAt.startsWith(monthPrefix)
  ).length;

  // filter 已排除已完成/已归档项目，activeProjects 直接取数据长度
  return {
    activeProjects: projects.data.length,
    pendingPublishTasks: publish.data.filter(t => t.status === '待发布').length,
    totalFinishedProducts: publish.data.length,
    publishedCount: publish.data.filter(t => t.status === '已发布').length,
    newClientsThisMonth,
  };
}

// ============ 写入接口 ============

export async function createProject(fields: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await bitableCreate(BITABLE_APP_TOKEN, TABLE_IDS.projects, fields);
    const recordId = res?.record?.record_id || '';
    return recordId || null;
  } catch (e) {
    console.warn('创建项目失败，已标记待同步:', e);
    await markPendingSync('projects', { fields });
    return null;
  }
}

export async function updateProject(recordId: string, fields: Record<string, unknown>, oldStatus?: string): Promise<boolean> {
  try {
    await bitableUpdate(BITABLE_APP_TOKEN, TABLE_IDS.projects, recordId, fields);
    if (fields['项目状态'] && oldStatus && fields['项目状态'] !== oldStatus) {
      const projectName = (fields['项目名称'] || '') as string;
      const chatId = (fields['项目群ID'] || '') as string;
      const assigneeId = (fields['负责人ID'] || fields['项目负责人ID'] || '') as string;
      void sendProjectStatusChange(
        recordId,
        projectName,
        oldStatus,
        fields['项目状态'] as string,
        chatId || undefined,
        assigneeId || undefined
      );
    }
    return true;
  } catch (e) {
    console.warn('更新项目失败，已标记待同步:', e);
    await markPendingSync('projects', { recordId, fields, oldStatus });
    return false;
  }
}

function getDaysSinceLastContact(lastContactDate: string): number | null {
  const lastContact = parseDateSafe(lastContactDate);
  if (!lastContact) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((Date.now() - lastContact.getTime()) / msPerDay);
}

function maybeSendClientFollowUp(fields: Record<string, unknown>): void {
  const lastContactDate = extractText(fields['最后跟进时间'] || fields['咨询时间']);
  const daysSince = getDaysSinceLastContact(lastContactDate);
  if (daysSince === null || daysSince < 3) return;

  const clientName = (fields['客户姓名'] || '') as string;
  const clientId = (fields['record_id'] || '') as string;
  const assigneeId = (fields['销售负责人ID'] || fields['负责人ID'] || '') as string;
  if (!clientName) return;

  void sendClientFollowUp(
    clientId,
    clientName,
    assigneeId || undefined
  );
}

export async function createClient(fields: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await bitableCreate(BITABLE_APP_TOKEN, TABLE_IDS.clients, fields);
    const recordId = res?.record?.record_id || '';
    // 如果客户已超 3 天未跟进，发送跟进提醒（可选，不阻塞主流程）
    if (recordId) {
      maybeSendClientFollowUp({ ...fields, record_id: recordId });
    }
    return recordId || null;
  } catch (e) {
    console.warn('创建客户失败，已标记待同步:', e);
    await markPendingSync('clients', { fields });
    return null;
  }
}

export async function updateClient(recordId: string, fields: Record<string, unknown>): Promise<boolean> {
  try {
    await bitableUpdate(BITABLE_APP_TOKEN, TABLE_IDS.clients, recordId, fields);
    // 如果客户已超 3 天未跟进，发送跟进提醒（可选，不阻塞主流程）
    maybeSendClientFollowUp({ ...fields, record_id: recordId });
    return true;
  } catch (e) {
    console.warn('更新客户失败，已标记待同步:', e);
    await markPendingSync('clients', { recordId, fields });
    return false;
  }
}

export async function updatePublishTask(recordId: string, fields: Record<string, unknown>): Promise<boolean> {
  try {
    await bitableUpdate(BITABLE_APP_TOKEN, TABLE_IDS.publishTasks, recordId, fields);
    return true;
  } catch (e) {
    console.warn('更新发布任务失败，已标记待同步:', e);
    await markPendingSync('publishBoard', { recordId, fields });
    return false;
  }
}

export async function createPublishTask(fields: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await bitableCreate(BITABLE_APP_TOKEN, TABLE_IDS.publishTasks, fields);
    return res?.record?.record_id || null;
  } catch (e) {
    console.warn('创建发布任务失败，已标记待同步:', e);
    await markPendingSync('publishBoard', { fields });
    return null;
  }
}

// ============ 同步触发 ============

export async function triggerSync(): Promise<boolean> {
  try {
    await feishuRequest('GET', '/open-apis/authen/v1/user_info');
    return true;
  } catch {
    return false;
  }
}

// ============ 飞书集成新增接口 ============

// ---- 消息通知 ----

export async function sendMessage(
  receiveId: string,
  msgType: string,
  content: string,
  receiveIdType: string = 'chat_id'
): Promise<{ messageId: string }> {
  const res = await feishuRequest<{ message_id: string }>('POST', '/open-apis/im/v1/messages', {
    query: { receive_id_type: receiveIdType },
    body: { receive_id: receiveId, msg_type: msgType, content },
  });
  return { messageId: res.message_id };
}

export async function sendCardMessage(
  receiveId: string,
  cardContent: string,
  receiveIdType: string = 'chat_id'
): Promise<{ messageId: string }> {
  const res = await feishuRequest<{ message_id: string }>('POST', '/open-apis/im/v1/messages', {
    query: { receive_id_type: receiveIdType },
    body: { receive_id: receiveId, msg_type: 'interactive', content: cardContent },
  });
  return { messageId: res.message_id };
}

// ============ 业务消息卡片 ============

function buildStatusChangeCard(
  projectName: string,
  oldStatus: string,
  newStatus: string,
  projectId: string
) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '项目状态变更' },
      template: 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**项目：** ${projectName}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**状态变更：** ${oldStatus} → ${newStatus}`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看项目' },
            type: 'primary',
            value: { projectId },
          },
        ],
      },
    ],
  };
}

function buildFollowUpCard(clientName: string, clientId: string) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '客户跟进提醒' },
      template: 'orange',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `客户「**${clientName}**」已超过 3 天未跟进，请及时联系。`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看客户' },
            type: 'primary',
            value: { clientId },
          },
        ],
      },
    ],
  };
}

function buildPublishDeadlineCard(
  title: string,
  deadline: string,
  taskId: string
) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '发布截止提醒' },
      template: 'red',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**发布任务：** ${title}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**截止时间：** ${formatDateTime(deadline)}`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看任务' },
            type: 'primary',
            value: { taskId },
          },
        ],
      },
    ],
  };
}

export async function sendProjectStatusChange(
  projectId: string,
  projectName: string,
  oldStatus: string,
  newStatus: string,
  chatId?: string,
  assigneeId?: string
): Promise<void> {
  try {
    const title = `项目状态变更：${projectName}`;
    const body = `项目「${projectName}」状态由 ${oldStatus} 变更为 ${newStatus}`;
    const card = buildStatusChangeCard(projectName, oldStatus, newStatus, projectId);
    const cardContent = JSON.stringify(card);

    const sends: Promise<{ messageId: string }>[] = [];
    if (chatId) {
      sends.push(sendCardMessage(chatId, cardContent, 'chat_id'));
    }
    if (assigneeId) {
      sends.push(sendCardMessage(assigneeId, cardContent, 'user_id'));
    }

    await Promise.all(sends);

    await addNotification({
      type: 'project_status',
      title,
      body,
      data: { projectId, oldStatus, newStatus, chatId, assigneeId },
      targetChatId: chatId,
      targetUserId: assigneeId,
      projectId,
    });
  } catch (e) {
    console.warn('发送项目状态变更通知失败:', e);
  }
}

export async function sendClientFollowUp(
  clientId: string,
  clientName: string,
  assigneeId?: string
): Promise<void> {
  try {
    const title = `客户跟进提醒：${clientName}`;
    const body = `客户「${clientName}」已超过 3 天未跟进，请及时联系。`;
    const card = buildFollowUpCard(clientName, clientId);

    if (assigneeId) {
      await sendCardMessage(assigneeId, JSON.stringify(card), 'user_id');
    }

    await addNotification({
      type: 'client_followup',
      title,
      body,
      data: { clientId, assigneeId },
      targetUserId: assigneeId,
      clientId,
    });
  } catch (e) {
    console.warn('发送客户跟进提醒失败:', e);
  }
}

export async function sendPublishDeadlineReminder(
  taskId: string,
  title: string,
  deadline: string,
  chatId?: string,
  assigneeId?: string
): Promise<void> {
  try {
    const notificationTitle = `发布截止提醒：${title}`;
    const body = `发布任务「${title}」截止时间为 ${formatDateTime(deadline)}，请尽快完成发布。`;
    const card = buildPublishDeadlineCard(title, deadline, taskId);
    const cardContent = JSON.stringify(card);

    const sends: Promise<{ messageId: string }>[] = [];
    if (chatId) {
      sends.push(sendCardMessage(chatId, cardContent, 'chat_id'));
    }
    if (assigneeId) {
      sends.push(sendCardMessage(assigneeId, cardContent, 'user_id'));
    }

    await Promise.all(sends);

    await addNotification({
      type: 'publish_deadline',
      title: notificationTitle,
      body,
      data: { taskId, deadline, chatId, assigneeId },
      targetChatId: chatId,
      targetUserId: assigneeId,
      taskId,
    });
  } catch (e) {
    console.warn('发送发布截止提醒失败:', e);
  }
}

export async function createGroup(
  name: string,
  description?: string
): Promise<{ chatId: string }> {
  const res = await feishuRequest<{ chat_id: string }>('POST', '/open-apis/im/v1/chats', {
    body: { name, description, chat_mode: 'group' },
  });
  return { chatId: res.chat_id };
}

// ---- 任务管理 ----

export async function createFeishuTask(params: {
  summary: string;
  description?: string;
  dueDate?: string;
  assigneeId?: string;
  projectId?: string;
}): Promise<{ taskId: string }> {
  try {
    const res = await feishuRequest<{ task: { task_id: string } }>(
      'POST',
      '/open-apis/task/v2/tasks',
      {
        body: {
          summary: params.summary,
          description: params.description,
          due_date: params.dueDate
            ? { timestamp: String(Math.floor(new Date(params.dueDate).getTime() / 1000)) }
            : undefined,
          members: params.assigneeId
            ? [{ id: params.assigneeId, type: 'user', role: 'assignee' }]
            : undefined,
        },
      }
    );
    return { taskId: res.task?.task_id || '' };
  } catch (e) {
    console.warn('创建任务失败，已标记待同步:', e);
    await markPendingSync('feishuTasks', { params });
    return { taskId: '' };
  }
}

export async function listMyTasks(params?: {
  pageSize?: number;
  completed?: boolean;
}): Promise<{ data: FeishuTask[]; hasMore: boolean }> {
  const res = await feishuRequest<{ items: any[]; has_more: boolean }>(
    'GET',
    '/open-apis/task/v2/tasks',
    { query: { page_size: params?.pageSize || 50 } }
  );
  const tasks = (res.items || []).map(mapFeishuTask);
  return { data: tasks, hasMore: res.has_more };
}

export async function updateFeishuTask(
  taskId: string,
  params: {
    summary?: string;
    status?: string;
    dueDate?: string;
  }
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {};
    if (params.summary !== undefined) body.summary = params.summary;
    if (params.status !== undefined) body.status = params.status;
    if (params.dueDate !== undefined) {
      body.due_date = { timestamp: String(Math.floor(new Date(params.dueDate).getTime() / 1000)) };
    }
    await feishuRequest('PATCH', '/open-apis/task/v2/tasks/' + taskId, { body });
    return true;
  } catch (e) {
    console.warn('更新任务失败，已标记待同步:', e);
    await markPendingSync('feishuTasks', { taskId, params });
    return false;
  }
}

function mapFeishuTask(item: any): FeishuTask {
  return {
    id: item.task_id || item.id,
    title: item.summary || '',
    description: item.description || '',
    assigneeId: item.assignee?.member_id || '',
    assigneeName: item.assignee?.name || '',
    dueDate: item.due_date?.timestamp
      ? new Date(Number(item.due_date.timestamp) * 1000).toISOString()
      : '',
    status: mapTaskStatus(item.status),
    projectId: item.extra?.project_id || '',
    projectName: item.extra?.project_name || '',
    createdAt: item.created_at
      ? new Date(Number(item.created_at) * 1000).toISOString()
      : '',
  };
}

function mapTaskStatus(status: string): TaskStatus {
  const map: Record<string, TaskStatus> = {
    '0': 'todo',
    '1': 'in_progress',
    '2': 'done',
    todo: 'todo',
    in_progress: 'in_progress',
    done: 'done',
  };
  return map[status] || 'todo';
}

// ---- 文档操作 ----

export async function shareDocument(
  fileToken: string,
  fileType: string,
  memberId: string,
  perm: string = 'full_access'
): Promise<{ url: string }> {
  await feishuRequest('POST', '/open-apis/drive/v1/permissions/' + fileToken + '/members', {
    query: { type: fileType },
    body: { member_type: 'openid', member_id: memberId, perm },
  });
  return { url: '' };
}

export async function copyTemplate(
  fileToken: string,
  fileType: string,
  name?: string,
  folderToken?: string
): Promise<{ fileToken: string; url: string }> {
  const res = await feishuRequest<{ file_token: string; url: string }>(
    'POST',
    '/open-apis/drive/v1/files/' + fileToken + '/copy',
    {
      query: { type: fileType },
      body: { name, folder_token: folderToken },
    }
  );
  return { fileToken: res.file_token, url: res.url || '' };
}

export async function createDriveFolder(
  name: string,
  folderToken: string
): Promise<{ token: string; url: string }> {
  const res = await feishuRequest<{ token: string }>(
    'POST',
    '/open-apis/drive/v1/files/create_folder',
    { body: { name, folder_token: folderToken } }
  );
  return { token: res.token, url: '' };
}

export async function listFolderContents(
  folderToken: string,
  pageSize?: number
): Promise<DocumentRef[]> {
  const res = await feishuRequest<{ files: any[] }>('GET', '/open-apis/drive/v1/files', {
    query: { folder_token: folderToken, page_size: pageSize || 50 },
  });
  return (res.files || []).map(mapDriveFile);
}

function mapDriveFile(item: any): DocumentRef {
  return {
    token: item.token,
    type: mapDocumentType(item.type),
    name: item.name,
    url: item.url,
    parentToken: item.parent_token,
    createdAt: item.created_time
      ? new Date(Number(item.created_time) * 1000).toISOString()
      : '',
    modifiedAt: item.modified_time
      ? new Date(Number(item.modified_time) * 1000).toISOString()
      : '',
  };
}

function mapDocumentType(type: string): DocumentType {
  const map: Record<string, DocumentType> = {
    doc: 'docx',
    docx: 'docx',
    sheet: 'sheet',
    bitable: 'bitable',
    folder: 'folder',
    shortcut: 'folder',
  };
  return map[type] || 'folder';
}

// ---- Wiki SOP ----

const SOP_PHASE_TITLES: Record<SOPPhase, string[]> = {
  client: ['全场景话术库', '接客话术与物料发送 SOP'],
  'project-plan': ['拍摄方案策划书标准格式'],
  shooting: ['拍摄当天执行流程', '拍摄现场执行清单'],
  post: ['选片与成片交付标准化流程'],
  publish: ['素材跨平台分发 SOP'],
};

export async function listWikiNodes(spaceId: string = WIKI_SPACE_ID): Promise<WikiNode[]> {
  const res = await feishuRequest<{ items: WikiNode[]; has_more: boolean; page_token?: string }>(
    'GET',
    '/open-apis/wiki/v2/spaces/' + spaceId + '/nodes',
    { query: { page_size: 50 } }
  );
  return res.items || [];
}

export async function getWikiNode(spaceId: string = WIKI_SPACE_ID, nodeToken: string): Promise<WikiNode> {
  const res = await feishuRequest<{ node: WikiNode }>(
    'GET',
    '/open-apis/wiki/v2/spaces/' + spaceId + '/nodes/' + nodeToken
  );
  return res.node;
}

export async function getSOPsByPhase(phase: SOPPhase, spaceId: string = WIKI_SPACE_ID): Promise<SOPItem[]> {
  const nodes = await listWikiNodes(spaceId);
  const titles = SOP_PHASE_TITLES[phase] || [];
  const matches = nodes.filter((node) => titles.some((title) => node.title.includes(title)));
  return matches.map((node) => ({
    nodeToken: node.node_token,
    title: node.title,
    url: node.url || `https://bytedance.larkoffice.com/wiki/${node.node_token}`,
  }));
}

// ---- 数据同步 ----

export async function getRecentChanges(params: {
  table: string;
  sinceTimestamp?: string;
}): Promise<{ items: any[]; count: number }> {
  const res = await bitableGet(BITABLE_APP_TOKEN, params.table, { pageSize: 100 });
  const items = res.items || [];
  return { items, count: items.length };
}

export async function batchSync(
  table: string,
  records: Array<{ recordId?: string; fields: Record<string, unknown> }>
): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  for (const r of records) {
    try {
      if (r.recordId) {
        await bitableUpdate(BITABLE_APP_TOKEN, table, r.recordId, r.fields);
      } else {
        await bitableCreate(BITABLE_APP_TOKEN, table, r.fields);
      }
      synced++;
    } catch (e) {
      console.warn('batchSync 单条失败:', e);
      failed++;
    }
  }
  return { synced, failed };
}

export async function getSyncStatus(table: string): Promise<SyncStatus> {
  const lastSyncTime = getLastSyncTime();
  const isSyncing = getSyncingState();
  return {
    lastSyncTime: lastSyncTime ? new Date(lastSyncTime).toISOString() : '',
    totalRecords: 0, // TODO: 从缓存或飞书API获取真实记录数
    tableId: table,
    isSyncing,
  };
}

// ============ 电子表格 API ============

const PROJECT_STATS_SHEET = 'f29435'; // sheetId（飞书 v2 API 需要 sheetId 而非 sheetName）
const PUBLISH_MATRIX_SHEET = 'Kw7c8o'; // sheetId
const DEFAULT_SHEET_RANGE = 'A1:Z500';

interface SpreadsheetReadResult {
  values?: string[][];
}

export async function readSpreadsheet(
  token: string,
  range: string
): Promise<SpreadsheetReadResult> {
  const res = await feishuRequest<{ valueRange?: { values?: string[][] } }>(
    'GET',
    '/open-apis/sheets/v2/spreadsheets/' + token + '/values/' + encodeURIComponent(range)
  );
  return { values: res?.valueRange?.values || [] };
}

export async function writeSpreadsheet(
  token: string,
  range: string,
  values: string[][]
): Promise<Record<string, unknown>> {
  return feishuRequest<Record<string, unknown>>(
    'PUT',
    '/open-apis/sheets/v2/spreadsheets/' + token + '/values',
    { body: { valueRange: { range, values } } }
  );
}

function buildRange(sheet: string, range?: string): string {
  const r = range || DEFAULT_SHEET_RANGE;
  if (r.includes('!')) return r;
  // sheetId 不需要单引号包裹（仅 sheetName 才需要）
  return `${sheet}!${r}`;
}

function countThisMonthShoots(headers: string[], rows: string[][]): number {
  const dateIndex = headers.findIndex((h) => String(h).includes('拍摄日期'));
  if (dateIndex < 0) return 0;

  const now = new Date();
  const monthPrefixSlash = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthPrefixDash = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return rows.filter((row) => {
    const val = row[dateIndex];
    if (val === undefined || val === null || val === '') return false;
    const s = String(val);
    return s.startsWith(monthPrefixSlash) || s.startsWith(monthPrefixDash);
  }).length;
}

export async function getProjectStats(): Promise<ProjectStats> {
  const range = buildRange(PROJECT_STATS_SHEET);
  const res = await readSpreadsheet(PROJECT_STATS_SHEET_TOKEN, range);
  const all = res.values || [];
  const headers = all[0] || [];
  const rows = all.slice(1).filter((row) => row.some((cell) => cell !== undefined && cell !== null && cell !== ''));

  return {
    headers,
    rows,
    totalProjects: rows.length,
    thisMonthShoots: countThisMonthShoots(headers, rows),
  };
}

export async function getPublishMatrix(): Promise<PublishMatrix> {
  const range = buildRange(PUBLISH_MATRIX_SHEET);
  const res = await readSpreadsheet(PUBLISH_MATRIX_SHEET_TOKEN, range);
  const all = res.values || [];
  const headers = all[0] || [];
  const rows = all.slice(1).filter((row) => row.some((cell) => cell !== undefined && cell !== null && cell !== ''));

  return { headers, rows };
}

export async function updatePublishMatrix(
  range: string,
  values: string[][]
): Promise<Record<string, unknown>> {
  const fullRange = range.includes('!') ? range : `${PUBLISH_MATRIX_SHEET}!${range}`;
  try {
    const result = await writeSpreadsheet(PUBLISH_MATRIX_SHEET_TOKEN, fullRange, values);
    return result;
  } catch (e) {
    console.warn('更新发布矩阵失败，已标记待同步:', e);
    await markPendingSync('publishMatrix', { range, values });
    throw e;
  }
}

export const spreadsheetApi = {
  readSpreadsheet,
  writeSpreadsheet,
  getProjectStats,
  getPublishMatrix,
  updatePublishMatrix,
};
