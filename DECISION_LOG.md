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
