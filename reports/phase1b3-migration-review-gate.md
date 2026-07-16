# Phase 1B-3 迁移预览报告 (Migration Review Gate v1.1)

> **生成时间**：2026-07-16T04:19:06.079Z
> **源 Base**：旧业务中台 (SOURCE_BASE_ALIAS)
> **目标 Base**：V2 Pilot (TARGET_V2_BASE_ALIAS)
> **模式**：只读 Dry Run（不写 V2）
> **规则版本**：v1.1（基于 D-020~D-025）
> **状态**：⏸ Migration Review Gate — 等待前置数量条件确认

## 1. 汇总

| 表 | 总记录数 | MIGRATABLE | NEEDS_REVIEW | BLOCKED | SKIP |
|---|---|---|---|---|---|
| 客户 (Clients) | 36 | 1 | 1 | 34 | 0 |
| 项目 (Projects) | 47 | 1 | 13 | 33 | 0 |
| 化妆师 (Makeup) | 115 | 66 | 10 | 39 | 0 |
| 模特 (Model) | 106 | 67 | 1 | 38 | 0 |

### 前置数量条件检查

| 条件 | 要求 | 实际 | 是否满足 |
|---|---|---|---|
| Customer MIGRATABLE | ≥5 | 1 | 否 |
| Project MIGRATABLE | ≥5 | 1 | 否 |
| Model MIGRATABLE | ≥10 | 67 | 是 |
| Makeup MIGRATABLE | ≥10 | 66 | 是 |

**综合结果**：❌ 不满足，需停留在 Review Gate

## 2. 字段映射 (v1.1)

### 2.1 客户 (Clients → Customer)

| 旧字段 | V2 字段 | 映射方式 | 备注 |
|---|---|---|---|
| 客户姓名 | customer_name | 直接映射 | |
| 联系方式 | phone | 直接映射 | |
| 微信号 | wechat_name | 直接映射 | |
| 来源渠道 | source_channel | 枚举映射 | 保留 source_channel_raw / source_channel_mapping_version |
| 客户状态 | relationship_status | 按关联项目推断 | 保留 legacy_status_raw / status_mapping_rule_version |
| 预算区间 | budget_min / budget_max / budget_range_raw / budget_parse_status | 范围拆分 | budget-map-v1.0 |
| 拍摄类型 | service_type | 枚举映射 | |
| 跟进人 | owner | 直接映射 | user 类型 |
| 最后跟进时间 | last_contact_at | 直接映射 | |
| 跟进记录 | latest_summary | 直接映射 | |
| 关联项目 ID | (link) | 迁移后重建 | |
| 客户 ID | customer_id | 重新生成 | V2 auto_number |
| (迁移批次) | migration_batch_id / ... | 写入时标记 | MIGRATION_PILOT_001 |

### 2.2 项目 (Projects → Project)

| 旧字段 | V2 字段 | 映射方式 | 备注 |
|---|---|---|---|
| 项目名称 | project_name | 直接映射 | |
| 项目状态 | project_status | 枚举映射 | 旧"待立项"→草稿；旧"已完成"需交付/归档证据 |
| 关联客户 | customer_link | 迁移后重建 | 禁止未知客户占位 |
| 项目类型 | project_type | 枚举映射 | |
| 定金金额 | deposit_amount | 直接映射 | D-024 新增 |
| 成交金额 | deal_amount | 直接映射 | D-024 新增 |
| 付款状态 | payment_status | 枚举映射 | D-024 新增 |
| 客户满意度 | satisfaction_score / satisfaction_note | 直接映射 | D-024 新增 |
| 满意度收集时间 | feedback_collected_at | 直接映射 | D-024 新增 |
| (迁移批次) | migration_batch_id / ... | 写入时标记 | MIGRATION_PILOT_001 |

### 2.3 化妆师/模特 (Makeup/Model → Resource)

| 旧字段 | V2 字段 | 映射方式 | 备注 |
|---|---|---|---|
| 姓名 (化妆师) / 艺名/昵称 (模特) | resource_name | 直接映射 | |
| 微信号 / 联系方式 | contact | 直接映射 | |
| 合作状态 | cooperation_status | 枚举映射 | |
| 小红书链接 / 作品链接 | portfolio_url | 直接映射 | 用于重复候选检测 |
| (迁移批次) | migration_batch_id / ... | 写入时标记 | MIGRATION_PILOT_001 |

## 3. 状态映射 (D-020)

### 3.1 客户状态映射规则

- 存在未交付或未归档的有效关联项目 → **服务中**
- 所有关联项目均已交付或已归档 → **已完成**
- 没有关联项目或项目状态无法判断 → **NEEDS_REVIEW**
- 旧状态 "已拍摄"/"拍摄完成" 不再无条件映射为 "服务中"

### 3.2 项目状态映射规则

- 旧 "待立项" → **草稿**
- 旧 "待策划" → **策划中**
- 旧 "初筛完成" / "修图中" → **后期制作**
- 旧 "已完成"：
  - 有交付日期、交付附件或明确交付证据 → **已交付**
  - 同时存在归档或复盘完成证据 → **已归档**
  - 无法证明交付 → **NEEDS_REVIEW**

### 3.3 来源渠道映射 (D-021)

V2 来源渠道扩展为：小红书、抖音、视频号、朋友圈、微信公众号、微信私聊、官网、小程序、转介绍、线下活动、其他、未知。
所有旧值保留在 source_channel_raw，无法识别时映射为 "其他" 或 "未知"。

## 4. 记录分类详情

### 4.1 客户分类

| record_id | 姓名 | 旧状态 | V2状态 | 旧来源 | V2来源 | 预算解析 | 有关联项目 | 重复候选 | 分类 | 问题 |
|---|---|---|---|---|---|---|---|---|---|---|
| REC_ALIAS_0013 | ENTITY_ALIAS_001 | 已拍摄 |  |  |  | unknown | 否 | NA | NEEDS_REVIEW | 旧状态为已拍摄/拍摄完成，但无关联项目 |
| REC_ALIAS_0014 | PROJECT_ALIAS_001 | 已报价 | 已确认需求 |  |  | unknown | 否 | NA | MIGRATABLE |  |
| REC_ALIAS_0015 | PROJECT_ALIAS_002 | 已报价 | 已确认需求 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0016 | PROJECT_ALIAS_003 | 已报价 | 已确认需求 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0017 | PROJECT_ALIAS_004 | 已报价 | 已确认需求 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0018 | PROJECT_ALIAS_005 | 已报价 | 已确认需求 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0019 | PROJECT_ALIAS_006 | 已报价 | 已确认需求 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0020 | PROJECT_ALIAS_007 | 已拍摄 |  |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息; 旧状态为已拍摄/拍摄完成，但无关联项目 |
| REC_ALIAS_0021 | PROJECT_ALIAS_008 | 已报价 | 已确认需求 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0022 | 苏 | 已流失 | 已流失 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0023 | PROJECT_ALIAS_009 | 已流失 | 已流失 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0024 | PROJECT_ALIAS_010 | 已报价 | 已确认需求 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0025 | 🦔 | 已报价 | 已确认需求 |  |  | unknown | 否 | NA | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| REC_ALIAS_0026 | (空) | 已流失 | 已流失 |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0027 | (空) | 已流失 | 已流失 |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0028 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0029 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0030 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0031 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0032 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0033 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0034 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0035 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0036 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0037 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0038 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0039 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0040 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0041 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0042 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0043 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0044 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0045 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0046 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0047 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |
| REC_ALIAS_0048 | (空) |  |  |  |  | unknown | 否 | NA | BLOCKED | 客户姓名为空 |

