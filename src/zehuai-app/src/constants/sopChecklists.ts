import { SOPChecklist, ProjectType, ProjectStatus } from '../types';

export const SOP_CHECKLISTS: SOPChecklist[] = [
  // ============ 客片 8 阶段 ============
  {
    id: 'client-获客建档',
    projectType: 'client',
    stage: '获客建档',
    title: '接客话术与物料发送 SOP',
    wikiUrl: 'https://YOUR_TENANT.feishu.cn/wiki/NIiLw8ibXij7v7kaWJxcMqbkn8g',
    items: [
      { id: '1', text: '确认客户拍摄意向与预算范围', checked: false, required: true },
      { id: '2', text: '发送作品集与报价单', checked: false, required: true },
      { id: '3', text: '确认拍摄风格与参考图', checked: false, required: true },
      { id: '4', text: '记录客户基本信息（姓名/电话/微信）', checked: false, required: true },
      { id: '5', text: '建立客户专属飞书群', checked: false, required: false },
    ],
  },
  {
    id: 'client-策划确认',
    projectType: 'client',
    stage: '策划确认',
    title: '拍摄方案策划与确认 SOP',
    wikiUrl: 'https://YOUR_TENANT.feishu.cn/wiki/PI81wolMZiNOHRkyfUYc19V0nZg',
    items: [
      { id: '1', text: '制定拍摄方案与分镜脚本', checked: false, required: true },
      { id: '2', text: '确认拍摄档期与场地', checked: false, required: true },
      { id: '3', text: '确认妆造、服装、道具清单', checked: false, required: true },
      { id: '4', text: '与客户确认策划方案并签字', checked: false, required: true },
      { id: '5', text: '收取定金/预付款', checked: false, required: true },
      { id: '6', text: '建立项目飞书文档与素材文件夹', checked: false, required: false },
    ],
  },
  {
    id: 'client-拍摄执行',
    projectType: 'client',
    stage: '拍摄执行',
    title: '现场拍摄执行 SOP',
    wikiUrl: 'https://YOUR_TENANT.feishu.cn/wiki/NFiew5oyNiAeiHk7SdCcv27gnbb',
    items: [
      { id: '1', text: '拍摄前设备检查（相机/镜头/电池/存储卡/灯光）', checked: false, required: true },
      { id: '2', text: '与团队同步拍摄通告单', checked: false, required: true },
      { id: '3', text: '现场按分镜脚本执行拍摄', checked: false, required: true },
      { id: '4', text: '拍摄过程中即时备份素材', checked: false, required: true },
      { id: '5', text: '客户现场确认关键画面', checked: false, required: false },
      { id: '6', text: '拍摄结束清点设备与素材', checked: false, required: true },
    ],
  },
  {
    id: 'client-选片确认',
    projectType: 'client',
    stage: '选片确认',
    title: '客户选片与确认 SOP',
    wikiUrl: 'https://YOUR_TENANT.feishu.cn/wiki/CqFzwFkZViHS8FkdBcVcSivbn2b',
    items: [
      { id: '1', text: '整理原始素材并初步筛选废片', checked: false, required: true },
      { id: '2', text: '上传选片链接/文件夹给客户', checked: false, required: true },
      { id: '3', text: '陪同或引导客户完成选片', checked: false, required: true },
      { id: '4', text: '确认精修数量与具体照片', checked: false, required: true },
      { id: '5', text: '记录客户修图特殊要求', checked: false, required: false },
    ],
  },
  {
    id: 'client-修图交付',
    projectType: 'client',
    stage: '修图交付',
    title: '精修图制作与交付 SOP',
    wikiUrl: 'https://YOUR_TENANT.feishu.cn/wiki/Ym1QwGoDGiK8VCk9t70cZnqCnPh',
    items: [
      { id: '1', text: '按选片清单逐张精修', checked: false, required: true },
      { id: '2', text: '肤质、色调、构图统一调整', checked: false, required: true },
      { id: '3', text: '内部质检修图质量', checked: false, required: true },
      { id: '4', text: '生成水印预览图发送客户确认', checked: false, required: true },
      { id: '5', text: '按客户反馈调整至满意', checked: false, required: false },
    ],
  },
  {
    id: 'client-成片交付',
    projectType: 'client',
    stage: '成片交付',
    title: '成片整理与交付 SOP',
    wikiUrl: 'https://YOUR_TENANT.feishu.cn/wiki/FV6vwAHOrie5r5ky70IcTs0GnKd',
    items: [
      { id: '1', text: '导出高清成片（含原片与精修）', checked: false, required: true },
      { id: '2', text: '整理交付文件夹结构', checked: false, required: true },
      { id: '3', text: '生成交付链接或网盘', checked: false, required: true },
      { id: '4', text: '发送交付通知给客户', checked: false, required: true },
      { id: '5', text: '确认客户收到并验收', checked: false, required: true },
    ],
  },
  {
    id: 'client-分发发布',
    projectType: 'client',
    stage: '分发发布',
    title: '内容分发与发布 SOP',
    wikiUrl: 'https://YOUR_TENANT.feishu.cn/wiki/MGytwm9DOiXsu8kjv9YcDlwcnib',
    items: [
      { id: '1', text: '筛选适合发布的优质成片', checked: false, required: true },
      { id: '2', text: '撰写发布文案与话题标签', checked: false, required: true },
      { id: '3', text: '制作封面图与水印', checked: false, required: true },
      { id: '4', text: '按平台规则发布（小红书/抖音等）', checked: false, required: true },
      { id: '5', text: '记录发布链接与数据', checked: false, required: false },
    ],
  },
  {
    id: 'client-复盘归档',
    projectType: 'client',
    stage: '复盘归档',
    title: '项目复盘与归档 SOP',
    wikiUrl: 'https://YOUR_TENANT.feishu.cn/wiki/LXIOw14i1iNXuMkdcZwcHoS3nxe',
    items: [
      { id: '1', text: '整理项目所有文档与素材归档', checked: false, required: true },
      { id: '2', text: '统计项目成本与收入', checked: false, required: true },
      { id: '3', text: '收集客户满意度反馈', checked: false, required: true },
      { id: '4', text: '总结拍摄经验与改进点', checked: false, required: false },
      { id: '5', text: '更新作品集与案例库', checked: false, required: false },
    ],
  },

  // ============ 创作片 5 状态 ============
  {
    id: 'creative-待拍摄',
    projectType: 'creative',
    stage: '待拍摄',
    title: '创作拍摄筹备 SOP',
    items: [
      { id: '1', text: '确定创作主题与风格方向', checked: false, required: true },
      { id: '2', text: '组建创作团队（模特/妆造/场地）', checked: false, required: true },
      { id: '3', text: '制定拍摄方案与分镜', checked: false, required: true },
      { id: '4', text: '准备服装道具与确认场地', checked: false, required: true },
      { id: '5', text: '确认拍摄档期与发布通告', checked: false, required: false },
    ],
  },
  {
    id: 'creative-拍摄中',
    projectType: 'creative',
    stage: '拍摄中',
    title: '创作拍摄执行 SOP',
    items: [
      { id: '1', text: '设备检查与现场布置', checked: false, required: true },
      { id: '2', text: '按分镜执行创作拍摄', checked: false, required: true },
      { id: '3', text: '现场即时查看与调整画面', checked: false, required: true },
      { id: '4', text: '素材实时备份', checked: false, required: true },
      { id: '5', text: '拍摄完成清点设备', checked: false, required: false },
    ],
  },
  {
    id: 'creative-后期制作',
    projectType: 'creative',
    stage: '后期制作',
    title: '创作后期制作 SOP',
    items: [
      { id: '1', text: '筛选优质素材', checked: false, required: true },
      { id: '2', text: '精修调色与创意合成', checked: false, required: true },
      { id: '3', text: '内部审片与迭代修改', checked: false, required: true },
      { id: '4', text: '输出最终成片', checked: false, required: true },
    ],
  },
  {
    id: 'creative-待交付',
    projectType: 'creative',
    stage: '待交付',
    title: '创作成片交付 SOP',
    items: [
      { id: '1', text: '整理成片与素材包', checked: false, required: true },
      { id: '2', text: '制作交付清单', checked: false, required: true },
      { id: '3', text: '生成交付链接', checked: false, required: true },
      { id: '4', text: '通知相关方验收', checked: false, required: false },
    ],
  },
  {
    id: 'creative-已完成',
    projectType: 'creative',
    stage: '已完成',
    title: '创作项目归档 SOP',
    items: [
      { id: '1', text: '归档创作素材', checked: false, required: true },
      { id: '2', text: '更新作品集', checked: false, required: true },
      { id: '3', text: '发布到社交平台', checked: false, required: false },
      { id: '4', text: '总结创作经验', checked: false, required: false },
    ],
  },
];

export function getChecklistForStage(
  type: ProjectType,
  stage: ProjectStatus
): SOPChecklist | undefined {
  return SOP_CHECKLISTS.find((c) => c.projectType === type && c.stage === stage);
}
