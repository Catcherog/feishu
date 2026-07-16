# Phase 1B-2 迁移预览报告 (Migration Review Gate)

> **生成时间**：2026-07-15T18:27:48.127Z
> **源 Base**：旧业务中台 (SOURCE_BASE_ALIAS)
> **目标 Base**：V2 Pilot (TARGET_V2_BASE_ALIAS)
> **模式**：只读 Dry Run（不写 V2）
> **状态**：⏸ Migration Review Gate — 等待人工确认

## 1. 汇总

| 表 | 总记录数 | MIGRATABLE | NEEDS_REVIEW | BLOCKED | SKIP |
|---|---|---|---|---|---|
| 客户 (Clients) | 36 | 0 | 13 | 23 | 0 |
| 项目 (Projects) | 47 | 0 | 22 | 25 | 0 |
| 化妆师 (Makeup) | 115 | 76 | 0 | 39 | 0 |
| 模特 (Model) | 106 | 61 | 7 | 38 | 0 |

## 2. 字段映射

### 2.1 客户 (Clients → Customer)

| 旧字段 | V2 字段 | 映射方式 | 备注 |
|---|---|---|---|
| 客户姓名 | customer_name | 直接映射 | |
| 联系方式 | phone | 直接映射 | |
| 来源渠道 | source_channel | 枚举映射 | 见状态映射表 |
| 客户状态 | relationship_status | 枚举映射 | 见状态映射表 |
| 意向风格 | preferred_style | 枚举映射 | 需确认 V2 风格标签 |
| 预算区间 | budget_min / budget_max | 范围拆分 | 旧为 select 区间，新为 number |
| 拍摄类型 | service_type | 枚举映射 | 见状态映射表 |
| 跟进人 | followup_owner | 直接映射 | user 类型 |
| 最后跟进时间 | last_followup_time | 直接映射 | |
| 跟进记录 | latest_summary | 直接映射 | |
| 备注 | notes | 直接映射 | |
| 关联项目 ID | (link) | 迁移后重建 | 需项目先迁移 |
| 客户 ID | customer_id | 重新生成 | V2 auto_number |
| 客户满意度 | (无) | 不迁移 | V2 无此字段 |
| 定金金额 / 成交金额 | (无) | 不迁移 | V2 无此字段，需扩展 |

### 2.2 项目 (Projects → Project)

| 旧字段 | V2 字段 | 映射方式 | 备注 |
|---|---|---|---|
| 项目名称 | project_name | 直接映射 | |
| 项目状态 | project_status | 枚举映射 | 见状态映射表 |
| 关联客户 | customer_link | 迁移后重建 | 需客户先迁移 |
| 项目类型 | project_type | 枚举映射 | |

### 2.3 化妆师/模特 (Makeup/Model → Resource)

| 旧字段 | V2 字段 | 映射方式 | 备注 |
|---|---|---|---|
| 姓名 (化妆师) / 艺名/昵称 (模特) | resource_name | 直接映射 | 字段名不同，需按表类型取值 |
| 微信号 / 联系方式 | contact | 直接映射 | 旧表无统一联系方式字段 |
| 合作状态 | cooperation_status | 枚举映射 | |
| 优先级 | priority | 枚举映射 | S/A/B/待评估 |
| 所在地 | city | 直接映射 | |
| 擅长风格 (化妆师) | style_tags | 枚举映射 | |
| 妆造报价 / 报价 | price_min / price_max | 直接映射 | |
| 作品链接 / 小红书链接 | portfolio_url | 直接映射 | |
| (表名) | resource_type | 固定值 | 化妆师→化妆师, 模特→模特 |

## 3. 状态映射

### 3.1 客户状态映射

| 旧状态 | V2 状态 | 备注 |
|---|---|---|
| 待跟进 | 新线索 | 需确认 |
| 跟进中 | 跟进中 | 直接映射 |
| 已报价 | 已确认需求 | 需确认 |
| 已付定金 | 待定金 | 需确认 |
| 待拍摄 | 服务中 | 需确认 |
| 已拍摄 | 服务中 | 需确认 |
| 拍摄完成 | 服务中 | 需确认 |
| 待交付 | 服务中 | 需确认 |
| 已交付 | 已完成 | 需确认 |
| 已流失 | 已流失 | 直接映射 |

**注意**：旧状态 "已拍摄" 和 "拍摄完成" 均映射到 "服务中"，需人工确认是否准确。

