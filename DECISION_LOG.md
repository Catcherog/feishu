# Decision Log

## D-009：feishu-v2 独立 Git 仓库建立

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 0 审计有条件通过，需要为 V2 项目建立独立版本控制，与 SOP 根目录和 zehuai-app 工作树隔离
- 可选方案：
  1. 在 SOP 根目录初始化 Git
  2. 复用 zehuai-app 的 Git remote
  3. 在 feishu-v2 子目录创建独立仓库
- 最终决策：方案 3 — 在 `D:\360Downloads\Trae 项目\SOP\feishu-v2` 创建独立 Git 仓库
- 原因：
  - 不污染 SOP 根目录
  - 不影响 zehuai-app 工作树
  - V2 项目有独立的版本控制需求
- 代价与风险：需要在 feishu-v2 目录单独管理 Git 历史
- 影响的表、代码和自动化：无（仅文档和配置仓库）
- 验证方式：Secret 扫描通过，本地 commit 成功
- 后续复审日期：Phase 1A Schema Review Gate 时

## D-010：不自动 push，等待用户配置 remote

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：feishu-v2 仓库已创建本地 commit，但 `FEISHU_V2_GIT_REMOTE` 环境变量和 `config/git-remote.local.txt` 均未配置
- 可选方案：
  1. 自动复用 zehuai-app 的 remote
  2. 等待用户配置新 remote
- 最终决策：方案 2 — 只完成本地 commit，不执行 push
- 原因：禁止自动复用 zehuai-app 的 remote，用户需显式配置 V2 专用 remote
- 代价与风险：代码仅存本地，需用户手动配置 remote 后 push
- 影响的表、代码和自动化：无
- 验证方式：输出本地 commit SHA
- 后续复审日期：用户配置 remote 后

## D-011：Phase 0.5 授权阻塞与处理方式

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 0.5 要求补全 12 条自动化执行历史、验证规则 #5 和 #12、备份用户级视图，但 lark-cli user 身份已过期（token missing），bot 身份无法读取 workflow 执行日志和视图配置
- 可选方案：
  1. 使用 bot 身份继续尝试（已确认 91403 权限错误，不可行）
  2. 等待用户完成 `lark-cli auth login` 后使用 user 身份继续
- 最终决策：方案 2 — 等待用户授权
- 原因：user 身份是读取 workflow 执行日志、视图配置和用户级数据的必要条件
- 代价与风险：Phase 0.5 进度受用户操作阻塞
- 影响的表、代码和自动化：旧自动化和旧 Base 保持只读，不修改
- 验证方式：lark-cli auth status --verify 返回 user identity: ready
- 后续复审日期：用户授权完成后立即执行

## D-012：Phase 1A Schema Review Gate 暂停

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 1A 要求先生成 10 张 V2 表完整 Schema、字段字典、状态机和视图规范，到 Schema Review Gate 后暂停等待确认
- 可选方案：
  1. 直接创建 Base 并写入 [TEST] 数据
  2. 生成 Schema 文档并提交到 Review Gate，等待用户确认后再创建 Base
- 最终决策：方案 2 — 生成 Schema 后暂停
- 原因：PROJECT_GUIDE.md 和 Phase 1A 明确要求在 Schema Review Gate 暂停，避免未确认结构就创建 Base
- 代价与风险：需要一次额外评审轮次
- 影响的表、代码和自动化：暂不创建任何 V2 表，不写入真实或合成数据
- 验证方式：Schema 文档通过 Secret 扫描和结构检查
- 后续复审日期：Schema Review Gate 用户确认后

## D-013：Phase 0.5 执行历史补全与验证结论

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：用户完成 `lark-cli auth login` 后，使用 user 身份读取了 V1 Base 的 12 条工作流定义、核心表记录、视图配置，并生成 Phase 0.5 执行历史报告
- 可选方案：
  1. 继续等待飞书暴露 workflow execution history API 后再补全
  2. 基于当前可获取的规则定义和记录快照生成推断报告，承认 API 限制