### 4.2 项目分类

| record_id | 名称 | 旧状态 | V2状态 | 付款状态 | 有关联客户 | 分类 | 问题 |
|---|---|---|---|---|---|---|---|
| REC_ALIAS_0049 | ENTITY_ALIAS_002 | 已归档 | 已归档 | 未知 | 是 | MIGRATABLE |  |
| REC_ALIAS_0050 | CUSTOMER_ALIAS_001 | 待立项 | 草稿 | 未知 | 否 | NEEDS_REVIEW | 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0051 | CUSTOMER_ALIAS_002 | 待立项 | 草稿 | 未知 | 否 | NEEDS_REVIEW | 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0052 | CUSTOMER_ALIAS_003 | 已完成 |  | 未知 | 否 | NEEDS_REVIEW | 旧状态已完成但无法证明交付; 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0053 | CUSTOMER_ALIAS_004 | 待立项 | 草稿 | 未知 | 否 | NEEDS_REVIEW | 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0054 | CUSTOMER_ALIAS_005 | 待立项 | 草稿 | 未知 | 否 | NEEDS_REVIEW | 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0055 | CUSTOMER_ALIAS_006 | 待立项 | 草稿 | 未知 | 否 | NEEDS_REVIEW | 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0056 | CUSTOMER_ALIAS_007 | 待立项 | 草稿 | 未知 | 否 | BLOCKED | 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0057 | CUSTOMER_ALIAS_008 | 待立项 | 草稿 | 未知 | 否 | BLOCKED | 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0058 | CUSTOMER_ALIAS_009 | 待立项 | 草稿 | 未知 | 否 | BLOCKED | 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0059 | CUSTOMER_ALIAS_010 | 待立项 | 草稿 | 未知 | 否 | BLOCKED | 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0060 | CUSTOMER_ALIAS_011 | 待立项 | 草稿 | 未知 | 否 | BLOCKED | 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0061 | CUSTOMER_ALIAS_012 | 待立项 | 草稿 | 未知 | 否 | BLOCKED | 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0062 | CUSTOMER_ALIAS_013 | 待立项 | 草稿 | 未知 | 否 | BLOCKED | 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0063 | CUSTOMER_ALIAS_014 | 待立项 | 草稿 | 未知 | 否 | BLOCKED | 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0064 | CUSTOMER_ALIAS_015 | 已完成 |  | 未知 | 否 | NEEDS_REVIEW | 旧状态已完成但无法证明交付; 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0065 | CUSTOMER_ALIAS_016 | 已完成 |  | 未知 | 否 | NEEDS_REVIEW | 旧状态已完成但无法证明交付; 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0066 | CUSTOMER_ALIAS_017 | 已完成 |  | 未知 | 否 | NEEDS_REVIEW | 旧状态已完成但无法证明交付; 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0067 | CUSTOMER_ALIAS_018 | 已完成 |  | 未知 | 否 | NEEDS_REVIEW | 旧状态已完成但无法证明交付; 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0068 | CUSTOMER_ALIAS_019 | 已完成 |  | 未知 | 否 | NEEDS_REVIEW | 旧状态已完成但无法证明交付; 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0069 | CUSTOMER_ALIAS_020 | 已完成 |  | 未知 | 否 | NEEDS_REVIEW | 旧状态已完成但无法证明交付; 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0070 | CUSTOMER_ALIAS_021 | 已完成 |  | 未知 | 否 | NEEDS_REVIEW | 旧状态已完成但无法证明交付; 项目字段存在客户信息，但无法匹配到可迁移客户 |
| REC_ALIAS_0071 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0072 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0073 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0074 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0075 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0076 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0077 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0078 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0079 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0080 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0081 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0082 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0083 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0084 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0085 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0086 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0087 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0088 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0089 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0090 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0091 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0092 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0093 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0094 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |
| REC_ALIAS_0095 | (空) |  |  | 未知 | 否 | BLOCKED | 项目名称为空; 无关联客户，且无法从项目字段确定客户 |

### 4.3 化妆师分类