### 3.2 项目状态映射

| 旧状态 | V2 状态 | 备注 |
|---|---|---|
| 草稿 | 草稿 | 直接映射 |
| 策划中 | 策划中 | 直接映射 |
| 策划已批准 | 策划已批准 | 直接映射 |
| 资源确认中 | 资源确认中 | 直接映射 |
| 待拍摄 | 待拍摄 | 直接映射 |
| 拍摄完成 | 拍摄完成 | 直接映射 |
| 后期制作 | 后期制作 | 直接映射 |
| 客户确认 | 客户确认 | 直接映射 |
| 已交付 | 已交付 | 直接映射 |
| 已归档 | 已归档 | 直接映射 |

### 3.3 来源渠道映射

| 旧渠道 | V2 渠道 | 备注 |
|---|---|---|
| 小红书 | 小红书 | 直接映射 |
| 抖音 | 其他 | 聚合到其他 |
| 视频号 | 其他 | 聚合到其他 |
| 朋友圈 | 其他 | 聚合到其他 |
| 老客转介绍 | 转介绍 | 聚合到其他 |
| 线下 | 其他 | 聚合到其他 |
| 其他 | 其他 | 直接映射 |

## 4. 记录分类详情

### 4.1 客户分类

| record_id | 姓名 | 电话 | 旧状态 | V2状态 | 有关联项目 | 分类 | 问题 |
|---|---|---|---|---|---|---|---|
| REC_ALIAS_0013 | ENTITY_ALIAS_001 |  | 已拍摄 | 服务中 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0014 | PROJECT_ALIAS_001 |  | 已报价 | 已确认需求 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0015 | PROJECT_ALIAS_002 |  | 已报价 | 已确认需求 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0016 | PROJECT_ALIAS_003 |  | 已报价 | 已确认需求 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0017 | PROJECT_ALIAS_004 |  | 已报价 | 已确认需求 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0018 | PROJECT_ALIAS_005 |  | 已报价 | 已确认需求 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0019 | PROJECT_ALIAS_006 |  | 已报价 | 已确认需求 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0020 | PROJECT_ALIAS_007 |  | 已拍摄 | 服务中 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0021 | PROJECT_ALIAS_008 |  | 已报价 | 已确认需求 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0022 | 苏 |  | 已流失 | 已流失 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0023 | PROJECT_ALIAS_009 |  | 已流失 | 已流失 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0024 | PROJECT_ALIAS_010 |  | 已报价 | 已确认需求 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0025 | 🦔 |  | 已报价 | 已确认需求 | 否 | NEEDS_REVIEW | 无关联项目 |
| REC_ALIAS_0026 | (空) |  | 已流失 | 已流失 | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0027 | (空) |  | 已流失 | 已流失 | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0028 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0029 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0030 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0031 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0032 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0033 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0034 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0035 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0036 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0037 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0038 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0039 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0040 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0041 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0042 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0043 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0044 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0045 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0046 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0047 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |
| REC_ALIAS_0048 | (空) |  |  |  | 否 | BLOCKED | 客户姓名为空; 无关联项目 |

### 4.2 项目分类

