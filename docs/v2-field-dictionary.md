# V2 Field Dictionary v1.1

> 固定日期：2026-07-16
> 来源：docs/v2-base-schema.md + phase1b3_migration_gate_decision.md
> 用途：快速查找任意字段的类型、约束和选项

## 字段总览

| # | 表 | 字段键 | 显示名 | 飞书类型 | 必填 | 约束/选项 |
|---|---|---|---|---|---|---|
| 1 | Customer | customer_id | 客户编号 | auto_number | 是 | 格式：CUST-{YYYYMMDD}-{###} |
| 2 | Customer | customer_name | 客户姓名 | text | 是 | ≤20 字符；非空 |
| 3 | Customer | phone | 手机号 | text | 是 | validation：需标准化校验；purpose：用于去重匹配 |
| 4 | Customer | wechat_name | 微信号 | text | 否 | — |
| 5 | Customer | source_channel | 来源渠道 | single_select | 是 | — | 选项：小红书、抖音、视频号、朋友圈、微信公众号、微信私聊、官网、小程序、转介绍、线下活动、其他、未知 |
| 6 | Customer | source_channel_raw | 来源渠道原始值 | text | 否 | — |
| 7 | Customer | source_channel_mapping_version | 来源渠道映射版本 | text | 否 | 默认：source-map-v1.0 |
| 8 | Customer | relationship_status | 客户状态 | single_select | 是 | 状态机：customer_relationship_status；AI直接编辑：False | 选项：新线索、跟进中、已确认需求、待定金、已成交、服务中、已完成、复购/转介绍、已流失 |
| 9 | Customer | legacy_status_raw | 旧客户状态原始值 | text | 否 | — |
| 10 | Customer | status_mapping_rule_version | 状态映射规则版本 | text | 否 | 默认：status-map-v1.0 |
| 11 | Customer | intent_level | 意向等级 | single_select | 是 | — | 选项：高、中、低、未知 |
| 12 | Customer | service_type | 服务类型 | multi_select | 否 | — | 选项：个人、双人、品牌、创作、其他 |
| 13 | Customer | preferred_style | 偏好风格 | multi_select | 否 | — | 选项：新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他 |
| 14 | Customer | budget_min | 预算下限 | number | 否 | ≥0；整数；单位：元 |
| 15 | Customer | budget_max | 预算上限 | number | 否 | ≥budget_min；可为空；单位：元 |
| 16 | Customer | budget_range_raw | 预算区间原始文本 | text | 否 | — |
| 17 | Customer | budget_parse_status | 预算解析状态 | single_select | 否 | — | 选项：parsed、ambiguous、unknown、invalid |
| 18 | Customer | budget_parse_rule_version | 预算解析规则版本 | text | 否 | 默认：budget-map-v1.0 |
| 19 | Customer | preferred_date_start | 期望档期起 | date | 否 | — |
| 20 | Customer | preferred_date_end | 期望档期止 | date | 否 | ≥preferred_date_start |
| 21 | Customer | owner | 跟进负责人 | person | 是 | — |
| 22 | Customer | last_contact_at | 最后跟进时间 | datetime | 否 | — |
| 23 | Customer | next_action_at | 下次跟进时间 | datetime | 否 | 自动化 F1 数据源 |
| 24 | Customer | latest_summary | 最新跟进摘要 | multiline_text | 否 | ≤500 字符 |
| 25 | Customer | privacy_level | 隐私级别 | single_select | 是 | — | 选项：普通、敏感、高敏 |
| 26 | Customer | created_at | 创建时间 | datetime | 是 | — |
| 27 | Customer | updated_at | 更新时间 | datetime | 是 | — |
| 28 | Customer | legacy_record_id | 旧记录ID | text | 否 | — |
| 29 | Customer | legacy_source | 旧表来源 | text | 否 | — |
| 30 | Customer | canonical_business_id | 规范业务ID | text | 否 | — |
| 31 | Customer | duplicate_review_status | 重复候选审核状态 | single_select | 否 | — | 选项：SAME_ENTITY、DISTINCT_ENTITY、UNRESOLVED、NA |
| 32 | Customer | migration_batch_id | 迁移批次ID | text | 否 | — |
| 33 | Customer | migration_source_record_id | 迁移源记录ID | text | 否 | — |
| 34 | Customer | migration_source_table | 迁移源表 | text | 否 | — |
| 35 | Customer | migration_rule_version | 迁移规则版本 | text | 否 | — |
| 36 | Customer | migrated_at | 迁移时间 | datetime | 否 | — |
| 37 | Project | project_id | 项目编号 | auto_number | 是 | 格式：PRJ-{YYYYMMDD}-{###} |
| 38 | Project | customer_link | 关联客户 | link | 是 | 关联到 customer；single选 |
| 39 | Project | project_name | 项目名称 | text | 是 | suggested_format：{客户名}-{类型}-{日期} |
| 40 | Project | project_type | 项目类型 | single_select | 是 | — | 选项：客片、创作、品牌、其他 |
| 41 | Project | deposit_amount | 定金金额 | number | 否 | ≥0；整数；单位：元 |
| 42 | Project | deal_amount | 成交金额 | number | 否 | ≥0；整数；单位：元 |
| 43 | Project | currency | 币种 | single_select | 否 | 默认：CNY | 选项：CNY |
| 44 | Project | payment_status | 付款状态 | single_select | 否 | — | 选项：未知、待定金、已付定金、已结清、已退款、部分退款 |
| 45 | Project | project_status | 项目状态 | single_select | 是 | 状态机：project_status；AI直接编辑：False | 选项：草稿、策划中、策划已批准、资源确认中、待拍摄、拍摄完成、后期制作、客户确认、已交付、已归档 |
| 46 | Project | legacy_status_raw | 旧项目状态原始值 | text | 否 | — |
| 47 | Project | status_mapping_rule_version | 状态映射规则版本 | text | 否 | 默认：status-map-v1.0 |
| 48 | Project | shoot_date_start | 拍摄开始时间 | datetime | 否 | — |
| 49 | Project | shoot_date_end | 拍摄结束时间 | datetime | 否 | ≥shoot_date_start |
| 50 | Project | location_text | 拍摄地点 | text | 否 | ≤100 字符 |
| 51 | Project | project_owner | 项目负责人 | person | 是 | — |
| 52 | Project | photographer | 摄影师 | person | 否 | — |
| 53 | Project | planning_status | 策划状态 | single_select | 是 | — | 选项：未创建、草稿、待审核、已批准、需修改 |
| 54 | Project | planning_link | 关联策划案 | link | 否 | 关联到 planning_document；multi选 |
| 55 | Project | delivery_due_at | 交付截止日 | date | 否 | 自动化 F2 数据源 |
| 56 | Project | satisfaction_score | 客户满意度评分 | number | 否 | ≥1；≤5；保留 1 位小数 |
| 57 | Project | satisfaction_note | 满意度备注 | multiline_text | 否 | ≤500 字符 |
| 58 | Project | feedback_collected_at | 满意度收集时间 | datetime | 否 | — |
| 59 | Project | risk_level | 风险等级 | single_select | 是 | — | 选项：正常、关注、高风险 |
| 60 | Project | risk_reason | 风险原因 | multiline_text | 否 | 当 risk_level ≠ 正常 时建议填写 |
| 61 | Project | folder_url | 项目文件夹 | url | 否 | — |
| 62 | Project | created_at | 创建时间 | datetime | 是 | — |
| 63 | Project | updated_at | 更新时间 | datetime | 是 | — |
| 64 | Project | legacy_record_id | 旧记录ID | text | 否 | — |
| 65 | Project | legacy_source | 旧表来源 | text | 否 | — |
| 66 | Project | migration_batch_id | 迁移批次ID | text | 否 | — |
| 67 | Project | migration_source_record_id | 迁移源记录ID | text | 否 | — |
| 68 | Project | migration_source_table | 迁移源表 | text | 否 | — |
| 69 | Project | migration_rule_version | 迁移规则版本 | text | 否 | — |
| 70 | Project | migrated_at | 迁移时间 | datetime | 否 | — |
| 71 | Resource | resource_id | 资源编号 | auto_number | 是 | 格式：RES-{YYYYMMDD}-{###} |
| 72 | Resource | resource_type | 资源类型 | single_select | 是 | — | 选项：模特、化妆师、场地、服装、修图师、摄影师、其他 |
| 73 | Resource | resource_name | 资源名称 | text | 是 | ≤30 字符；非空 |
| 74 | Resource | contact | 联系方式 | text | 否 | 格式：手机号/微信/邮箱 |
| 75 | Resource | city | 城市 | single_select | 否 | — | 选项：杭州、上海、北京、深圳、广州、成都、武汉、其他 |
| 76 | Resource | style_tags | 风格标签 | multi_select | 否 | — | 选项：新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他 |
| 77 | Resource | capability_tags | 能力标签 | multi_select | 否 | — | 选项：发型、妆面、尺码、设备、场地类型、服装类别、其他 |
| 78 | Resource | priority | 优先级 | single_select | 是 | — | 选项：S、A、B、待评估 |
| 79 | Resource | cooperation_status | 合作状态 | single_select | 是 | — | 选项：未联系、沟通中、已合作、暂停、黑名单 |
| 80 | Resource | availability_note | 档期备注 | text | 否 | ≤200 字符 |
| 81 | Resource | portfolio_url | 作品链接 | url | 否 | — |
| 82 | Resource | price_min | 报价下限 | number | 否 | ≥0；单位：元 |
| 83 | Resource | price_max | 报价上限 | number | 否 | ≥price_min；单位：元 |
| 84 | Resource | rating_quality | 质量评分 | rating | 否 | ≥1；≤5 |
| 85 | Resource | rating_reliability | 可靠性评分 | rating | 否 | ≥1；≤5 |
| 86 | Resource | last_cooperation_at | 最近合作日期 | date | 否 | — |
| 87 | Resource | notes | 备注 | multiline_text | 否 | ≤500 字符 |
| 88 | Resource | resource_profile_json | 资源档案JSON | multiline_text | 否 | 格式：合法 JSON 字符串 |
| 89 | Resource | created_at | 创建时间 | datetime | 是 | — |
| 90 | Resource | updated_at | 更新时间 | datetime | 是 | — |
| 91 | Resource | legacy_record_id | 旧记录ID | text | 否 | — |
| 92 | Resource | legacy_source | 旧表来源 | text | 否 | — |
| 93 | Resource | canonical_business_id | 规范业务ID | text | 否 | — |
| 94 | Resource | duplicate_review_status | 重复候选审核状态 | single_select | 否 | — | 选项：SAME_ENTITY、DISTINCT_ENTITY、UNRESOLVED、NA |
| 95 | Resource | migration_batch_id | 迁移批次ID | text | 否 | — |
| 96 | Resource | migration_source_record_id | 迁移源记录ID | text | 否 | — |
| 97 | Resource | migration_source_table | 迁移源表 | text | 否 | — |
| 98 | Resource | migration_rule_version | 迁移规则版本 | text | 否 | — |
| 99 | Resource | migrated_at | 迁移时间 | datetime | 否 | — |
| 100 | Project_resource_assignment | assignment_id | 安排编号 | auto_number | 是 | 格式：ASG-{YYYYMMDD}-{###} |
| 101 | Project_resource_assignment | project_link | 关联项目 | link | 是 | 关联到 project；single选 |
| 102 | Project_resource_assignment | resource_link | 关联资源 | link | 是 | 关联到 resource；single选 |
| 103 | Project_resource_assignment | role_in_project | 项目角色 | single_select | 是 | — | 选项：主模特、备选模特、主化妆、备选化妆、主摄影、助理摄影、场地、服装、修图师、道具、其他 |
| 104 | Project_resource_assignment | booking_status | 预约状态 | single_select | 是 | — | 选项：候选、询价中、待确认、已确认、已取消 |
| 105 | Project_resource_assignment | quoted_price | 报价 | number | 否 | ≥0；单位：元 |
| 106 | Project_resource_assignment | confirmed_price | 确认价格 | number | 否 | ≥0；单位：元 |
| 107 | Project_resource_assignment | start_at | 档期开始 | datetime | 否 | — |
| 108 | Project_resource_assignment | end_at | 档期结束 | datetime | 否 | ≥start_at |
| 109 | Project_resource_assignment | conflict_status | 冲突状态 | single_select | 是 | 由 S4 自动化更新 | 选项：无冲突、疑似冲突、已冲突 |
| 110 | Project_resource_assignment | owner | 跟进人 | person | 否 | — |
| 111 | Project_resource_assignment | notes | 备注 | text | 否 | ≤200 字符 |
| 112 | Project_resource_assignment | created_at | 创建时间 | datetime | 是 | — |
| 113 | Project_resource_assignment | updated_at | 更新时间 | datetime | 是 | — |
| 114 | Planning_document | planning_id | 策划编号 | auto_number | 是 | 格式：PLN-{YYYYMMDD}-{###} |
| 115 | Planning_document | project_link | 关联项目 | link | 是 | 关联到 project；single选 |
| 116 | Planning_document | version | 版本号 | text | 是 | 格式：v1, v2, ... |
| 117 | Planning_document | status | 策划状态 | single_select | 是 | flow：AI草稿 → 人工编辑 → 待客户确认 → 已批准（或 已废弃） | 选项：AI草稿、人工编辑、待客户确认、已批准、已废弃 |
| 118 | Planning_document | document_url | 策划文档链接 | url | 否 | — |
| 119 | Planning_document | template_version | 模板版本 | text | 否 | 格式：v1.0, v1.1, ... |
| 120 | Planning_document | ai_job_link | AI来源任务 | link | 否 | 关联到 ai_inbox；single选 |
| 121 | Planning_document | summary | 策划摘要 | multiline_text | 否 | ≤1000 字符 |
| 122 | Planning_document | theme | 主题 | text | 否 | ≤50 字符 |
| 123 | Planning_document | style_tags | 风格标签 | multi_select | 否 | — | 选项：新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他 |
| 124 | Planning_document | scene_plan | 场景摘要 | multiline_text | 否 | ≤500 字符 |
| 125 | Planning_document | wardrobe_plan | 服装摘要 | multiline_text | 否 | ≤500 字符 |
| 126 | Planning_document | makeup_plan | 妆造摘要 | multiline_text | 否 | ≤500 字符 |
| 127 | Planning_document | shot_list_summary | 分镜摘要 | multiline_text | 否 | ≤500 字符 |
| 128 | Planning_document | risk_notes | 风险与待确认 | multiline_text | 否 | — |
| 129 | Planning_document | approved_by | 批准人 | person | 否 | 当 status=已批准 时必填 |
| 130 | Planning_document | approved_at | 批准时间 | datetime | 否 | 当 status=已批准 时必填 |
| 131 | Planning_document | created_at | 创建时间 | datetime | 是 | — |
| 132 | Planning_document | updated_at | 更新时间 | datetime | 是 | — |
| 133 | Task | task_id | 任务编号 | auto_number | 是 | 格式：TSK-{YYYYMMDD}-{###} |
| 134 | Task | project_link | 关联项目 | link | 否 | 关联到 project；single选；可为空 |
| 135 | Task | task_type | 任务类型 | single_select | 是 | — | 选项：跟进、策划、资源确认、拍摄、后期、交付、复盘 |
| 136 | Task | title | 任务标题 | text | 是 | ≤50 字符 |
| 137 | Task | status | 任务状态 | single_select | 是 | — | 选项：待处理、处理中、受阻、已完成、已取消 |
| 138 | Task | owner | 负责人 | person | 是 | — |
| 139 | Task | due_at | 截止时间 | datetime | 否 | used_for：SLA 监控 |
| 140 | Task | completed_at | 完成时间 | datetime | 否 | 当 status=已完成 时必填 |
| 141 | Task | evidence_url | 完成证据 | url | 否 | 格式：可为附件或 URL |
| 142 | Task | source_event_id | 来源事件ID | text | 否 | references：Automation_Event.event_id |
| 143 | Task | notes | 备注 | text | 否 | ≤200 字符 |
| 144 | Task | created_at | 创建时间 | datetime | 是 | — |
| 145 | Task | updated_at | 更新时间 | datetime | 是 | — |
| 146 | Ai_inbox | ai_job_id | AI任务编号 | text | 是 | 格式：UUID |
| 147 | Ai_inbox | task_type | 任务类型 | single_select | 是 | — | 选项：客户提取、资源提取、项目提取、策划生成、摘要、质检 |
| 148 | Ai_inbox | source_type | 输入来源 | single_select | 是 | — | 选项：文本、截图、语音、表单、聊天记录、项目记录 |
| 149 | Ai_inbox | source_url | 原始输入链接 | url | 否 | 格式：附件或 URL |
| 150 | Ai_inbox | source_text | 输入文本 | multiline_text | 否 | — |
| 151 | Ai_inbox | target_entity | 目标实体 | single_select | 是 | — | 选项：Customer、Resource、Project、Planning |
| 152 | Ai_inbox | candidate_record_id | 候选记录ID | text | 否 | purpose：用于去重匹配 |
| 153 | Ai_inbox | output_json | AI输出JSON | multiline_text | 是 | 格式：合法 JSON，符合 ai_ingest_output.schema.json |
| 154 | Ai_inbox | confidence | 置信度 | number | 是 | ≥0；≤1；保留 2 位小数 |
| 155 | Ai_inbox | risk_level | 风险等级 | single_select | 是 | writeback_rules：{'Low': '标签、摘要、非关键备注 → 可批量审核，允许自动写回', 'Medium': '客户需求、预算、日期、资源匹配 → 必须逐条人工审核', 'High': '价格、付款、合同、档期承诺、删除、合并 → 不允许自动写回'} | 选项：Low、Medium、High |
| 156 | Ai_inbox | validation_errors | 校验错误 | multiline_text | 否 | — |
| 157 | Ai_inbox | review_status | 审核状态 | single_select | 是 | writeback_rule：仅 已采纳 或 已修改 状态才能执行 S7 写回 | 选项：待审核、已采纳、已修改、已拒绝、执行失败 |
| 158 | Ai_inbox | reviewer | 审核人 | person | 否 | 当 review_status ≠ 待审核 时必填 |
| 159 | Ai_inbox | human_revision_json | 人工修改JSON | multiline_text | 否 | 格式：合法 JSON |
| 160 | Ai_inbox | writeback_target | 写回目标 | text | 否 | example：Customer.phone, Customer.budget_min |
| 161 | Ai_inbox | writeback_result | 写回结果 | multiline_text | 否 | 格式：成功/失败/冲突详情 |
| 162 | Ai_inbox | model_name | 模型名称 | text | 否 | example：doubao-pro, gpt-4o |
| 163 | Ai_inbox | prompt_version | Prompt版本 | text | 否 | 格式：{task}-v{major}.{minor} |
| 164 | Ai_inbox | latency_ms | 耗时(ms) | number | 否 | 单位：毫秒 |
| 165 | Ai_inbox | cost_estimate | 成本估算 | number | 否 | 单位：元 |
| 166 | Ai_inbox | created_at | 创建时间 | datetime | 是 | — |
| 167 | Ai_inbox | reviewed_at | 审核时间 | datetime | 否 | 当 review_status ≠ 待审核 时必填 |
| 168 | Automation_event | event_id | 事件编号 | text | 是 | 格式：UUID |
| 169 | Automation_event | event_type | 事件类型 | single_select | 是 | — | 选项：S1定金创建项目、S2策划草稿生成、S3执行任务生成、S4资源冲突检查、S5客户状态同步、S6复盘任务生成、S7AI写回、S8失败汇总、手动补偿、其他 |
| 170 | Automation_event | source_table | 来源表 | single_select | 否 | — | 选项：Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox |
| 171 | Automation_event | source_record_id | 来源记录ID | text | 否 | — |
| 172 | Automation_event | idempotency_key | 幂等键 | text | 是 | 格式：source_record_id + event_type + rule_version；唯一 |
| 173 | Automation_event | rule_version | 规则版本 | text | 是 | 格式：v1.0, v1.1, ... |
| 174 | Automation_event | input_snapshot | 输入快照 | multiline_text | 否 | 格式：合法 JSON，脱敏后存储 |
| 175 | Automation_event | status | 执行状态 | single_select | 是 | flow：received → running → success / failed / manual_action | 选项：received、running、success、failed、manual_action |
| 176 | Automation_event | started_at | 开始时间 | datetime | 是 | — |
| 177 | Automation_event | completed_at | 完成时间 | datetime | 否 | 当 status ∈ {success, failed, manual_action} 时必填 |
| 178 | Automation_event | retry_count | 重试次数 | number | 是 | ≥0；≤3 |
| 179 | Automation_event | output_summary | 执行结果摘要 | multiline_text | 否 | ≤500 字符 |
| 180 | Automation_event | error_code | 错误代码 | text | 否 | example：FS_429, SCHEMA_ERROR |
| 181 | Automation_event | error_message | 错误信息 | multiline_text | 否 | ≤500 字符 |
| 182 | Automation_event | operator | 补偿操作人 | person | 否 | 当 status=manual_action 时必填 |
| 183 | Automation_event | created_at | 创建时间 | datetime | 是 | — |
| 184 | Data_quality_issue | issue_id | 问题编号 | auto_number | 是 | 格式：DQI-{YYYYMMDD}-{###} |
| 185 | Data_quality_issue | issue_type | 问题类型 | single_select | 是 | — | 选项：重复客户、重复资源、字段无法匹配、日期冲突、非法状态、缺失关键字段、关联记录丢失、资源档期冲突、写回失败、其他 |
| 186 | Data_quality_issue | severity | 严重程度 | single_select | 是 | affects：处理优先级 | 选项：低、中、高、严重 |
| 187 | Data_quality_issue | source_table | 来源表 | single_select | 否 | — | 选项：Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox、Automation_Event |
| 188 | Data_quality_issue | source_record_id | 来源记录ID | text | 否 | 格式：可为多个，逗号分隔 |
| 189 | Data_quality_issue | description | 问题描述 | multiline_text | 是 | ≤500 字符 |
| 190 | Data_quality_issue | detected_by | 发现方式 | single_select | 是 | — | 选项：自动化检测、AI质检、人工发现、迁移对账 |
| 191 | Data_quality_issue | detected_at | 发现时间 | datetime | 是 | — |
| 192 | Data_quality_issue | status | 处理状态 | single_select | 是 | — | 选项：待处理、处理中、已解决、已忽略、无法解决 |
| 193 | Data_quality_issue | owner | 责任人 | person | 否 | — |
| 194 | Data_quality_issue | resolution | 解决方案 | multiline_text | 否 | 当 status ∈ {已解决, 已忽略} 时必填 |
| 195 | Data_quality_issue | resolved_at | 解决时间 | datetime | 否 | 当 status=已解决 时必填 |
| 196 | Data_quality_issue | related_event_id | 关联事件ID | text | 否 | — |
| 197 | Data_quality_issue | created_at | 创建时间 | datetime | 是 | — |
| 198 | Data_quality_issue | updated_at | 更新时间 | datetime | 是 | — |
| 199 | System_config | config_id | 配置编号 | auto_number | 是 | 格式：CFG-{###} |
| 200 | System_config | config_key | 配置键 | text | 是 | 唯一；命名：snake_case |
| 201 | System_config | config_category | 配置类别 | single_select | 是 | — | 选项：状态机、Prompt、自动化规则、风险阈值、枚举字典、策划模板、系统参数 |
| 202 | System_config | config_value | 配置值 | multiline_text | 是 | 格式：JSON 或文本 |
| 203 | System_config | config_description | 配置说明 | multiline_text | 否 | ≤200 字符 |
| 204 | System_config | version | 版本号 | text | 是 | 格式：v1.0, v1.1, ... |
| 205 | System_config | is_active | 是否生效 | checkbox | 是 | 规则：同类别同 key 仅一条生效 |
| 206 | System_config | updated_by | 更新人 | person | 否 | — |
| 207 | System_config | created_at | 创建时间 | datetime | 是 | — |
| 208 | System_config | updated_at | 更新时间 | datetime | 是 | — |

## 详细字段说明

### Customer 客户表

> 用途：保存客户的权威身份、需求和关系状态。一个客户可关联多个项目。客户状态描述商业关系阶段，不复制项目具体交付状态。

#### customer_id
- 显示名：客户编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式：CUST-{YYYYMMDD}-{###}
- 说明：稳定业务 ID，不使用 record_id

#### customer_name
- 显示名：客户姓名
- 飞书类型：text
- 必填：是
- 约束：≤20 字符；非空
- 说明：正式姓名，昵称存入备注

#### phone
- 显示名：手机号
- 飞书类型：text
- 必填：是
- 约束：validation：需标准化校验；purpose：用于去重匹配
- 说明：统一格式，中国大陆或国际标准

#### wechat_name
- 显示名：微信号
- 飞书类型：text
- 必填：否
- 说明：不作为唯一匹配键

#### source_channel
- 显示名：来源渠道
- 飞书类型：single_select
- 必填：是
- 选项：小红书、抖音、视频号、朋友圈、微信公众号、微信私聊、官网、小程序、转介绍、线下活动、其他、未知
- 说明：客户来源

#### source_channel_raw
- 显示名：来源渠道原始值
- 飞书类型：text
- 必填：否
- 说明：迁移前旧表的原始来源渠道文本，保留业务事实

#### source_channel_mapping_version
- 显示名：来源渠道映射版本
- 飞书类型：text
- 必填：否
- 约束：默认：source-map-v1.0
- 说明：来源渠道映射规则版本

#### relationship_status
- 显示名：客户状态
- 飞书类型：single_select
- 必填：是
- 约束：状态机：customer_relationship_status；AI直接编辑：False
- 选项：新线索、跟进中、已确认需求、待定金、已成交、服务中、已完成、复购/转介绍、已流失
- 说明：商业关系状态，见客户状态机

#### legacy_status_raw
- 显示名：旧客户状态原始值
- 飞书类型：text
- 必填：否
- 说明：迁移前旧表的客户状态原始文本

#### status_mapping_rule_version
- 显示名：状态映射规则版本
- 飞书类型：text
- 必填：否
- 约束：默认：status-map-v1.0
- 说明：客户状态映射规则版本

#### intent_level
- 显示名：意向等级
- 飞书类型：single_select
- 必填：是
- 选项：高、中、低、未知
- 说明：客户意向强度

#### service_type
- 显示名：服务类型
- 飞书类型：multi_select
- 必填：否
- 选项：个人、双人、品牌、创作、其他
- 说明：期望拍摄类型

#### preferred_style
- 显示名：偏好风格
- 飞书类型：multi_select
- 必填：否
- 选项：新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他
- 说明：结构化风格标签

#### budget_min
- 显示名：预算下限
- 飞书类型：number
- 必填：否
- 约束：≥0；整数；单位：元
- 说明：预算范围下限

#### budget_max
- 显示名：预算上限
- 飞书类型：number
- 必填：否
- 约束：≥budget_min；可为空；单位：元
- 说明：预算范围上限

#### budget_range_raw
- 显示名：预算区间原始文本
- 飞书类型：text
- 必填：否
- 说明：迁移前旧表的原始预算文本，保留业务事实

#### budget_parse_status
- 显示名：预算解析状态
- 飞书类型：single_select
- 必填：否
- 选项：parsed、ambiguous、unknown、invalid
- 说明：预算文本解析结果状态

#### budget_parse_rule_version
- 显示名：预算解析规则版本
- 飞书类型：text
- 必填：否
- 约束：默认：budget-map-v1.0
- 说明：预算解析规则版本

#### preferred_date_start
- 显示名：期望档期起
- 飞书类型：date
- 必填：否
- 说明：期望拍摄时间范围起点

#### preferred_date_end
- 显示名：期望档期止
- 飞书类型：date
- 必填：否
- 约束：≥preferred_date_start
- 说明：期望拍摄时间范围终点

#### owner
- 显示名：跟进负责人
- 飞书类型：person
- 必填：是
- 说明：当前跟进负责人

#### last_contact_at
- 显示名：最后跟进时间
- 飞书类型：datetime
- 必填：否
- 说明：由真实跟进动作更新

#### next_action_at
- 显示名：下次跟进时间
- 飞书类型：datetime
- 必填：否
- 约束：自动化 F1 数据源
- 说明：下一次应跟进时间

#### latest_summary
- 显示名：最新跟进摘要
- 飞书类型：multiline_text
- 必填：否
- 约束：≤500 字符
- 说明：AI 可生成，人工确认后写入

#### privacy_level
- 显示名：隐私级别
- 飞书类型：single_select
- 必填：是
- 选项：普通、敏感、高敏
- 说明：控制信息可见性

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### updated_at
- 显示名：更新时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### legacy_record_id
- 显示名：旧记录ID
- 飞书类型：text
- 必填：否
- 说明：迁移对账用

#### legacy_source
- 显示名：旧表来源
- 飞书类型：text
- 必填：否
- 说明：迁移对账用

#### canonical_business_id
- 显示名：规范业务ID
- 飞书类型：text
- 必填：否
- 说明：人工确认重复候选后指向的主记录业务 ID，未确认时与 customer_id 相同

#### duplicate_review_status
- 显示名：重复候选审核状态
- 飞书类型：single_select
- 必填：否
- 选项：SAME_ENTITY、DISTINCT_ENTITY、UNRESOLVED、NA
- 说明：重复候选人工决策状态，UNRESOLVED 不得进入 Pilot

#### migration_batch_id
- 显示名：迁移批次ID
- 飞书类型：text
- 必填：否
- 说明：写入 V2 时标记的迁移批次，如 MIGRATION_PILOT_001

#### migration_source_record_id
- 显示名：迁移源记录ID
- 飞书类型：text
- 必填：否
- 说明：旧表源记录 record_id

#### migration_source_table
- 显示名：迁移源表
- 飞书类型：text
- 必填：否
- 说明：旧表表名

#### migration_rule_version
- 显示名：迁移规则版本
- 飞书类型：text
- 必填：否
- 说明：执行迁移时使用的规则版本集合

#### migrated_at
- 显示名：迁移时间
- 飞书类型：datetime
- 必填：否
- 说明：数据写入 V2 的时间

---

### Project 项目表

> 用途：表示一次正式交付。客户付定金或负责人确认立项后创建。一个项目关联一个客户，可关联多个资源安排和策划案。

#### project_id
- 显示名：项目编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式：PRJ-{YYYYMMDD}-{###}
- 说明：稳定业务 ID

#### customer_link
- 显示名：关联客户
- 飞书类型：link
- 必填：是
- 约束：关联到 customer；single选
- 说明：必须关联一个 Customer 记录

#### project_name
- 显示名：项目名称
- 飞书类型：text
- 必填：是
- 约束：suggested_format：{客户名}-{类型}-{日期}
- 说明：建议自动生成后允许人工修改

#### project_type
- 显示名：项目类型
- 飞书类型：single_select
- 必填：是
- 选项：客片、创作、品牌、其他
- 说明：拍摄类型

#### deposit_amount
- 显示名：定金金额
- 飞书类型：number
- 必填：否
- 约束：≥0；整数；单位：元
- 说明：客户已付定金金额，人民币

#### deal_amount
- 显示名：成交金额
- 飞书类型：number
- 必填：否
- 约束：≥0；整数；单位：元
- 说明：项目成交金额，人民币

#### currency
- 显示名：币种
- 飞书类型：single_select
- 必填：否
- 约束：默认：CNY
- 选项：CNY
- 说明：金额币种

#### payment_status
- 显示名：付款状态
- 飞书类型：single_select
- 必填：否
- 选项：未知、待定金、已付定金、已结清、已退款、部分退款
- 说明：项目付款状态

#### project_status
- 显示名：项目状态
- 飞书类型：single_select
- 必填：是
- 约束：状态机：project_status；AI直接编辑：False
- 选项：草稿、策划中、策划已批准、资源确认中、待拍摄、拍摄完成、后期制作、客户确认、已交付、已归档
- 说明：见项目状态机

#### legacy_status_raw
- 显示名：旧项目状态原始值
- 飞书类型：text
- 必填：否
- 说明：迁移前旧表的项目状态原始文本

#### status_mapping_rule_version
- 显示名：状态映射规则版本
- 飞书类型：text
- 必填：否
- 约束：默认：status-map-v1.0
- 说明：项目状态映射规则版本

#### shoot_date_start
- 显示名：拍摄开始时间
- 飞书类型：datetime
- 必填：否
- 说明：可为空

#### shoot_date_end
- 显示名：拍摄结束时间
- 飞书类型：datetime
- 必填：否
- 约束：≥shoot_date_start
- 说明：可为空

#### location_text
- 显示名：拍摄地点
- 飞书类型：text
- 必填：否
- 约束：≤100 字符
- 说明：首期允许文本，后续可关联资源

#### project_owner
- 显示名：项目负责人
- 飞书类型：person
- 必填：是
- 说明：项目总负责人

#### photographer
- 显示名：摄影师
- 飞书类型：person
- 必填：否
- 说明：团队内人员可用人员字段

#### planning_status
- 显示名：策划状态
- 飞书类型：single_select
- 必填：是
- 选项：未创建、草稿、待审核、已批准、需修改
- 说明：策划案进度

#### planning_link
- 显示名：关联策划案
- 飞书类型：link
- 必填：否
- 约束：关联到 planning_document；multi选
- 说明：关联 Planning_Document

#### delivery_due_at
- 显示名：交付截止日
- 飞书类型：date
- 必填：否
- 约束：自动化 F2 数据源
- 说明：交付 SLA

#### satisfaction_score
- 显示名：客户满意度评分
- 飞书类型：number
- 必填：否
- 约束：≥1；≤5；保留 1 位小数
- 说明：客户对项目结果满意度，建议 1-5

#### satisfaction_note
- 显示名：满意度备注
- 飞书类型：multiline_text
- 必填：否
- 约束：≤500 字符
- 说明：客户满意度反馈原文或摘要

#### feedback_collected_at
- 显示名：满意度收集时间
- 飞书类型：datetime
- 必填：否
- 说明：满意度反馈收集时间

#### risk_level
- 显示名：风险等级
- 飞书类型：single_select
- 必填：是
- 选项：正常、关注、高风险
- 说明：项目风险

#### risk_reason
- 显示名：风险原因
- 飞书类型：multiline_text
- 必填：否
- 约束：当 risk_level ≠ 正常 时建议填写
- 说明：风险触发依据

#### folder_url
- 显示名：项目文件夹
- 飞书类型：url
- 必填：否
- 说明：项目云盘/素材库链接

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### updated_at
- 显示名：更新时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### legacy_record_id
- 显示名：旧记录ID
- 飞书类型：text
- 必填：否
- 说明：迁移对账用

#### legacy_source
- 显示名：旧表来源
- 飞书类型：text
- 必填：否
- 说明：迁移对账用

#### migration_batch_id
- 显示名：迁移批次ID
- 飞书类型：text
- 必填：否
- 说明：写入 V2 时标记的迁移批次，如 MIGRATION_PILOT_001

#### migration_source_record_id
- 显示名：迁移源记录ID
- 飞书类型：text
- 必填：否
- 说明：旧表源记录 record_id

#### migration_source_table
- 显示名：迁移源表
- 飞书类型：text
- 必填：否
- 说明：旧表表名

#### migration_rule_version
- 显示名：迁移规则版本
- 飞书类型：text
- 必填：否
- 说明：执行迁移时使用的规则版本集合

#### migrated_at
- 显示名：迁移时间
- 飞书类型：datetime
- 必填：否
- 说明：数据写入 V2 的时间

---

### Resource 统一资源表

> 用途：合并模特、化妆师、场地、服装、修图师、摄影师等资源的公共信息，以"资源类型 + 视图"替代多张重复子表。通过 resource_type 区分资源类别。

#### resource_id
- 显示名：资源编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式：RES-{YYYYMMDD}-{###}
- 说明：稳定业务 ID

#### resource_type
- 显示名：资源类型
- 飞书类型：single_select
- 必填：是
- 选项：模特、化妆师、场地、服装、修图师、摄影师、其他
- 说明：资源类别，视图分组核心

#### resource_name
- 显示名：资源名称
- 飞书类型：text
- 必填：是
- 约束：≤30 字符；非空
- 说明：名称或称呼

#### contact
- 显示名：联系方式
- 飞书类型：text
- 必填：否
- 约束：格式：手机号/微信/邮箱
- 说明：按隐私级别控制可见性

#### city
- 显示名：城市
- 飞书类型：single_select
- 必填：否
- 选项：杭州、上海、北京、深圳、广州、成都、武汉、其他
- 说明：统一城市字典

#### style_tags
- 显示名：风格标签
- 飞书类型：multi_select
- 必填：否
- 选项：新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他
- 说明：擅长风格

#### capability_tags
- 显示名：能力标签
- 飞书类型：multi_select
- 必填：否
- 选项：发型、妆面、尺码、设备、场地类型、服装类别、其他
- 说明：能力/属性标签

#### priority
- 显示名：优先级
- 飞书类型：single_select
- 必填：是
- 选项：S、A、B、待评估
- 说明：资源优先级

#### cooperation_status
- 显示名：合作状态
- 飞书类型：single_select
- 必填：是
- 选项：未联系、沟通中、已合作、暂停、黑名单
- 说明：当前合作状态

#### availability_note
- 显示名：档期备注
- 飞书类型：text
- 必填：否
- 约束：≤200 字符
- 说明：首期不做完整排期系统

#### portfolio_url
- 显示名：作品链接
- 飞书类型：url
- 必填：否
- 说明：作品集链接

#### price_min
- 显示名：报价下限
- 飞书类型：number
- 必填：否
- 约束：≥0；单位：元
- 说明：报价范围下限

#### price_max
- 显示名：报价上限
- 飞书类型：number
- 必填：否
- 约束：≥price_min；单位：元
- 说明：报价范围上限

#### rating_quality
- 显示名：质量评分
- 飞书类型：rating
- 必填：否
- 约束：≥1；≤5
- 说明：质量评价

#### rating_reliability
- 显示名：可靠性评分
- 飞书类型：rating
- 必填：否
- 约束：≥1；≤5
- 说明：合作可靠性

#### last_cooperation_at
- 显示名：最近合作日期
- 飞书类型：date
- 必填：否
- 说明：最近一次合作时间

#### notes
- 显示名：备注
- 飞书类型：multiline_text
- 必填：否
- 约束：≤500 字符
- 说明：补充信息，不得代替结构化字段

#### resource_profile_json
- 显示名：资源档案JSON
- 飞书类型：multiline_text
- 必填：否
- 约束：格式：合法 JSON 字符串
- 说明：类型特有信息，供 Agent 和 API 使用

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### updated_at
- 显示名：更新时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### legacy_record_id
- 显示名：旧记录ID
- 飞书类型：text
- 必填：否
- 说明：迁移对账用

#### legacy_source
- 显示名：旧表来源
- 飞书类型：text
- 必填：否
- 说明：迁移对账用，旧子表名（如"模特资源库"）

#### canonical_business_id
- 显示名：规范业务ID
- 飞书类型：text
- 必填：否
- 说明：人工确认重复候选后指向的主记录业务 ID，未确认时与 resource_id 相同

#### duplicate_review_status
- 显示名：重复候选审核状态
- 飞书类型：single_select
- 必填：否
- 选项：SAME_ENTITY、DISTINCT_ENTITY、UNRESOLVED、NA
- 说明：重复候选人工决策状态，UNRESOLVED 不得进入 Pilot

#### migration_batch_id
- 显示名：迁移批次ID
- 飞书类型：text
- 必填：否
- 说明：写入 V2 时标记的迁移批次，如 MIGRATION_PILOT_001

#### migration_source_record_id
- 显示名：迁移源记录ID
- 飞书类型：text
- 必填：否
- 说明：旧表源记录 record_id

#### migration_source_table
- 显示名：迁移源表
- 飞书类型：text
- 必填：否
- 说明：旧表表名

#### migration_rule_version
- 显示名：迁移规则版本
- 飞书类型：text
- 必填：否
- 说明：执行迁移时使用的规则版本集合

#### migrated_at
- 显示名：迁移时间
- 飞书类型：datetime
- 必填：否
- 说明：数据写入 V2 的时间

---

### Project_Resource_Assignment 项目资源安排表

> 用途：解决"一个项目使用多个资源、一个资源参与多个项目"的多对多关系。是资源推荐、档期冲突检测和策划案资源清单的关键中间层。

#### assignment_id
- 显示名：安排编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式：ASG-{YYYYMMDD}-{###}
- 说明：唯一编号

#### project_link
- 显示名：关联项目
- 飞书类型：link
- 必填：是
- 约束：关联到 project；single选
- 说明：必填

#### resource_link
- 显示名：关联资源
- 飞书类型：link
- 必填：是
- 约束：关联到 resource；single选
- 说明：必填

#### role_in_project
- 显示名：项目角色
- 飞书类型：single_select
- 必填：是
- 选项：主模特、备选模特、主化妆、备选化妆、主摄影、助理摄影、场地、服装、修图师、道具、其他
- 说明：资源在项目中的角色

#### booking_status
- 显示名：预约状态
- 飞书类型：single_select
- 必填：是
- 选项：候选、询价中、待确认、已确认、已取消
- 说明：资源预约进度

#### quoted_price
- 显示名：报价
- 飞书类型：number
- 必填：否
- 约束：≥0；单位：元
- 说明：资源报价

#### confirmed_price
- 显示名：确认价格
- 飞书类型：number
- 必填：否
- 约束：≥0；单位：元
- 说明：最终确认价格

#### start_at
- 显示名：档期开始
- 飞书类型：datetime
- 必填：否
- 说明：预约档期起点

#### end_at
- 显示名：档期结束
- 飞书类型：datetime
- 必填：否
- 约束：≥start_at
- 说明：预约档期终点

#### conflict_status
- 显示名：冲突状态
- 飞书类型：single_select
- 必填：是
- 约束：由 S4 自动化更新
- 选项：无冲突、疑似冲突、已冲突
- 说明：档期冲突检测结果，由 S4 自动化更新

#### owner
- 显示名：跟进人
- 飞书类型：person
- 必填：否
- 说明：资源安排跟进负责人

#### notes
- 显示名：备注
- 飞书类型：text
- 必填：否
- 约束：≤200 字符
- 说明：补充信息

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### updated_at
- 显示名：更新时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

---

### Planning_Document 策划案表

> 用途：保存策划案的元数据、版本和审批状态。完整策划案正文存储在飞书文档或 Wiki 中，多维表只保存摘要和结构化字段。

#### planning_id
- 显示名：策划编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式：PLN-{YYYYMMDD}-{###}
- 说明：策划案 ID

#### project_link
- 显示名：关联项目
- 飞书类型：link
- 必填：是
- 约束：关联到 project；single选
- 说明：必填

#### version
- 显示名：版本号
- 飞书类型：text
- 必填：是
- 约束：格式：v1, v2, ...
- 说明：版本标识

#### status
- 显示名：策划状态
- 飞书类型：single_select
- 必填：是
- 约束：flow：AI草稿 → 人工编辑 → 待客户确认 → 已批准（或 已废弃）
- 选项：AI草稿、人工编辑、待客户确认、已批准、已废弃
- 说明：策划案审批状态

#### document_url
- 显示名：策划文档链接
- 飞书类型：url
- 必填：否
- 说明：飞书文档链接，完整正文存储位置

#### template_version
- 显示名：模板版本
- 飞书类型：text
- 必填：否
- 约束：格式：v1.0, v1.1, ...
- 说明：策划模板版本

#### ai_job_link
- 显示名：AI来源任务
- 飞书类型：link
- 必填：否
- 约束：关联到 ai_inbox；single选
- 说明：生成来源

#### summary
- 显示名：策划摘要
- 飞书类型：multiline_text
- 必填：否
- 约束：≤1000 字符
- 说明：策划案整体摘要

#### theme
- 显示名：主题
- 飞书类型：text
- 必填：否
- 约束：≤50 字符
- 说明：拍摄主题

#### style_tags
- 显示名：风格标签
- 飞书类型：multi_select
- 必填：否
- 选项：新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他
- 说明：策划风格

#### scene_plan
- 显示名：场景摘要
- 飞书类型：multiline_text
- 必填：否
- 约束：≤500 字符
- 说明：场景安排摘要，不保存完整正文

#### wardrobe_plan
- 显示名：服装摘要
- 飞书类型：multiline_text
- 必填：否
- 约束：≤500 字符
- 说明：服装方案摘要，不保存完整正文

#### makeup_plan
- 显示名：妆造摘要
- 飞书类型：multiline_text
- 必填：否
- 约束：≤500 字符
- 说明：妆造方案摘要，不保存完整正文

#### shot_list_summary
- 显示名：分镜摘要
- 飞书类型：multiline_text
- 必填：否
- 约束：≤500 字符
- 说明：分镜列表摘要，不保存完整正文

#### risk_notes
- 显示名：风险与待确认
- 飞书类型：multiline_text
- 必填：否
- 说明：风险提示与待确认问题

#### approved_by
- 显示名：批准人
- 飞书类型：person
- 必填：否
- 约束：当 status=已批准 时必填
- 说明：内部批准人

#### approved_at
- 显示名：批准时间
- 飞书类型：datetime
- 必填：否
- 约束：当 status=已批准 时必填
- 说明：内部批准时间

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### updated_at
- 显示名：更新时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

---

### Task 任务表

> 用途：保存跨角色、需要 SLA 或需要证据的任务。首期不保存所有待办，只保存关键流程节点任务。

#### task_id
- 显示名：任务编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式：TSK-{YYYYMMDD}-{###}
- 说明：唯一 ID

#### project_link
- 显示名：关联项目
- 飞书类型：link
- 必填：否
- 约束：关联到 project；single选；可为空
- 说明：可为空（跨项目任务）

#### task_type
- 显示名：任务类型
- 飞书类型：single_select
- 必填：是
- 选项：跟进、策划、资源确认、拍摄、后期、交付、复盘
- 说明：任务类别

#### title
- 显示名：任务标题
- 飞书类型：text
- 必填：是
- 约束：≤50 字符
- 说明：任务标题

#### status
- 显示名：任务状态
- 飞书类型：single_select
- 必填：是
- 选项：待处理、处理中、受阻、已完成、已取消
- 说明：任务执行状态

#### owner
- 显示名：负责人
- 飞书类型：person
- 必填：是
- 说明：任务负责人

#### due_at
- 显示名：截止时间
- 飞书类型：datetime
- 必填：否
- 约束：used_for：SLA 监控
- 说明：任务截止时间

#### completed_at
- 显示名：完成时间
- 飞书类型：datetime
- 必填：否
- 约束：当 status=已完成 时必填
- 说明：实际完成时间

#### evidence_url
- 显示名：完成证据
- 飞书类型：url
- 必填：否
- 约束：格式：可为附件或 URL
- 说明：完成证据链接

#### source_event_id
- 显示名：来源事件ID
- 飞书类型：text
- 必填：否
- 约束：references：Automation_Event.event_id
- 说明：由哪个自动化创建

#### notes
- 显示名：备注
- 飞书类型：text
- 必填：否
- 约束：≤200 字符
- 说明：补充信息

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### updated_at
- 显示名：更新时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

---

### AI_Inbox AI审核队列

> 用途：所有 AI 生成的候选数据先进入此表，人工确认后才能写入核心事实表。是 AI 与核心数据之间的质量闸门。

#### ai_job_id
- 显示名：AI任务编号
- 飞书类型：text
- 必填：是
- 约束：格式：UUID
- 说明：UUID，由 Agent 生成，全局唯一

#### task_type
- 显示名：任务类型
- 飞书类型：single_select
- 必填：是
- 选项：客户提取、资源提取、项目提取、策划生成、摘要、质检
- 说明：AI 处理类型

#### source_type
- 显示名：输入来源
- 飞书类型：single_select
- 必填：是
- 选项：文本、截图、语音、表单、聊天记录、项目记录
- 说明：原始输入类型

#### source_url
- 显示名：原始输入链接
- 飞书类型：url
- 必填：否
- 约束：格式：附件或 URL
- 说明：原始输入文件链接

#### source_text
- 显示名：输入文本
- 飞书类型：multiline_text
- 必填：否
- 说明：OCR/ASR 后的文本

#### target_entity
- 显示名：目标实体
- 飞书类型：single_select
- 必填：是
- 选项：Customer、Resource、Project、Planning
- 说明：写回目标表

#### candidate_record_id
- 显示名：候选记录ID
- 飞书类型：text
- 必填：否
- 约束：purpose：用于去重匹配
- 说明：可能匹配的已有业务 ID

#### output_json
- 显示名：AI输出JSON
- 飞书类型：multiline_text
- 必填：是
- 约束：格式：合法 JSON，符合 ai_ingest_output.schema.json
- 说明：符合 JSON Schema 的输出

#### confidence
- 显示名：置信度
- 飞书类型：number
- 必填：是
- 约束：≥0；≤1；保留 2 位小数
- 说明：AI 输出整体置信度

#### risk_level
- 显示名：风险等级
- 飞书类型：single_select
- 必填：是
- 约束：writeback_rules：{'Low': '标签、摘要、非关键备注 → 可批量审核，允许自动写回', 'Medium': '客户需求、预算、日期、资源匹配 → 必须逐条人工审核', 'High': '价格、付款、合同、档期承诺、删除、合并 → 不允许自动写回'}
- 选项：Low、Medium、High
- 说明：写回风险分级

#### validation_errors
- 显示名：校验错误
- 飞书类型：multiline_text
- 必填：否
- 说明：字段校验错误信息

#### review_status
- 显示名：审核状态
- 飞书类型：single_select
- 必填：是
- 约束：writeback_rule：仅 已采纳 或 已修改 状态才能执行 S7 写回
- 选项：待审核、已采纳、已修改、已拒绝、执行失败
- 说明：人工审核结果

#### reviewer
- 显示名：审核人
- 飞书类型：person
- 必填：否
- 约束：当 review_status ≠ 待审核 时必填
- 说明：人工审核人

#### human_revision_json
- 显示名：人工修改JSON
- 飞书类型：multiline_text
- 必填：否
- 约束：格式：合法 JSON
- 说明：人工修改后的输出

#### writeback_target
- 显示名：写回目标
- 飞书类型：text
- 必填：否
- 约束：example：Customer.phone, Customer.budget_min
- 说明：目标表和字段描述

#### writeback_result
- 显示名：写回结果
- 飞书类型：multiline_text
- 必填：否
- 约束：格式：成功/失败/冲突详情
- 说明：写回执行结果

#### model_name
- 显示名：模型名称
- 飞书类型：text
- 必填：否
- 约束：example：doubao-pro, gpt-4o
- 说明：使用的 AI 模型

#### prompt_version
- 显示名：Prompt版本
- 飞书类型：text
- 必填：否
- 约束：格式：{task}-v{major}.{minor}
- 说明：使用的 Prompt 版本

#### latency_ms
- 显示名：耗时(ms)
- 飞书类型：number
- 必填：否
- 约束：单位：毫秒
- 说明：AI 处理耗时

#### cost_estimate
- 显示名：成本估算
- 飞书类型：number
- 必填：否
- 约束：单位：元
- 说明：单次调用成本估算

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### reviewed_at
- 显示名：审核时间
- 飞书类型：datetime
- 必填：否
- 约束：当 review_status ≠ 待审核 时必填
- 说明：人工审核时间

---

### Automation_Event 自动化事件日志

> 用途：所有 Serverless 自动化必须写日志。记录自动化触发、执行、结果和错误，用于监控、重试和人工补偿。

#### event_id
- 显示名：事件编号
- 飞书类型：text
- 必填：是
- 约束：格式：UUID
- 说明：UUID，全局唯一

#### event_type
- 显示名：事件类型
- 飞书类型：single_select
- 必填：是
- 选项：S1定金创建项目、S2策划草稿生成、S3执行任务生成、S4资源冲突检查、S5客户状态同步、S6复盘任务生成、S7AI写回、S8失败汇总、手动补偿、其他
- 说明：自动化规则类型

#### source_table
- 显示名：来源表
- 飞书类型：single_select
- 必填：否
- 选项：Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox
- 说明：触发来源表

#### source_record_id
- 显示名：来源记录ID
- 飞书类型：text
- 必填：否
- 说明：触发来源记录 ID

#### idempotency_key
- 显示名：幂等键
- 飞书类型：text
- 必填：是
- 约束：格式：source_record_id + event_type + rule_version；唯一
- 说明：幂等控制

#### rule_version
- 显示名：规则版本
- 飞书类型：text
- 必填：是
- 约束：格式：v1.0, v1.1, ...
- 说明：自动化规则版本

#### input_snapshot
- 显示名：输入快照
- 飞书类型：multiline_text
- 必填：否
- 约束：格式：合法 JSON，脱敏后存储
- 说明：触发时的输入数据快照

#### status
- 显示名：执行状态
- 飞书类型：single_select
- 必填：是
- 约束：flow：received → running → success / failed / manual_action
- 选项：received、running、success、failed、manual_action
- 说明：执行结果

#### started_at
- 显示名：开始时间
- 飞书类型：datetime
- 必填：是
- 说明：执行开始时间

#### completed_at
- 显示名：完成时间
- 飞书类型：datetime
- 必填：否
- 约束：当 status ∈ {success, failed, manual_action} 时必填
- 说明：执行完成时间

#### retry_count
- 显示名：重试次数
- 飞书类型：number
- 必填：是
- 约束：≥0；≤3
- 说明：自动重试次数

#### output_summary
- 显示名：执行结果摘要
- 飞书类型：multiline_text
- 必填：否
- 约束：≤500 字符
- 说明：执行结果描述

#### error_code
- 显示名：错误代码
- 飞书类型：text
- 必填：否
- 约束：example：FS_429, SCHEMA_ERROR
- 说明：错误标识

#### error_message
- 显示名：错误信息
- 飞书类型：multiline_text
- 必填：否
- 约束：≤500 字符
- 说明：错误详情

#### operator
- 显示名：补偿操作人
- 飞书类型：person
- 必填：否
- 约束：当 status=manual_action 时必填
- 说明：人工补偿执行人

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

---

### Data_Quality_Issue 数据质量问题表

> 用途：记录数据质量问题（重复客户、重复资源、无法匹配字段、日期冲突、非法状态、缺失关键字段、关联记录丢失、资源档期冲突、写回失败）。所有问题必须有状态、责任人和解决结果。

#### issue_id
- 显示名：问题编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式：DQI-{YYYYMMDD}-{###}
- 说明：唯一编号

#### issue_type
- 显示名：问题类型
- 飞书类型：single_select
- 必填：是
- 选项：重复客户、重复资源、字段无法匹配、日期冲突、非法状态、缺失关键字段、关联记录丢失、资源档期冲突、写回失败、其他
- 说明：数据问题类别

#### severity
- 显示名：严重程度
- 飞书类型：single_select
- 必填：是
- 约束：affects：处理优先级
- 选项：低、中、高、严重
- 说明：问题严重级别

#### source_table
- 显示名：来源表
- 飞书类型：single_select
- 必填：否
- 选项：Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox、Automation_Event
- 说明：问题涉及的表

#### source_record_id
- 显示名：来源记录ID
- 飞书类型：text
- 必填：否
- 约束：格式：可为多个，逗号分隔
- 说明：问题涉及的记录 ID

#### description
- 显示名：问题描述
- 飞书类型：multiline_text
- 必填：是
- 约束：≤500 字符
- 说明：问题详细描述

#### detected_by
- 显示名：发现方式
- 飞书类型：single_select
- 必填：是
- 选项：自动化检测、AI质检、人工发现、迁移对账
- 说明：问题发现途径

#### detected_at
- 显示名：发现时间
- 飞书类型：datetime
- 必填：是
- 说明：问题发现时间，系统写入

#### status
- 显示名：处理状态
- 飞书类型：single_select
- 必填：是
- 选项：待处理、处理中、已解决、已忽略、无法解决
- 说明：问题处理进度

#### owner
- 显示名：责任人
- 飞书类型：person
- 必填：否
- 说明：问题处理负责人

#### resolution
- 显示名：解决方案
- 飞书类型：multiline_text
- 必填：否
- 约束：当 status ∈ {已解决, 已忽略} 时必填
- 说明：问题处理结果

#### resolved_at
- 显示名：解决时间
- 飞书类型：datetime
- 必填：否
- 约束：当 status=已解决 时必填
- 说明：问题解决时间

#### related_event_id
- 显示名：关联事件ID
- 飞书类型：text
- 必填：否
- 说明：关联的 Automation_Event.event_id

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### updated_at
- 显示名：更新时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

---

### System_Config 配置表

> 用途：保存非敏感系统配置：状态机版本、Prompt 版本、自动化规则版本、风险阈值、枚举字典、策划模板版本。禁止保存 App Secret、Access Token、API Key 等敏感信息。

#### config_id
- 显示名：配置编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式：CFG-{###}
- 说明：唯一编号

#### config_key
- 显示名：配置键
- 飞书类型：text
- 必填：是
- 约束：唯一；命名：snake_case
- 说明：配置标识符

#### config_category
- 显示名：配置类别
- 飞书类型：single_select
- 必填：是
- 选项：状态机、Prompt、自动化规则、风险阈值、枚举字典、策划模板、系统参数
- 说明：配置分类

#### config_value
- 显示名：配置值
- 飞书类型：multiline_text
- 必填：是
- 约束：格式：JSON 或文本
- 说明：配置内容

#### config_description
- 显示名：配置说明
- 飞书类型：multiline_text
- 必填：否
- 约束：≤200 字符
- 说明：配置用途描述

#### version
- 显示名：版本号
- 飞书类型：text
- 必填：是
- 约束：格式：v1.0, v1.1, ...
- 说明：配置版本

#### is_active
- 显示名：是否生效
- 飞书类型：checkbox
- 必填：是
- 约束：规则：同类别同 key 仅一条生效
- 说明：当前是否生效

#### updated_by
- 显示名：更新人
- 飞书类型：person
- 必填：否
- 说明：最后修改人

#### created_at
- 显示名：创建时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

#### updated_at
- 显示名：更新时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，系统写入

---

## 枚举值速查

### source_channel 来源渠道
小红书、抖音、视频号、朋友圈、微信公众号、微信私聊、官网、小程序、转介绍、线下活动、其他、未知

### service_type 服务类型
个人、双人、品牌、创作、其他

### style_tags 风格标签
新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他

### resource_type 资源类型
模特、化妆师、场地、服装、修图师、摄影师、其他

### priority 优先级
S、A、B、待评估

### cooperation_status 合作状态
未联系、沟通中、已合作、暂停、黑名单

### project_type 项目类型
客片、创作、品牌、其他

### risk_level 风险等级
正常、关注、高风险

### privacy_level 隐私级别
普通、敏感、高敏

---

## 其他枚举字段（非顶级枚举，按字段定义）

### relationship_status 客户状态（Customer.relationship_status）
新线索、跟进中、已确认需求、待定金、已成交、服务中、已完成、复购/转介绍、已流失

### intent_level 意向等级（Customer.intent_level）
高、中、低、未知

### project_status 项目状态（Project.project_status）
草稿、策划中、策划已批准、资源确认中、待拍摄、拍摄完成、后期制作、客户确认、已交付、已归档

### planning_status 策划状态（Project.planning_status）
未创建、草稿、待审核、已批准、需修改

### currency 币种（Project.currency）
CNY

### payment_status 付款状态（Project.payment_status）
未知、待定金、已付定金、已结清、已退款、部分退款

### city 城市（Resource.city）
杭州、上海、北京、深圳、广州、成都、武汉、其他

### capability_tags 能力标签（Resource.capability_tags）
发型、妆面、尺码、设备、场地类型、服装类别、其他

### role_in_project 项目角色（Project_resource_assignment.role_in_project）
主模特、备选模特、主化妆、备选化妆、主摄影、助理摄影、场地、服装、修图师、道具、其他

### booking_status 预约状态（Project_resource_assignment.booking_status）
候选、询价中、待确认、已确认、已取消

### conflict_status 冲突状态（Project_resource_assignment.conflict_status）
无冲突、疑似冲突、已冲突

### planning_status 策划案状态（Planning_document.status）
AI草稿、人工编辑、待客户确认、已批准、已废弃

### task_type 任务类型（Task）（Task.task_type）
跟进、策划、资源确认、拍摄、后期、交付、复盘

### task_type 任务类型（AI_Inbox）（Ai_inbox.task_type）
客户提取、资源提取、项目提取、策划生成、摘要、质检

### task_status 任务状态（Task.status）
待处理、处理中、受阻、已完成、已取消

### source_type 输入来源（Ai_inbox.source_type）
文本、截图、语音、表单、聊天记录、项目记录

### target_entity 目标实体（Ai_inbox.target_entity）
Customer、Resource、Project、Planning

### ai_risk_level AI 风险等级（Ai_inbox.risk_level）
Low、Medium、High

### review_status 审核状态（Ai_inbox.review_status）
待审核、已采纳、已修改、已拒绝、执行失败

### event_type 事件类型（Automation_event.event_type）
S1定金创建项目、S2策划草稿生成、S3执行任务生成、S4资源冲突检查、S5客户状态同步、S6复盘任务生成、S7AI写回、S8失败汇总、手动补偿、其他

### event_source_table 来源表（Automation_event.source_table）
Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox

### event_status 执行状态（Automation_event.status）
received、running、success、failed、manual_action

### issue_type 问题类型（Data_quality_issue.issue_type）
重复客户、重复资源、字段无法匹配、日期冲突、非法状态、缺失关键字段、关联记录丢失、资源档期冲突、写回失败、其他

### severity 严重程度（Data_quality_issue.severity）
低、中、高、严重

### dq_source_table 来源表（Data_quality_issue.source_table）
Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox、Automation_Event

### detected_by 发现方式（Data_quality_issue.detected_by）
自动化检测、AI质检、人工发现、迁移对账

### issue_status 处理状态（Data_quality_issue.status）
待处理、处理中、已解决、已忽略、无法解决

### config_category 配置类别（System_config.config_category）
状态机、Prompt、自动化规则、风险阈值、枚举字典、策划模板、系统参数

### budget_parse_status 预算解析状态（Customer.budget_parse_status）
parsed、ambiguous、unknown、invalid

### duplicate_review_status 客户重复候选审核状态（Customer.duplicate_review_status）
SAME_ENTITY、DISTINCT_ENTITY、UNRESOLVED、NA

### duplicate_review_status 资源重复候选审核状态（Resource.duplicate_review_status）
SAME_ENTITY、DISTINCT_ENTITY、UNRESOLVED、NA

