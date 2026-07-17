'use strict';

// Budget range parser. Pure function, no I/O.
//
// Source of truth: DECISION_LOG D-025 (budget-map-v1.0).
//
// Parsing rules:
//   - "3000以下" / "<3000" / "≤3000"  -> min=0,    max=3000,  status=parsed
//   - "3000-5000" / "3000~5000"      -> min=3000,  max=5000,  status=parsed
//   - "5000以上" / "5000+" / "≥5000"  -> min=5000,  max=null,  status=parsed
//   - "未确定" / "面议" / ""          -> min=null,  max=null,  status=unknown
//   - multiple conflicting ranges or
//     uninterpretable text            -> min=null,  max=null,  status=ambiguous
//
// All amounts are CNY integers. The original raw text is always preserved.

const BUDGET_RULE_VERSION = 'budget-map-v1.0';

// Keywords that explicitly mean "no budget stated".
const UNKNOWN_KEYWORDS = new Set(['面议', '未确定', '未填写', '未知', '无']);

/**
 * Strip whitespace and common currency suffixes/units from a numeric token.
 * @param {string} token
 * @returns {number|null}
 */
function parseAmount(token) {
  if (token === null || token === undefined) return null;
  const cleaned = String(token).replace(/[元块¥,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

/**
 * Parse a legacy budget range raw text into structured bounds.
 *
 * @param {string|null|undefined} rawText
 * @returns {{
 *   budget_min: number|null,
 *   budget_max: number|null,
 *   budget_range_raw: string,
 *   budget_parse_status: 'parsed'|'ambiguous'|'unknown'|'invalid',
 *   budget_parse_rule_version: string
 * }}
 */
function parseBudget(rawText) {
  const budget_range_raw = rawText === null || rawText === undefined ? '' : String(rawText);
  const trimmed = budget_range_raw.trim();

  const base = {
    budget_min: null,
    budget_max: null,
    budget_range_raw,
    budget_parse_status: 'unknown',
    budget_parse_rule_version: BUDGET_RULE_VERSION,
  };

  if (trimmed === '') return base;
  if (UNKNOWN_KEYWORDS.has(trimmed)) return base;

  // Detect multiple conflicting ranges (any "或" / "或者" / "|" separator).
  // If present and at least two range-like fragments exist, mark ambiguous.
  if (/[或者|]|\/\s*(?=\d)/.test(trimmed)) {
    const rangeCount = (trimmed.match(/\d+\s*[-~到]\s*\d+/g) || []).length
      + (trimmed.match(/\d+\s*(?:以下|<|≤)/g) || []).length
      + (trimmed.match(/\d+\s*(?:以上|\+|>|≥)/g) || []).length;
    if (rangeCount >= 2) {
      base.budget_parse_status = 'ambiguous';
      return base;
    }
  }

  // Range: "3000-5000", "3000~5000", "3000到5000"
  let m = trimmed.match(/^(\d+)\s*[-~到]\s*(\d+)$/);
  if (m) {
    const lo = parseAmount(m[1]);
    const hi = parseAmount(m[2]);
    if (lo !== null && hi !== null && lo <= hi) {
      base.budget_min = lo;
      base.budget_max = hi;
      base.budget_parse_status = 'parsed';
      return base;
    }
  }

  // Lower bound: "3000以下", "<3000", "≤3000"
  m = trimmed.match(/^(\d+)\s*(?:以下|<|≤)$/);
  if (m) {
    const hi = parseAmount(m[1]);
    if (hi !== null) {
      base.budget_min = 0;
      base.budget_max = hi;
      base.budget_parse_status = 'parsed';
      return base;
    }
  }

  // Upper bound: "5000以上", "5000+", "≥5000"
  m = trimmed.match(/^(\d+)\s*(?:以上|\+|>|≥)$/);
  if (m) {
    const lo = parseAmount(m[1]);
    if (lo !== null) {
      base.budget_min = lo;
      base.budget_max = null;
      base.budget_parse_status = 'parsed';
      return base;
    }
  }

  // Uninterpretable text that is not empty and not a known "no budget" keyword
  // is treated as ambiguous per D-025 ("无法解释 -> ambiguous").
  base.budget_parse_status = 'ambiguous';
  return base;
}

module.exports = {
  parseBudget,
  BUDGET_RULE_VERSION,
};