| record_id | 姓名 | 分类 | 重复候选 | 问题 |
|---|---|---|---|---|
| REC_ALIAS_0096 | ENTITY_ALIAS_003 | MIGRATABLE | NA |  |
| REC_ALIAS_0097 | ENTITY_ALIAS_004 | MIGRATABLE | NA |  |
| REC_ALIAS_0098 | ENTITY_ALIAS_005 | MIGRATABLE | NA |  |
| REC_ALIAS_0099 | ENTITY_ALIAS_006 | MIGRATABLE | NA |  |
| REC_ALIAS_0100 | ENTITY_ALIAS_007 | MIGRATABLE | NA |  |
| REC_ALIAS_0101 | ENTITY_ALIAS_008 | MIGRATABLE | NA |  |
| REC_ALIAS_0102 | ENTITY_ALIAS_009 | MIGRATABLE | NA |  |
| REC_ALIAS_0103 | 虞 | MIGRATABLE | NA |  |
| REC_ALIAS_0104 | ENTITY_ALIAS_010 | MIGRATABLE | NA |  |
| REC_ALIAS_0105 | :-* | MIGRATABLE | NA |  |
| REC_ALIAS_0106 | ENTITY_ALIAS_011 | MIGRATABLE | NA |  |
| REC_ALIAS_0107 | MAKEUP_ALIAS_001 | MIGRATABLE | NA |  |
| REC_ALIAS_0108 | MAKEUP_ALIAS_002 | MIGRATABLE | NA |  |
| REC_ALIAS_0109 | ENTITY_ALIAS_012 | MIGRATABLE | NA |  |
| REC_ALIAS_0110 | ENTITY_ALIAS_013 | MIGRATABLE | NA |  |
| REC_ALIAS_0111 | ENTITY_ALIAS_014 | MIGRATABLE | NA |  |
| REC_ALIAS_0112 | ENTITY_ALIAS_015 | MIGRATABLE | NA |  |
| REC_ALIAS_0113 | MAKEUP_ALIAS_003 | MIGRATABLE | NA |  |
| REC_ALIAS_0114 | MAKEUP_ALIAS_004 | MIGRATABLE | NA |  |
| REC_ALIAS_0115 | MAKEUP_ALIAS_005 | MIGRATABLE | NA |  |
| REC_ALIAS_0116 | ENTITY_ALIAS_016 | MIGRATABLE | NA |  |
| REC_ALIAS_0117 | / | MIGRATABLE | NA |  |
| REC_ALIAS_0118 | ENTITY_ALIAS_017 | MIGRATABLE | NA |  |
| REC_ALIAS_0119 | ENTITY_ALIAS_018 \| 微信:源月yury \| 地点:杭州金海公寓 \| 档期:5/25,5/26,5/28,5/29 \| 优先级:A \| 合作状态:有意向 | MIGRATABLE | NA |  |
| REC_ALIAS_0120 | ENTITY_ALIAS_019 | MIGRATABLE | NA |  |
| REC_ALIAS_0121 | MAKEUP_ALIAS_006 | MIGRATABLE | NA |  |
| REC_ALIAS_0122 | ENTITY_ALIAS_020 | MIGRATABLE | NA |  |
| REC_ALIAS_0123 | ENTITY_ALIAS_021 | MIGRATABLE | NA |  |
| REC_ALIAS_0124 | ENTITY_ALIAS_022 | MIGRATABLE | NA |  |
| REC_ALIAS_0125 | ENTITY_ALIAS_023 | MIGRATABLE | NA |  |
| REC_ALIAS_0126 | ENTITY_ALIAS_024 \| 微信:不熬夜的Mz ིྀ \| 地点:北京 \| 报价:400-450 \| 优先级:A \| 合作状态:有意向 | MIGRATABLE | NA |  |
| REC_ALIAS_0127 | ENTITY_ALIAS_025 | MIGRATABLE | NA |  |
| REC_ALIAS_0128 | ENTITY_ALIAS_013 \| 微信:ENTITY_ALIAS_013 \| 地点:杭州 \| 报价:200 \| 优先级:B \| 合作状态:已合作 | MIGRATABLE | NA |  |
| REC_ALIAS_0129 | ENTITY_ALIAS_003 \| 微信:ENTITY_ALIAS_003 \| 地点:杭州 \| 档期:工作日有空 \| 报价:499优惠429 \| 优先级:B \| 合作状态:有意向 | MIGRATABLE | NA |  |
| REC_ALIAS_0130 | ENTITY_ALIAS_004 \| 微信:ENTITY_ALIAS_004 \| 地点:杭州 \| 优先级:B | MIGRATABLE | NA |  |
| REC_ALIAS_0131 | ENTITY_ALIAS_006 \| 微信:ENTITY_ALIAS_006 \| 地点:杭州 \| 报价:350 \| 优先级:B \| 合作状态:无意向 \| 备注:创作看时间风格 | MIGRATABLE | NA |  |
| REC_ALIAS_0132 | ENTITY_ALIAS_026 \| 微信:ENTITY_ALIAS_026 \| 地点:杭州钱江国际商务中心 \| 优先级:B \| 合作状态:无意向 | MIGRATABLE | NA |  |
| REC_ALIAS_0133 | ENTITY_ALIAS_010 \| 微信:ENTITY_ALIAS_010 \| 地点:杭州 \| 优先级:B \| 合作状态:无意向 | MIGRATABLE | NA |  |
| REC_ALIAS_0134 | MAKEUP_ALIAS_007 \| 微信:Anna（定金留档） \| 地点:杭州定安路 \| 档期:5/23 \| 优先级:B \| 合作状态:有意向 \| 备注:汉服 | MIGRATABLE | NA |  |
| REC_ALIAS_0135 | ENTITY_ALIAS_027 | MIGRATABLE | NA |  |
| REC_ALIAS_0136 | ENTITY_ALIAS_028 | MIGRATABLE | NA |  |
| REC_ALIAS_0137 | ENTITY_ALIAS_029 | MIGRATABLE | NA |  |
| REC_ALIAS_0138 | ENTITY_ALIAS_030 | MIGRATABLE | NA |  |
| REC_ALIAS_0139 | MAKEUP_ALIAS_008 | MIGRATABLE | NA |  |
| REC_ALIAS_0140 | ENTITY_ALIAS_031 | MIGRATABLE | NA |  |
| REC_ALIAS_0141 | ENTITY_ALIAS_032 \| 微信:椿山化妆间·刘恋 | MIGRATABLE | NA |  |
| REC_ALIAS_0142 | ENTITY_ALIAS_033 | MIGRATABLE | NA |  |
| REC_ALIAS_0143 | ENTITY_ALIAS_034 \| 微信:我 | MIGRATABLE | NA |  |
| REC_ALIAS_0144 | ENTITY_ALIAS_035 | MIGRATABLE | NA |  |
| REC_ALIAS_0145 | ENTITY_ALIAS_036 | MIGRATABLE | NA |  |
| REC_ALIAS_0146 | ENTITY_ALIAS_037 \| 微信:ENTITY_ALIAS_037 \| 地点:杭州 \| 合作状态:无意向 | MIGRATABLE | NA |  |
| REC_ALIAS_0147 | ENTITY_ALIAS_038 \| 微信:西溪梦华赋汉服写真 \| 地点:杭州 | MIGRATABLE | NA |  |
| REC_ALIAS_0148 | ENTITY_ALIAS_039 \| 微信:ENTITY_ALIAS_039 \| 地点:杭州 | MIGRATABLE | NA |  |
| REC_ALIAS_0149 | ENTITY_ALIAS_040 \| 微信:ENTITY_ALIAS_040🐯 \| 地点:杭州 \| 备注:汉服 | MIGRATABLE | NA |  |
| REC_ALIAS_0150 | ENTITY_ALIAS_041 | MIGRATABLE | NA |  |
| REC_ALIAS_0151 | ENTITY_ALIAS_042 | MIGRATABLE | NA |  |
| REC_ALIAS_0152 | ENTITY_ALIAS_043 | MIGRATABLE | NA |  |
| REC_ALIAS_0153 | ENTITY_ALIAS_044 \| 备注:已私信 \| 优先级:A | MIGRATABLE | NA |  |
| REC_ALIAS_0154 | ENTITY_ALIAS_045 \| 优先级:S | MIGRATABLE | NA |  |
| REC_ALIAS_0155 | MAKEUP_ALIAS_009 \| 优先级:A | MIGRATABLE | NA |  |
| REC_ALIAS_0156 | MAKEUP_ALIAS_010 \| 地点:杭州 | MIGRATABLE | NA |  |
| REC_ALIAS_0157 | ENTITY_ALIAS_046 \| 地点:杭州 | MIGRATABLE | NA |  |
| REC_ALIAS_0158 | ENTITY_ALIAS_047 \| 微信:化妆师小熊 | MIGRATABLE | NA |  |
| REC_ALIAS_0159 | MAKEUP_ALIAS_011 \| 微信:<REDACTED_WECHAT> | MIGRATABLE | NA |  |
| REC_ALIAS_0160 | ENTITY_ALIAS_048 \| 地点:杭州 | MIGRATABLE | NA |  |
| REC_ALIAS_0161 | ENTITY_ALIAS_049 | MIGRATABLE | NA |  |
| REC_ALIAS_0162 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0112 一致; 小红书账号与 REC_ALIAS_0112 一致 |
| REC_ALIAS_0163 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0120 一致; 小红书账号与 REC_ALIAS_0120 一致 |
| REC_ALIAS_0164 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0121 一致; 小红书账号与 REC_ALIAS_0121 一致 |
| REC_ALIAS_0165 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0122 一致; 小红书账号与 REC_ALIAS_0122 一致 |
| REC_ALIAS_0166 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0123 一致; 小红书账号与 REC_ALIAS_0123 一致 |
| REC_ALIAS_0167 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0124 一致; 小红书账号与 REC_ALIAS_0124 一致 |
| REC_ALIAS_0168 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0125 一致; 小红书账号与 REC_ALIAS_0125 一致 |
| REC_ALIAS_0169 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0170 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0127 一致; 小红书账号与 REC_ALIAS_0127 一致 |
| REC_ALIAS_0171 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0117 一致; 小红书账号与 REC_ALIAS_0117 一致 |
| REC_ALIAS_0172 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0097 一致; 小红书账号与 REC_ALIAS_0097 一致 |
| REC_ALIAS_0173 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0174 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0135 一致; 小红书账号与 REC_ALIAS_0135 一致 |
| REC_ALIAS_0175 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0136 一致; 小红书账号与 REC_ALIAS_0136 一致 |
| REC_ALIAS_0176 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0137 一致; 小红书账号与 REC_ALIAS_0137 一致 |
| REC_ALIAS_0177 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0138 一致; 小红书账号与 REC_ALIAS_0138 一致 |
| REC_ALIAS_0178 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0139 一致; 小红书账号与 REC_ALIAS_0139 一致 |
| REC_ALIAS_0179 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0140 一致; 小红书账号与 REC_ALIAS_0140 一致 |
| REC_ALIAS_0180 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0181 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0142 一致; 小红书账号与 REC_ALIAS_0142 一致 |
| REC_ALIAS_0182 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0183 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0144 一致; 小红书账号与 REC_ALIAS_0144 一致 |
| REC_ALIAS_0184 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0145 一致; 小红书账号与 REC_ALIAS_0145 一致 |
| REC_ALIAS_0185 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0186 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0187 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0188 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0189 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0150 一致; 小红书账号与 REC_ALIAS_0150 一致 |
| REC_ALIAS_0190 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0151 一致; 小红书账号与 REC_ALIAS_0151 一致 |
| REC_ALIAS_0191 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0152 一致; 小红书账号与 REC_ALIAS_0152 一致 |
| REC_ALIAS_0192 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0113 一致; 小红书账号与 REC_ALIAS_0113 一致 |
| REC_ALIAS_0193 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0114 一致; 小红书账号与 REC_ALIAS_0114 一致 |
| REC_ALIAS_0194 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0115 一致; 小红书账号与 REC_ALIAS_0115 一致 |
| REC_ALIAS_0195 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0116 一致; 小红书账号与 REC_ALIAS_0116 一致 |
| REC_ALIAS_0196 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0197 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0118 一致; 小红书账号与 REC_ALIAS_0118 一致 |
| REC_ALIAS_0198 | (空) | BLOCKED | NA | 化妆师名称为空 |
| REC_ALIAS_0199 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0096 一致; 小红书账号与 REC_ALIAS_0096 一致 |
| REC_ALIAS_0200 | (空) | BLOCKED | UNRESOLVED | 化妆师名称为空; 高概率重复候选：微信号与 REC_ALIAS_0099 一致; 小红书账号与 REC_ALIAS_0099 一致 |
| REC_ALIAS_0201 | MAKEUP_ALIAS_012 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0196 一致; 小红书账号与 REC_ALIAS_0196 一致 |
| REC_ALIAS_0202 | MAKEUP_ALIAS_013 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0198 一致; 小红书账号与 REC_ALIAS_0198 一致 |
| REC_ALIAS_0203 | ENTITY_ALIAS_050 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0169 一致; 小红书账号与 REC_ALIAS_0169 一致 |
| REC_ALIAS_0204 | ENTITY_ALIAS_051 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0173 一致; 小红书账号与 REC_ALIAS_0173 一致 |
| REC_ALIAS_0205 | ENTITY_ALIAS_052 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0180 一致; 小红书账号与 REC_ALIAS_0180 一致 |
| REC_ALIAS_0206 | ENTITY_ALIAS_053 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0182 一致; 小红书账号与 REC_ALIAS_0182 一致 |
| REC_ALIAS_0207 | ENTITY_ALIAS_054 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0185 一致; 小红书账号与 REC_ALIAS_0185 一致 |
| REC_ALIAS_0208 | ENTITY_ALIAS_055 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0186 一致; 小红书账号与 REC_ALIAS_0186 一致 |
| REC_ALIAS_0209 | ENTITY_ALIAS_056 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0187 一致; 小红书账号与 REC_ALIAS_0187 一致 |
| REC_ALIAS_0210 | ENTITY_ALIAS_057 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0188 一致; 小红书账号与 REC_ALIAS_0188 一致 |