- 最终决策：方案 2 — 生成推断报告并公开关键结论
- 原因：
  - `lark-cli` 未提供 workflow execution history 命令（`+workflow-execution-list` 不存在）
  - 规则 #5 真实触发字段已验证为「客户状态」=「已付定金」，纠正了旧文档错误
  - 规则 #12 已验证配置存在但数据条件未命中，未触发
- 代价与风险：无法给出精确执行次数，只能给出潜在触发数和条件验证结论
- 影响的表、代码和自动化：
  - 旧自动化保持启用，未修改
  - 旧 Base 未修改
  - 完整数据备份存放于 `backups/private/`，不提交 Git
- 验证方式：
  - 12 条 workflow 配置备份完整
  - 核心表记录备份完整
  - 视图配置备份完整
  - `docs/phase05-execution-report.md` 公开版无敏感信息
- 后续复审日期：V2 迁移 Serverless 自动化设计时

## D-014：Phase 0.5 临时脚本处理

- 日期：2026-07-15
- 状态：PENDING
- 决策人：用户
- 背景：Phase 0.5 数据分析过程中产生了多个一次性调试脚本，已按 `_temp_script.md` 规则存放到 `src/scripts/temp/` 并添加 TEMP 标记
- 当前保留的临时脚本：
  - `src/scripts/temp/phase05_execution_report.py`：生成 Phase 0.5 报告
  - `src/scripts/temp/fix_json_v5.py`：修复备份 JSON 编码损坏
  - `src/scripts/temp/compute_counts.py`：计算工作流潜在触发数
- 已清理的脚本：多个中间调试版本（fix_json_v2/v3/v4.py、debug_*.py、inspect_*.py、test_*.py、decode_*.py 等）
- 可选方案：
  1. 删除全部临时脚本（Phase 0.5 已完成）
  2. 迁移到 `src/scripts/` 并移除 TEMP 标记，作为 V2 数据分析工具保留
- 最终决策：待用户确认
- 原因：脚本的未来价值取决于是否还需要对 V1 Base 进行类似分析
- 代价与风险：删除后若需复现报告需重新编写；保留会增加仓库体积
- 影响的表、代码和自动化：无
- 验证方式：用户确认后执行
- 后续复审日期：用户回复后

## D-015：Phase 1A Schema Review Gate 通过并批准创建 V2 Pilot Base

