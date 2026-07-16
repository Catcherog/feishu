# V2 View Inventory v1.1

> 固定日期：2026-07-16
> 来源：docs/v2-base-schema.md + phase1b3_migration_gate_decision.md
> 用途：快速查找任意视图的筛选条件和排序

## 视图总览

| # | 表 | 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 | 自动化数据源 |
|---|---|---|---|---|---|---|---|
| 1 | Customer | 全部客户 | 表格 | 无 | created_at 降序 | 默认视图 | - |
| 2 | Customer | 今日待跟进 | 表格 | next_action_at ≤ 今天 且 relationship_status ≠ 已完成 且 ≠ 已流失 | next_action_at 升序 | F1 自动化数据源 | F1 |
| 3 | Customer | 跟进中客户 | 表格 | relationship_status = 跟进中 | next_action_at 升序 | 活跃跟进池 | - |
| 4 | Customer | 待定金客户 | 表格 | relationship_status = 待定金 | updated_at 降序 | 重点转化对象 | - |
| 5 | Customer | 服务中客户 | 表格 | relationship_status = 服务中 | owner 分组 | 当前服务中 | - |
| 6 | Customer | 已流失客户 | 表格 | relationship_status = 已流失 | updated_at 降序 | 回收站 | - |
| 7 | Customer | 高意向客户 | 看板 | intent_level = 高 且 relationship_status ∈ {新线索, 跟进中, 已确认需求, 待定金} | — | 按状态分组看板 | - |
| 8 | Customer | 按负责人分组 | 看板 | 无 | — | owner 分组 | - |
| 9 | Customer | 高敏客户 | 表格 | privacy_level = 高敏 | created_at 降序 | 隐私管控 | - |
| 10 | Customer | 迁移记录 | 表格 | migration_batch_id 不为空 | migrated_at 降序 | 按迁移批次查看 | - |
| 11 | Project | 全部项目 | 表格 | 无 | created_at 降序 | 默认视图 | - |
| 11 | Project | 未来3天拍摄 | 表格 | project_status = 待拍摄 且 shoot_date_start ≤ 今天+3天 且 shoot_date_start ≥ 今天 | shoot_date_start 升序 | F2 自动化数据源 | F2 |
| 12 | Project | 交付超期 | 表格 | project_status ∈ {后期制作, 客户确认} 且 delivery_due_at < 今天 | delivery_due_at 升序 | F2 自动化数据源 | F2 |
| 13 | Project | 待客户确认 | 表格 | project_status = 客户确认 | updated_at 降序 | F2 自动化数据源 | F2 |
| 14 | Project | 策划中 | 表格 | project_status = 策划中 且 planning_status ∈ {草稿, 待审核, 需修改} | updated_at 降序 | 策划跟进 | - |
| 15 | Project | 资源确认中 | 表格 | project_status = 资源确认中 | updated_at 降序 | 资源安排跟进 | - |
| 16 | Project | 高风险项目 | 表格 | risk_level = 高风险 | delivery_due_at 升序 | 风险管控 | - |
| 17 | Project | 进行中看板 | 看板 | project_status ∉ {草稿, 已归档} | — | 按状态分组 | - |
| 18 | Project | 按负责人分组 | 看板 | 无 | — | project_owner 分组 | - |
| 19 | Project | 近期交付 | 画册 | project_status = 已交付 | delivery_due_at 降序 | 已交付项目展示 | - |
| 20 | Project | 迁移记录 | 表格 | migration_batch_id 不为空 | migrated_at 降序 | 按迁移批次查看 | - |
| 21 | Project | 按付款状态分组 | 看板 | 无 | — | payment_status 分组 | - |
| 22 | Resource | 全部资源 | 表格 | 无 | created_at 降序 | 默认视图 | - |
| 21 | Resource | 模特库 | 表格 | resource_type = 模特 | priority 升序 → rating_quality 降序 | 模特视图 | - |
| 22 | Resource | 化妆师库 | 表格 | resource_type = 化妆师 | priority 升序 → rating_quality 降序 | 化妆师视图 | - |
| 23 | Resource | 场地库 | 表格 | resource_type = 场地 | priority 升序 | 场地视图 | - |
| 24 | Resource | 服装库 | 表格 | resource_type = 服装 | created_at 降序 | 服装视图 | - |
| 25 | Resource | 修图师库 | 表格 | resource_type = 修图师 | priority 升序 → rating_reliability 降序 | 修图师视图 | - |
| 26 | Resource | 摄影师库 | 表格 | resource_type = 摄影师 | priority 升序 | 摄影师视图 | - |
| 27 | Resource | S级资源 | 表格 | priority = S | resource_type 分组 | 顶级资源池 | - |
| 28 | Resource | 待评估资源 | 表格 | priority = 待评估 | created_at 降序 | 新资源待评估 | - |
| 29 | Resource | 杭州可用资源 | 表格 | city = 杭州 且 cooperation_status ∈ {已合作, 沟通中} | priority 升序 | 地区可用资源 | - |
| 30 | Resource | 可合作资源 | 看板 | cooperation_status ∈ {已合作, 沟通中, 未联系} 且 ≠ 黑名单 | — | 按合作状态分组 | - |
| 31 | Resource | 按类型分组 | 看板 | 无 | — | resource_type 分组 | - |
| 32 | Resource | 迁移记录 | 表格 | migration_batch_id 不为空 | migrated_at 降序 | 按迁移批次查看 | - |
| 33 | Project_Resource_Assignment | 全部安排 | 表格 | 无 | created_at 降序 | 默认视图 | - |
| 33 | Project_Resource_Assignment | 待确认安排 | 表格 | booking_status = 待确认 | start_at 升序 | 需跟进确认 | - |
| 34 | Project_Resource_Assignment | 已确认安排 | 表格 | booking_status = 已确认 | start_at 升序 | 已确认档期 | - |
| 35 | Project_Resource_Assignment | 冲突安排 | 表格 | conflict_status ∈ {疑似冲突, 已冲突} | start_at 升序 | S4 自动化产出 | - |
| 36 | Project_Resource_Assignment | 按项目分组 | 看板 | 无 | — | project_link 分组 | - |
| 37 | Project_Resource_Assignment | 按资源分组 | 看板 | booking_status ≠ 已取消 | — | resource_link 分组 | - |
| 38 | Project_Resource_Assignment | 近期档期 | 表格 | start_at ≥ 今天 且 booking_status = 已确认 且 start_at ≤ 今天+7天 | start_at 升序 | 本周档期 | - |
| 39 | Planning_Document | 全部策划 | 表格 | 无 | created_at 降序 | 默认视图 | - |
| 40 | Planning_Document | AI草稿待审核 | 表格 | status = AI草稿 | created_at 升序 | 待人工编辑 | - |
| 41 | Planning_Document | 待客户确认 | 表格 | status = 待客户确认 | updated_at 降序 | 等待客户反馈 | - |
| 42 | Planning_Document | 已批准策划 | 表格 | status = 已批准 | approved_at 降序 | 已批准策划案 | - |
| 43 | Planning_Document | 最新版本 | 表格 | 每个 project_link 仅显示最新 version | version 降序 | 按项目显示最新策划 | - |
| 44 | Planning_Document | 按项目分组 | 看板 | 无 | — | project_link 分组 | - |
| 45 | Planning_Document | 按状态看板 | 看板 | status ≠ 已废弃 | — | status 分组 | - |
| 46 | Task | 全部任务 | 表格 | 无 | created_at 降序 | 默认视图 | - |
| 47 | Task | 待处理 | 表格 | status = 待处理 | due_at 升序 | 待领取任务 | - |
| 48 | Task | 处理中 | 表格 | status = 处理中 | due_at 升序 | 进行中任务 | - |
| 49 | Task | 受阻任务 | 表格 | status = 受阻 | updated_at 降序 | 需关注 | - |
| 50 | Task | 已超期 | 表格 | status ∈ {待处理, 处理中} 且 due_at < 今天 且 due_at ≠ 空 | due_at 升序 | SLA 超期 | - |
| 51 | Task | 今日到期 | 表格 | due_at = 今天 且 status ∈ {待处理, 处理中} | due_at 升序 | 今日截止 | - |
| 52 | Task | 按负责人分组 | 看板 | status ∈ {待处理, 处理中, 受阻} | — | owner 分组 | - |
| 53 | Task | 按类型看板 | 看板 | status ∈ {待处理, 处理中} | — | task_type 分组 | - |
| 54 | Task | 复盘任务 | 表格 | task_type = 复盘 且 status ≠ 已取消 | due_at 升序 | S6 自动化产出 | - |
| 55 | AI_Inbox | 全部任务 | 表格 | 无 | created_at 降序 | 默认视图 | - |
| 56 | AI_Inbox | 待审核 | 表格 | review_status = 待审核 | risk_level 升序 → created_at 升序 | F3 自动化数据源 | F3 |
| 57 | AI_Inbox | 高风险待审 | 表格 | review_status = 待审核 且 risk_level = High | created_at 升序 | F3 即时提醒 | F3 |
| 58 | AI_Inbox | 中风险待审 | 表格 | review_status = 待审核 且 risk_level = Medium | created_at 升序 | F3 汇总提醒 | F3 |
| 59 | AI_Inbox | 已采纳 | 表格 | review_status = 已采纳 | reviewed_at 降序 | 已写回记录 | - |
| 60 | AI_Inbox | 已拒绝 | 表格 | review_status = 已拒绝 | reviewed_at 降序 | 被拒绝记录 | - |
| 61 | AI_Inbox | 执行失败 | 表格 | review_status = 执行失败 | created_at 降序 | 写回失败待处理 | - |
| 62 | AI_Inbox | 按类型看板 | 看板 | review_status = 待审核 | — | task_type 分组 | - |
| 63 | AI_Inbox | 按风险看板 | 看板 | review_status = 待审核 | — | risk_level 分组 | - |
| 64 | AI_Inbox | 近期已审 | 表格 | review_status ∈ {已采纳, 已修改, 已拒绝} 且 reviewed_at ≥ 今天-7天 | reviewed_at 降序 | 近 7 天审核记录 | - |
| 65 | Automation_Event | 全部事件 | 表格 | 无 | started_at 降序 | 默认视图 | - |
| 66 | Automation_Event | 失败事件 | 表格 | status = failed | started_at 降序 | S8 自动化数据源 | - |
| 67 | Automation_Event | 待人工补偿 | 表格 | status = manual_action | started_at 升序 | 需人工处理 | - |
| 68 | Automation_Event | 运行中 | 表格 | status ∈ {received, running} | started_at 降序 | 正在执行 | - |
| 69 | Automation_Event | 今日事件 | 表格 | started_at ≥ 今天 | started_at 降序 | 今日所有事件 | - |
| 70 | Automation_Event | 按类型分组 | 看板 | 无 | — | event_type 分组 | - |
| 71 | Automation_Event | 按状态看板 | 看板 | 无 | — | status 分组 | - |
| 72 | Automation_Event | 高频错误 | 表格 | status = failed | error_code 分组 → started_at 降序 | S8 错误统计 | - |
| 73 | Data_Quality_Issue | 全部问题 | 表格 | 无 | detected_at 降序 | 默认视图 | - |
| 74 | Data_Quality_Issue | 待处理 | 表格 | status = 待处理 | severity 升序 → detected_at 升序 | 按严重程度排序 | - |
| 75 | Data_Quality_Issue | 处理中 | 表格 | status = 处理中 | severity 升序 → detected_at 升序 | 正在处理 | - |
| 76 | Data_Quality_Issue | 已解决 | 表格 | status = 已解决 | resolved_at 降序 | 已关闭问题 | - |
| 77 | Data_Quality_Issue | 严重问题 | 表格 | severity = 严重 且 status ∈ {待处理, 处理中} | detected_at 升序 | 需立即处理 | - |
| 78 | Data_Quality_Issue | 迁移问题 | 表格 | detected_by = 迁移对账 | detected_at 降序 | 迁移过程中发现的问题 | - |
| 79 | Data_Quality_Issue | 按类型分组 | 看板 | status ∈ {待处理, 处理中} | — | issue_type 分组 | - |
| 80 | Data_Quality_Issue | 按状态看板 | 看板 | 无 | — | status 分组 | - |
| 81 | System_Config | 全部配置 | 表格 | 无 | config_category 分组 → version 降序 | 默认视图 | - |
| 82 | System_Config | 生效配置 | 表格 | is_active = true | config_category 分组 | 当前生效的配置 | - |
| 83 | System_Config | 状态机配置 | 表格 | config_category = 状态机 | version 降序 | 状态机版本管理 | - |
| 84 | System_Config | Prompt版本 | 表格 | config_category = Prompt | version 降序 | Prompt 版本管理 | - |
| 85 | System_Config | 自动化规则 | 表格 | config_category = 自动化规则 | config_key 分组 → version 降序 | 规则版本管理 | - |
| 86 | System_Config | 枚举字典 | 表格 | config_category = 枚举字典 | config_key 分组 | 枚举值管理 | - |
| 87 | System_Config | 按类别看板 | 看板 | 无 | — | config_category 分组 | - |

