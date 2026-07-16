# Phase 0 当前状态审计报�?
> 审计日期�?026-07-15
> 审计范围：泽怀影像飞书业务中台 V1 全量资源
> 审计人：Trae AI
> 审计依据：项目指南包 `feishu-v2-guide/TRAE_EXECUTION_PROMPT.md`
> Base App Token：`<V1_BASE_TOKEN>`

---

## 1. 项目目录结构盘点

### 1.1 核心目录

```
d:\360Downloads\Trae 项目\SOP\
├── .trae/                          # AI 配置（rules/ skills/ knowledge/ specs/�?├── docs/                           # 文档（审计报告、自动化清单等）
├── src/
�?  ├── zehuai-app/                 # Expo React Native APP
�?  �?  └── src/
�?  �?      ├── constants/config.ts # 飞书资源 token 和表 ID 映射
�?  �?      ├── services/
�?  �?      �?  ├── feishu.ts       # 飞书 API 封装�?mapper 函数
�?  �?      �?  ├── syncManager.ts  # APP 端同步管理器
�?  �?      �?  ├── localCache.ts   # 本地缓存
�?  �?      �?  └── pendingSync.ts  # 离线待同步队�?�?  �?      ├── screens/            # UI 屏幕
�?  �?      ├── types/index.ts      # TypeScript 类型定义
�?  �?      └── hooks/useFeishuData.ts
�?  └── scripts/
�?      ├── sync/
�?      �?  └── sync_config.json    # 电子表格→多维表格同步配�?�?      └── export-audit.js         # Phase 0 审计导出脚本
├── 项目指南�?
�?  └── feishu-v2-guide/
�?      ├── PROJECT_GUIDE.md        # V2 长期事实�?�?      └── TRAE_EXECUTION_PROMPT.md # Phase 0 执行指令
└── package.json
```

### 1.2 飞书相关配置和脚本清�?
| 文件 | 用�?| 状�?|
|------|------|------|
| `src/zehuai-app/src/constants/config.ts` | 飞书 token�?7 张表 ID 映射、OAuth 配置 | 活跃 |
| `src/zehuai-app/src/services/feishu.ts` | 飞书 API 封装、mapper 函数、查询函�?| 活跃 |
| `src/zehuai-app/src/services/syncManager.ts` | APP 端定时同步管�?| 活跃（仅 4 张表�?|
| `src/scripts/sync/sync_config.json` | 电子表格→多维表格同步配�?| 活跃�? 个任务，5 启用�?|
| `src/scripts/export-audit.js` | Phase 0 审计导出脚本 | 临时脚本 |
| `docs/自动化规则清�?md` | 12 条自动化规则文档 v3.1 | 历史文档 |
| `docs/app-base-coverage-audit.md` | APP 覆盖率审计报�?2026-06-28 | 历史文档 |

---

## 2. 当前 Base/Table/Field 真实资源映射

### 2.1 17 张子表全量清�?
> 数据来源：`docs/current-base-schema-export.json`（通过 lark-cli `base +record-list` 分页获取，`--as bot` 身份�?> 审计日期�?026-07-15

| # | 表名 | table_id | 字段�?| 记录�?| 数据来源 |
|---|------|----------|--------|--------|----------|
| 1 | 跨平台发布总看�?| V1_PUBLISHDASHBOARD_TABLE_ALIAS | 16 | 1 | 真实导出 |
| 2 | 总览说明 | V1_SOPRULES_TABLE_ALIAS | 5 | 26 | 真实导出 |
| 3 | 客户全生命周期管理表 | V1_CLIENTS_TABLE_ALIAS | 38 | 36 | 真实导出 |
| 4 | 拍摄项目全流程管理表 | V1_PROJECTS_TABLE_ALIAS | 37 | 47 | 真实导出 |
| 5 | 资源总库主表 | V1_RESOURCEMASTER_TABLE_ALIAS | 17 | 2 | 真实导出 |
| 6 | 场地资源子表 | V1_VENUE_TABLE_ALIAS | 15 | 49 | 真实导出 |
| 7 | 妆造师资源子表 | V1_MAKEUP_TABLE_ALIAS | 21 | 115 | 真实导出 |
| 8 | 模特资源子表 | V1_MODEL_TABLE_ALIAS | 21 | 106 | 真实导出 |
| 9 | 服装租赁子表 | V1_COSTUME_TABLE_ALIAS | 16 | 21 | 真实导出 |
| 10 | 修图师资源子�?| V1_RETOUCH_TABLE_ALIAS | 12 | 13 | 真实导出 |
| 11 | 道具资源子表 | V1_EMERGENCY_TABLE_ALIAS | 14 | 13 | 真实导出 |
| 12 | 爆款调研库表 | V1_TRENDINGRESEARCH_TABLE_ALIAS | 20 | 19 | 真实导出 |
| 13 | 成品发布与运营数据表 | V1_PUBLISHTASKS_TABLE_ALIAS | 32 | 95 | 真实导出 |
| 14 | 素材库目录管理表 | V1_MATERIALLIBRARY_TABLE_ALIAS | 25 | 30 | 真实导出 |
| 15 | 全场景话术库�?| V1_SCRIPTS_TABLE_ALIAS | 16 | 36 | 真实导出 |
| 16 | 知识库目录管理表 | V1_KNOWLEDGEBASE_TABLE_ALIAS | 14 | �?0 | 真实导出�?29 限流后确�?has_more=false�?|
| 17 | SOP迭代优化管理�?| V1_SOPMANAGEMENT_TABLE_ALIAS | 19 | 1 | 真实导出 |

