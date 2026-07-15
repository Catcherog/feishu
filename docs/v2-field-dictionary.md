# V2 Field Dictionary v1.0

> 固定日期：2026-07-16
> 来源：docs/v2-base-schema.md
> 用途：快速查找任意字段的类型、约束和选项

## 字段总览

| # | 表 | 字段键 | 显示名 | 飞书类型 | 必填 | 约束/选项 |
|---|---|---|---|---|---|---|
| 1 | Customer | customer_id | 客户编号 | auto_number | 是 | 格式：`CUST-{YYYYMMDD}-{###}` |
| 2 | Customer | customer_name | 客户姓名 | text | 是 | 非空，≤20 字符 |
| 3 | Customer | phone | 手机号 | text | 是 | 需标准化校验，用于去重匹配 |
| 4 | Customer | wechat_name | 微信号 | text | 否 | — |
| 5 | Customer | source_channel | 来源渠道 | single_select | 是 | 枚举：小红书、微信、官网、小程序、转介绍、其他 |
| 6 | Customer | relationship_status | 客户状态 | single_select | 是 | 枚举：新线索、跟进中、已确认需求、待定金、已成交、服务中、已完成、复购/转介绍、已流失 |
| 7 | Customer | intent_level | 意向等级 | single_select | 是 | 枚举：高、中、低、未知 |
| 8 | Customer | service_type | 服务类型 | multi_select | 否 | 枚举：个人、双人、品牌、创作、其他 |
| 9 | Customer | preferred_style | 偏好风格 | multi_select | 否 | 枚举：新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他 |
| 10 | Customer | budget_min | 预算下限 | number | 否 | ≥0，整数，单位：元 |
| 11 | Customer | budget_max | 预算上限 | number | 否 | ≥budget_min，可为空 |
| 12 | Customer | preferred_date_start | 期望档期起 | date | 否 | — |
| 13 | Customer | preferred_date_end | 期望档期止 | date | 否 | ≥preferred_date_start |
| 14 | Customer | owner | 跟进负责人 | person | 是 | 飞书用户 |
| 15 | Customer | last_contact_at | 最后跟进时间 | datetime | 否 | — |
| 16 | Customer | next_action_at | 下次跟进时间 | datetime | 否 | 用于 F1 自动化查询 |
| 17 | Customer | latest_summary | 最新跟进摘要 | multiline_text | 否 | ≤500 字符 |
| 18 | Customer | privacy_level | 隐私级别 | single_select | 是 | 枚举：普通、敏感、高敏 |
| 19 | Customer | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 20 | Customer | updated_at | 更新时间 | datetime | 是 | 审计字段，系统写入 |
| 21 | Customer | legacy_record_id | 旧记录ID | text | 否 | 迁移对账用 |
| 22 | Customer | legacy_source | 旧表来源 | text | 否 | 迁移对账用 |
| 23 | Project | project_id | 项目编号 | auto_number | 是 | 格式：`PRJ-{YYYYMMDD}-{###}` |
| 24 | Project | customer_link | 关联客户 | link | 是 | 关联到 Customer 表，单选 |
| 25 | Project | project_name | 项目名称 | text | 是 | 建议格式：`{客户名}-{类型}-{日期}` |
| 26 | Project | project_type | 项目类型 | single_select | 是 | 枚举：客片、创作、品牌、其他 |
| 27 | Project | project_status | 项目状态 | single_select | 是 | 枚举：草稿、策划中、策划已批准、资源确认中、待拍摄、拍摄完成、后期制作、客户确认、已交付、已归档 |
| 28 | Project | shoot_date_start | 拍摄开始时间 | datetime | 否 | 可为空 |
| 29 | Project | shoot_date_end | 拍摄结束时间 | datetime | 否 | ≥shoot_date_start |
| 30 | Project | location_text | 拍摄地点 | text | 否 | ≤100 字符 |
| 31 | Project | project_owner | 项目负责人 | person | 是 | 飞书用户 |
| 32 | Project | photographer | 摄影师 | person | 否 | 飞书用户 |
| 33 | Project | planning_status | 策划状态 | single_select | 是 | 枚举：未创建、草稿、待审核、已批准、需修改 |
| 34 | Project | planning_link | 关联策划案 | link | 否 | 关联到 Planning_Document 表，多选 |
| 35 | Project | delivery_due_at | 交付截止日 | date | 否 | 用于 F2 自动化超期查询 |
| 36 | Project | risk_level | 风险等级 | single_select | 是 | 枚举：正常、关注、高风险 |
| 37 | Project | risk_reason | 风险原因 | multiline_text | 否 | 当 risk_level ≠ 正常时建议填写 |
| 38 | Project | folder_url | 项目文件夹 | url | 否 | 项目云盘/素材库链接 |
| 39 | Project | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 40 | Project | updated_at | 更新时间 | datetime | 是 | 审计字段，系统写入 |
| 41 | Project | legacy_record_id | 旧记录ID | text | 否 | 迁移对账用 |
| 42 | Project | legacy_source | 旧表来源 | text | 否 | 迁移对账用 |
| 43 | Resource | resource_id | 资源编号 | auto_number | 是 | 格式：`RES-{YYYYMMDD}-{###}` |
| 44 | Resource | resource_type | 资源类型 | single_select | 是 | 枚举：模特、化妆师、场地、服装、修图师、摄影师、其他 |
| 45 | Resource | resource_name | 资源名称 | text | 是 | 非空，≤30 字符 |
| 46 | Resource | contact | 联系方式 | text | 否 | 手机号/微信/邮箱 |
| 47 | Resource | city | 城市 | single_select | 否 | 枚举：杭州、上海、北京、深圳、广州、成都、武汉、其他 |
| 48 | Resource | style_tags | 风格标签 | multi_select | 否 | 枚举：新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他 |
| 49 | Resource | capability_tags | 能力标签 | multi_select | 否 | 枚举：发型、妆面、尺码、设备、场地类型、服装类别、其他 |
| 50 | Resource | priority | 优先级 | single_select | 是 | 枚举：S、A、B、待评估 |
| 51 | Resource | cooperation_status | 合作状态 | single_select | 是 | 枚举：未联系、沟通中、已合作、暂停、黑名单 |
| 52 | Resource | availability_note | 档期备注 | text | 否 | ≤200 字符 |
| 53 | Resource | portfolio_url | 作品链接 | url | 否 | 作品集链接 |
| 54 | Resource | price_min | 报价下限 | number | 否 | ≥0，单位：元 |
| 55 | Resource | price_max | 报价上限 | number | 否 | ≥price_min |
| 56 | Resource | rating_quality | 质量评分 | rating | 否 | 1-5 星 |
| 57 | Resource | rating_reliability | 可靠性评分 | rating | 否 | 1-5 星 |
| 58 | Resource | last_cooperation_at | 最近合作日期 | date | 否 | — |
| 59 | Resource | notes | 备注 | multiline_text | 否 | ≤500 字符 |
| 60 | Resource | resource_profile_json | 资源档案JSON | multiline_text | 否 | 合法 JSON 字符串 |
| 61 | Resource | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 62 | Resource | updated_at | 更新时间 | datetime | 是 | 审计字段，系统写入 |
| 63 | Resource | legacy_record_id | 旧记录ID | text | 否 | 迁移对账用 |
| 64 | Resource | legacy_source | 旧表来源 | text | 否 | 旧子表名（如"模特资源库"） |
| 65 | Project_Resource_Assignment | assignment_id | 安排编号 | auto_number | 是 | 格式：`ASG-{YYYYMMDD}-{###}` |
| 66 | Project_Resource_Assignment | project_link | 关联项目 | link | 是 | 关联到 Project 表，单选 |
| 67 | Project_Resource_Assignment | resource_link | 关联资源 | link | 是 | 关联到 Resource 表，单选 |
| 68 | Project_Resource_Assignment | role_in_project | 项目角色 | single_select | 是 | 枚举：主模特、备选模特、主化妆、备选化妆、主摄影、助理摄影、场地、服装、修图师、道具、其他 |
| 69 | Project_Resource_Assignment | booking_status | 预约状态 | single_select | 是 | 枚举：候选、询价中、待确认、已确认、已取消 |
| 70 | Project_Resource_Assignment | quoted_price | 报价 | number | 否 | ≥0，单位：元 |
| 71 | Project_Resource_Assignment | confirmed_price | 确认价格 | number | 否 | ≥0，单位：元 |
| 72 | Project_Resource_Assignment | start_at | 档期开始 | datetime | 否 | — |
| 73 | Project_Resource_Assignment | end_at | 档期结束 | datetime | 否 | ≥start_at |
| 74 | Project_Resource_Assignment | conflict_status | 冲突状态 | single_select | 是 | 枚举：无冲突、疑似冲突、已冲突 |
| 75 | Project_Resource_Assignment | owner | 跟进人 | person | 否 | 飞书用户 |
| 76 | Project_Resource_Assignment | notes | 备注 | text | 否 | ≤200 字符 |
| 77 | Project_Resource_Assignment | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 78 | Project_Resource_Assignment | updated_at | 更新时间 | datetime | 是 | 审计字段，系统写入 |
| 79 | Planning_Document | planning_id | 策划编号 | auto_number | 是 | 格式：`PLN-{YYYYMMDD}-{###}` |
| 80 | Planning_Document | project_link | 关联项目 | link | 是 | 关联到 Project 表，单选 |
| 81 | Planning_Document | version | 版本号 | text | 是 | 格式：`v1`, `v2`, ... |
| 82 | Planning_Document | status | 策划状态 | single_select | 是 | 枚举：AI草稿、人工编辑、待客户确认、已批准、已废弃 |
| 83 | Planning_Document | document_url | 策划文档链接 | url | 否 | 飞书文档链接 |
| 84 | Planning_Document | template_version | 模板版本 | text | 否 | 格式：`v1.0`, `v1.1`, ... |
| 85 | Planning_Document | ai_job_link | AI来源任务 | link | 否 | 关联到 AI_Inbox 表，单选 |
| 86 | Planning_Document | summary | 策划摘要 | multiline_text | 否 | ≤1000 字符 |
| 87 | Planning_Document | theme | 主题 | text | 否 | ≤50 字符 |
| 88 | Planning_Document | style_tags | 风格标签 | multi_select | 否 | 枚举：新中式、电影感、复古、日系、清新、暗黑、商务、国潮、其他 |
| 89 | Planning_Document | scene_plan | 场景摘要 | multiline_text | 否 | 不保存完整正文 |
| 90 | Planning_Document | wardrobe_plan | 服装摘要 | multiline_text | 否 | 不保存完整正文 |
| 91 | Planning_Document | makeup_plan | 妆造摘要 | multiline_text | 否 | 不保存完整正文 |
| 92 | Planning_Document | shot_list_summary | 分镜摘要 | multiline_text | 否 | 不保存完整正文 |
| 93 | Planning_Document | risk_notes | 风险与待确认 | multiline_text | 否 | — |
| 94 | Planning_Document | approved_by | 批准人 | person | 否 | status=已批准时必填 |
| 95 | Planning_Document | approved_at | 批准时间 | datetime | 否 | status=已批准时必填 |
| 96 | Planning_Document | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 97 | Planning_Document | updated_at | 更新时间 | datetime | 是 | 审计字段，系统写入 |
| 98 | Task | task_id | 任务编号 | auto_number | 是 | 格式：`TSK-{YYYYMMDD}-{###}` |
| 99 | Task | project_link | 关联项目 | link | 否 | 关联到 Project 表，单选，可为空 |
| 100 | Task | task_type | 任务类型 | single_select | 是 | 枚举：跟进、策划、资源确认、拍摄、后期、交付、复盘 |
| 101 | Task | title | 任务标题 | text | 是 | ≤50 字符 |
| 102 | Task | status | 任务状态 | single_select | 是 | 枚举：待处理、处理中、受阻、已完成、已取消 |
| 103 | Task | owner | 负责人 | person | 是 | 飞书用户 |
| 104 | Task | due_at | 截止时间 | datetime | 否 | 用于 SLA 监控 |
| 105 | Task | completed_at | 完成时间 | datetime | 否 | status=已完成时填写 |
| 106 | Task | evidence_url | 完成证据 | url | 否 | 可为附件或 URL |
| 107 | Task | source_event_id | 来源事件ID | text | 否 | 对应 Automation_Event.event_id |
| 108 | Task | notes | 备注 | text | 否 | ≤200 字符 |
| 109 | Task | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 110 | Task | updated_at | 更新时间 | datetime | 是 | 审计字段，系统写入 |
| 111 | AI_Inbox | ai_job_id | AI任务编号 | text | 是 | UUID，由 Agent 生成 |
| 112 | AI_Inbox | task_type | 任务类型 | single_select | 是 | 枚举：客户提取、资源提取、项目提取、策划生成、摘要、质检 |
| 113 | AI_Inbox | source_type | 输入来源 | single_select | 是 | 枚举：文本、截图、语音、表单、聊天记录、项目记录 |
| 114 | AI_Inbox | source_url | 原始输入链接 | url | 否 | 附件或 URL |
| 115 | AI_Inbox | source_text | 输入文本 | multiline_text | 否 | OCR/ASR 后的文本 |
| 116 | AI_Inbox | target_entity | 目标实体 | single_select | 是 | 枚举：Customer、Resource、Project、Planning |
| 117 | AI_Inbox | candidate_record_id | 候选记录ID | text | 否 | 用于去重匹配 |
| 118 | AI_Inbox | output_json | AI输出JSON | multiline_text | 是 | 合法 JSON，符合 ai_ingest_output.schema.json |
| 119 | AI_Inbox | confidence | 置信度 | number | 是 | 0-1，保留 2 位小数 |
| 120 | AI_Inbox | risk_level | 风险等级 | single_select | 是 | 枚举：Low、Medium、High |
| 121 | AI_Inbox | validation_errors | 校验错误 | multiline_text | 否 | — |
| 122 | AI_Inbox | review_status | 审核状态 | single_select | 是 | 枚举：待审核、已采纳、已修改、已拒绝、执行失败 |
| 123 | AI_Inbox | reviewer | 审核人 | person | 否 | review_status ≠ 待审核时必填 |
| 124 | AI_Inbox | human_revision_json | 人工修改JSON | multiline_text | 否 | 合法 JSON |
| 125 | AI_Inbox | writeback_target | 写回目标 | text | 否 | 如 "Customer.phone, Customer.budget_min" |
| 126 | AI_Inbox | writeback_result | 写回结果 | multiline_text | 否 | 成功/失败/冲突详情 |
| 127 | AI_Inbox | model_name | 模型名称 | text | 否 | 如 "doubao-pro", "gpt-4o" |
| 128 | AI_Inbox | prompt_version | Prompt版本 | text | 否 | 格式：`{task}-v{major}.{minor}` |
| 129 | AI_Inbox | latency_ms | 耗时(ms) | number | 否 | 毫秒 |
| 130 | AI_Inbox | cost_estimate | 成本估算 | number | 否 | 单位：元 |
| 131 | AI_Inbox | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 132 | AI_Inbox | reviewed_at | 审核时间 | datetime | 否 | review_status ≠ 待审核时填写 |
| 133 | Automation_Event | event_id | 事件编号 | text | 是 | UUID，全局唯一 |
| 134 | Automation_Event | event_type | 事件类型 | single_select | 是 | 枚举：S1定金创建项目、S2策划草稿生成、S3执行任务生成、S4资源冲突检查、S5客户状态同步、S6复盘任务生成、S7AI写回、S8失败汇总、手动补偿、其他 |
| 135 | Automation_Event | source_table | 来源表 | single_select | 否 | 枚举：Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox |
| 136 | Automation_Event | source_record_id | 来源记录ID | text | 否 | — |
| 137 | Automation_Event | idempotency_key | 幂等键 | text | 是 | 格式：`source_record_id + event_type + rule_version` |
| 138 | Automation_Event | rule_version | 规则版本 | text | 是 | 格式：`v1.0`, `v1.1`, ... |
| 139 | Automation_Event | input_snapshot | 输入快照 | multiline_text | 否 | 合法 JSON，脱敏后存储 |
| 140 | Automation_Event | status | 执行状态 | single_select | 是 | 枚举：received、running、success、failed、manual_action |
| 141 | Automation_Event | started_at | 开始时间 | datetime | 是 | — |
| 142 | Automation_Event | completed_at | 完成时间 | datetime | 否 | status ∈ {success, failed, manual_action} 时填写 |
| 143 | Automation_Event | retry_count | 重试次数 | number | 是 | ≥0，最大 3 |
| 144 | Automation_Event | output_summary | 执行结果摘要 | multiline_text | 否 | ≤500 字符 |
| 145 | Automation_Event | error_code | 错误代码 | text | 否 | 如 "FS_429", "SCHEMA_ERROR" |
| 146 | Automation_Event | error_message | 错误信息 | multiline_text | 否 | ≤500 字符 |
| 147 | Automation_Event | operator | 补偿操作人 | person | 否 | status=manual_action 时填写 |
| 148 | Automation_Event | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 149 | Data_Quality_Issue | issue_id | 问题编号 | auto_number | 是 | 格式：`DQI-{YYYYMMDD}-{###}` |
| 150 | Data_Quality_Issue | issue_type | 问题类型 | single_select | 是 | 枚举：重复客户、重复资源、字段无法匹配、日期冲突、非法状态、缺失关键字段、关联记录丢失、资源档期冲突、写回失败、其他 |
| 151 | Data_Quality_Issue | severity | 严重程度 | single_select | 是 | 枚举：低、中、高、严重 |
| 152 | Data_Quality_Issue | source_table | 来源表 | single_select | 否 | 枚举：Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox、Automation_Event |
| 153 | Data_Quality_Issue | source_record_id | 来源记录ID | text | 否 | 可为多个，逗号分隔 |
| 154 | Data_Quality_Issue | description | 问题描述 | multiline_text | 是 | ≤500 字符 |
| 155 | Data_Quality_Issue | detected_by | 发现方式 | single_select | 是 | 枚举：自动化检测、AI质检、人工发现、迁移对账 |
| 156 | Data_Quality_Issue | detected_at | 发现时间 | datetime | 是 | 系统写入 |
| 157 | Data_Quality_Issue | status | 处理状态 | single_select | 是 | 枚举：待处理、处理中、已解决、已忽略、无法解决 |
| 158 | Data_Quality_Issue | owner | 责任人 | person | 否 | — |
| 159 | Data_Quality_Issue | resolution | 解决方案 | multiline_text | 否 | status ∈ {已解决, 已忽略} 时填写 |
| 160 | Data_Quality_Issue | resolved_at | 解决时间 | datetime | 否 | status=已解决 时填写 |
| 161 | Data_Quality_Issue | related_event_id | 关联事件ID | text | 否 | 关联的 Automation_Event.event_id |
| 162 | Data_Quality_Issue | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 163 | Data_Quality_Issue | updated_at | 更新时间 | datetime | 是 | 审计字段，系统写入 |
| 164 | System_Config | config_id | 配置编号 | auto_number | 是 | 格式：`CFG-{###}` |
| 165 | System_Config | config_key | 配置键 | text | 是 | 唯一，snake_case |
| 166 | System_Config | config_category | 配置类别 | single_select | 是 | 枚举：状态机、Prompt、自动化规则、风险阈值、枚举字典、策划模板、系统参数 |
| 167 | System_Config | config_value | 配置值 | multiline_text | 是 | JSON 或文本 |
| 168 | System_Config | config_description | 配置说明 | multiline_text | 否 | ≤200 字符 |
| 169 | System_Config | version | 版本号 | text | 是 | 格式：`v1.0`, `v1.1`, ... |
| 170 | System_Config | is_active | 是否生效 | checkbox | 是 | 同类别同 key 仅一条生效 |
| 171 | System_Config | updated_by | 更新人 | person | 否 | 飞书用户 |
| 172 | System_Config | created_at | 创建时间 | datetime | 是 | 审计字段，系统写入 |
| 173 | System_Config | updated_at | 更新时间 | datetime | 是 | 审计字段，系统写入 |

