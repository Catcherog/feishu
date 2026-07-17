'use strict';

// Budget range parser. Pure function, no I/O.
//
// Source of truth: DECISION_LOG D-025 (budget-map-v1.0).
//
// Approved parsing forms (D-025):
//   Prefix-symbol form:
//     "<3000"   -> min=0,    max=3000,  status=parsed
//     "≤3000"   -> min=0,    max=3000,  status=parsed
//     ">5000"   -> min=5000, max=null,  status=parsed
//     "≥5000"   -> min=5000, max=null,  status=parsed
//   Chinese-suffix / plus form:
//     "3000以下" -> min=0,    max=3000,  status=parsed
//     "5000以上" -> min=5000, max=null,  status=parsed
//     "5000+"    -> min=5000, max=null,  status=parsed
//   Range form:
//     "3000-5000" / "3000~5000" / "3000到5000"
//                          -> min=3000, max=5000, status=parsed
//   Unknown keywords:
//     "面议" / "未确定" / "" -> min=null, max=null, status=unknown
//   Otherwise (including disallowed reversed forms like "3000<", "5000≥"):
//     -> min=null, max=null, status=ambiguous
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
 * Count the number of range-like fragments in a string. Used by the
 * multi-range ambiguity detector. Counts both approved forms (prefix
 * symbol "<3000", "≥5000") and disallowed reversed forms ("3000<", "5000≥")
 * because both indicate range intent and should trigger ambiguity when
 * multiple fragments are present.
 *
 * @param {string} text
 * @returns {number}
 */
function countRangeFragments(text) {
  let count = 0;
  // Range "3000-5000" / "3000~5000" / "3000到5000"
  count += (text.match(/\d+\s*[-~到]\s*\d+/g) || []).length;
  // Prefix-symbol bound: "<3000" / "≤3000" / ">5000" / "≥5000"
  count += (text.match(/^[<>≤≥]\s*\d+|\s[<>≤≥]\s*\d+/g) || []).length;
  // Suffix-symbol bound (reversed, disallowed): "3000<" / "3000≤" / "5000>" / "5000≥"
  count += (text.match(/\d\s*[<>≤≥](?!\d)/g) || []).length;
  // Chinese-suffix or plus bound: "3000以下" / "5000以上" / "5000+"
  count += (text.match(/\d+\s*(?:以下|以上|\+)/g) || []).length;
  return count;
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
    const rangeCount = countRangeFragments(trimmed);
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

  // Approved prefix-symbol bound form: "<3000", "≤3000", ">5000", "≥5000".
  // The symbol MUST appear before the number. Reversed forms like "3000<"
  // or "5000≥" do NOT match this pattern and fall through to ambiguous.
  m = trimmed.match(/^([<>≤≥])\s*(\d+)$/);
  if (m) {
    const sym = m[1];
    const n = parseAmount(m[2]);
    if (n !== null) {
      if (sym === '<' || sym === '≤') {
        base.budget_min = 0;
        base.budget_max = n;
        base.budget_parse_status = 'parsed';
        return base;
      }
      if (sym === '>' || sym === '≥') {
        base.budget_min = n;
        base.budget_max = null;
        base.budget_parse_status = 'parsed';
        return base;
      }
    }
  }

  // Approved Chinese-suffix or plus bound form:
  //   "3000以下"  -> upper bound (min=0, max=n)
  //   "5000以上"  -> lower bound (min=n, max=null)
  //   "5000+"     -> lower bound (min=n, max=null)
  m = trimmed.match(/^(\d+)\s*(以下|以上|\+)$/);
  if (m) {
    const n = parseAmount(m[1]);
    const suffix = m[2];
    if (n !== null) {
      if (suffix === '以下') {
        base.budget_min = 0;
        base.budget_max = n;
        base.budget_parse_status = 'parsed';
        return base;
      }
      if (suffix === '以上' || suffix === '+') {
        base.budget_min = n;
        base.budget_max = null;
        base.budget_parse_status = 'parsed';
        return base;
      }
    }
  }

  // Uninterpretable text that is not empty and not a known "no budget" keyword
  // is treated as ambiguous per D-025 ("无法解释 -> ambiguous"). This
  // includes disallowed reversed forms like "3000<" and "5000≥".
  base.budget_parse_status = 'ambiguous';
  return base;
}

module.exports = {
  parseBudget,
  BUDGET_RULE_VERSION,
};