## 按表分组

### Customer 客户表

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部客户 | 表格 | 无 | created_at 降序 | 默认视图 |
| 今日待跟进 | 表格 | next_action_at ≤ 今天 且 relationship_status ≠ 已完成 且 ≠ 已流失 | next_action_at 升序 | F1 自动化数据源 |
| 跟进中客户 | 表格 | relationship_status = 跟进中 | next_action_at 升序 | 活跃跟进池 |
| 待定金客户 | 表格 | relationship_status = 待定金 | updated_at 降序 | 重点转化对象 |
| 服务中客户 | 表格 | relationship_status = 服务中 | owner 分组 | 当前服务中 |
| 已流失客户 | 表格 | relationship_status = 已流失 | updated_at 降序 | 回收站 |
| 高意向客户 | 看板 | intent_level = 高 且 relationship_status ∈ {新线索, 跟进中, 已确认需求, 待定金} | — | 按状态分组看板 |
| 按负责人分组 | 看板 | 无 | — | owner 分组 |
| 高敏客户 | 表格 | privacy_level = 高敏 | created_at 降序 | 隐私管控 |
| 迁移记录 | 表格 | migration_batch_id 不为空 | migrated_at 降序 | 按迁移批次查看 |

### Project 项目表

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部项目 | 表格 | 无 | created_at 降序 | 默认视图 |
| 未来3天拍摄 | 表格 | project_status = 待拍摄 且 shoot_date_start ≤ 今天+3天 且 shoot_date_start ≥ 今天 | shoot_date_start 升序 | F2 自动化数据源 |
| 交付超期 | 表格 | project_status ∈ {后期制作, 客户确认} 且 delivery_due_at < 今天 | delivery_due_at 升序 | F2 自动化数据源 |
| 待客户确认 | 表格 | project_status = 客户确认 | updated_at 降序 | F2 自动化数据源 |
| 策划中 | 表格 | project_status = 策划中 且 planning_status ∈ {草稿, 待审核, 需修改} | updated_at 降序 | 策划跟进 |
| 资源确认中 | 表格 | project_status = 资源确认中 | updated_at 降序 | 资源安排跟进 |
| 高风险项目 | 表格 | risk_level = 高风险 | delivery_due_at 升序 | 风险管控 |
| 进行中看板 | 看板 | project_status ∉ {草稿, 已归档} | — | 按状态分组 |
| 按负责人分组 | 看板 | 无 | — | project_owner 分组 |
| 近期交付 | 画册 | project_status = 已交付 | delivery_due_at 降序 | 已交付项目展示 |
| 迁移记录 | 表格 | migration_batch_id 不为空 | migrated_at 降序 | 按迁移批次查看 |
| 按付款状态分组 | 看板 | 无 | — | payment_status 分组 |