| record_id | 名称 | 旧状态 | V2状态 | 有关联客户 | 分类 | 问题 |
|---|---|---|---|---|---|---|
| REC_ALIAS_0049 | ENTITY_ALIAS_002 | 已归档 | 已归档 | 否 | NEEDS_REVIEW | 无关联客户 |
| REC_ALIAS_0050 | CUSTOMER_ALIAS_001 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0051 | CUSTOMER_ALIAS_002 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0052 | CUSTOMER_ALIAS_003 | 已完成 |  | 否 | NEEDS_REVIEW | 项目状态 "已完成" 无映射; 无关联客户 |
| REC_ALIAS_0053 | CUSTOMER_ALIAS_004 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0054 | CUSTOMER_ALIAS_005 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0055 | CUSTOMER_ALIAS_006 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0056 | CUSTOMER_ALIAS_007 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0057 | CUSTOMER_ALIAS_008 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0058 | CUSTOMER_ALIAS_009 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0059 | CUSTOMER_ALIAS_010 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0060 | CUSTOMER_ALIAS_011 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0061 | CUSTOMER_ALIAS_012 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0062 | CUSTOMER_ALIAS_013 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0063 | CUSTOMER_ALIAS_014 | 待立项 |  | 否 | NEEDS_REVIEW | 项目状态 "待立项" 无映射; 无关联客户 |
| REC_ALIAS_0064 | CUSTOMER_ALIAS_015 | 已完成 |  | 否 | NEEDS_REVIEW | 项目状态 "已完成" 无映射; 无关联客户 |
| REC_ALIAS_0065 | CUSTOMER_ALIAS_016 | 已完成 |  | 否 | NEEDS_REVIEW | 项目状态 "已完成" 无映射; 无关联客户 |
| REC_ALIAS_0066 | CUSTOMER_ALIAS_017 | 已完成 |  | 否 | NEEDS_REVIEW | 项目状态 "已完成" 无映射; 无关联客户 |
| REC_ALIAS_0067 | CUSTOMER_ALIAS_018 | 已完成 |  | 否 | NEEDS_REVIEW | 项目状态 "已完成" 无映射; 无关联客户 |
| REC_ALIAS_0068 | CUSTOMER_ALIAS_019 | 已完成 |  | 否 | NEEDS_REVIEW | 项目状态 "已完成" 无映射; 无关联客户 |
| REC_ALIAS_0069 | CUSTOMER_ALIAS_020 | 已完成 |  | 否 | NEEDS_REVIEW | 项目状态 "已完成" 无映射; 无关联客户 |
| REC_ALIAS_0070 | CUSTOMER_ALIAS_021 | 已完成 |  | 否 | NEEDS_REVIEW | 项目状态 "已完成" 无映射; 无关联客户 |
| REC_ALIAS_0071 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0072 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0073 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0074 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0075 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0076 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0077 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0078 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0079 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0080 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0081 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0082 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0083 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0084 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0085 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0086 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0087 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0088 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0089 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0090 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0091 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0092 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0093 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0094 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |
| REC_ALIAS_0095 | (空) |  |  | 否 | BLOCKED | 项目名称为空; 无关联客户 |

### 4.3 化妆师分类

