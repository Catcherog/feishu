# Phase 0.5 自动化规则执行历史摘要报告（公开版）

> 报告生成时间：2026-07-15 23:26:50
> 数据来源：V1 Base 实时工作流列表、实时表记录、`backups/private/live/`
> 身份：user（已登录）

## 1. 数据解析概况（实时）

| 表 | Table ID | 实时记录数 |
|---|---|---|
| 客户全生命周期管理表 | `V1_CLIENTS_TABLE_ALIAS` | 36 |
| 拍摄项目全流程管理表 | `V1_PROJECTS_TABLE_ALIAS` | 47 |
| 资源总库主表 | `V1_RESOURCEMASTER_TABLE_ALIAS` | 2 |
| 知识库目录管理表 | `V1_KNOWLEDGEBASE_TABLE_ALIAS` | 10 |
| 素材库目录管理表 | `V1_MATERIALLIBRARY_TABLE_ALIAS` | 30 |
| 成品发布与运营数据表 | `V1_PUBLISHTASKS_TABLE_ALIAS` | 95 |

## 2. 关键验证结果

### 2.1 规则 #5：客户付定金自动创建项目

**实际配置（已用 user 身份复核）**：触发字段为「客户全生命周期管理表.客户状态」= **已付定金**，动作是在「拍摄项目全流程管理表」自动创建项目。

- 实时状态中 **已付定金** 的客户数：**0**
- 关联到这些客户的项目数：**0**

**结论**：实时数据中仍然没有状态为「已付定金」的客户，因此该规则在近期没有可验证的执行痕迹。规则配置本身完整，但数据条件未满足；旧文档对触发字段的描述与实际配置不符。

### 2.2 规则 #12：优质资源自动同步到知识库

**实际配置（已用 user 身份复核）**：触发字段为「资源总库主表.合作状态」= **优质合作**，动作是在「知识库目录管理表」生成知识记录。

- 实时状态中 **优质合作** 的资源数：**0**

**结论**：实时数据中没有任何资源的合作状态为「优质合作」，因此规则 #12 在近期未触发。

## 3. 全部 12 条工作流实时状态

| # | 工作流名称 | Workflow ID | 实时状态 | 触发类型 | 最近更新时间 |
|---|---|---|---|---|---|
| 1 | 客户跟进超时预警 | `V1_WF_CLIENT_FOLLOWUP_WARNING_ALIAS` | enabled | TimerTrigger | 2026-06-27 15:19:03 |
| 2 | 项目档期临近提醒 | `V1_WF_PROJECT_SCHEDULE_REMINDER_ALIAS` | enabled | TimerTrigger | 2026-06-25 01:14:35 |
| 3 | 满意度回访提醒 | `V1_WF_SATISFACTION_REVIEW_REMINDER_ALIAS` | enabled | TimerTrigger | 2026-06-25 01:14:08 |
| 4 | 项目状态自动同步客户状态 | `V1_WF_PROJECT_STATUS_SYNC_CLIENT_ALIAS` | enabled | SetRecordTrigger | 2026-06-25 01:08:05 |
| 5 | 客户付定金自动创建项目 | `V1_WF_DEPOSIT_AUTO_CREATE_PROJECT_ALIAS` | enabled | SetRecordTrigger | 2026-06-27 15:17:35 |
| 6 | 精修交付超期预警 | `V1_WF_RETOUCH_DELIVERY_OVERDUE_ALIAS` | enabled | TimerTrigger | 2026-06-25 01:02:25 |
| 7 | 新项目创建-三端联动初始化提醒 | `V1_WF_NEW_PROJECT_INIT_REMINDER_ALIAS` | enabled | AddRecordTrigger | 2026-05-11 16:26:45 |
| 8 | 每日待发布任务提醒 - 每日9点 | `V1_WF_DAILY_PUBLISH_TASK_REMINDER_ALIAS` | enabled | TimerTrigger | 2026-06-27 15:19:06 |
| 9 | 适配超时预警 - 每日9点检查 | `V1_WF_ADAPTATION_OVERDUE_WARNING_ALIAS` | enabled | TimerTrigger | 2026-06-27 15:19:09 |
| 10 | 成品发布自动同步素材状态 | `V1_WF_PUBLISH_SYNC_MATERIAL_STATUS_ALIAS` | enabled | SetRecordTrigger | 2026-06-27 15:14:48 |
| 11 | 素材归档自动生成全平台成品任务 | `V1_WF_MATERIAL_ARCHIVE_AUTO_CREATE_PUBLISH_ALIAS` | enabled | SetRecordTrigger | 2026-06-25 11:31:27 |
| 12 | 优质资源自动同步到知识库 | `V1_WF_QUALITY_RESOURCE_SYNC_KNOWLEDGE_ALIAS` | enabled | SetRecordTrigger | 2026-06-27 15:17:38 |

## 4. 关键状态字段实时分布

| 表 | 字段 | 分布（实时） |
|---|---|---|
| 客户 | 客户状态 | {'已拍摄': 2, '已报价': 9, '已流失': 4, '': 21} |
| 项目 | 项目状态 | {'已归档': 1, '待立项': 13, '已完成': 8, '': 25} |
| 资源 | 合作状态 | {'': 1, '待沟通': 1} |
| 素材 | 素材状态 | {'已归档': 30} |
| 素材 | 跨平台适配状态 | {'': 30} |
| 成品 | 发布状态 | {'已发布': 1, '': 64, '待发布': 30} |

## 5. 执行历史 API 探测

尝试调用候选执行历史接口：

- `GET /open-apis/bitable/v1/apps/{app_token}/workflows/{workflow_id}/executions` → **404 Not Found**
- `GET /open-apis/bitable/v1/apps/{app_token}/workflows/{workflow_id}/runs` → **404 Not Found**

**结论**：飞书未通过标准 Base OpenAPI 暴露自动化流程执行历史。实际运行次数、成功/失败状态、执行详情只能在飞书前端「自动化 → 运行日志」中查看。本报告只能提供“规则是否启用”和“数据条件是否满足”两层证据。

## 6. 用户级视图备份

实时视图配置已备份到：
- `D:\360Downloads\Trae 项目\SOP\feishu-v2\backups\private\live\views\customer-V1_CLIENTS_TABLE_ALIAS.json`
- `D:\360Downloads\Trae 项目\SOP\feishu-v2\backups\private\live\views\project-V1_PROJECTS_TABLE_ALIAS.json`
- `D:\360Downloads\Trae 项目\SOP\feishu-v2\backups\private\live\views\resource-V1_RESOURCEMASTER_TABLE_ALIAS.json`
- `D:\360Downloads\Trae 项目\SOP\feishu-v2\backups\private\live\views\knowledge-V1_KNOWLEDGEBASE_TABLE_ALIAS.json`
- `D:\360Downloads\Trae 项目\SOP\feishu-v2\backups\private\live\views\material-V1_MATERIALLIBRARY_TABLE_ALIAS.json`
- `D:\360Downloads\Trae 项目\SOP\feishu-v2\backups\private\live\views\publish-V1_PUBLISHTASKS_TABLE_ALIAS.json`

## 7. 结论

- 12 条工作流全部处于 **enabled** 状态，配置未变更。
- **规则 #5**：实时数据仍无已付定金客户，无执行痕迹。
- **规则 #12**：实时数据仍无优质合作资源，未触发。
- 执行历史无法通过 API 批量拉取，需在前端手动查看或等待飞书开放对应接口。