### Resource 统一资源表

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部资源 | 表格 | 无 | created_at 降序 | 默认视图 |
| 模特库 | 表格 | resource_type = 模特 | priority 升序 → rating_quality 降序 | 模特视图 |
| 化妆师库 | 表格 | resource_type = 化妆师 | priority 升序 → rating_quality 降序 | 化妆师视图 |
| 场地库 | 表格 | resource_type = 场地 | priority 升序 | 场地视图 |
| 服装库 | 表格 | resource_type = 服装 | created_at 降序 | 服装视图 |
| 修图师库 | 表格 | resource_type = 修图师 | priority 升序 → rating_reliability 降序 | 修图师视图 |
| 摄影师库 | 表格 | resource_type = 摄影师 | priority 升序 | 摄影师视图 |
| S级资源 | 表格 | priority = S | resource_type 分组 | 顶级资源池 |
| 待评估资源 | 表格 | priority = 待评估 | created_at 降序 | 新资源待评估 |
| 杭州可用资源 | 表格 | city = 杭州 且 cooperation_status ∈ {已合作, 沟通中} | priority 升序 | 地区可用资源 |
| 可合作资源 | 看板 | cooperation_status ∈ {已合作, 沟通中, 未联系} 且 ≠ 黑名单 | — | 按合作状态分组 |
| 按类型分组 | 看板 | 无 | — | resource_type 分组 |
| 迁移记录 | 表格 | migration_batch_id 不为空 | migrated_at 降序 | 按迁移批次查看 |