| record_id | 姓名 | 分类 | 问题 |
|---|---|---|---|
| REC_ALIAS_0096 | ENTITY_ALIAS_003 | MIGRATABLE |  |
| REC_ALIAS_0097 | ENTITY_ALIAS_004 | MIGRATABLE |  |
| REC_ALIAS_0098 | ENTITY_ALIAS_005 | MIGRATABLE |  |
| REC_ALIAS_0099 | ENTITY_ALIAS_006 | MIGRATABLE |  |
| REC_ALIAS_0100 | ENTITY_ALIAS_007 | MIGRATABLE |  |
| REC_ALIAS_0101 | ENTITY_ALIAS_008 | MIGRATABLE |  |
| REC_ALIAS_0102 | ENTITY_ALIAS_009 | MIGRATABLE |  |
| REC_ALIAS_0103 | 虞 | MIGRATABLE |  |
| REC_ALIAS_0104 | ENTITY_ALIAS_010 | MIGRATABLE |  |
| REC_ALIAS_0105 | :-* | MIGRATABLE |  |
| REC_ALIAS_0106 | ENTITY_ALIAS_011 | MIGRATABLE |  |
| REC_ALIAS_0107 | MAKEUP_ALIAS_001 | MIGRATABLE |  |
| REC_ALIAS_0108 | MAKEUP_ALIAS_002 | MIGRATABLE |  |
| REC_ALIAS_0109 | ENTITY_ALIAS_012 | MIGRATABLE |  |
| REC_ALIAS_0110 | ENTITY_ALIAS_013 | MIGRATABLE |  |
| REC_ALIAS_0111 | ENTITY_ALIAS_014 | MIGRATABLE |  |
| REC_ALIAS_0112 | ENTITY_ALIAS_015 | MIGRATABLE |  |
| REC_ALIAS_0113 | MAKEUP_ALIAS_003 | MIGRATABLE |  |
| REC_ALIAS_0114 | MAKEUP_ALIAS_004 | MIGRATABLE |  |
| REC_ALIAS_0115 | MAKEUP_ALIAS_005 | MIGRATABLE |  |
| REC_ALIAS_0116 | ENTITY_ALIAS_016 | MIGRATABLE |  |
| REC_ALIAS_0117 | / | MIGRATABLE |  |
| REC_ALIAS_0118 | ENTITY_ALIAS_017 | MIGRATABLE |  |
| REC_ALIAS_0119 | ENTITY_ALIAS_097 | MIGRATABLE |  |
| REC_ALIAS_0120 | ENTITY_ALIAS_019 | MIGRATABLE |  |
| REC_ALIAS_0121 | MAKEUP_ALIAS_006 | MIGRATABLE |  |
| REC_ALIAS_0122 | ENTITY_ALIAS_020 | MIGRATABLE |  |
| REC_ALIAS_0123 | ENTITY_ALIAS_021 | MIGRATABLE |  |
| REC_ALIAS_0124 | ENTITY_ALIAS_022 | MIGRATABLE |  |
| REC_ALIAS_0125 | ENTITY_ALIAS_023 | MIGRATABLE |  |
| REC_ALIAS_0126 | ENTITY_ALIAS_098 | MIGRATABLE |  |
| REC_ALIAS_0127 | ENTITY_ALIAS_025 | MIGRATABLE |  |
| REC_ALIAS_0128 | ENTITY_ALIAS_099 | MIGRATABLE |  |
| REC_ALIAS_0129 | ENTITY_ALIAS_100 | MIGRATABLE |  |
| REC_ALIAS_0130 | ENTITY_ALIAS_101 | MIGRATABLE |  |
| REC_ALIAS_0131 | ENTITY_ALIAS_102 | MIGRATABLE |  |
| REC_ALIAS_0132 | ENTITY_ALIAS_103 | MIGRATABLE |  |
| REC_ALIAS_0133 | ENTITY_ALIAS_104 | MIGRATABLE |  |
| REC_ALIAS_0134 | MAKEUP_ALIAS_014 | MIGRATABLE |  |
| REC_ALIAS_0135 | ENTITY_ALIAS_027 | MIGRATABLE |  |
| REC_ALIAS_0136 | ENTITY_ALIAS_028 | MIGRATABLE |  |
| REC_ALIAS_0137 | ENTITY_ALIAS_029 | MIGRATABLE |  |
| REC_ALIAS_0138 | ENTITY_ALIAS_030 | MIGRATABLE |  |
| REC_ALIAS_0139 | MAKEUP_ALIAS_008 | MIGRATABLE |  |
| REC_ALIAS_0140 | ENTITY_ALIAS_031 | MIGRATABLE |  |
| REC_ALIAS_0141 | ENTITY_ALIAS_105 | MIGRATABLE |  |
| REC_ALIAS_0142 | ENTITY_ALIAS_033 | MIGRATABLE |  |
| REC_ALIAS_0143 | ENTITY_ALIAS_106 | MIGRATABLE |  |
| REC_ALIAS_0144 | ENTITY_ALIAS_035 | MIGRATABLE |  |
| REC_ALIAS_0145 | ENTITY_ALIAS_036 | MIGRATABLE |  |
| REC_ALIAS_0146 | ENTITY_ALIAS_107 | MIGRATABLE |  |
| REC_ALIAS_0147 | ENTITY_ALIAS_108 | MIGRATABLE |  |
| REC_ALIAS_0148 | ENTITY_ALIAS_109 | MIGRATABLE |  |
| REC_ALIAS_0149 | ENTITY_ALIAS_110 | MIGRATABLE |  |
| REC_ALIAS_0150 | ENTITY_ALIAS_041 | MIGRATABLE |  |
| REC_ALIAS_0151 | ENTITY_ALIAS_042 | MIGRATABLE |  |
| REC_ALIAS_0152 | ENTITY_ALIAS_043 | MIGRATABLE |  |
| REC_ALIAS_0153 | ENTITY_ALIAS_111 | MIGRATABLE |  |
| REC_ALIAS_0154 | ENTITY_ALIAS_112 | MIGRATABLE |  |
| REC_ALIAS_0155 | MAKEUP_ALIAS_015 | MIGRATABLE |  |
| REC_ALIAS_0156 | MAKEUP_ALIAS_016 | MIGRATABLE |  |
| REC_ALIAS_0157 | ENTITY_ALIAS_113 | MIGRATABLE |  |
| REC_ALIAS_0158 | ENTITY_ALIAS_114 | MIGRATABLE |  |
| REC_ALIAS_0159 | MAKEUP_ALIAS_017 | MIGRATABLE |  |
| REC_ALIAS_0160 | ENTITY_ALIAS_115 | MIGRATABLE |  |
| REC_ALIAS_0161 | ENTITY_ALIAS_049 | MIGRATABLE |  |
| REC_ALIAS_0162 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0163 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0164 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0165 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0166 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0167 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0168 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0169 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0170 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0171 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0172 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0173 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0174 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0175 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0176 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0177 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0178 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0179 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0180 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0181 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0182 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0183 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0184 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0185 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0186 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0187 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0188 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0189 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0190 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0191 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0192 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0193 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0194 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0195 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0196 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0197 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0198 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0199 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0200 | (空) | BLOCKED | 化妆师名称为空 |
| REC_ALIAS_0201 | MAKEUP_ALIAS_012 | MIGRATABLE |  |
| REC_ALIAS_0202 | MAKEUP_ALIAS_013 | MIGRATABLE |  |
| REC_ALIAS_0203 | ENTITY_ALIAS_050 | MIGRATABLE |  |
| REC_ALIAS_0204 | ENTITY_ALIAS_051 | MIGRATABLE |  |
| REC_ALIAS_0205 | ENTITY_ALIAS_052 | MIGRATABLE |  |
| REC_ALIAS_0206 | ENTITY_ALIAS_053 | MIGRATABLE |  |
| REC_ALIAS_0207 | ENTITY_ALIAS_054 | MIGRATABLE |  |
| REC_ALIAS_0208 | ENTITY_ALIAS_055 | MIGRATABLE |  |
| REC_ALIAS_0209 | ENTITY_ALIAS_056 | MIGRATABLE |  |
| REC_ALIAS_0210 | ENTITY_ALIAS_057 | MIGRATABLE |  |