**合计**�?7 张表�?17 个字段，510 条记�?
### 2.2 关键字段结构说明

#### 客户全生命周期管理表�?8 字段�?
核心字段：客户姓名、联系方式、微信号、客户状态（select）、来源渠道（select）、意向风格（select）、预算区间（select）、拍摄类型（select）、咨询时间、最后跟进时间、成交金额、定金金额、关联项�?ID（link）、关联成品记录（link）、可用话术（link）、跟进记录、备注、客户满意度、创建时�?人、更新时�?人�?
关联字段：`关联项目 ID` �?拍摄项目全流程管理表；`关联成品记录` �?成品发布与运营数据表；`可用话术` �?全场景话术库表�?
#### 拍摄项目全流程管理表�?7 字段�?
核心字段：项目名称、项目状态（select）、项目类型（select）、拍摄档期、拍摄地点、客户名称、项目负责人（user）、化妆师、可选模特、系列、主题、精修交付时间、实际交付时间、备注、项目进度百分比（formula）�?
关联字段：`关联成品 ID` �?成品发布与运营数据表；`关联资源 ID` �?资源总库主表；`关联知识记录` �?知识库目录管理表；`爆款参考来源` �?爆款调研库表�?
#### 6 张资源子表公共字�?
名称/姓名、联系方�?电话/微信、价�?报价、状�?合作状态、所在地/地址、风�?类型、备注、作品链接�?
差异点：
- 妆造师/模特子表�?`优先级`（S/A/B）、`合作状态`（已合作/有意�?无意向）、`服装尺码`（模特特有）
- 服装子表�?`服装状态`（可购买）、`服装类别`、`尺码`、`采购来源`、`采购链接`
- 修图师子表字段最少（12 个），无优先级和合作状态字�?
---

## 3. 12 条旧自动化真实配�?
> 数据来源：`docs/自动化规则清�?md` v3.1�?026-06-27 通过 lark-cli OpenAPI 全量枚举�?> ⚠️ 当前限制：bot 身份无法读取 workflow 执行日志�?1403 权限错误），user 身份 token 已过�?
| # | 规则名称 | Workflow ID | 触发类型 | 触发�?| 声称状�?|
|---|---------|-------------|---------|--------|---------|
| 1 | 客户跟进超时预警 | V1_WF_CLIENT_FOLLOWUP_WARNING_ALIAS | 定时 9:00 | 客户�?| 已启�?|
| 2 | 项目档期临近提醒 | V1_WF_PROJECT_SCHEDULE_REMINDER_ALIAS | 定时 9:00 | 项目�?| 已启�?|
| 3 | 满意度回访提�?| V1_WF_SATISFACTION_REVIEW_REMINDER_ALIAS | 定时 9:00 | 项目�?| 已启�?|
| 4 | 项目状态自动同步客户状�?| V1_WF_PROJECT_STATUS_SYNC_CLIENT_ALIAS | 字段变更 | 项目�?| 已启�?|
| 5 | 客户付定金自动创建项�?| V1_WF_DEPOSIT_AUTO_CREATE_PROJECT_ALIAS | 字段变更 | 客户�?| 已启�?|
| 6 | 精修交付超期预警 | V1_WF_RETOUCH_DELIVERY_OVERDUE_ALIAS | 定时 9:00 | 项目�?| 已启�?|
| 7 | 新项目创�?三端联动提醒 | V1_WF_NEW_PROJECT_INIT_REMINDER_ALIAS | 新增记录 | 项目�?| 已启�?|
| 8 | 每日待发布任务提�?| V1_WF_DAILY_PUBLISH_TASK_REMINDER_ALIAS | 定时 9:00 | 成品发布�?| 已启�?|
| 9 | 适配超时预警 | V1_WF_ADAPTATION_OVERDUE_WARNING_ALIAS | 定时 9:00 | 成品发布�?| 已启�?|
| 10 | 成品发布自动同步素材状�?| V1_WF_PUBLISH_SYNC_MATERIAL_STATUS_ALIAS | 字段变更 | 成品发布�?| 已启�?|
| 11 | 素材归档自动生成成品任务 | V1_WF_MATERIAL_ARCHIVE_AUTO_CREATE_PUBLISH_ALIAS | 字段变更 | 素材库表 | 已启�?|
| 12 | 优质资源自动同步到知识库 | V1_WF_QUALITY_RESOURCE_SYNC_KNOWLEDGE_ALIAS | 字段变更 | 资源总库主表 | 已启�?|