### 4.4 模特分类

| record_id | 姓名 | 分类 | 重复候选 | 问题 |
|---|---|---|---|---|
| REC_ALIAS_0211 | ENTITY_ALIAS_058 | MIGRATABLE | NA |  |
| REC_ALIAS_0212 | ENTITY_ALIAS_059 | MIGRATABLE | NA |  |
| REC_ALIAS_0213 | 易 | MIGRATABLE | NA |  |
| REC_ALIAS_0214 | 11 | MIGRATABLE | NA |  |
| REC_ALIAS_0215 | ENTITY_ALIAS_060 | MIGRATABLE | NA |  |
| REC_ALIAS_0216 | ENTITY_ALIAS_061 | MIGRATABLE | NA |  |
| REC_ALIAS_0217 | ENTITY_ALIAS_062 | MIGRATABLE | NA |  |
| REC_ALIAS_0218 | 喏 | MIGRATABLE | NA |  |
| REC_ALIAS_0219 | L | MIGRATABLE | NA |  |
| REC_ALIAS_0220 | ENTITY_ALIAS_063 | MIGRATABLE | NA |  |
| REC_ALIAS_0221 | ENTITY_ALIAS_064 | MIGRATABLE | NA |  |
| REC_ALIAS_0222 | ENTITY_ALIAS_065 | MIGRATABLE | NA |  |
| REC_ALIAS_0223 | 呱 | MIGRATABLE | NA |  |
| REC_ALIAS_0224 | ENTITY_ALIAS_116 | MIGRATABLE | NA |  |
| REC_ALIAS_0225 | ENTITY_ALIAS_066 | MIGRATABLE | NA |  |
| REC_ALIAS_0226 | MODEL_ALIAS_001 | MIGRATABLE | NA |  |
| REC_ALIAS_0227 | ENTITY_ALIAS_117 | MIGRATABLE | NA |  |
| REC_ALIAS_0228 | ENTITY_ALIAS_067 | MIGRATABLE | NA |  |
| REC_ALIAS_0229 | MODEL_ALIAS_011 | MIGRATABLE | NA |  |
| REC_ALIAS_0230 | ENTITY_ALIAS_068 | MIGRATABLE | NA |  |
| REC_ALIAS_0231 | ENTITY_ALIAS_069 | MIGRATABLE | NA |  |
| REC_ALIAS_0232 | ENTITY_ALIAS_042 | MIGRATABLE | NA |  |
| REC_ALIAS_0233 | ENTITY_ALIAS_070 | MIGRATABLE | NA |  |
| REC_ALIAS_0234 | ENTITY_ALIAS_071 | MIGRATABLE | NA |  |
| REC_ALIAS_0235 | ENTITY_ALIAS_072 | MIGRATABLE | NA |  |
| REC_ALIAS_0236 | 喏 | MIGRATABLE | NA |  |
| REC_ALIAS_0237 | MODEL_ALIAS_002 | MIGRATABLE | NA |  |
| REC_ALIAS_0238 | ENTITY_ALIAS_073 | MIGRATABLE | NA |  |
| REC_ALIAS_0239 | ENTITY_ALIAS_074 | MIGRATABLE | NA |  |
| REC_ALIAS_0240 | ENTITY_ALIAS_058 | MIGRATABLE | NA |  |
| REC_ALIAS_0241 | MODEL_ALIAS_003 | MIGRATABLE | NA |  |
| REC_ALIAS_0242 | ENTITY_ALIAS_075 | MIGRATABLE | NA |  |
| REC_ALIAS_0243 | 011 | MIGRATABLE | NA |  |
| REC_ALIAS_0244 | ENTITY_ALIAS_060 | MIGRATABLE | NA |  |
| REC_ALIAS_0245 | MODEL_ALIAS_004 | MIGRATABLE | NA |  |
| REC_ALIAS_0246 | ENTITY_ALIAS_076 | MIGRATABLE | NA |  |
| REC_ALIAS_0247 | / | MIGRATABLE | NA |  |
| REC_ALIAS_0248 | ENTITY_ALIAS_077 | MIGRATABLE | NA |  |
| REC_ALIAS_0249 | MODEL_ALIAS_005 | MIGRATABLE | NA |  |
| REC_ALIAS_0250 | ENTITY_ALIAS_078 | MIGRATABLE | NA |  |
| REC_ALIAS_0251 | ENTITY_ALIAS_079 | MIGRATABLE | NA |  |
| REC_ALIAS_0252 | ENTITY_ALIAS_080 | MIGRATABLE | NA |  |
| REC_ALIAS_0253 | ENTITY_ALIAS_081 | MIGRATABLE | NA |  |
| REC_ALIAS_0254 | 23 | MIGRATABLE | NA |  |
| REC_ALIAS_0255 | ENTITY_ALIAS_082 | MIGRATABLE | NA |  |
| REC_ALIAS_0256 | ENTITY_ALIAS_083 | MIGRATABLE | NA |  |
| REC_ALIAS_0257 | ENTITY_ALIAS_084 | MIGRATABLE | NA |  |
| REC_ALIAS_0258 | ENTITY_ALIAS_085 | MIGRATABLE | NA |  |
| REC_ALIAS_0259 | ENTITY_ALIAS_086 | MIGRATABLE | NA |  |
| REC_ALIAS_0260 | / | MIGRATABLE | NA |  |
| REC_ALIAS_0261 | ENTITY_ALIAS_069 | MIGRATABLE | NA |  |
| REC_ALIAS_0262 | MODEL_ALIAS_006 | MIGRATABLE | NA |  |
| REC_ALIAS_0263 | ENTITY_ALIAS_071 | MIGRATABLE | NA |  |
| REC_ALIAS_0264 | MODEL_ALIAS_007 | MIGRATABLE | NA |  |
| REC_ALIAS_0265 | MODEL_ALIAS_002 | MIGRATABLE | NA |  |
| REC_ALIAS_0266 | MODEL_ALIAS_008 | MIGRATABLE | NA |  |
| REC_ALIAS_0267 | ENTITY_ALIAS_087 | MIGRATABLE | NA |  |
| REC_ALIAS_0268 | ENTITY_ALIAS_088 | MIGRATABLE | NA |  |
| REC_ALIAS_0269 | ENTITY_ALIAS_089 | MIGRATABLE | NA |  |
| REC_ALIAS_0270 | ENTITY_ALIAS_090 | MIGRATABLE | NA |  |
| REC_ALIAS_0271 | ENTITY_ALIAS_091 | MIGRATABLE | NA |  |
| REC_ALIAS_0272 | ENTITY_ALIAS_092 | MIGRATABLE | NA |  |
| REC_ALIAS_0273 | ENTITY_ALIAS_093 | MIGRATABLE | NA |  |
| REC_ALIAS_0274 | MODEL_ALIAS_009 | MIGRATABLE | NA |  |
| REC_ALIAS_0275 | ENTITY_ALIAS_094 | MIGRATABLE | NA |  |
| REC_ALIAS_0276 | ENTITY_ALIAS_095 | MIGRATABLE | NA |  |
| REC_ALIAS_0277 | ENTITY_ALIAS_096 | MIGRATABLE | NA |  |
| REC_ALIAS_0278 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0211 一致; 小红书账号与 REC_ALIAS_0211 一致 |
| REC_ALIAS_0279 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0215 一致; 小红书账号与 REC_ALIAS_0215 一致 |
| REC_ALIAS_0280 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0245 一致; 小红书账号与 REC_ALIAS_0245 一致 |
| REC_ALIAS_0281 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0247 一致; 小红书账号与 REC_ALIAS_0247 一致 |
| REC_ALIAS_0282 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0250 一致; 小红书账号与 REC_ALIAS_0250 一致 |
| REC_ALIAS_0283 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0251 一致; 小红书账号与 REC_ALIAS_0251 一致 |
| REC_ALIAS_0284 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0253 一致; 小红书账号与 REC_ALIAS_0253 一致 |
| REC_ALIAS_0285 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0255 一致; 小红书账号与 REC_ALIAS_0255 一致 |
| REC_ALIAS_0286 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0256 一致; 小红书账号与 REC_ALIAS_0256 一致 |
| REC_ALIAS_0287 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0257 一致; 小红书账号与 REC_ALIAS_0257 一致 |
| REC_ALIAS_0288 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0234 一致; 小红书账号与 REC_ALIAS_0234 一致 |
| REC_ALIAS_0289 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0266 一致; 小红书账号与 REC_ALIAS_0266 一致 |
| REC_ALIAS_0290 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0267 一致; 小红书账号与 REC_ALIAS_0267 一致 |
| REC_ALIAS_0291 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0269 一致; 小红书账号与 REC_ALIAS_0269 一致 |
| REC_ALIAS_0292 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0270 一致; 小红书账号与 REC_ALIAS_0270 一致 |
| REC_ALIAS_0293 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0271 一致; 小红书账号与 REC_ALIAS_0271 一致 |
| REC_ALIAS_0294 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0272 一致; 小红书账号与 REC_ALIAS_0272 一致 |
| REC_ALIAS_0295 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0273 一致; 小红书账号与 REC_ALIAS_0273 一致 |
| REC_ALIAS_0296 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0274 一致; 小红书账号与 REC_ALIAS_0274 一致 |
| REC_ALIAS_0297 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0275 一致; 小红书账号与 REC_ALIAS_0275 一致 |
| REC_ALIAS_0298 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0276 一致; 小红书账号与 REC_ALIAS_0276 一致 |
| REC_ALIAS_0299 | (空) | BLOCKED | NA | 模特名称为空 |
| REC_ALIAS_0300 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0241 一致; 小红书账号与 REC_ALIAS_0241 一致 |
| REC_ALIAS_0301 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0242 一致; 小红书账号与 REC_ALIAS_0242 一致 |
| REC_ALIAS_0302 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0243 一致; 小红书账号与 REC_ALIAS_0243 一致 |
| REC_ALIAS_0303 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0246 一致; 小红书账号与 REC_ALIAS_0246 一致 |
| REC_ALIAS_0304 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0248 一致; 小红书账号与 REC_ALIAS_0248 一致 |
| REC_ALIAS_0305 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0249 一致; 小红书账号与 REC_ALIAS_0249 一致 |
| REC_ALIAS_0306 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0252 一致; 小红书账号与 REC_ALIAS_0252 一致 |
| REC_ALIAS_0307 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0254 一致; 小红书账号与 REC_ALIAS_0254 一致 |
| REC_ALIAS_0308 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0258 一致; 小红书账号与 REC_ALIAS_0258 一致 |
| REC_ALIAS_0309 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0259 一致; 小红书账号与 REC_ALIAS_0259 一致 |
| REC_ALIAS_0310 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0231 一致; 小红书账号与 REC_ALIAS_0231 一致 |
| REC_ALIAS_0311 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0262 一致; 小红书账号与 REC_ALIAS_0262 一致 |
| REC_ALIAS_0312 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0264 一致; 小红书账号与 REC_ALIAS_0264 一致 |
| REC_ALIAS_0313 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0237 一致; 小红书账号与 REC_ALIAS_0237 一致 |
| REC_ALIAS_0314 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0268 一致; 小红书账号与 REC_ALIAS_0268 一致 |
| REC_ALIAS_0315 | (空) | BLOCKED | UNRESOLVED | 模特名称为空; 高概率重复候选：微信号与 REC_ALIAS_0277 一致; 小红书账号与 REC_ALIAS_0277 一致 |
| REC_ALIAS_0316 | MODEL_ALIAS_010 | NEEDS_REVIEW | UNRESOLVED | 高概率重复候选：微信号与 REC_ALIAS_0299 一致; 小红书账号与 REC_ALIAS_0299 一致 |