### 4.4 模特分类

| record_id | 姓名 | 分类 | 问题 |
|---|---|---|---|
| REC_ALIAS_0211 | ENTITY_ALIAS_058 | MIGRATABLE |  |
| REC_ALIAS_0212 | ENTITY_ALIAS_059 | MIGRATABLE |  |
| REC_ALIAS_0213 | 易 | MIGRATABLE |  |
| REC_ALIAS_0214 | 11 | MIGRATABLE |  |
| REC_ALIAS_0215 | ENTITY_ALIAS_060 | MIGRATABLE |  |
| REC_ALIAS_0216 | ENTITY_ALIAS_061 | MIGRATABLE |  |
| REC_ALIAS_0217 | ENTITY_ALIAS_062 | MIGRATABLE |  |
| REC_ALIAS_0218 | 喏 | MIGRATABLE |  |
| REC_ALIAS_0219 | L | MIGRATABLE |  |
| REC_ALIAS_0220 | ENTITY_ALIAS_063 | MIGRATABLE |  |
| REC_ALIAS_0221 | ENTITY_ALIAS_064 | MIGRATABLE |  |
| REC_ALIAS_0222 | ENTITY_ALIAS_065 | MIGRATABLE |  |
| REC_ALIAS_0223 | 呱 | MIGRATABLE |  |
| REC_ALIAS_0224 | 然 北京模特
jyrty1112 | MIGRATABLE |  |
| REC_ALIAS_0225 | ENTITY_ALIAS_066 | MIGRATABLE |  |
| REC_ALIAS_0226 | MODEL_ALIAS_001 | MIGRATABLE |  |
| REC_ALIAS_0227 | 王佳琪
haodENTITY_ALIAS_008xiaowangya | MIGRATABLE |  |
| REC_ALIAS_0228 | ENTITY_ALIAS_067 | MIGRATABLE |  |
| REC_ALIAS_0229 | 开心超人
n3238346542 | MIGRATABLE |  |
| REC_ALIAS_0230 | ENTITY_ALIAS_068 | MIGRATABLE |  |
| REC_ALIAS_0231 | ENTITY_ALIAS_069 | MIGRATABLE |  |
| REC_ALIAS_0232 | ENTITY_ALIAS_042 | MIGRATABLE |  |
| REC_ALIAS_0233 | ENTITY_ALIAS_070 | MIGRATABLE |  |
| REC_ALIAS_0234 | ENTITY_ALIAS_071 | MIGRATABLE |  |
| REC_ALIAS_0235 | ENTITY_ALIAS_072 | MIGRATABLE |  |
| REC_ALIAS_0236 | 喏 | NEEDS_REVIEW | 存在同名模特: REC_ALIAS_0218 |
| REC_ALIAS_0237 | MODEL_ALIAS_002 | MIGRATABLE |  |
| REC_ALIAS_0238 | ENTITY_ALIAS_073 | MIGRATABLE |  |
| REC_ALIAS_0239 | ENTITY_ALIAS_074 | MIGRATABLE |  |
| REC_ALIAS_0240 | ENTITY_ALIAS_058 | NEEDS_REVIEW | 存在同名模特: REC_ALIAS_0211 |
| REC_ALIAS_0241 | MODEL_ALIAS_003 | MIGRATABLE |  |
| REC_ALIAS_0242 | ENTITY_ALIAS_075 | MIGRATABLE |  |
| REC_ALIAS_0243 | 011 | MIGRATABLE |  |
| REC_ALIAS_0244 | ENTITY_ALIAS_060 | NEEDS_REVIEW | 存在同名模特: REC_ALIAS_0215 |
| REC_ALIAS_0245 | MODEL_ALIAS_004 | MIGRATABLE |  |
| REC_ALIAS_0246 | ENTITY_ALIAS_076 | MIGRATABLE |  |
| REC_ALIAS_0247 | / | MIGRATABLE |  |
| REC_ALIAS_0248 | ENTITY_ALIAS_077 | MIGRATABLE |  |
| REC_ALIAS_0249 | MODEL_ALIAS_005 | MIGRATABLE |  |
| REC_ALIAS_0250 | ENTITY_ALIAS_078 | MIGRATABLE |  |
| REC_ALIAS_0251 | ENTITY_ALIAS_079 | MIGRATABLE |  |
| REC_ALIAS_0252 | ENTITY_ALIAS_080 | MIGRATABLE |  |
| REC_ALIAS_0253 | ENTITY_ALIAS_081 | MIGRATABLE |  |
| REC_ALIAS_0254 | 23 | MIGRATABLE |  |
| REC_ALIAS_0255 | ENTITY_ALIAS_082 | MIGRATABLE |  |
| REC_ALIAS_0256 | ENTITY_ALIAS_083 | MIGRATABLE |  |
| REC_ALIAS_0257 | ENTITY_ALIAS_084 | MIGRATABLE |  |
| REC_ALIAS_0258 | ENTITY_ALIAS_085 | MIGRATABLE |  |
| REC_ALIAS_0259 | ENTITY_ALIAS_086 | MIGRATABLE |  |
| REC_ALIAS_0260 | / | NEEDS_REVIEW | 存在同名模特: REC_ALIAS_0247 |
| REC_ALIAS_0261 | ENTITY_ALIAS_069 | NEEDS_REVIEW | 存在同名模特: REC_ALIAS_0231 |
| REC_ALIAS_0262 | MODEL_ALIAS_006 | MIGRATABLE |  |
| REC_ALIAS_0263 | ENTITY_ALIAS_071 | NEEDS_REVIEW | 存在同名模特: REC_ALIAS_0234 |
| REC_ALIAS_0264 | MODEL_ALIAS_007 | MIGRATABLE |  |
| REC_ALIAS_0265 | MODEL_ALIAS_002 | NEEDS_REVIEW | 存在同名模特: REC_ALIAS_0237 |
| REC_ALIAS_0266 | MODEL_ALIAS_008 | MIGRATABLE |  |
| REC_ALIAS_0267 | ENTITY_ALIAS_087 | MIGRATABLE |  |
| REC_ALIAS_0268 | ENTITY_ALIAS_088 | MIGRATABLE |  |
| REC_ALIAS_0269 | ENTITY_ALIAS_089 | MIGRATABLE |  |
| REC_ALIAS_0270 | ENTITY_ALIAS_090 | MIGRATABLE |  |
| REC_ALIAS_0271 | ENTITY_ALIAS_091 | MIGRATABLE |  |
| REC_ALIAS_0272 | ENTITY_ALIAS_092 | MIGRATABLE |  |
| REC_ALIAS_0273 | ENTITY_ALIAS_093 | MIGRATABLE |  |
| REC_ALIAS_0274 | MODEL_ALIAS_009 | MIGRATABLE |  |
| REC_ALIAS_0275 | ENTITY_ALIAS_094 | MIGRATABLE |  |
| REC_ALIAS_0276 | ENTITY_ALIAS_095 | MIGRATABLE |  |
| REC_ALIAS_0277 | ENTITY_ALIAS_096 | MIGRATABLE |  |
| REC_ALIAS_0278 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0279 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0280 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0281 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0282 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0283 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0284 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0285 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0286 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0287 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0288 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0289 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0290 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0291 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0292 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0293 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0294 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0295 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0296 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0297 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0298 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0299 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0300 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0301 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0302 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0303 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0304 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0305 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0306 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0307 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0308 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0309 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0310 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0311 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0312 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0313 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0314 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0315 | (空) | BLOCKED | 模特名称为空 |
| REC_ALIAS_0316 | MODEL_ALIAS_010 | MIGRATABLE |  |

