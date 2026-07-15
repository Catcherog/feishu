# 飞书业务中台 V2 指南包

建议使用顺序：

1. 阅读 `PROJECT_GUIDE.md`
2. 将 `TRAE_EXECUTION_PROMPT.md` 完整复制给 Trae
3. Trae 只执行 Phase 0 审计，不直接改线上 Base
4. 审计完成后，根据报告确认 V2 表结构和迁移范围

文件说明：

- `PROJECT_GUIDE.md`：长期事实源和完整产品/技术方案
- `TRAE_EXECUTION_PROMPT.md`：可直接复制给 Trae 的第一阶段指令
- `schemas/ai_ingest_output.schema.json`：数据清洗 Agent 输出协议
- `templates/DECISION_LOG.md`：结构性决策记录模板
- `templates/TEST_REPORT.md`：测试和验收报告模板

安全提醒：

- 本包不包含真实飞书 App Token、Table ID、Field ID、Secret 或客户数据。
- Trae 应在本地生成 `resource-map.local.json`，并加入 `.gitignore`。