## 详细字段说明

### Customer 客户表

> 用途：保存客户的权威身份、需求和关系状态。一个客户可关联多个项目。

#### customer_id
- 显示名：客户编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式 `CUST-{YYYYMMDD}-{###}`，前缀 `CUST-`，日期格式 `{YYYYMMDD}`，序号 3 位补零（001-999）
- 说明：稳定业务 ID，不使用 record_id

#### customer_name
- 显示名：客户姓名
- 飞书类型：text
- 必填：是
- 约束：非空，≤20 字符
- 说明：正式姓名，昵称存入备注

#### phone
- 显示名：手机号
- 飞书类型：text
- 必填：是
- 约束：需标准化校验，用于去重匹配；使用文本类型以兼容国际格式（如 +86）
- 说明：统一格式，中国大陆或国际标准；应用层负责标准化和校验

#### wechat_name
- 显示名：微信号
- 飞书类型：text
- 必填：否
- 约束：无
- 说明：不作为唯一匹配键

#### source_channel
- 显示名：来源渠道
- 飞书类型：single_select
- 必填：是
- 选项：小红书、微信、官网、小程序、转介绍、其他
- 说明：客户来源

#### relationship_status
- 显示名：客户状态
- 飞书类型：single_select
- 必填：是
- 选项：新线索、跟进中、已确认需求、待定金、已成交、服务中、已完成、复购/转介绍、已流失
- 说明：商业关系状态，见客户状态机；状态变更触发 S5 自动化；AI 不得直接修改此字段
- 颜色建议：新线索（灰）、跟进中（蓝）、已确认需求（青）、待定金（黄）、已成交（绿）、服务中（浅绿）、已完成（深绿）、复购/转介绍（紫）、已流失（红）

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
- 约束：≥0，整数，单位：元
- 说明：预算范围下限