## 5. 问题汇总

| 问题类型 | 数量 | 严重度 | 说明 |
|---|---|---|---|
| orphan | 83 | NEEDS_REVIEW | 无关联项目 |
| missing_name | 125 | BLOCKED | 客户姓名为空 |
| illegal_enum | 21 | NEEDS_REVIEW | 项目状态 "待立项" 无映射 |
| duplicate_name | 7 | NEEDS_REVIEW | 存在同名模特 |

### 5.1 BLOCKED 原因分析

> 以下 BLOCKED 记录均已确认为旧表中关键字段（名称）真实为空，并非字段映射问题。

| 表 | 总数 | BLOCKED | 空名称字段 | 说明 |
|---|---|---|---|---|
| 客户 | 36 | 23 | 客户姓名 | 旧表存在大量测试或废弃空记录 |
| 项目 | 47 | 25 | 项目名称 | 旧表存在大量测试或废弃空记录 |
| 化妆师 | 115 | 39 | 姓名 | 旧表存在大量测试或废弃空记录 |
| 模特 | 106 | 38 | 艺名/昵称 | 旧表存在大量测试或废弃空记录 |

**建议处理方式**：BLOCKED 记录不迁移至 V2，仅记录在 `reports/private/` 下供人工核查。如确需迁移，需人工补全名称字段后再处理。