### Project_Resource_Assignment 项目资源安排表

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部安排 | 表格 | 无 | created_at 降序 | 默认视图 |
| 待确认安排 | 表格 | booking_status = 待确认 | start_at 升序 | 需跟进确认 |
| 已确认安排 | 表格 | booking_status = 已确认 | start_at 升序 | 已确认档期 |
| 冲突安排 | 表格 | conflict_status ∈ {疑似冲突, 已冲突} | start_at 升序 | S4 自动化产出 |
| 按项目分组 | 看板 | 无 | — | project_link 分组 |
| 按资源分组 | 看板 | booking_status ≠ 已取消 | — | resource_link 分组 |
| 近期档期 | 表格 | start_at ≥ 今天 且 booking_status = 已确认 且 start_at ≤ 今天+7天 | start_at 升序 | 本周档期 |

### Planning_Document 策划案表

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部策划 | 表格 | 无 | created_at 降序 | 默认视图 |
| AI草稿待审核 | 表格 | status = AI草稿 | created_at 升序 | 待人工编辑 |
| 待客户确认 | 表格 | status = 待客户确认 | updated_at 降序 | 等待客户反馈 |
| 已批准策划 | 表格 | status = 已批准 | approved_at 降序 | 已批准策划案 |
| 最新版本 | 表格 | 每个 project_link 仅显示最新 version | version 降序 | 按项目显示最新策划 |
| 按项目分组 | 看板 | 无 | — | project_link 分组 |
| 按状态看板 | 看板 | status ≠ 已废弃 | — | status 分组 |