#### budget_max
- 显示名：预算上限
- 飞书类型：number
- 必填：否
- 约束：≥budget_min，可为空
- 说明：预算范围上限

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
- 说明：当前跟进负责人，飞书用户

#### last_contact_at
- 显示名：最后跟进时间
- 飞书类型：datetime
- 必填：否
- 说明：由真实跟进动作更新

#### next_action_at
- 显示名：下次跟进时间
- 飞书类型：datetime
- 必填：否
- 说明：下一次应跟进时间，用于 F1 自动化查询

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
- 说明：审计字段，记录创建时间，由系统写入

#### updated_at
- 显示名：更新时间
- 飞书类型：datetime
- 必填：是
- 说明：审计字段，记录最后修改时间，由系统写入

#### legacy_record_id
- 显示名：旧记录ID
- 飞书类型：text
- 必填：否
- 说明：迁移自旧表时的 record_id，用于对账

#### legacy_source
- 显示名：旧表来源
- 飞书类型：text
- 必填：否
- 说明：迁移自旧表的表名

---

### Project 项目表

> 用途：表示一次正式交付。客户付定金或负责人确认立项后创建。一个项目关联一个客户，可关联多个资源安排和策划案。

#### project_id
- 显示名：项目编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式 `PRJ-{YYYYMMDD}-{###}`，前缀 `PRJ-`
- 说明：稳定业务 ID