**关键限制**�?- 所有定时规则的 Loop 循环上限硬限制为 5 条，超过 5 条待处理记录时仅�?5 条收到通知
- 规则 #11 无法根据多�?所属平�?拆分创建多条成品记录
- trigger_control_list 仅阻止粘�?批量/导入/API批量更新触发，单�?API 更新仍会触发

**未验证项**：最近执行时间、成�?失败次数、是否造成重复记录 �?需用户重新授权 `lark-cli auth login` 后通过 workflow 执行日志验证

---

## 4. Expo APP 当前读取和写入的�?
> 数据来源：`src/zehuai-app/src/constants/config.ts`、`src/zehuai-app/src/services/feishu.ts`、`docs/app-base-coverage-audit.md`

### 4.1 APP 使用情况矩阵

| # | 表名 | table_id | APP 读取 | APP 写入 | 使用位置 |
|---|------|----------|---------|---------|---------|
| 1 | 客户全生命周期管理表 | V1_CLIENTS_TABLE_ALIAS | �?| �?| ClientsScreen / ClientDetailScreen |
| 2 | 拍摄项目全流程管理表 | V1_PROJECTS_TABLE_ALIAS | �?| �?| ProjectsScreen / ProjectDetailScreen |
| 3 | 成品发布与运营数据表 | V1_PUBLISHTASKS_TABLE_ALIAS | �?| ✅（浏览数回填） | PublishScreen |
| 4 | 场地资源子表 | V1_VENUE_TABLE_ALIAS | �?| �?| ResourcesScreen |
| 5 | 妆造师资源子表 | V1_MAKEUP_TABLE_ALIAS | �?| �?| ResourcesScreen |
| 6 | 模特资源子表 | V1_MODEL_TABLE_ALIAS | �?| �?| ResourcesScreen |
| 7 | 服装租赁子表 | V1_COSTUME_TABLE_ALIAS | �?| �?| ResourcesScreen |
| 8 | 修图师资源子�?| V1_RETOUCH_TABLE_ALIAS | �?| �?| ResourcesScreen |
| 9 | 道具资源子表 | V1_EMERGENCY_TABLE_ALIAS | �?| �?| ResourcesScreen |
| 10 | 知识库目录管理表 | V1_KNOWLEDGEBASE_TABLE_ALIAS | �?| �?| KnowledgeScreen（知识库子视图） |
| 11 | 全场景话术库�?| V1_SCRIPTS_TABLE_ALIAS | �?| �?| KnowledgeScreen（话术库子视图） |
| 12 | 总览说明 | V1_SOPRULES_TABLE_ALIAS | �?| �?| KnowledgeScreen（SOP规则子视图） |
| 13 | 爆款调研库表 | V1_TRENDINGRESEARCH_TABLE_ALIAS | �?| �?| KnowledgeScreen（爆款参考子视图�?|
| 14 | 跨平台发布总看�?| V1_PUBLISHDASHBOARD_TABLE_ALIAS | �?| �?| �?syncManager 引用，无 UI |
| 15 | 资源总库主表 | V1_RESOURCEMASTER_TABLE_ALIAS | �?| �?| config 声明但无 UI |
| 16 | 素材库目录管理表 | V1_MATERIALLIBRARY_TABLE_ALIAS | �?| �?| config 声明但无 UI |
| 17 | SOP迭代优化管理�?| V1_SOPMANAGEMENT_TABLE_ALIAS | �?| �?| config 声明但无 UI，仅 1 条记�?|