## 5. 问题汇总

| 表 | 问题类型 | 数量 | 严重度 | 说明 |
|---|---|---|---|---|
| 客户 | status_needs_review | 2 | NEEDS_REVIEW | 旧状态为已拍摄/拍摄完成，但无关联项目 |
| 客户 | empty_identity | 11 | BLOCKED | 有姓名但无联系方式、来源和有效需求信息 |
| 客户 | missing_name | 23 | BLOCKED | 客户姓名为空 |
| 项目 | customer_by_name_unmatched | 13 | NEEDS_REVIEW | 项目字段存在客户信息，但无法匹配到可迁移客户 |
| 项目 | status_needs_review | 8 | NEEDS_REVIEW | 旧状态已完成但无法证明交付 |
| 项目 | orphan_project | 33 | BLOCKED | 无关联客户，且无法从项目字段确定客户 |
| 项目 | missing_name | 25 | BLOCKED | 项目名称为空 |
| 化妆师 | missing_name | 39 | BLOCKED | 化妆师名称为空 |
| 化妆师 | duplicate_candidate | 39 | NEEDS_REVIEW | 高概率重复候选：微信号与 REC_ALIAS_0112 一致; 小红书账号与 REC_ALIAS_0112 一致 |
| 模特 | missing_name | 38 | BLOCKED | 模特名称为空 |
| 模特 | duplicate_candidate | 38 | NEEDS_REVIEW | 高概率重复候选：微信号与 REC_ALIAS_0211 一致; 小红书账号与 REC_ALIAS_0211 一致 |

