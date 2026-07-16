const { execSync } = require("child_process");

// ─── Feishu Base 配置 ───────────────────────────────────────────
const FEISHU_BASE_TOKEN = "SOURCE_BASE_ALIAS";

const TABLES = {
  projects: {
    tableId: "V1_PROJECTS_TABLE_ALIAS",
    label: "拍摄项目全流程管理表",
    mysqlTable: "projects",
  },
  clients: {
    tableId: "V1_CLIENTS_TABLE_ALIAS",
    label: "客户全生命周期管理表",
    mysqlTable: "clients",
  },
  publishBoard: {
    tableId: "V1_PUBLISH_DASHBOARD_TABLE_ALIAS",
    label: "跨平台发布总看板",
    mysqlTable: "publish_board",
  },
  publish: {
    tableId: "V1_PUBLISH_TASKS_TABLE_ALIAS",
    label: "成品发布与运营数据表",
    mysqlTable: "publish",
  },
};

// ─── 命令行参数解析 ─────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let targetTable = null;

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) {
      targetTable = args[i];
    }
  }

  return { targetTable };
}

// ─── 飞书字段扁平化 ─────────────────────────────────────────────
function flattenFieldValue(value) {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    const isTextArray = value.length > 0 && value[0] && typeof value[0].text === "string";
    if (isTextArray) return value.map((item) => item.text).join("");

    const isMultiSelect = value.length > 0 && value[0] && value[0].name && value[0].id;
    if (isMultiSelect) return value.map((item) => item.name).join(",");

    const isPerson = value.length > 0 && value[0] && (value[0].id || value[0].en_name || value[0].name);
    if (isPerson) return value.map((item) => item.name || item.en_name || item.id).join(",");

    const isAttachment = value.length > 0 && value[0] && value[0].file_token;
    if (isAttachment) return JSON.stringify(value);

    const isLink = value.length > 0 && value[0] && value[0].record_id;
    if (isLink) return value.map((item) => item.record_id).join(",");

    return JSON.stringify(value);
  }

  if (typeof value === "object" && value.name && value.id) return value.name;
  if (typeof value === "object" && value.link) return value.link;
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  return value;
}

function flattenRecord(record) {
  const fields = record.fields || {};
  const flat = {
    _record_id: record.record_id,
    _synced_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    _raw_fields: JSON.stringify(fields),
  };

  for (const [key, value] of Object.entries(fields)) {
    flat[key] = flattenFieldValue(value);
  }

  return flat;
}

// ─── 从飞书 Base 读取数据 ───────────────────────────────────────
function fetchFeishuRecords(tableId) {
  const cmd = `lark-cli base +record-list --base-token ${FEISHU_BASE_TOKEN} --table-id ${tableId} --limit 200 --as user --format json`;

  let stdout;
  try {
    stdout = execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });
  } catch (err) {
    throw new Error(`lark-cli 执行失败: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    // 尝试从输出中提取 JSON
    const lines = stdout.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        parsed = JSON.parse(lines[i]);
        break;
      } catch {}
    }
    if (!parsed) throw new Error(`无法解析 lark-cli 输出`);
  }

  // lark-cli --format json 返回格式: { ok, identity, data: { data: [[...]], fields: [...], record_id_list: [...] } }
  const data = parsed.data || parsed;
  const fields = data.fields || [];
  const rows = data.data || [];
  const recordIds = data.record_id_list || [];

  // 将列式数据转为行式
  const items = recordIds.map((rid, rowIdx) => {
    const fieldsObj = {};
    fields.forEach((fieldName, colIdx) => {
      fieldsObj[fieldName] = rows[rowIdx] ? rows[rowIdx][colIdx] : null;
    });
    return { record_id: rid, fields: fieldsObj };
  });

  const hasMore = data.has_more || false;
  const total = items.length;

  return { items, hasMore, total };
}

// ─── SQL 转义 ──────────────────────────────────────────────────
function escapeSql(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") return String(val);
  const str = String(val);
  return "'" + str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"') + "'";
}

// ─── 通过 CloudBase MCP 写入 MySQL ─────────────────────────────
function pushToMySQLViaMCP(mysqlTable, records) {
  if (records.length === 0) {
    console.log("无数据需要同步");
    return;
  }

  // 1. 清空表
  const deleteSql = `DELETE FROM ${mysqlTable}`;
  try {
    execSync(`npx mcporter call cloudbase.manageSqlDatabase action=runStatement sql="${deleteSql.replace(/"/g, '\\"')}"`, {
      encoding: "utf-8",
      timeout: 30000,
    });
  } catch (err) {
    // 忽略清空错误
  }

  // 2. 逐条插入
  let inserted = 0;
  for (const record of records) {
    const columns = Object.keys(record);
    const values = columns.map((col) => escapeSql(record[col]));

    // 用反引号包裹中文列名
    const quotedCols = columns.map((c) => {
      if (c.startsWith("_")) return c;
      return "`" + c + "`";
    });

    const insertSql = `INSERT INTO ${mysqlTable} (${quotedCols.join(", ")}) VALUES (${values.join(", ")})`;

    try {
      execSync(
        `npx mcporter call cloudbase.manageSqlDatabase action=runStatement sql="${insertSql.replace(/"/g, '\\"').replace(/\n/g, " ")}"`,
        { encoding: "utf-8", timeout: 30000 }
      );
      inserted++;
    } catch (err) {
      console.error(`  插入失败 (record_id: ${record._record_id}): ${err.message.slice(0, 100)}`);
    }
  }

  console.log(`  已插入 ${inserted}/${records.length} 条`);
}

// ─── 单表同步 ──────────────────────────────────────────────────
function syncTable(tableKey) {
  const config = TABLES[tableKey];
  if (!config) {
    throw new Error(`未知表: ${tableKey}，可选: ${Object.keys(TABLES).join(", ")}`);
  }

  console.log(`正在同步 ${tableKey}（${config.label}）...`);

  const { items, total } = fetchFeishuRecords(config.tableId);
  console.log(`  从飞书读取 ${total} 条记录`);

  if (total > 0) {
    const flatRecords = items.map(flattenRecord);
    pushToMySQLViaMCP(config.mysqlTable, flatRecords);
  } else {
    console.log("  无数据，跳过");
  }
}

// ─── 主流程 ────────────────────────────────────────────────────
function main() {
  const { targetTable } = parseArgs();

  console.log("=== 泽怀影像中台数据同步 ===");
  console.log(`时间: ${new Date().toLocaleString("zh-CN")}\n`);

  const tablesToSync = targetTable ? [targetTable] : Object.keys(TABLES);

  let failed = 0;
  for (const tableKey of tablesToSync) {
    try {
      syncTable(tableKey);
    } catch (err) {
      console.error(`✗ 同步 ${tableKey} 失败: ${err.message}`);
      failed++;
    }
  }

  console.log("\n── 同步完成 ──");
  if (failed > 0) {
    console.log(`成功: ${tablesToSync.length - failed}/${tablesToSync.length}，失败: ${failed}`);
    process.exit(1);
  } else {
    console.log(`全部成功: ${tablesToSync.length}/${tablesToSync.length}`);
  }
}

main();