- 日期：2026-07-15
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 1A Schema Review Gate 已生成 [`docs/v2-base-schema.md`](file:///D:/360Downloads/Trae%20项目/SOP/feishu-v2/docs/v2-base-schema.md)，包含 10 张 V2 表的字段字典、状态机和视图规范
- 可选方案：
  1. 继续修改 Schema 后再创建 Base
  2. 按当前 Schema 创建飞书 Base `泽怀影像_业务中台_V2_PILOT`
- 最终决策：方案 2 — 按当前 Schema 创建 V2 Pilot Base
- 原因：用户已明确批准 Schema；PROJECT_GUIDE.md 和 Phase 1A 要求 Schema 确认后再创建 Base
- 限制条件：
  - 仅写入明确标记为 `[TEST]` 的合成数据
  - 不迁移真实客户和资源
  - 不修改 APP
  - 不部署正式自动化
  - 不自动进入下一阶段
- 代价与风险：创建 Base 后若 Schema 需要大幅调整，需重新建表或迁移字段
- 影响的表、代码和自动化：将在飞书新建 10 张 V2 表，不触碰 V1 旧表
- 验证方式：Base 创建后生成 `resource-map.local.json` 并核对 Table ID / Field ID
- 后续复审日期：Phase 1B 数据写入与验证完成后

## D-016：Phase 1A V2 Pilot Base 创建与 [TEST] 数据写入完成

- 日期：2026-07-15
- 状态：COMPLETED
- 决策人：用户 / AI 执行
- 背景：D-015 已批准按 Schema 创建 V2 Pilot Base，需实际建表、建字段、写入 [TEST] 合成数据并生成资源映射
- 执行结果：
  - 飞书 Base：`泽怀影像_业务中台_V2_PILOT`
  - Base token：`TARGET_V2_BASE_ALIAS`
  - 创建 10 张业务表：Customer、Project、Resource、Project_Resource_Assignment、Planning_Document、Task、AI_Inbox、Automation_Event、Data_Quality_Issue、System_Config
  - 写入 [TEST] 合成数据：
    - Customer：3 条
    - Project：3 条
    - Resource：4 条
    - Project_Resource_Assignment：2 条
    - Planning_Document：2 条
    - Task：3 条
    - AI_Inbox：1 条
    - Automation_Event：1 条
    - Data_Quality_Issue：1 条
    - System_Config：9 条
  - 生成 `config/resource-map.local.json`（含 Base token、Table ID、Field ID 映射）
- 限制条件遵守情况：
  - 所有记录名称/手机号/摘要均带 `[TEST]` 标记
  - 未迁移真实客户和资源
  - 未修改 APP
  - 未部署正式自动化
  - 未自动进入下一阶段
- 已知遗留问题：
  - 标题解析存在 3 个同名 Base（早期重试产生），当前脚本按 `+title-resolve` 首个结果复用完整 Base（token 见上）；其余 2 个仅含默认空表，建议后续在飞书界面手动删除或重命名以避免混淆
- 验证方式：
  - `+record-list` 确认各表记录数与预期一致
  - `resource-map.local.json` 中 Table ID / Field ID 与 `+field-list` / `+table-list` 返回一致    
- 后续复审日期：Phase 1B 数据写入与验证开始时

## D-017：Phase 1B-0 资源收尾与 Schema v1.0 固化

- 日期：2026-07-16
- 状态：COMPLETED
- 决策人：用户 / AI 执行
- 背景：Phase 1A 完成后进入 Phase 1B，需先完成 Git remote 配置、重名 Base 核查、Schema 固化
- 执行结果：
  - feishu-v2 配置独立 Git remote（`https://github.com/Catcherog/feishu.git`）
  - 干净提交推送到 GitHub
  - 核查重名 V2 Base，输出清单和创建时间，未删除任何 Base（遵守"不删除重名 Base，除非已完成人工确认"约束）
  - 固化 4 份 Schema 资产：
    - `schemas/v2-schema-v1.0.json`（Schema 源文件）
    - `schemas/v2-schema-v1.0.sha256`（完整性校验）
    - `docs/v2-field-dictionary.md`（字段字典）
    - `docs/v2-view-inventory.md`（视图清单）
  - 本地资源标识保留在 `config/resource-map.local.json`（已 gitignore）
- 验证方式：commit 312354f 推送成功，4 份资产文件存在且 hash 一致
- 后续复审日期：Phase 1B-3 Acceptance Gate 时

## D-018：Phase 1B-1 写入链路验证 — 47/47 PASS

- 日期：2026-07-16
- 状态：COMPLETED
- 决策人：AI 执行 / 用户复核
- 背景：需验证 V2 10 张表的完整 CRUD 链路、跨表关联、幂等性、错误处理和 AI_Inbox 生命周期
- 执行结果：
  - 对 10 张表（Customer、Project、Resource、Project_Resource_Assignment、Planning_Document、Task、AI_Inbox、Automation_Event、Data_Quality_Issue、System_Config）完成 CRUD 验证
  - 验证跨表关联（Project↔Customer、Assignment↔Project/Resource、Planning↔Project 等）
  - 所有写操作实现 `idempotency_key = source_record_id + event_type + rule_version`
  - 测试重复事件、429、网络中断、非法枚举、缺失字段、无效关联和部分成功
  - AI_Inbox 生命周期：pending → approved/modified/rejected → writeback 全链路通过
  - 所有写入操作记录到 Automation_Event
  - 测试数据全部使用 `[TEST]` 前缀
  - 最终结果：47/47 PASS（100%）
- 关键技术决策：
  - 使用 `+record-upsert`（单条）替代 `+record-batch-create`，避免批量格式复杂性
  - `+record-get` 需加 `--format json` 标志，返回 CSV 风格二维数组需重建 fields 映射
  - `+record-delete` 需 `--yes` 标志（high-risk-write）
  - `+record-upsert` 返回 `data.record.record_id_list[0]`（非 `record_id`）
  - 飞书平台允许创建空记录（auto_number 自动生成），数据校验需在应用层实现
- 输出：`reports/phase1b-write-path-test-report.md`（commit bb87d63）
- 验证方式：测试脚本运行通过，所有 [TEST] 记录已清理
- 后续复审日期：Phase 1B-3 Acceptance Gate 时

## D-019：Phase 1B-2 只读迁移 Dry Run — Migration Review Gate 暂停

- 日期：2026-07-16
- 状态：PAUSED（等待人工确认）
- 决策人：AI 执行 / 用户待确认
- 背景：需以只读方式读取旧 Base 的客户、项目、化妆师、模特，生成迁移预览报告
- 执行结果：
  - 只读取旧 Base 4 张表，未写 V2
  - 生成完整迁移预览：字段映射、状态映射、重复候选、孤儿记录、非法枚举、缺失字段
  - 客户和资源仅名称相同未自动合并
  - 原始导出和隐私数据存入 `backups/private/`（已 gitignore）
  - 每条核心记录给出分类：MIGRATABLE / NEEDS_REVIEW / BLOCKED / SKIP
  - 最终分类统计（MIGRATABLE / NEEDS_REVIEW / BLOCKED / SKIP）：
    - 客户：0 / 13 / 23 / 0（总 36 条）
    - 项目：0 / 22 / 25 / 0（总 47 条）
    - 化妆师：76 / 0 / 39 / 0（总 115 条）
    - 模特：61 / 7 / 38 / 0（总 106 条）
- 关键发现：
  - 旧表存在大量名称为空的测试/废弃记录（客户 23、项目 25、化妆师 39、模特 38），这些 BLOCKED 记录已确认为真实空值，非字段映射问题
  - 模特表使用 "艺名/昵称" 字段（非 "姓名"），初始脚本不匹配导致 106 条全部 BLOCKED；修正后 61 条 MIGRATABLE
  - 项目表使用 "关联客户 ID" 字段（非 "关联客户"），初始脚本不匹配导致全部误判为孤儿
  - 旧项目存在 "待立项" 和 "已完成" 状态，在 V2 项目状态机中无映射，需人工确认映射规则
  - 旧客户 "已拍摄"/"拍摄完成" 状态在 V2 中均映射到 "服务中"，需人工确认
  - 旧来源渠道 "抖音"/"视频号"/"朋友圈" 聚合到 V2 "其他"，需确认是否合理
- 输出：`reports/phase1b2-migration-review-gate.md`（commit f655d95）
- 暂停状态：⏸ Migration Review Gate — 等待人工确认以下事项：
  1. 状态映射确认（已拍摄/拍摄完成 → 服务中；待立项/已完成 → ?）
  2. 来源渠道聚合确认（抖音/视频号/朋友圈 → 其他）
  3. 重复候选逐条确认
  4. 孤儿记录处理（无关联项目的客户、无关联客户的项目）
  5. 缺失字段处理（定金金额、成交金额、客户满意度等 V2 无对应字段）
  6. 预算区间拆分规则确认
- 后续复审日期：用户确认后进入 Phase 1B-3 小批量试迁移

## D-020：客户状态与项目状态映射规则 v1.0

- 日期：2026-07-16
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 1B-2 Dry Run 发现旧客户 `已拍摄` / `拍摄完成` 以及旧项目 `待立项` / `已完成` 在 V2 状态机中无明确映射，需人工确认规则
- 可选方案：
  1. 旧客户 `已拍摄` / `拍摄完成` 无条件映射为 V2 `服务中`
  2. 按关联项目交付/归档情况区分映射为 `服务中`、`已完成` 或 `NEEDS_REVIEW`
- 最终决策：方案 2 — 按关联项目状态推断客户关系状态
- 原因：客户关系状态不得简单复制项目状态，必须基于业务事实
- 客户状态规则：
  - 存在未交付或未归档的有效关联项目 → `服务中`
  - 所有关联项目均已交付或已归档 → `已完成`
  - 没有关联项目或项目状态无法判断 → `NEEDS_REVIEW`
- 项目状态规则：
  - 旧 `待立项` → V2 `草稿`
  - 旧 `已完成`：
    - 有交付日期、交付附件或明确交付证据 → `已交付`
    - 同时存在归档或复盘完成证据 → `已归档`
    - 无法证明交付 → `NEEDS_REVIEW`
- 保留字段：`legacy_status_raw`、`status_mapping_rule_version = status-map-v1.0`
- 代价与风险：需要读取并判断关联项目状态，Dry Run 复杂度提高；规则版本需在迁移记录中保留以便追溯
- 影响的表、代码和自动化：Customer、Project 表迁移规则；Dry Run 脚本需增加关联分析逻辑
- 验证方式：重新执行 Dry Run 后，检查 MIGRATABLE/NEEDS_REVIEW/BLOCKED 分布合理
- 后续复审日期：Phase 1B-3 Acceptance Gate

## D-021：来源渠道映射规则 source-map-v1.0

- 日期：2026-07-16
- 状态：APPROVED
- 决策人：用户
- 背景：旧来源渠道包含抖音、视频号、朋友圈等，Phase 1B-2 Dry Run 将其聚合为 `其他`，可能丢失渠道事实
- 可选方案：
  1. 抖音/视频号/朋友圈合并为 `其他`
  2. 扩展 V2 `source_channel` 选项，保留所有历史来源
- 最终决策：方案 2 — 扩展 source_channel 选项
- 原因：不丢弃原始业务事实，同时保留原始文本便于追溯
- V2 来源渠道选项：
  - 小红书
  - 抖音
  - 视频号
  - 朋友圈
  - 微信公众号
  - 微信私聊
  - 官网
  - 小程序
  - 转介绍
  - 线下活动
  - 其他
  - 未知
- 保留字段：`source_channel_raw`、`source_channel_mapping_version = source-map-v1.0`
- 代价与风险：V2 Schema 需更新 select 选项；无法识别的旧值映射为 `其他` 或 `未知`，需人工复核
- 影响的表、代码和自动化：Customer 表 source_channel 字段；迁移规则脚本
- 验证方式：Dry Run 统计各来源渠道映射分布，确认无丢失原始值
- 后续复审日期：Phase 1B-3 Acceptance Gate

## D-022：重复候选人工决策规则

- 日期：2026-07-16
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 1B-2 Dry Run 发现客户和资源存在潜在重复，需明确是否合并及如何决策
- 可选方案：
  1. 按手机号/微信号/作品链接自动合并重复记录
  2. 任何重复候选不得自动合并，仅生成人工审核清单
- 最终决策：方案 2 — 禁止自动合并，采用人工决策值
- 原因：避免误合并导致客户或资源历史丢失，保证数据所有权清晰
- 新增决策值：
  - `SAME_ENTITY`
  - `DISTINCT_ENTITY`
  - `UNRESOLVED`
- 规则：
  - 客户：手机号完全一致或微信号完全一致可标记为高概率候选，但仍需人工确认
  - 资源：联系方式、社交账号或作品链接完全一致可标记为高概率候选，但仍需人工确认
  - `UNRESOLVED` 记录不得进入 Pilot
  - 不修改或删除旧 Base 中的重复记录
  - V2 中保留全部 `legacy_record_id`，并记录 `canonical_business_id`
- 代价与风险：增加人工审核工作量；Pilot 样本需排除未解决重复候选
- 影响的表、代码和自动化：Customer、Resource 表迁移；需新增重复候选清单生成逻辑
- 验证方式：输出重复候选清单，逐条给出证据和推荐决策，用户确认
- 后续复审日期：Phase 1B-3 MIGRATION_PILOT_001 启动前

## D-023：孤儿记录处理规则

- 日期：2026-07-16
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 1B-2 Dry Run 存在无关联项目的客户和无关联客户的项目，需明确是否迁移
- 可选方案：
  1. 无关联项目的客户自动 BLOCKED；为无关联客户的项目创建 `未知客户` 占位
  2. 客户可作为线索独立存在；无关联客户的项目必须确定客户后才能迁移
- 最终决策：方案 2 — 客户允许线索态，项目必须有明确客户
- 原因：客户和项目在业务模型中职责不同，不应为项目伪造客户
- 客户规则：
  - 有姓名或称呼，且至少有联系方式、来源、有效需求摘要之一 → 可迁移为 Customer
  - 只有空壳字段、无有效身份和业务信息 → `BLOCKED`
  - 不因“没有项目”自动阻止客户迁移
- 项目规则：
  - 可从项目字段确定客户，并经人工确认 → 先创建/匹配 Customer，再迁移 Project
  - 无法确定客户 → `BLOCKED`
  - 禁止创建 `未知客户` 占位记录
  - Pilot 中排除所有未解决的孤儿项目
- 代价与风险：部分历史项目可能因客户无法追溯而被 BLOCKED；需人工确认项目与客户关联
- 影响的表、代码和自动化：Customer、Project 迁移规则；Dry Run 脚本需增加孤儿记录分析
- 验证方式：Dry Run 输出孤儿记录清单，分类说明原因
- 后续复审日期：Phase 1B-3 MIGRATION_PILOT_001 启动前

## D-024：V2 Schema v1.1 最小扩展

- 日期：2026-07-16
- 状态：APPROVED
- 决策人：用户
- 背景：Phase 1B-2 Dry Run 发现旧记录包含定金金额、成交金额、客户满意度、预算区间等有效业务事实，V2 Schema v1.0 未提供对应字段，直接迁移会导致信息丢失
- 可选方案：
  1. 不扩展 Schema，将上述信息丢弃或暂存到备注
  2. 最小化扩展 Schema，新增必要字段保留业务事实
- 最终决策：方案 2 — Schema 从 v1.0 升级为 v1.1
- 原因：避免历史有效业务事实丢失，但不扩展成完整财务/合同系统
- Project 新增字段：
  - `deposit_amount`：Number，人民币金额，可空
  - `deal_amount`：Number，人民币金额，可空
  - `currency`：SingleSelect，首期默认 `CNY`
  - `payment_status`：SingleSelect，`未知 / 待定金 / 已付定金 / 已结清 / 已退款 / 部分退款`
  - `satisfaction_score`：Number，建议 1—5，可空
  - `satisfaction_note`：LongText，可空
  - `feedback_collected_at`：DateTime，可空
- Customer 后续如需历史平均满意度，使用只读汇总字段，不作为迁移目标字段
- 需重新固化：
  - `schemas/v2-schema-v1.1.json`
  - `schemas/v2-schema-v1.1.sha256`
  - `docs/v2-field-dictionary.md`
  - `docs/v2-view-inventory.md`（若视图受影响）
- 代价与风险：Schema 版本升级需同步更新 Pilot Base 字段；若字段类型选择不当可能影响后续查询
- 影响的表、代码和自动化：Project 表结构、字段字典、视图清单、迁移脚本
- 验证方式：Schema 文件通过结构校验，hash 一致，字段字典完整描述新增字段
- 后续复审日期：Phase 1B-3 Acceptance Gate

## D-025：预算区间拆分规则 budget-map-v1.0

- 日期：2026-07-16
- 状态：APPROVED
- 决策人：用户
- 背景：旧记录中预算字段为非结构化文本，如 `3000以下`、`5000-8000`、`面议` 等，需拆分为结构化上下界
- 可选方案：
  1. 原样复制为文本字段
  2. 解析为 `budget_min` / `budget_max`，保留原始文本和解析状态
- 最终决策：方案 2 — 采用 CNY 整数，保留原始值，不要求所有记录都解析成功
- 新增/确认字段：
  - `budget_min`
  - `budget_max`
  - `budget_range_raw`
  - `budget_parse_status`：`parsed / ambiguous / unknown / invalid`
  - `budget_parse_rule_version = budget-map-v1.0`
- 解析规则：
  - `3000以下` / `<3000` → min=0, max=3000, status=parsed
  - `3000-5000` → min=3000, max=5000, status=parsed
  - `5000以上` / `5000+` → min=5000, max=null, status=parsed
  - `未确定` / `面议` / 空 → min=null, max=null, status=unknown
  - 多个冲突区间或无法解释 → min=null, max=null, status=ambiguous
- 说明：预算上下界是业务估算范围，不作为严格数学开闭区间；所有原始文本必须保留
- 代价与风险：解析规则无法覆盖所有历史写法，ambiguous 记录需人工复核
- 影响的表、代码和自动化：Customer 或 Project 表预算字段；迁移规则脚本
- 验证方式：Dry Run 输出 budget_parse_status 分布，抽查解析结果
- 后续复审日期：Phase 1B-3 Acceptance Gate

## D-026：Phase 1B-3 启动前置条件与 MIGRATION_PILOT_001 样本规则

- 日期：2026-07-16
- 状态：APPROVED_WITH_CONDITIONS
- 决策人：用户
- 背景：D-019 Migration Review Gate 提出 6 项待确认事项，经 D-020—D-025 逐条决策后，需明确 Phase 1B-3 启动条件和 Pilot 样本规则
- 可选方案：
  1. 确认规则后立即执行真实数据迁移
  2. 先更新 Schema 和迁移规则，重新 Dry Run，满足数量条件后再启动 Pilot
- 最终决策：方案 2 — 不批准立即写入真实数据，必须先完成前置步骤
- Phase 1B-3 启动前置条件：
  1. 将 D-020—D-025 追加到 `DECISION_LOG.md` 和 `project_memory.md`
  2. 更新并固化 Schema v1.1 与字段字典
  3. 更新状态、来源、预算和缺失字段迁移规则
  4. 创建重复候选人工审核清单
  5. 创建孤儿记录处理清单
  6. 重新执行全量只读 Dry Run
  7. 输出更新后的 MIGRATABLE / NEEDS_REVIEW / BLOCKED 统计
  8. 确认至少：5 个 Customer MIGRATABLE、5 个 Project MIGRATABLE 且关联上述 Customer、10 个 Model MIGRATABLE、10 个 Makeup MIGRATABLE
  9. 若不足，停止在 Review Gate，不得从 NEEDS_REVIEW 中直接抽样写入
- MIGRATION_PILOT_001 样本规则：
  - 客户无未解决重复候选
  - 项目客户关联明确
  - 项目状态可确定映射
  - 核心字段通过 Schema 校验
  - 资源无未解决重复候选
  - 关联策划案、任务、资源安排可确定性关联
  - 不包含高敏客户原始聊天、照片或未脱敏附件
  - 建议选择 5 个完整客户—项目组合，而非分别随机抽取
- 回滚规则：
  - 所有 Pilot 记录必须标记 `migration_batch_id = MIGRATION_PILOT_001`、`migration_source_record_id`、`migration_source_table`、`migration_rule_version`、`migrated_at`
  - Dry-run rollback 只模拟，不实际删除
  - Confirmed rollback 仅在 batch_id 完全匹配、记录未被修改、未被非 Pilot 数据引用、已保存前后快照、用户明确确认时才允许删除
  - 若记录已被修改或产生后续关联，标记 `rollback_pending` 进入人工补偿清单
  - 禁止修改或删除旧 Base 数据
- Acceptance Gate 必须输出：迁移前后逐字段对账、源到目标记录映射、关联完整性检查、重复创建检查、Schema 校验结果、自动化事件日志、Dry-run rollback 结果、Confirmed rollback 演练结果、未解决问题、是否建议进入下一批次
- 代价与风险：前置步骤增加执行时间；若不满足数量条件则 Pilot 延迟，但可避免低质量数据进入 V2
- 影响的表、代码和自动化：V2 Pilot Base 结构更新、迁移脚本、Dry Run 报告、Pilot 写入脚本
- 验证方式：Dry Run 报告和 Schema 资产通过校验；数量条件满足后用户再次批准 Pilot
- 后续复审日期：Phase 1B-3 MIGRATION_PILOT_001 启动前