#### customer_link
- 显示名：关联客户
- 飞书类型：link
- 必填：是
- 约束：关联到 Customer 表，单选；反向关联：Customer 表可查看关联的项目
- 说明：必须关联一个 Customer 记录

#### project_name
- 显示名：项目名称
- 飞书类型：text
- 必填：是
- 约束：建议格式 `{客户名}-{类型}-{日期}`
- 说明：建议自动生成后允许人工修改

#### project_type
- 显示名：项目类型
- 飞书类型：single_select
- 必填：是
- 选项：客片、创作、品牌、其他
- 说明：拍摄类型

#### project_status
- 显示名：项目状态
- 飞书类型：single_select
- 必填：是
- 选项：草稿、策划中、策划已批准、资源确认中、待拍摄、拍摄完成、后期制作、客户确认、已交付、已归档
- 说明：见项目状态机；**AI 不得直接修改此字段**
- 颜色建议：草稿（灰）、策划中（蓝）、策划已批准（青）、资源确认中（黄）、待拍摄（橙）、拍摄完成（浅绿）、后期制作（绿）、客户确认（紫）、已交付（深绿）、已归档（深灰）

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
- 说明：项目总负责人，飞书用户

#### photographer
- 显示名：摄影师
- 飞书类型：person
- 必填：否
- 说明：团队内人员可用人员字段，飞书用户

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
- 约束：关联到 Planning_Document 表，多选（支持多版本）
- 说明：关联 Planning_Document