### 5.1 BLOCKED 原因分析

| 表 | 总数 | BLOCKED | 主要原因 |
|---|---|---|---|
| 客户 | 36 | 34 | 名称空或有效身份信息缺失 |
| 项目 | 47 | 33 | 名称空或无关联客户 |
| 化妆师 | 115 | 39 | 名称空 |
| 模特 | 106 | 38 | 名称空 |

**建议处理方式**：BLOCKED 记录不迁移至 V2。

## 6. 重复候选人工审核清单 (D-022)

> **规则**：任何重复候选不得自动合并。客户按手机号/微信号一致标记高概率候选；资源按联系方式/社交账号/作品链接一致标记高概率候选。状态为 UNRESOLVED 不得进入 Pilot。

### 6.1 客户重复候选

无重复候选。

### 6.2 化妆师重复候选

| record_id | 姓名 | 联系方式 | 证据 | 建议决策 |
|---|---|---|---|---|
| REC_ALIAS_0162 | (空) |  | 微信号与 REC_ALIAS_0112 一致; 小红书账号与 REC_ALIAS_0112 一致 | 待人工确认 |
| REC_ALIAS_0163 | (空) |  | 微信号与 REC_ALIAS_0120 一致; 小红书账号与 REC_ALIAS_0120 一致 | 待人工确认 |
| REC_ALIAS_0164 | (空) |  | 微信号与 REC_ALIAS_0121 一致; 小红书账号与 REC_ALIAS_0121 一致 | 待人工确认 |
| REC_ALIAS_0165 | (空) |  | 微信号与 REC_ALIAS_0122 一致; 小红书账号与 REC_ALIAS_0122 一致 | 待人工确认 |
| REC_ALIAS_0166 | (空) |  | 微信号与 REC_ALIAS_0123 一致; 小红书账号与 REC_ALIAS_0123 一致 | 待人工确认 |
| REC_ALIAS_0167 | (空) |  | 微信号与 REC_ALIAS_0124 一致; 小红书账号与 REC_ALIAS_0124 一致 | 待人工确认 |
| REC_ALIAS_0168 | (空) |  | 微信号与 REC_ALIAS_0125 一致; 小红书账号与 REC_ALIAS_0125 一致 | 待人工确认 |
| REC_ALIAS_0170 | (空) |  | 微信号与 REC_ALIAS_0127 一致; 小红书账号与 REC_ALIAS_0127 一致 | 待人工确认 |
| REC_ALIAS_0171 | (空) |  | 微信号与 REC_ALIAS_0117 一致; 小红书账号与 REC_ALIAS_0117 一致 | 待人工确认 |
| REC_ALIAS_0172 | (空) |  | 微信号与 REC_ALIAS_0097 一致; 小红书账号与 REC_ALIAS_0097 一致 | 待人工确认 |
| REC_ALIAS_0174 | (空) |  | 微信号与 REC_ALIAS_0135 一致; 小红书账号与 REC_ALIAS_0135 一致 | 待人工确认 |
| REC_ALIAS_0175 | (空) |  | 微信号与 REC_ALIAS_0136 一致; 小红书账号与 REC_ALIAS_0136 一致 | 待人工确认 |
| REC_ALIAS_0176 | (空) |  | 微信号与 REC_ALIAS_0137 一致; 小红书账号与 REC_ALIAS_0137 一致 | 待人工确认 |
| REC_ALIAS_0177 | (空) |  | 微信号与 REC_ALIAS_0138 一致; 小红书账号与 REC_ALIAS_0138 一致 | 待人工确认 |
| REC_ALIAS_0178 | (空) |  | 微信号与 REC_ALIAS_0139 一致; 小红书账号与 REC_ALIAS_0139 一致 | 待人工确认 |
| REC_ALIAS_0179 | (空) |  | 微信号与 REC_ALIAS_0140 一致; 小红书账号与 REC_ALIAS_0140 一致 | 待人工确认 |
| REC_ALIAS_0181 | (空) |  | 微信号与 REC_ALIAS_0142 一致; 小红书账号与 REC_ALIAS_0142 一致 | 待人工确认 |
| REC_ALIAS_0183 | (空) |  | 微信号与 REC_ALIAS_0144 一致; 小红书账号与 REC_ALIAS_0144 一致 | 待人工确认 |
| REC_ALIAS_0184 | (空) |  | 微信号与 REC_ALIAS_0145 一致; 小红书账号与 REC_ALIAS_0145 一致 | 待人工确认 |
| REC_ALIAS_0189 | (空) |  | 微信号与 REC_ALIAS_0150 一致; 小红书账号与 REC_ALIAS_0150 一致 | 待人工确认 |
| REC_ALIAS_0190 | (空) |  | 微信号与 REC_ALIAS_0151 一致; 小红书账号与 REC_ALIAS_0151 一致 | 待人工确认 |
| REC_ALIAS_0191 | (空) |  | 微信号与 REC_ALIAS_0152 一致; 小红书账号与 REC_ALIAS_0152 一致 | 待人工确认 |
| REC_ALIAS_0192 | (空) |  | 微信号与 REC_ALIAS_0113 一致; 小红书账号与 REC_ALIAS_0113 一致 | 待人工确认 |
| REC_ALIAS_0193 | (空) |  | 微信号与 REC_ALIAS_0114 一致; 小红书账号与 REC_ALIAS_0114 一致 | 待人工确认 |
| REC_ALIAS_0194 | (空) |  | 微信号与 REC_ALIAS_0115 一致; 小红书账号与 REC_ALIAS_0115 一致 | 待人工确认 |
| REC_ALIAS_0195 | (空) |  | 微信号与 REC_ALIAS_0116 一致; 小红书账号与 REC_ALIAS_0116 一致 | 待人工确认 |
| REC_ALIAS_0197 | (空) |  | 微信号与 REC_ALIAS_0118 一致; 小红书账号与 REC_ALIAS_0118 一致 | 待人工确认 |
| REC_ALIAS_0199 | (空) |  | 微信号与 REC_ALIAS_0096 一致; 小红书账号与 REC_ALIAS_0096 一致 | 待人工确认 |
| REC_ALIAS_0200 | (空) |  | 微信号与 REC_ALIAS_0099 一致; 小红书账号与 REC_ALIAS_0099 一致 | 待人工确认 |
| REC_ALIAS_0201 | MAKEUP_ALIAS_012 |  | 微信号与 REC_ALIAS_0196 一致; 小红书账号与 REC_ALIAS_0196 一致 | 待人工确认 |
| REC_ALIAS_0202 | MAKEUP_ALIAS_013 |  | 微信号与 REC_ALIAS_0198 一致; 小红书账号与 REC_ALIAS_0198 一致 | 待人工确认 |
| REC_ALIAS_0203 | ENTITY_ALIAS_050 |  | 微信号与 REC_ALIAS_0169 一致; 小红书账号与 REC_ALIAS_0169 一致 | 待人工确认 |
| REC_ALIAS_0204 | ENTITY_ALIAS_051 |  | 微信号与 REC_ALIAS_0173 一致; 小红书账号与 REC_ALIAS_0173 一致 | 待人工确认 |
| REC_ALIAS_0205 | ENTITY_ALIAS_052 |  | 微信号与 REC_ALIAS_0180 一致; 小红书账号与 REC_ALIAS_0180 一致 | 待人工确认 |
| REC_ALIAS_0206 | ENTITY_ALIAS_053 |  | 微信号与 REC_ALIAS_0182 一致; 小红书账号与 REC_ALIAS_0182 一致 | 待人工确认 |
| REC_ALIAS_0207 | ENTITY_ALIAS_054 |  | 微信号与 REC_ALIAS_0185 一致; 小红书账号与 REC_ALIAS_0185 一致 | 待人工确认 |
| REC_ALIAS_0208 | ENTITY_ALIAS_055 |  | 微信号与 REC_ALIAS_0186 一致; 小红书账号与 REC_ALIAS_0186 一致 | 待人工确认 |
| REC_ALIAS_0209 | ENTITY_ALIAS_056 |  | 微信号与 REC_ALIAS_0187 一致; 小红书账号与 REC_ALIAS_0187 一致 | 待人工确认 |
| REC_ALIAS_0210 | ENTITY_ALIAS_057 |  | 微信号与 REC_ALIAS_0188 一致; 小红书账号与 REC_ALIAS_0188 一致 | 待人工确认 |

