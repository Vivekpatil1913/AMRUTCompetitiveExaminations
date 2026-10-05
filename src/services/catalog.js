// Shared read queries for the public site (and reusable elsewhere).
const db = require('../db/pool');
const { canAccess, lockReason } = require('./access');

const LECTURE_SELECT = `
  SELECT l.*, s.name_en AS speaker_en, s.name_mr AS speaker_mr, s.designation_en AS speaker_desig_en, s.designation_mr AS speaker_desig_mr,
         e.name_en AS exam_en, e.name_mr AS exam_mr, c.title_en AS course_en, c.title_mr AS course_mr,
         sb.name_en AS subject_en, sb.name_mr AS subject_mr, tp.name_en AS topic_en, tp.name_mr AS topic_mr,
         ce.name_en AS centre_en, ce.name_mr AS centre_mr, ce.address AS centre_address, ce.map_url AS centre_map
    FROM lectures l
    LEFT JOIN speakers s ON s.id = l.speaker_id
    LEFT JOIN examinations e ON e.id = l.examination_id
    LEFT JOIN courses c ON c.id = l.course_id
    LEFT JOIN subjects sb ON sb.id = l.subject_id
    LEFT JOIN topics tp ON tp.id = l.topic_id
    LEFT JOIN centres ce ON ce.id = l.centre_id`;

const RESOURCE_SELECT = `
  SELECT r.*, e.name_en AS exam_en, e.name_mr AS exam_mr, c.title_en AS course_en, c.title_mr AS course_mr,
         sb.name_en AS subject_en, sb.name_mr AS subject_mr, tp.name_en AS topic_en, tp.name_mr AS topic_mr
    FROM resources r
    LEFT JOIN examinations e ON e.id = r.examination_id
    LEFT JOIN courses c ON c.id = r.course_id
    LEFT JOIN subjects sb ON sb.id = r.subject_id
    LEFT JOIN topics tp ON tp.id = r.topic_id`;

const int = (v) => (/^\d+$/.test(String(v || '')) ? Number(v) : null);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

// Build a WHERE clause from optional filters. Returns { where, params }.
function where(conds) {
  const parts = []; const params = [];
  for (const [sql, val] of conds) {
    if (val === null || val === undefined || val === '') continue;
    params.push(val);
    parts.push(sql.replace('?', '$' + params.length));
  }
  return { where: parts.length ? ' AND ' + parts.join(' AND ') : '', params };
}

async function lectures(filters = {}, { order = 'l.lecture_date, l.start_time', limit = 200 } = {}) {
  const w = where([
    ['l.examination_id = ?', int(filters.exam)], ['l.course_id = ?', int(filters.course)], ['l.subject_id = ?', int(filters.subject)],
    ['l.mode = ?', ['online', 'offline'].includes(filters.mode) ? filters.mode : null],
    ['l.lecture_type = ?', ['regular', 'guest', 'guidance', 'special'].includes(filters.type) ? filters.type : null],
    ['l.lecture_date >= ?', isDate(filters.from) ? filters.from : null], ['l.lecture_date <= ?', isDate(filters.to) ? filters.to : null],
    ['l.lecture_date < ?', isDate(filters.before) ? filters.before : null],
  ]);
  return db.many(`${LECTURE_SELECT} WHERE l.is_published ${w.where} ORDER BY ${order} LIMIT ${Number(limit)}`, w.params);
}

async function lecture(id) {
  return db.one(`${LECTURE_SELECT} WHERE l.is_published AND l.id = $1`, [int(id)]);
}

async function grantsFor(candidate) {
  if (!candidate) return new Set();
  return new Set((await db.many('SELECT resource_id FROM resource_grants WHERE candidate_id = $1', [candidate.id])).map((g) => g.resource_id));
}

async function resources(filters = {}, candidate = null) {
  const w = where([
    ['r.resource_type = ?', filters.type || null], ['r.examination_id = ?', int(filters.exam)], ['r.course_id = ?', int(filters.course)],
    ['r.subject_id = ?', int(filters.subject)], ['r.topic_id = ?', int(filters.topic)],
  ]);
  const rows = await db.many(`${RESOURCE_SELECT} WHERE r.is_published ${w.where} ORDER BY r.sort_order, r.created_at DESC`, w.params);
  const grants = await grantsFor(candidate);
  rows.forEach((r) => { r.allowed = canAccess(candidate, r, grants); r.lock = r.allowed ? null : lockReason(candidate, r); });
  return rows;
}

// Topic rows → nested tree using parent_id
function buildTree(rows) {
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const n of byId.values()) (n.parent_id && byId.has(n.parent_id) ? byId.get(n.parent_id).children : roots).push(n);
  return roots;
}

// Options for filter dropdowns
async function filterOptions() {
  const [exams, courses, subjects, topics] = await Promise.all([
    db.many('SELECT id, name_en, name_mr FROM examinations WHERE is_active ORDER BY sort_order, id'),
    db.many('SELECT id, title_en, title_mr FROM courses WHERE is_active ORDER BY sort_order, id'),
    db.many(`SELECT s.id, s.name_en, s.name_mr, e.short_name FROM subjects s LEFT JOIN examinations e ON e.id = s.examination_id
             WHERE s.is_active ORDER BY e.sort_order, s.sort_order, s.id`),
    db.many('SELECT t.id, t.name_en, t.name_mr, t.subject_id FROM topics t WHERE t.is_active ORDER BY t.subject_id, t.sort_order, t.id'),
  ]);
  return { exams, courses, subjects, topics };
}

module.exports = { LECTURE_SELECT, RESOURCE_SELECT, lectures, lecture, resources, grantsFor, buildTree, filterOptions, int, isDate };
