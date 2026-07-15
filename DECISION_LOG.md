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