### 6.3 模特重复候选

| record_id | 姓名 | 联系方式 | 证据 | 建议决策 |
|---|---|---|---|---|
| REC_ALIAS_0278 | (空) |  | 微信号与 REC_ALIAS_0211 一致; 小红书账号与 REC_ALIAS_0211 一致 | 待人工确认 |
| REC_ALIAS_0279 | (空) |  | 微信号与 REC_ALIAS_0215 一致; 小红书账号与 REC_ALIAS_0215 一致 | 待人工确认 |
| REC_ALIAS_0280 | (空) |  | 微信号与 REC_ALIAS_0245 一致; 小红书账号与 REC_ALIAS_0245 一致 | 待人工确认 |
| REC_ALIAS_0281 | (空) |  | 微信号与 REC_ALIAS_0247 一致; 小红书账号与 REC_ALIAS_0247 一致 | 待人工确认 |
| REC_ALIAS_0282 | (空) |  | 微信号与 REC_ALIAS_0250 一致; 小红书账号与 REC_ALIAS_0250 一致 | 待人工确认 |
| REC_ALIAS_0283 | (空) |  | 微信号与 REC_ALIAS_0251 一致; 小红书账号与 REC_ALIAS_0251 一致 | 待人工确认 |
| REC_ALIAS_0284 | (空) |  | 微信号与 REC_ALIAS_0253 一致; 小红书账号与 REC_ALIAS_0253 一致 | 待人工确认 |
| REC_ALIAS_0285 | (空) |  | 微信号与 REC_ALIAS_0255 一致; 小红书账号与 REC_ALIAS_0255 一致 | 待人工确认 |
| REC_ALIAS_0286 | (空) |  | 微信号与 REC_ALIAS_0256 一致; 小红书账号与 REC_ALIAS_0256 一致 | 待人工确认 |
| REC_ALIAS_0287 | (空) |  | 微信号与 REC_ALIAS_0257 一致; 小红书账号与 REC_ALIAS_0257 一致 | 待人工确认 |
| REC_ALIAS_0288 | (空) |  | 微信号与 REC_ALIAS_0234 一致; 小红书账号与 REC_ALIAS_0234 一致 | 待人工确认 |
| REC_ALIAS_0289 | (空) |  | 微信号与 REC_ALIAS_0266 一致; 小红书账号与 REC_ALIAS_0266 一致 | 待人工确认 |
| REC_ALIAS_0290 | (空) |  | 微信号与 REC_ALIAS_0267 一致; 小红书账号与 REC_ALIAS_0267 一致 | 待人工确认 |
| REC_ALIAS_0291 | (空) |  | 微信号与 REC_ALIAS_0269 一致; 小红书账号与 REC_ALIAS_0269 一致 | 待人工确认 |
| REC_ALIAS_0292 | (空) |  | 微信号与 REC_ALIAS_0270 一致; 小红书账号与 REC_ALIAS_0270 一致 | 待人工确认 |
| REC_ALIAS_0293 | (空) |  | 微信号与 REC_ALIAS_0271 一致; 小红书账号与 REC_ALIAS_0271 一致 | 待人工确认 |
| REC_ALIAS_0294 | (空) |  | 微信号与 REC_ALIAS_0272 一致; 小红书账号与 REC_ALIAS_0272 一致 | 待人工确认 |
| REC_ALIAS_0295 | (空) |  | 微信号与 REC_ALIAS_0273 一致; 小红书账号与 REC_ALIAS_0273 一致 | 待人工确认 |
| REC_ALIAS_0296 | (空) |  | 微信号与 REC_ALIAS_0274 一致; 小红书账号与 REC_ALIAS_0274 一致 | 待人工确认 |
| REC_ALIAS_0297 | (空) |  | 微信号与 REC_ALIAS_0275 一致; 小红书账号与 REC_ALIAS_0275 一致 | 待人工确认 |
| REC_ALIAS_0298 | (空) |  | 微信号与 REC_ALIAS_0276 一致; 小红书账号与 REC_ALIAS_0276 一致 | 待人工确认 |
| REC_ALIAS_0300 | (空) |  | 微信号与 REC_ALIAS_0241 一致; 小红书账号与 REC_ALIAS_0241 一致 | 待人工确认 |
| REC_ALIAS_0301 | (空) |  | 微信号与 REC_ALIAS_0242 一致; 小红书账号与 REC_ALIAS_0242 一致 | 待人工确认 |
| REC_ALIAS_0302 | (空) |  | 微信号与 REC_ALIAS_0243 一致; 小红书账号与 REC_ALIAS_0243 一致 | 待人工确认 |
| REC_ALIAS_0303 | (空) |  | 微信号与 REC_ALIAS_0246 一致; 小红书账号与 REC_ALIAS_0246 一致 | 待人工确认 |
| REC_ALIAS_0304 | (空) |  | 微信号与 REC_ALIAS_0248 一致; 小红书账号与 REC_ALIAS_0248 一致 | 待人工确认 |
| REC_ALIAS_0305 | (空) |  | 微信号与 REC_ALIAS_0249 一致; 小红书账号与 REC_ALIAS_0249 一致 | 待人工确认 |
| REC_ALIAS_0306 | (空) |  | 微信号与 REC_ALIAS_0252 一致; 小红书账号与 REC_ALIAS_0252 一致 | 待人工确认 |
| REC_ALIAS_0307 | (空) |  | 微信号与 REC_ALIAS_0254 一致; 小红书账号与 REC_ALIAS_0254 一致 | 待人工确认 |
| REC_ALIAS_0308 | (空) |  | 微信号与 REC_ALIAS_0258 一致; 小红书账号与 REC_ALIAS_0258 一致 | 待人工确认 |
| REC_ALIAS_0309 | (空) |  | 微信号与 REC_ALIAS_0259 一致; 小红书账号与 REC_ALIAS_0259 一致 | 待人工确认 |
| REC_ALIAS_0310 | (空) |  | 微信号与 REC_ALIAS_0231 一致; 小红书账号与 REC_ALIAS_0231 一致 | 待人工确认 |
| REC_ALIAS_0311 | (空) |  | 微信号与 REC_ALIAS_0262 一致; 小红书账号与 REC_ALIAS_0262 一致 | 待人工确认 |
| REC_ALIAS_0312 | (空) |  | 微信号与 REC_ALIAS_0264 一致; 小红书账号与 REC_ALIAS_0264 一致 | 待人工确认 |
| REC_ALIAS_0313 | (空) |  | 微信号与 REC_ALIAS_0237 一致; 小红书账号与 REC_ALIAS_0237 一致 | 待人工确认 |
| REC_ALIAS_0314 | (空) |  | 微信号与 REC_ALIAS_0268 一致; 小红书账号与 REC_ALIAS_0268 一致 | 待人工确认 |
| REC_ALIAS_0315 | (空) |  | 微信号与 REC_ALIAS_0277 一致; 小红书账号与 REC_ALIAS_0277 一致 | 待人工确认 |
| REC_ALIAS_0316 | MODEL_ALIAS_010 |  | 微信号与 REC_ALIAS_0299 一致; 小红书账号与 REC_ALIAS_0299 一致 | 待人工确认 |