#### delivery_due_at
- 显示名：交付截止日
- 飞书类型：date
- 必填：否
- 说明：交付 SLA，用于 F2 自动化超期查询

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
- 约束：当 risk_level ≠ 正常时建议填写
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

---

### Resource 统一资源表

> 用途：合并模特、化妆师、场地、服装、修图师、摄影师等资源的公共信息，以"资源类型 + 视图"替代多张重复子表。通过 resource_type 区分资源类别。

#### resource_id
- 显示名：资源编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式 `RES-{YYYYMMDD}-{###}`，前缀 `RES-`
- 说明：稳定业务 ID

#### resource_type
- 显示名：资源类型
- 飞书类型：single_select
- 必填：是
- 选项：模特、化妆师、场地、服装、修图师、摄影师、其他
- 说明：资源类别，视图分组核心
- 颜色建议：模特（粉）、化妆师（紫）、场地（绿）、服装（蓝）、修图师（橙）、摄影师（青）、其他（灰）

#### resource_name
- 显示名：资源名称
- 飞书类型：text
- 必填：是
- 约束：非空，≤30 字符
- 说明：名称或称呼

#### contact
- 显示名：联系方式
- 飞书类型：text
- 必填：否
- 约束：手机号/微信/邮箱
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
- 约束：≥0，单位：元
- 说明：报价范围下限