### Task 任务表

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部任务 | 表格 | 无 | created_at 降序 | 默认视图 |
| 待处理 | 表格 | status = 待处理 | due_at 升序 | 待领取任务 |
| 处理中 | 表格 | status = 处理中 | due_at 升序 | 进行中任务 |
| 受阻任务 | 表格 | status = 受阻 | updated_at 降序 | 需关注 |
| 已超期 | 表格 | status ∈ {待处理, 处理中} 且 due_at < 今天 且 due_at ≠ 空 | due_at 升序 | SLA 超期 |
| 今日到期 | 表格 | due_at = 今天 且 status ∈ {待处理, 处理中} | due_at 升序 | 今日截止 |
| 按负责人分组 | 看板 | status ∈ {待处理, 处理中, 受阻} | — | owner 分组 |
| 按类型看板 | 看板 | status ∈ {待处理, 处理中} | — | task_type 分组 |
| 复盘任务 | 表格 | task_type = 复盘 且 status ≠ 已取消 | due_at 升序 | S6 自动化产出 |

### AI_Inbox AI审核队列

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部任务 | 表格 | 无 | created_at 降序 | 默认视图 |
| 待审核 | 表格 | review_status = 待审核 | risk_level 升序 → created_at 升序 | F3 自动化数据源 |
| 高风险待审 | 表格 | review_status = 待审核 且 risk_level = High | created_at 升序 | F3 即时提醒 |
| 中风险待审 | 表格 | review_status = 待审核 且 risk_level = Medium | created_at 升序 | F3 汇总提醒 |
| 已采纳 | 表格 | review_status = 已采纳 | reviewed_at 降序 | 已写回记录 |
| 已拒绝 | 表格 | review_status = 已拒绝 | reviewed_at 降序 | 被拒绝记录 |
| 执行失败 | 表格 | review_status = 执行失败 | created_at 降序 | 写回失败待处理 |
| 按类型看板 | 看板 | review_status = 待审核 | — | task_type 分组 |
| 按风险看板 | 看板 | review_status = 待审核 | — | risk_level 分组 |
| 近期已审 | 表格 | review_status ∈ {已采纳, 已修改, 已拒绝} 且 reviewed_at ≥ 今天-7天 | reviewed_at 降序 | 近 7 天审核记录 |