## 7. 孤儿记录处理清单 (D-023)

| 类型 | 数量 | 处理规则 |
|---|---|---|
| 无关联项目的客户（可作为线索） | 2 | 有姓名+联系方式/来源/需求信息之一即可迁移为 Customer |
| 无关联客户且项目字段无客户信息 | 33 | BLOCKED：禁止创建未知客户占位，Pilot 排除 |
| 项目字段有客户信息但无法匹配 | 13 | NEEDS_REVIEW：需人工确认/创建对应 Customer 后再迁移 |

## 8. Migration Review Gate 结论

D-020~D-025 已确认，Schema 已升级为 v1.1，Dry Run 已按新规则重新执行。

### 是否满足 MIGRATION_PILOT_001 前置条件

❌ 不满足（客户 1/5，项目 1/5，模特 67/10，化妆师 66/10）

### 下一步

- 前置数量条件不足，停留在 Review Gate，不得从 NEEDS_REVIEW 中直接抽样写入
- 需人工处理 NEEDS_REVIEW 记录或补充数据后重新 Dry Run
- 迁移范围：5 个完整客户—项目组合、10 个模特、10 个化妆师
- 迁移前保存快照，迁移后逐字段对账
- 实现 batch 级 dry-run rollback 和 confirmed rollback

### 文件位置

- 原始导出（含隐私）：`backups/private/v1-raw-export-v1.1.json`（已 gitignore）
- 本报告：`reports/phase1b3-migration-review-gate.md`