#### price_max
- 显示名：报价上限
- 飞书类型：number
- 必填：否
- 约束：≥price_min
- 说明：报价范围上限

#### rating_quality
- 显示名：质量评分
- 飞书类型：rating
- 必填：否
- 约束：1-5 星
- 说明：质量评价

#### rating_reliability
- 显示名：可靠性评分
- 飞书类型：rating
- 必填：否
- 约束：1-5 星
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
- 约束：合法 JSON 字符串
- 说明：类型特有信息，供 Agent 和 API 使用
- 示例：模特 `{"height":175, "bust":86, "waist":62, "hip":90, "shoe_size":38}`；场地 `{"address":"...", "area_sqm":120, "facilities":[...]}`；服装 `{"category":"婚纱", "sizes":["S","M","L"], ...}`

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

---

### Project_Resource_Assignment 项目资源安排表

> 用途：解决"一个项目使用多个资源、一个资源参与多个项目"的多对多关系。是资源推荐、档期冲突检测和策划案资源清单的关键中间层。

#### assignment_id
- 显示名：安排编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式 `ASG-{YYYYMMDD}-{###}`，前缀 `ASG-`
- 说明：唯一编号

#### project_link
- 显示名：关联项目
- 飞书类型：link
- 必填：是
- 约束：关联到 Project 表，单选
- 说明：必填

#### resource_link
- 显示名：关联资源
- 飞书类型：link
- 必填：是
- 约束：关联到 Resource 表，单选
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
- 约束：≥0，单位：元
- 说明：资源报价

#### confirmed_price
- 显示名：确认价格
- 飞书类型：number
- 必填：否
- 约束：≥0，单位：元
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
- 选项：无冲突、疑似冲突、已冲突
- 说明：档期冲突检测结果，由 S4 自动化更新
- 颜色建议：无冲突（绿）、疑似冲突（黄）、已冲突（红）

#### owner
- 显示名：跟进人
- 飞书类型：person
- 必填：否
- 说明：资源安排跟进负责人，飞书用户

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
- 约束：格式 `PLN-{YYYYMMDD}-{###}`，前缀 `PLN-`
- 说明：策划案 ID

#### project_link
- 显示名：关联项目
- 飞书类型：link
- 必填：是
- 约束：关联到 Project 表，单选
- 说明：必填

#### version
- 显示名：版本号
- 飞书类型：text
- 必填：是
- 约束：格式 `v1`, `v2`, ...
- 说明：版本标识

#### status
- 显示名：策划状态
- 飞书类型：single_select
- 必填：是
- 选项：AI草稿、人工编辑、待客户确认、已批准、已废弃
- 说明：策划案审批状态
- 颜色建议：AI草稿（灰）、人工编辑（蓝）、待客户确认（黄）、已批准（绿）、已废弃（红）
- 状态流转：AI草稿 → 人工编辑 → 待客户确认 → 已批准（或 已废弃）

#### document_url
- 显示名：策划文档链接
- 飞书类型：url
- 必填：否
- 说明：飞书文档链接，完整正文存储位置

#### template_version
- 显示名：模板版本
- 飞书类型：text
- 必填：否
- 约束：格式 `v1.0`, `v1.1`, ...
- 说明：策划模板版本

#### ai_job_link
- 显示名：AI来源任务
- 飞书类型：link
- 必填：否
- 约束：关联到 AI_Inbox 表，单选
- 说明：生成来源，记录策划案由哪个 AI 任务生成

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
- 约束：status=已批准时必填
- 说明：内部批准人，飞书用户

#### approved_at
- 显示名：批准时间
- 飞书类型：datetime
- 必填：否
- 约束：status=已批准时必填
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
- 约束：格式 `TSK-{YYYYMMDD}-{###}`，前缀 `TSK-`
- 说明：唯一 ID

#### project_link
- 显示名：关联项目
- 飞书类型：link
- 必填：否
- 约束：关联到 Project 表，单选，可为空
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
- 颜色建议：待处理（灰）、处理中（蓝）、受阻（红）、已完成（绿）、已取消（深灰）

#### owner
- 显示名：负责人
- 飞书类型：person
- 必填：是
- 说明：任务负责人，飞书用户