### Automation_Event 自动化事件日志

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部事件 | 表格 | 无 | started_at 降序 | 默认视图 |
| 失败事件 | 表格 | status = failed | started_at 降序 | S8 自动化数据源 |
| 待人工补偿 | 表格 | status = manual_action | started_at 升序 | 需人工处理 |
| 运行中 | 表格 | status ∈ {received, running} | started_at 降序 | 正在执行 |
| 今日事件 | 表格 | started_at ≥ 今天 | started_at 降序 | 今日所有事件 |
| 按类型分组 | 看板 | 无 | — | event_type 分组 |
| 按状态看板 | 看板 | 无 | — | status 分组 |
| 高频错误 | 表格 | status = failed | error_code 分组 → started_at 降序 | S8 错误统计 |

### Data_Quality_Issue 数据质量问题表

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部问题 | 表格 | 无 | detected_at 降序 | 默认视图 |
| 待处理 | 表格 | status = 待处理 | severity 升序 → detected_at 升序 | 按严重程度排序 |
| 处理中 | 表格 | status = 处理中 | severity 升序 → detected_at 升序 | 正在处理 |
| 已解决 | 表格 | status = 已解决 | resolved_at 降序 | 已关闭问题 |
| 严重问题 | 表格 | severity = 严重 且 status ∈ {待处理, 处理中} | detected_at 升序 | 需立即处理 |
| 迁移问题 | 表格 | detected_by = 迁移对账 | detected_at 降序 | 迁移过程中发现的问题 |
| 按类型分组 | 看板 | status ∈ {待处理, 处理中} | — | issue_type 分组 |
| 按状态看板 | 看板 | 无 | — | status 分组 |

### System_Config 配置表

| 视图名称 | 视图类型 | 筛选条件 | 排序 | 说明 |
|---|---|---|---|---|
| 全部配置 | 表格 | 无 | config_category 分组 → version 降序 | 默认视图 |
| 生效配置 | 表格 | is_active = true | config_category 分组 | 当前生效的配置 |
| 状态机配置 | 表格 | config_category = 状态机 | version 降序 | 状态机版本管理 |
| Prompt版本 | 表格 | config_category = Prompt | version 降序 | Prompt 版本管理 |
| 自动化规则 | 表格 | config_category = 自动化规则 | config_key 分组 → version 降序 | 规则版本管理 |
| 枚举字典 | 表格 | config_category = 枚举字典 | config_key 分组 | 枚举值管理 |
| 按类别看板 | 看板 | 无 | — | config_category 分组 |

## 自动化数据源视图

| 自动化 | 视图 | 表 | 筛选条件 |
|---|---|---|---|
| F1 客户跟进每日汇总 | 今日待跟进 | Customer | next_action_at ≤ 今天 且 relationship_status ≠ 已完成 且 ≠ 已流失 |
| F2 项目节点每日汇总 | 未来3天拍摄 | Project | project_status = 待拍摄 且 shoot_date_start ≤ 今天+3天 且 shoot_date_start ≥ 今天 |
| F2 项目节点每日汇总 | 交付超期 | Project | project_status ∈ {后期制作, 客户确认} 且 delivery_due_at < 今天 |
| F2 项目节点每日汇总 | 待客户确认 | Project | project_status = 客户确认 |
| F3 AI审核待办提醒 | 待审核 | AI_Inbox | review_status = 待审核 |
| F3 AI审核待办提醒 | 高风险待审 | AI_Inbox | review_status = 待审核 且 risk_level = High |
| F3 AI审核待办提醒 | 中风险待审 | AI_Inbox | review_status = 待审核 且 risk_level = Medium |

## 视图类型统计

| 视图类型 | 数量 | 说明 |
|---|---|---|
| 表格 | 70 | 标准列表视图 |
| 看板 | 20 | 分组看板视图 |
| 画册 | 1 | 画册展示视图（Project 近期交付） |
| **合计** | **92** | |

## 各表视图数量统计

| 表 | 视图数量 |
|---|---|
| Customer | 10 |
| Project | 12 |
| Resource | 13 |
| Project_Resource_Assignment | 7 |
| Planning_Document | 7 |
| Task | 9 |
| AI_Inbox | 10 |
| Automation_Event | 8 |
| Data_Quality_Issue | 8 |
| System_Config | 7 |
| **合计** | **92** |