**APP 覆盖�?*�?3/17 = 76%�?3 张表�?UI 消费�?
### 4.2 APP 写入场景

| �?| 写入字段 | 写入位置 | 已知问题 |
|----|---------|---------|---------|
| 客户�?| 跟进记录、备注、客户状态、最后跟进时�?| ClientDetailScreen | �?|
| 成品发布�?| 浏览�?| PublishScreen TaskDetailModal.handleSave | ⚠️ 写入"浏览�?字段，但 mapper 读取"播放�?字段，导致回填后无法读回 |

---

## 5. 数据同步脚本实际支持的表

### 5.1 APP �?syncManager

> 数据来源：`src/zehuai-app/src/services/syncManager.ts`

`SYNC_TABLES` 仅包�?4 张表�?
| �?| table_id | 同步方式 |
|----|----------|---------|
| 拍摄项目全流程管理表 | V1_PROJECTS_TABLE_ALIAS | 全量拉取第一页（pageSize 100�?|
| 客户全生命周期管理表 | V1_CLIENTS_TABLE_ALIAS | 全量拉取第一页（pageSize 100�?|
| 成品发布与运营数据表 | V1_PUBLISHTASKS_TABLE_ALIAS | 全量拉取第一页（pageSize 100�?|
| 跨平台发布总看�?| V1_PUBLISHDASHBOARD_TABLE_ALIAS | 全量拉取第一页（pageSize 100�?|

**已知问题**�?- `getRecentChanges` 函数接收 `sinceTimestamp` 参数但完全忽略，始终全量拉取第一�?- 超过 100 条的表存在数据截断风险（妆造师 115 条、模�?106 条、成品发�?95 条）
- 9 张资源子表和知识库表均无离线缓存兜底

### 5.2 电子表格→多维表格同步脚�?
> 数据来源：`src/scripts/sync/sync_config.json`

| # | 任务�?| 源电子表�?| 目标 Base �?| 状�?| match_key |
|---|--------|-----------|-------------|------|-----------|
| 1 | 项目统计表同�?| AfPYsxFhohhqj9tP9HEcfxcNnUf | 拍摄项目全流程管理表 | �?启用 | 项目名称 |
| 2 | 聚光客户同步 | OpG5sJpFAh7pTWt0123ccpBxnYg | 客户全生命周期管理表 | �?启用 | 客户姓名 |
| 3 | 成品发布情况表同�?| L1pJsFjK5hGaUotezXOcBRTan6e | 成品发布与运营数据表 | �?禁用 | 项目编号 |
| 4 | 化妆资源同步 | NMoisfXOrhZVFft7322c8CWYnTb | 妆造师资源子表 | �?启用 | 姓名（小红书�?|
| 5 | 模特资源同步 | EqGnsTc4UhmmJbtEHFdcqNXwnKb | 模特资源子表 | �?启用 | 艺名/昵称（小红书�?|
| 6 | 服装资源同步 | TlnGsCEY2h9YgFtXVMKcOBHenHF | 服装租赁子表 | �?启用 | 服装名称/品牌 |

**未覆盖的�?*�?1 张）：场地资源子表、修图师资源子表、道具资源子表、资源总库主表、跨平台发布总看板、总览说明、爆款调研库表、素材库目录管理表、全场景话术库表、知识库目录管理表、SOP迭代优化管理�?
**成品发布同步禁用原因**：Base 已有 95 条自动化生成记录（由规则 #11 创建），ID 体系与电子表格不兼容（Base CP20260427001 vs 电子表格 XM-2�?
---

## 6. 历史文档与真实系统的冲突清单

> 禁止静默修复，以下差异需用户确认

### 6.1 表名差异

| 位置 | 声称名称 | 真实名称 | 差异类型 |
|------|---------|---------|---------|
| config.ts 注释 | "应急资源子�? | "道具资源子表" | 注释与真实表名不�?|
| 自动化规则清�?#5 | 触发字段"定金状�? | 客户表无"定金状�?字段，实际为"客户状�?字段变更 | 触发字段描述与真实字段可能不一�?|

### 6.2 数量差异

| 维度 | 声称�?| 真实�?| 差异说明 |
|------|--------|--------|---------|
| config.ts TABLE_IDS | 16 张表 | Base 17 张表 | config 缺少"总览说明"表（后补入知识库模块�?|
| syncManager.SYNC_TABLES | 4 张表 | config 16 �?/ Base 17 �?| APP 缓存覆盖率仅 24% |
| sync_config.json | 6 个任�?| Base 17 张表 | 脚本同步覆盖�?35% |
| 知识库目录管理表记录�?| 10 条（app-base-coverage-audit.md�?| �?0 条（真实导出确认 has_more=false�?| 一�?|