#### due_at
- 显示名：截止时间
- 飞书类型：datetime
- 必填：否
- 说明：任务截止时间，用于 SLA 监控

#### completed_at
- 显示名：完成时间
- 飞书类型：datetime
- 必填：否
- 约束：status=已完成时填写
- 说明：实际完成时间

#### evidence_url
- 显示名：完成证据
- 飞书类型：url
- 必填：否
- 约束：可为附件或 URL
- 说明：完成证据链接

#### source_event_id
- 显示名：来源事件ID
- 飞书类型：text
- 必填：否
- 约束：对应 Automation_Event.event_id
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
- 约束：UUID 格式，由 Agent 生成，全局唯一
- 说明：不使用自动编号，确保 Agent 与飞书 ID 一致

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
- 约束：附件或 URL
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
- 说明：可能匹配的已有业务 ID，用于去重匹配

#### output_json
- 显示名：AI输出JSON
- 飞书类型：multiline_text
- 必填：是
- 约束：合法 JSON，符合 ai_ingest_output.schema.json
- 说明：符合 JSON Schema 的输出

#### confidence
- 显示名：置信度
- 飞书类型：number
- 必填：是
- 约束：0-1，保留 2 位小数
- 说明：AI 输出整体置信度

#### risk_level
- 显示名：风险等级
- 飞书类型：single_select
- 必填：是
- 选项：Low、Medium、High
- 说明：写回风险分级
- 规则：Low（标签、摘要、非关键备注 → 可批量审核，允许自动写回）；Medium（客户需求、预算、日期、资源匹配 → 必须逐条人工审核）；High（价格、付款、合同、档期承诺、删除、合并 → 不允许自动写回）

#### validation_errors
- 显示名：校验错误
- 飞书类型：multiline_text
- 必填：否
- 说明：字段校验错误信息

#### review_status
- 显示名：审核状态
- 飞书类型：single_select
- 必填：是
- 选项：待审核、已采纳、已修改、已拒绝、执行失败
- 说明：人工审核结果
- 颜色建议：待审核（黄）、已采纳（绿）、已修改（青）、已拒绝（红）、执行失败（橙）
- 写回规则：仅 `已采纳` 或 `已修改` 状态才能执行 S7 写回

#### reviewer
- 显示名：审核人
- 飞书类型：person
- 必填：否
- 约束：review_status ≠ 待审核时必填
- 说明：人工审核人

#### human_revision_json
- 显示名：人工修改JSON
- 飞书类型：multiline_text
- 必填：否
- 约束：合法 JSON
- 说明：人工修改后的输出

#### writeback_target
- 显示名：写回目标
- 飞书类型：text
- 必填：否
- 说明：目标表和字段描述，如 "Customer.phone, Customer.budget_min"

#### writeback_result
- 显示名：写回结果
- 飞书类型：multiline_text
- 必填：否
- 约束：成功/失败/冲突详情
- 说明：写回执行结果

#### model_name
- 显示名：模型名称
- 飞书类型：text
- 必填：否
- 说明：使用的 AI 模型，如 "doubao-pro", "gpt-4o"

#### prompt_version
- 显示名：Prompt版本
- 飞书类型：text
- 必填：否
- 约束：格式 `{task}-v{major}.{minor}`
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
- 约束：review_status ≠ 待审核时填写
- 说明：人工审核时间

---

### Automation_Event 自动化事件日志

> 用途：所有 Serverless 自动化必须写日志。记录自动化触发、执行、结果和错误，用于监控、重试和人工补偿。

#### event_id
- 显示名：事件编号
- 飞书类型：text
- 必填：是
- 约束：UUID 格式，全局唯一
- 说明：不使用自动编号，确保幂等键唯一性检查可执行

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
- 约束：格式 `source_record_id + event_type + rule_version`，同一幂等键不得创建第二条业务记录
- 说明：幂等控制

#### rule_version
- 显示名：规则版本
- 飞书类型：text
- 必填：是
- 约束：格式 `v1.0`, `v1.1`, ...
- 说明：自动化规则版本

#### input_snapshot
- 显示名：输入快照
- 飞书类型：multiline_text
- 必填：否
- 约束：合法 JSON，脱敏后存储（移除手机号、客户姓名等），只保存脱敏摘要和哈希
- 说明：触发时的输入数据快照

#### status
- 显示名：执行状态
- 飞书类型：single_select
- 必填：是
- 选项：received、running、success、failed、manual_action
- 说明：执行结果
- 颜色建议：received（灰）、running（蓝）、success（绿）、failed（红）、manual_action（橙）
- 状态流转：received → running → success / failed / manual_action

#### started_at
- 显示名：开始时间
- 飞书类型：datetime
- 必填：是
- 说明：执行开始时间

#### completed_at
- 显示名：完成时间
- 飞书类型：datetime
- 必填：否
- 约束：status ∈ {success, failed, manual_action} 时填写
- 说明：执行完成时间