## 6. 重复候选

> **重要**：客户和资源仅名称相同不得自动合并。以下为候选列表，需人工逐条确认。

### 6.1 客户重复候选

无重复候选。

### 6.2 化妆师重复候选

无重复候选。

### 6.3 模特重复候选

| record_id | 姓名 | 问题 |
|---|---|---|
| REC_ALIAS_0236 | 喏 | 存在同名模特: REC_ALIAS_0218 |
| REC_ALIAS_0240 | ENTITY_ALIAS_058 | 存在同名模特: REC_ALIAS_0211 |
| REC_ALIAS_0244 | ENTITY_ALIAS_060 | 存在同名模特: REC_ALIAS_0215 |
| REC_ALIAS_0260 | / | 存在同名模特: REC_ALIAS_0247 |
| REC_ALIAS_0261 | ENTITY_ALIAS_069 | 存在同名模特: REC_ALIAS_0231 |
| REC_ALIAS_0263 | ENTITY_ALIAS_071 | 存在同名模特: REC_ALIAS_0234 |
| REC_ALIAS_0265 | MODEL_ALIAS_002 | 存在同名模特: REC_ALIAS_0237 |

## 7. 孤儿记录

| 表 | 数量 | 说明 |
|---|---|---|
| 客户 | 36 | 无关联项目 |
| 项目 | 47 | 无关联客户 |

## 8. Migration Review Gate

### 状态：⏸ 等待人工确认

### 需要确认的事项：

1. **状态映射确认**：旧客户状态 "已拍摄"/"拍摄完成" 映射到 V2 "服务中" 是否准确？
2. **来源渠道聚合**：抖音/视频号/朋友圈 聚合到 "其他" 是否合理？还是需要扩展 V2 选项？
3. **重复候选处理**：上述重复候选需逐条确认是否为同一实体
4. **孤儿记录处理**：无关联项目的客户和无关联客户的项目是否需要迁移？
5. **缺失字段处理**：旧表的定金金额、成交金额、客户满意度等字段在 V2 中不存在，是否需要扩展 V2 schema？
6. **字段映射确认**：预算区间从 select 拆分为 budget_min/budget_max 的映射规则是否合理？

### 下一步

- 人工确认上述事项后，执行 Phase 1B-3 小批量真实数据试迁移
- 迁移范围：5 个客户、5 个项目、10 个模特、10 个化妆师
- 迁移前保存快照，迁移后逐字段对账
- 实现 batch 级 dry-run rollback 和 confirmed rollback

### 文件位置

- 原始导出（含隐私）：`backups/private/v1-raw-export.json`（已 gitignore）
- 本报告：`reports/phase1b2-migration-review-gate.md`