### 6.3 字段读写不一�?
| �?| 读取字段 | 写入字段 | 影响 |
|----|---------|---------|------|
| 成品发布�?| `播放量`（mapBitableRecordToPublishTask�?| `浏览数`（PublishScreen.handleSave�?| APP 回填浏览数据后无法读回，统计行始终显�?0 |

### 6.4 自动化状态未验证

| 项目 | 声称状�?| 真实验证 | 说明 |
|------|---------|---------|------|
| 12 条自动化 | 全部"已启�? | 未验�?| bot 身份无法读取执行日志，需 user 重新授权 |
| 规则 #4 触发字段 | "项目状�?变更 | 未验�?| 需确认真实字段配置 |
| 规则 #5 触发字段 | "定金状�?变更 | 未验�?| 客户表无"定金状�?字段，可能实际触发字段为"客户状�? |
| Loop 上限影响 | 6 条定时规�?| 未验�?| �?5 条记录时是否遗漏通知 |

### 6.5 功能声称与实际实�?
| 功能 | 声称 | 实际 | 差异 |
|------|------|------|------|
| 增量同步 | syncManager 传入 sinceTimestamp | getRecentChanges 忽略参数，始终全量拉�?| 假象增量同步 |
| 资源总库主表 | config 声明 | �?UI 消费，仅 2 条记�?| 声明但未使用 |
| 跨平台发布总看�?| config + syncManager 引用 | �?UI，仅 1 条记�?| 占用同步配额无业务收�?|

---

## 7. 备份与可恢复�?
### 7.1 已完成备�?
| 备份�?| 文件位置 | 内容 | 可恢复�?|
|--------|---------|------|---------|
| Base 结构导出 | `docs/current-base-schema-export.json` | 17 张表字段列表 + 记录�?| �?可恢复表结构 |
| 自动化配�?| `docs/自动化规则清�?md` v3.1 | 12 条规�?Workflow ID + 配置 | �?可恢复自动化 |
| APP 代码 | Git 仓库 | 完整 APP 源码 | �?可恢�?|
| 同步配置 | `src/scripts/sync/sync_config.json` | 6 个同步任�?| �?可恢�?|

### 7.2 未完成备�?
| 备份�?| 状�?| 阻塞原因 |
|--------|------|---------|
| 每张表完整记录数据导�?| �?未完�?| 仅有记录数，未导出记录内容（隐私+数据量） |
| 视图配置备份 | �?未完�?| bot 身份无法读取视图配置 |
| 自动化执行日�?| �?未完�?| 需 user 重新授权 lark-cli |
| Git 当前 Commit | �?未记�?| 需执行 `git log` 确认当前状�?|

### 7.3 未修改线上业务结构声�?
Phase 0 审计过程中严格执行只读操作：
- �?未修改任何表结构
- �?未修改任何记录数�?- �?未启�?禁用任何自动�?- �?未删除任何字段或视图
- �?所�?lark-cli 命令均使�?`--as bot` 只读身份

---

## 8. 审计结论

### 8.1 漂移风险评估

| 漂移类型 | 严重程度 | 说明 |
|---------|---------|------|
| 文档 vs Base 结构 | 🟡 �?| emergency 注释、规�?#5 触发字段描述 |
| APP vs Base 结构 | 🟡 �?| PublishScreen 字段读写不一�?|
| syncManager vs config | 🔴 �?| SYNC_TABLES �?4 张，覆盖�?24% |
| sync_config vs Base | 🟡 �?| 11 张表无同步任�?|
| 自动化声�?vs 真实运行 | 🔴 �?| 12 �?已启�?但无执行证据 |

### 8.2 V2 迁移前置条件检�?
| 前置条件 | 状�?|
|---------|------|
| 当前 Base 全量结构导出 | �?已完�?|
| 数据量统�?| �?已完�?|
| 旧自动化配置备份 | �?已完成（配置级） |
| 旧自动化执行日志 | �?未完成（需 user 授权�?|
| 旧代码和配置备份 | �?已完成（Git�?|
| 资源标识脱敏映射 | �?待生成（config/resource-map�?|
| 历史文档冲突识别 | �?已完�?|

---

*本报告由 Trae AI �?2026-07-15 生成，数据源�?lark-cli 真实导出 + 本地代码审计 + 历史文档比对�?