#### retry_count
- 显示名：重试次数
- 飞书类型：number
- 必填：是
- 约束：≥0，最大 3
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
- 说明：错误标识，如 "FS_429", "SCHEMA_ERROR"

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
- 约束：status=manual_action 时填写
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
- 约束：格式 `DQI-{YYYYMMDD}-{###}`，前缀 `DQI-`
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
- 选项：低、中、高、严重
- 说明：问题严重级别，影响处理优先级
- 颜色建议：低（灰）、中（黄）、高（橙）、严重（红）

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
- 约束：可为多个，逗号分隔
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
- 颜色建议：待处理（红）、处理中（黄）、已解决（绿）、已忽略（灰）、无法解决（深灰）

#### owner
- 显示名：责任人
- 飞书类型：person
- 必填：否
- 说明：问题处理负责人

#### resolution
- 显示名：解决方案
- 飞书类型：multiline_text
- 必填：否
- 约束：status ∈ {已解决, 已忽略} 时填写
- 说明：问题处理结果

#### resolved_at
- 显示名：解决时间
- 飞书类型：datetime
- 必填：否
- 约束：status=已解决 时填写
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

> 用途：保存非敏感系统配置：状态机版本、Prompt 版本、自动化规则版本、风险阈值、枚举字典、策划模板版本。**禁止保存 App Secret、Access Token、API Key 等敏感信息。**

#### config_id
- 显示名：配置编号
- 飞书类型：auto_number
- 必填：是
- 约束：格式 `CFG-{###}`，前缀 `CFG-`，序号 3 位补零
- 说明：唯一编号

#### config_key
- 显示名：配置键
- 飞书类型：text
- 必填：是
- 约束：唯一（应用层保证），snake_case 命名
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
- 约束：JSON 或文本
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
- 约束：格式 `v1.0`, `v1.1`, ...
- 说明：配置版本

#### is_active
- 显示名：是否生效
- 飞书类型：checkbox
- 必填：是
- 约束：同一 config_category + config_key 组合下，仅一条记录 is_active = true；版本切换时，旧版本 is_active = false
- 说明：当前是否生效，布尔值

#### updated_by
- 显示名：更新人
- 飞书类型：person
- 必填：否
- 说明：最后修改人，飞书用户

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
小红书、微信、官网、小程序、转介绍、其他

### service_type 服务类型
个人、双人、品牌、创作、其他

### style_tags 风格标签（preferred_style / style_tags）
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

### city 城市（Resource.city）
杭州、上海、北京、深圳、广州、成都、武汉、其他

### capability_tags 能力标签（Resource.capability_tags）
发型、妆面、尺码、设备、场地类型、服装类别、其他

### role_in_project 项目角色（Project_Resource_Assignment.role_in_project）
主模特、备选模特、主化妆、备选化妆、主摄影、助理摄影、场地、服装、修图师、道具、其他

### booking_status 预约状态（Project_Resource_Assignment.booking_status）
候选、询价中、待确认、已确认、已取消

### conflict_status 冲突状态（Project_Resource_Assignment.conflict_status）
无冲突、疑似冲突、已冲突

### planning_status 策划案状态（Planning_Document.status）
AI草稿、人工编辑、待客户确认、已批准、已废弃

### task_type 任务类型（Task.task_type / AI_Inbox.task_type）
- Task: 跟进、策划、资源确认、拍摄、后期、交付、复盘
- AI_Inbox: 客户提取、资源提取、项目提取、策划生成、摘要、质检

### task_status 任务状态（Task.status）
待处理、处理中、受阻、已完成、已取消

### source_type 输入来源（AI_Inbox.source_type）
文本、截图、语音、表单、聊天记录、项目记录

### target_entity 目标实体（AI_Inbox.target_entity）
Customer、Resource、Project、Planning

### ai_risk_level AI 风险等级（AI_Inbox.risk_level）
Low、Medium、High

### review_status 审核状态（AI_Inbox.review_status）
待审核、已采纳、已修改、已拒绝、执行失败

### event_type 事件类型（Automation_Event.event_type）
S1定金创建项目、S2策划草稿生成、S3执行任务生成、S4资源冲突检查、S5客户状态同步、S6复盘任务生成、S7AI写回、S8失败汇总、手动补偿、其他

### event_source_table 来源表（Automation_Event.source_table）
Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox

### event_status 执行状态（Automation_Event.status）
received、running、success、failed、manual_action

### issue_type 问题类型（Data_Quality_Issue.issue_type）
重复客户、重复资源、字段无法匹配、日期冲突、非法状态、缺失关键字段、关联记录丢失、资源档期冲突、写回失败、其他

### severity 严重程度（Data_Quality_Issue.severity）
低、中、高、严重

### dq_source_table 来源表（Data_Quality_Issue.source_table）
Customer、Project、Resource、Assignment、Planning_Document、Task、AI_Inbox、Automation_Event

### detected_by 发现方式（Data_Quality_Issue.detected_by）
自动化检测、AI质检、人工发现、迁移对账

### issue_status 处理状态（Data_Quality_Issue.status）
待处理、处理中、已解决、已忽略、无法解决

### config_category 配置类别（System_Config.config_category）
状态机、Prompt、自动化规则、风险阈值、枚举字典、策划模板、系统参数
