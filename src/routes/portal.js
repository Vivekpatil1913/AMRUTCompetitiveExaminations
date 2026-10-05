// Logged-in candidate study portal (mounted at /portal).
const fs = require('fs');
const express = require('express');
const db = require('../db/pool');
const { requireCandidate, flash, uploader, relUpload } = require('../middleware');
const { canAccess, lockReason, canSeeLecture } = require('../services/access');

const router = express.Router();
router.use(requireCandidate);
router.use((req, res, next) => { res.locals.layout = 'layouts/portal'; next(); });

// ---------------------------------------------------------------- helpers
const wrap = (fn) => (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };
const toInt = (v) => (/^\d{1,9}$/.test(String(v ?? '')) ? Number(v) : null);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));
const one = (v) => (Array.isArray(v) ? v[0] : v);
const str = (v, max = 500) => String(one(v) ?? '').trim().slice(0, max);
const OPTS = ['a', 'b', 'c', 'd'];

function notFound(res) {
  return res.status(404).page('public/error', { title: '404', code: 404, message: res.locals.t('pt.notFound') });
}

// Collects "AND ..." conditions with positional params. Each '?' becomes the next $n.
function where(params = []) {
  const parts = [];
  return {
    params,
    add(sql, ...vals) { parts.push(sql.replace(/\?/g, () => { params.push(vals.shift()); return '$' + params.length; })); return this; },
    sql() { return parts.length ? ' AND ' + parts.join(' AND ') : ''; },
  };
}

// Courses / examinations the candidate is enrolled in (withdrawn enrolments excluded)
async function scope(req) {
  if (req.portalScope) return req.portalScope;
  const rows = await db.many(`SELECT e.course_id, c.examination_id FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.candidate_id = $1 AND e.status <> 'withdrawn'`, [req.candidate.id]);
  req.portalScope = {
    courseIds: [...new Set(rows.map((r) => r.course_id))],
    examIds: [...new Set(rows.map((r) => r.examination_id).filter(Boolean))],
  };
  return req.portalScope;
}

async function grantSet(candidateId) {
  const rows = await db.many('SELECT resource_id FROM resource_grants WHERE candidate_id = $1', [candidateId]);
  return new Set(rows.map((g) => g.resource_id));
}

function decorate(candidate, rows, grants) {
  for (const r of rows) {
    r.allowed = canAccess(candidate, r, grants);
    r.lock = r.allowed ? null : lockReason(candidate, r);
  }
  return rows;
}

// Flat topic rows → nested tree (topics.parent_id allows any depth)
function topicTree(rows) {
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const n of byId.values()) {
    const p = n.parent_id && byId.get(n.parent_id);
    (p ? p.children : roots).push(n);
  }
  return roots;
}

// Filter dropdown sources (always from DB)
const lookups = {
  exams: () => db.many('SELECT id, name_en, name_mr FROM examinations WHERE is_active ORDER BY sort_order, id'),
  courses: () => db.many('SELECT id, title_en, title_mr FROM courses WHERE is_active ORDER BY sort_order, id'),
  subjects: () => db.many(`SELECT s.id, s.name_en, s.name_mr, e.short_name, e.name_en AS exam_en FROM subjects s
      LEFT JOIN examinations e ON e.id = s.examination_id WHERE s.is_active ORDER BY e.sort_order NULLS LAST, s.sort_order, s.id`),
  topics: (subjectId) => db.many(`SELECT t.id, t.name_en, t.name_mr, s.name_en AS subject_en, s.name_mr AS subject_mr FROM topics t
      JOIN subjects s ON s.id = t.subject_id WHERE t.is_active AND ($1::int IS NULL OR t.subject_id = $1) ORDER BY s.sort_order, t.subject_id, t.sort_order, t.id`, [subjectId]),
};
function options(res, rows, field, suffix) {
  const L = res.locals.L;
  return rows.map((r) => ({ value: r.id, label: L(r, field) + (suffix ? suffix(r) : '') }));
}
async function filterOptions(res, which, subjectId = null) {
  const L = res.locals.L;
  const out = {};
  if (which.includes('exam')) out.exam = options(res, await lookups.exams(), 'name');
  if (which.includes('course')) out.course = options(res, await lookups.courses(), 'title');
  if (which.includes('subject')) out.subject = options(res, await lookups.subjects(), 'name', (r) => (r.short_name || r.exam_en ? ` (${r.short_name || r.exam_en})` : ''));
  if (which.includes('topic')) out.topic = options(res, await lookups.topics(subjectId), 'name', (r) => ` (${L(r, 'subject')})`);
  return out;
}

// ---------------------------------------------------------------- shared SQL
const LEC_SQL = `SELECT l.*, sp.name_en AS speaker_en, sp.name_mr AS speaker_mr, sp.designation_en AS speaker_desig_en, sp.designation_mr AS speaker_desig_mr,
    su.name_en AS subject_en, su.name_mr AS subject_mr, ce.name_en AS centre_en, ce.name_mr AS centre_mr, ce.address AS centre_address,
    ce.location AS centre_location, ce.map_url AS centre_map, ex.name_en AS exam_en, ex.name_mr AS exam_mr,
    co.title_en AS course_en, co.title_mr AS course_mr, tp.name_en AS topic_en, tp.name_mr AS topic_mr
  FROM lectures l
  LEFT JOIN speakers sp ON sp.id = l.speaker_id LEFT JOIN subjects su ON su.id = l.subject_id
  LEFT JOIN centres ce ON ce.id = l.centre_id LEFT JOIN examinations ex ON ex.id = l.examination_id
  LEFT JOIN courses co ON co.id = l.course_id LEFT JOIN topics tp ON tp.id = l.topic_id
  WHERE l.is_published`;
const LEC_ORDER = ' ORDER BY l.lecture_date, l.start_time NULLS LAST, l.id';
// "My" lectures: lectures of enrolled courses, or exam-level lectures (no course) of enrolled examinations
const MINE_LEC = '(l.course_id = ANY(?::int[]) OR (l.course_id IS NULL AND l.examination_id = ANY(?::int[])))';

const RES_SQL = `SELECT r.*, ex.name_en AS exam_en, ex.name_mr AS exam_mr, su.name_en AS subject_en, su.name_mr AS subject_mr,
    tp.name_en AS topic_en, tp.name_mr AS topic_mr
  FROM resources r LEFT JOIN examinations ex ON ex.id = r.examination_id
  LEFT JOIN subjects su ON su.id = r.subject_id LEFT JOIN topics tp ON tp.id = r.topic_id
  WHERE r.is_published`;
const RES_ORDER = ' ORDER BY su.sort_order NULLS LAST, r.subject_id NULLS LAST, r.sort_order, r.id';

// $1 must be the candidate id
const TEST_SQL = `SELECT t.*, l.title_en AS lecture_en, l.title_mr AS lecture_mr, l.lecture_date,
    su.name_en AS subject_en, su.name_mr AS subject_mr, co.title_en AS course_en, co.title_mr AS course_mr,
    (SELECT count(*) FROM test_questions tq JOIN questions q ON q.id = tq.question_id AND q.is_active WHERE tq.test_id = t.id)::int AS q_count,
    la.id AS last_attempt_id, la.correct AS last_correct, la.total AS last_total, la.submitted_at AS last_submitted
  FROM tests t LEFT JOIN lectures l ON l.id = t.lecture_id LEFT JOIN subjects su ON su.id = t.subject_id
  LEFT JOIN courses co ON co.id = t.course_id
  LEFT JOIN LATERAL (SELECT a.* FROM test_attempts a WHERE a.test_id = t.id AND a.candidate_id = $1 AND a.submitted_at IS NOT NULL
                     ORDER BY a.submitted_at DESC LIMIT 1) la ON TRUE
  WHERE t.is_published`;
const TEST_MINE = '(t.course_id IS NULL OR t.course_id = ANY(?::int[]))';

const ANN_ACTIVE = `is_published AND (publish_from IS NULL OR publish_from <= $1) AND (publish_to IS NULL OR publish_to >= $1)`;

// Enrolled courses with batch/centre details and derived lecture progress
function myCourses(candidateId, today) {
  return db.many(`SELECT e.id AS enrollment_id, e.status AS enrollment_status, e.batch_id, c.id, c.title_en, c.title_mr, c.mode, c.duration_days,
      c.description_en, c.description_mr, ex.id AS exam_id, ex.name_en AS exam_en, ex.name_mr AS exam_mr,
      cc.name_en AS category_en, cc.name_mr AS category_mr, b.name AS batch_name, b.start_date, b.end_date,
      ce.name_en AS centre_en, ce.name_mr AS centre_mr,
      (SELECT count(*) FROM lectures l WHERE l.course_id = c.id AND l.is_published)::int AS lec_total,
      (SELECT count(*) FROM lectures l WHERE l.course_id = c.id AND l.is_published AND l.lecture_date < $2)::int AS lec_done
    FROM enrollments e JOIN courses c ON c.id = e.course_id
    LEFT JOIN examinations ex ON ex.id = c.examination_id LEFT JOIN course_categories cc ON cc.id = c.category_id
    LEFT JOIN batches b ON b.id = e.batch_id LEFT JOIN centres ce ON ce.id = b.centre_id
    WHERE e.candidate_id = $1 ORDER BY (e.status = 'active') DESC, e.enrolled_at, e.id`, [candidateId, today]);
}

// ================================================================ Dashboard
router.get('/', wrap(async (req, res) => {
  const cand = req.candidate;
  const today = res.locals.today;
  const { courseIds, examIds } = await scope(req);
  const courses = await myCourses(cand.id, today);
  const primary = courses.find((c) => c.enrollment_status === 'active') || null;

  const counts = await db.one(`SELECT
      (SELECT count(DISTINCT cs.subject_id) FROM course_subjects cs JOIN subjects s ON s.id = cs.subject_id AND s.is_active WHERE cs.course_id = ANY($1::int[]))::int AS subjects,
      (SELECT count(*) FROM resources WHERE is_published AND resource_type = 'study_material')::int AS material,
      (SELECT count(*) FROM questions WHERE in_question_bank AND is_active)::int AS questions,
      (SELECT count(*) FROM resources WHERE is_published AND resource_type = 'video')::int AS videos,
      (SELECT count(*) FROM resources WHERE is_published AND resource_type = 'youtube')::int AS youtube,
      (SELECT count(*) FROM lectures l WHERE l.is_published AND l.lecture_date >= $3
         AND (l.course_id = ANY($1::int[]) OR (l.course_id IS NULL AND l.examination_id = ANY($2::int[]))))::int AS upcoming,
      (SELECT count(*) FROM tests t WHERE t.is_published AND (t.course_id IS NULL OR t.course_id = ANY($1::int[])))::int AS tests,
      (SELECT count(*) FROM test_attempts WHERE candidate_id = $4 AND submitted_at IS NOT NULL)::int AS results,
      (SELECT count(*) FROM lectures WHERE is_published AND lecture_date >= $3 AND lecture_type IN ('guest','special','guidance'))::int AS guest,
      (SELECT count(*) FROM travel_schedules WHERE is_published AND schedule_date >= $3)::int AS yatra,
      (SELECT count(*) FROM announcements WHERE is_published AND (publish_from IS NULL OR publish_from <= $3) AND (publish_to IS NULL OR publish_to >= $3))::int AS announcements,
      (SELECT count(*) FROM important_links WHERE is_active)::int AS links`, [courseIds, examIds, today, cand.id]);

  const w = where([today]).add(MINE_LEC, courseIds, examIds);
  const lectures = await db.many(`${LEC_SQL} AND l.lecture_date >= $1${w.sql()}${LEC_ORDER} LIMIT 5`, w.params);
  const announcements = await db.many(`SELECT * FROM announcements WHERE ${ANN_ACTIVE} ORDER BY created_at DESC, id DESC LIMIT 5`, [today]);
  const yatra = await db.many(`SELECT * FROM travel_schedules WHERE is_published AND schedule_date >= $1
      ORDER BY schedule_date, start_time NULLS LAST, id LIMIT 4`, [today]);

  res.page('portal/dashboard', { title: res.locals.t('portal.title'), courses, primary, counts, lectures, announcements, yatra });
}));

// ================================================================ Courses
router.get('/courses', wrap(async (req, res) => {
  const courses = await myCourses(req.candidate.id, res.locals.today);
  res.page('portal/courses', { title: res.locals.t('portal.myCourses'), courses });
}));

router.get('/courses/:id', wrap(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return notFound(res);
  const course = (await myCourses(req.candidate.id, res.locals.today)).find((c) => c.id === id);
  if (!course) return notFound(res);
  const tab = ['subjects', 'lectures', 'material', 'tests'].includes(req.query.tab) ? req.query.tab : 'subjects';
  const subjects = await db.many(`SELECT s.*, e.name_en AS exam_en, e.name_mr AS exam_mr FROM course_subjects cs
      JOIN subjects s ON s.id = cs.subject_id AND s.is_active LEFT JOIN examinations e ON e.id = s.examination_id
      WHERE cs.course_id = $1 ORDER BY s.sort_order, s.id`, [id]);
  const subjectIds = subjects.map((s) => s.id);
  const data = { title: res.locals.L(course, 'title'), course, tab, subjects, lectures: [], materials: [], tests: [], trees: {} };

  if (tab === 'subjects') {
    const topics = await db.many('SELECT * FROM topics WHERE is_active AND subject_id = ANY($1::int[]) ORDER BY sort_order, id', [subjectIds]);
    for (const s of subjects) data.trees[s.id] = topicTree(topics.filter((t) => t.subject_id === s.id));
  } else if (tab === 'lectures') {
    data.lectures = await db.many(`${LEC_SQL} AND l.course_id = $1${LEC_ORDER}`, [id]);
  } else if (tab === 'material') {
    const rows = await db.many(`${RES_SQL} AND r.resource_type = 'study_material'
        AND (r.course_id = $1 OR (r.course_id IS NULL AND r.subject_id = ANY($2::int[])))${RES_ORDER}`, [id, subjectIds]);
    data.materials = decorate(req.candidate, rows, await grantSet(req.candidate.id));
  } else {
    data.tests = await db.many(`${TEST_SQL} AND t.course_id = $2 ORDER BY t.id`, [req.candidate.id, id]);
  }
  res.page('portal/course-detail', data);
}));

// ================================================================ Subjects
router.get('/subjects', wrap(async (req, res) => {
  const { courseIds } = await scope(req);
  const subjects = await db.many(`SELECT s.id, s.name_en, s.name_mr, s.description_en, s.description_mr,
      e.id AS exam_id, e.name_en AS exam_en, e.name_mr AS exam_mr,
      (SELECT count(*) FROM topics t WHERE t.subject_id = s.id AND t.is_active)::int AS topic_count,
      (SELECT count(*) FROM resources r WHERE r.subject_id = s.id AND r.is_published AND r.resource_type = 'study_material')::int AS material_count,
      (SELECT count(*) FROM tests t WHERE t.subject_id = s.id AND t.is_published)::int AS test_count
    FROM subjects s LEFT JOIN examinations e ON e.id = s.examination_id
    WHERE s.is_active AND s.id IN (SELECT subject_id FROM course_subjects WHERE course_id = ANY($1::int[]))
    ORDER BY e.sort_order NULLS LAST, e.id, s.sort_order, s.id`, [courseIds]);
  const groups = [];
  for (const s of subjects) {
    let g = groups.find((x) => x.exam_id === s.exam_id);
    if (!g) groups.push(g = { exam_id: s.exam_id, exam_en: s.exam_en, exam_mr: s.exam_mr, items: [] });
    g.items.push(s);
  }
  res.page('portal/subjects', { title: res.locals.t('portal.mySubjects'), groups });
}));

router.get('/subjects/:id', wrap(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return notFound(res);
  const subject = await db.one(`SELECT s.*, e.name_en AS exam_en, e.name_mr AS exam_mr, st.name_en AS stage_en, st.name_mr AS stage_mr
      FROM subjects s LEFT JOIN examinations e ON e.id = s.examination_id LEFT JOIN exam_stages st ON st.id = s.stage_id
      WHERE s.id = $1 AND s.is_active`, [id]);
  if (!subject) return notFound(res);
  const { courseIds } = await scope(req);
  const topics = await db.many('SELECT * FROM topics WHERE is_active AND subject_id = $1 ORDER BY sort_order, id', [id]);
  const lectures = await db.many(`${LEC_SQL} AND l.subject_id = $1${LEC_ORDER}`, [id]);
  const materials = decorate(req.candidate, await db.many(`${RES_SQL} AND r.resource_type = 'study_material' AND r.subject_id = $1${RES_ORDER}`, [id]), await grantSet(req.candidate.id));
  const tests = await db.many(`${TEST_SQL} AND t.subject_id = $2 AND (t.course_id IS NULL OR t.course_id = ANY($3::int[])) ORDER BY t.id`, [req.candidate.id, id, courseIds]);
  const qCount = (await db.one('SELECT count(*)::int AS n FROM questions WHERE in_question_bank AND is_active AND subject_id = $1', [id])).n;
  res.page('portal/subject-detail', { title: res.locals.L(subject, 'name'), subject, tree: topicTree(topics), lectures, materials, tests, qCount });
}));

// ================================================================ Study material
router.get('/study-material', wrap(async (req, res) => {
  const f = { exam: toInt(req.query.exam), course: toInt(req.query.course), subject: toInt(req.query.subject), topic: toInt(req.query.topic) };
  const w = where();
  if (f.exam) w.add('r.examination_id = ?', f.exam);
  if (f.course) w.add('r.course_id = ?', f.course);
  if (f.subject) w.add('r.subject_id = ?', f.subject);
  if (f.topic) w.add('r.topic_id = ?', f.topic);
  const rows = decorate(req.candidate, await db.many(`${RES_SQL} AND r.resource_type = 'study_material'${w.sql()}${RES_ORDER}`, w.params), await grantSet(req.candidate.id));
  const groups = [];
  for (const r of rows) {
    let g = groups.find((x) => x.subject_id === r.subject_id);
    if (!g) groups.push(g = { subject_id: r.subject_id, subject_en: r.subject_en, subject_mr: r.subject_mr, items: [] });
    g.items.push(r);
  }
  const opts = await filterOptions(res, ['exam', 'course', 'subject', 'topic'], f.subject);
  res.page('portal/study-material', { title: res.locals.t('portal.studyMaterial'), f, opts, groups, total: rows.length });
}));

// ================================================================ Learning resources (videos, YouTube, ...)
const RES_TYPES = ['video', 'youtube', 'question_bank', 'guest_lecture', 'pdf'];
router.get('/resources', wrap(async (req, res) => {
  const type = RES_TYPES.includes(req.query.type) ? req.query.type : 'video';
  const f = { type, exam: toInt(req.query.exam), subject: toInt(req.query.subject), topic: toInt(req.query.topic) };
  const w = where().add('r.resource_type = ?', type);
  if (f.exam) w.add('r.examination_id = ?', f.exam);
  if (f.subject) w.add('r.subject_id = ?', f.subject);
  if (f.topic) w.add('r.topic_id = ?', f.topic);
  const items = decorate(req.candidate, await db.many(`${RES_SQL}${w.sql()}${RES_ORDER}`, w.params), await grantSet(req.candidate.id));
  const opts = await filterOptions(res, ['exam', 'subject', 'topic'], f.subject);
  res.page('portal/resources', { title: res.locals.t('resourceType.' + type), f, opts, items, types: RES_TYPES });
}));

// ================================================================ Question bank (practice; nothing stored)
async function bankQuestions(f) {
  const w = where();
  if (f.exam) w.add('q.examination_id = ?', f.exam);
  if (f.subject) w.add('q.subject_id = ?', f.subject);
  if (f.topic) w.add('q.topic_id = ?', f.topic);
  w.params.push(f.n);
  return db.many(`SELECT q.*, s.name_en AS subject_en, s.name_mr AS subject_mr, tp.name_en AS topic_en, tp.name_mr AS topic_mr
      FROM questions q LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics tp ON tp.id = q.topic_id
      WHERE q.in_question_bank AND q.is_active${w.sql()} ORDER BY q.id LIMIT $${w.params.length}`, w.params);
}
function bankFilters(src) {
  const n = toInt(one(src.n));
  return { exam: toInt(one(src.exam)), subject: toInt(one(src.subject)), topic: toInt(one(src.topic)), n: n ? Math.min(Math.max(n, 1), 50) : 10 };
}

router.get('/question-bank', wrap(async (req, res) => {
  const f = bankFilters(req.query);
  const questions = await bankQuestions(f);
  const opts = await filterOptions(res, ['exam', 'subject', 'topic'], f.subject);
  res.page('portal/question-bank', { title: res.locals.t('portal.questionBank'), f, opts, questions, checked: false, answers: {}, tally: null });
}));

router.post('/question-bank/check', wrap(async (req, res) => {
  const f = bankFilters(req.body);
  const raw = req.body.qid;
  const ids = [...new Set((Array.isArray(raw) ? raw : [raw]).map(toInt).filter(Boolean))].slice(0, 50);
  const rows = ids.length ? await db.many(`SELECT q.*, s.name_en AS subject_en, s.name_mr AS subject_mr, tp.name_en AS topic_en, tp.name_mr AS topic_mr
      FROM questions q LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN topics tp ON tp.id = q.topic_id
      WHERE q.id = ANY($1::int[]) AND q.in_question_bank AND q.is_active`, [ids]) : [];
  const questions = ids.map((id) => rows.find((q) => q.id === id)).filter(Boolean);
  const answers = {};
  const tally = { correct: 0, incorrect: 0, unanswered: 0, total: questions.length };
  for (const q of questions) {
    const a = str(req.body['ans_' + q.id], 1);
    if (OPTS.includes(a)) { answers[q.id] = a; tally[a === q.correct_option ? 'correct' : 'incorrect']++; } else tally.unanswered++;
  }
  const opts = await filterOptions(res, ['exam', 'subject', 'topic'], f.subject);
  res.page('portal/question-bank', { title: res.locals.t('portal.questionBank'), f, opts, questions, checked: true, answers, tally });
}));

// ================================================================ Online tests
async function findTest(req, id) {
  const { courseIds } = await scope(req);
  const w = where([req.candidate.id]).add('t.id = ?', id).add(TEST_MINE, courseIds);
  return db.one(`${TEST_SQL}${w.sql()}`, w.params);
}
function testQuestions(testId) {
  return db.many(`SELECT q.* FROM test_questions tq JOIN questions q ON q.id = tq.question_id AND q.is_active
      WHERE tq.test_id = $1 ORDER BY tq.sort_order, q.id`, [testId]);
}

router.get('/tests', wrap(async (req, res) => {
  const { courseIds } = await scope(req);
  const w = where([req.candidate.id]).add(TEST_MINE, courseIds);
  const tests = await db.many(`${TEST_SQL}${w.sql()} ORDER BY t.test_type, t.id`, w.params);
  res.page('portal/tests', { title: res.locals.t('portal.tests'), tests });
}));

router.get('/tests/:id', wrap(async (req, res) => {
  const id = toInt(req.params.id);
  const test = id && await findTest(req, id);
  if (!test) return notFound(res);
  const open = await db.one('SELECT id FROM test_attempts WHERE test_id = $1 AND candidate_id = $2 AND submitted_at IS NULL ORDER BY id DESC LIMIT 1', [id, req.candidate.id]);
  res.page('portal/test-instructions', { title: res.locals.L(test, 'title'), test, open });
}));

router.post('/tests/:id/start', wrap(async (req, res) => {
  const id = toInt(req.params.id);
  const test = id && await findTest(req, id);
  if (!test) return notFound(res);
  if (!test.q_count) { flash(req, 'warning', res.locals.t('pt.noQuestionsYet')); return res.redirect('/portal/tests/' + id); }
  // Resume an unfinished attempt instead of creating duplicates
  let attempt = await db.one('SELECT id FROM test_attempts WHERE test_id = $1 AND candidate_id = $2 AND submitted_at IS NULL ORDER BY id DESC LIMIT 1', [id, req.candidate.id]);
  if (!attempt) attempt = await db.one('INSERT INTO test_attempts (test_id, candidate_id) VALUES ($1, $2) RETURNING id', [id, req.candidate.id]);
  res.redirect('/portal/attempts/' + attempt.id);
}));

async function ownAttempt(req, id) {
  if (!id) return null;
  return db.one(`SELECT a.*, t.title_en, t.title_mr, t.test_type FROM test_attempts a JOIN tests t ON t.id = a.test_id
      WHERE a.id = $1 AND a.candidate_id = $2`, [id, req.candidate.id]);
}

router.get('/attempts/:id', wrap(async (req, res) => {
  const attempt = await ownAttempt(req, toInt(req.params.id));
  if (!attempt) return notFound(res);
  if (attempt.submitted_at) return res.redirect(`/portal/attempts/${attempt.id}/result`);
  const questions = await testQuestions(attempt.test_id);
  res.page('portal/attempt', { title: res.locals.L(attempt, 'title'), attempt, questions });
}));

router.post('/attempts/:id/submit', wrap(async (req, res) => {
  const attempt = await ownAttempt(req, toInt(req.params.id));
  if (!attempt) return notFound(res);
  if (attempt.submitted_at) return res.redirect(`/portal/attempts/${attempt.id}/result`);
  const questions = await testQuestions(attempt.test_id);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query('SELECT submitted_at FROM test_attempts WHERE id = $1 FOR UPDATE', [attempt.id]);
    if (!lock.rows[0].submitted_at) {
      const s = { correct: 0, incorrect: 0, unanswered: 0 };
      await client.query('DELETE FROM attempt_answers WHERE attempt_id = $1', [attempt.id]);
      for (const q of questions) {
        const sel = str(req.body['ans_' + q.id], 1);
        const picked = OPTS.includes(sel) ? sel : null;
        const ok = picked ? picked === q.correct_option : false;
        if (!picked) s.unanswered++; else s[ok ? 'correct' : 'incorrect']++;
        await client.query('INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct) VALUES ($1, $2, $3, $4)', [attempt.id, q.id, picked, ok]);
      }
      // Score = number of correct answers. Negative marking / weightage: HOLD (not applied)
      await client.query(`UPDATE test_attempts SET total = $2, correct = $3, incorrect = $4, unanswered = $5, submitted_at = now() WHERE id = $1`,
        [attempt.id, questions.length, s.correct, s.incorrect, s.unanswered]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  flash(req, 'success', res.locals.t('pt.testSubmitted'));
  res.redirect(`/portal/attempts/${attempt.id}/result`);
}));

router.get('/attempts/:id/result', wrap(async (req, res) => {
  const attempt = await ownAttempt(req, toInt(req.params.id));
  if (!attempt) return notFound(res);
  if (!attempt.submitted_at) return res.redirect('/portal/attempts/' + attempt.id);
  const review = await db.many(`SELECT q.*, aa.selected_option, aa.is_correct FROM attempt_answers aa
      JOIN questions q ON q.id = aa.question_id LEFT JOIN test_questions tq ON tq.test_id = $2 AND tq.question_id = q.id
      WHERE aa.attempt_id = $1 ORDER BY tq.sort_order NULLS LAST, q.id`, [attempt.id, attempt.test_id]);
  res.page('portal/attempt-result', { title: res.locals.t('pt.testResult'), attempt, review });
}));

router.get('/results', wrap(async (req, res) => {
  const attempts = await db.many(`SELECT a.*, t.title_en, t.title_mr, t.test_type, su.name_en AS subject_en, su.name_mr AS subject_mr
      FROM test_attempts a JOIN tests t ON t.id = a.test_id LEFT JOIN subjects su ON su.id = t.subject_id
      WHERE a.candidate_id = $1 AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC`, [req.candidate.id]);
  res.page('portal/results', { title: res.locals.t('portal.results'), attempts });
}));

// ================================================================ Psychological / aptitude assessment (framework only)
router.get('/assessment', wrap(async (req, res) => {
  const assessments = await db.many(`SELECT * FROM assessments ORDER BY CASE area WHEN 'adaptability' THEN 1 WHEN 'interest' THEN 2 ELSE 3 END, id`);
  res.page('portal/assessment', { title: res.locals.t('portal.assessment'), assessments });
}));

// ================================================================ Lectures & guest lectures
const LEC_TYPES = ['regular', 'guest', 'guidance', 'special'];
const GUEST_TYPES = ['guest', 'special', 'guidance'];

async function lectureList(req, res, guest) {
  const today = res.locals.today;
  const tabs = guest ? ['upcoming', 'past'] : ['upcoming', 'past', 'mine'];
  const tab = tabs.includes(req.query.tab) ? req.query.tab : 'upcoming';
  const types = guest ? GUEST_TYPES : LEC_TYPES;
  const f = { tab, type: types.includes(req.query.type) ? req.query.type : '', mode: ['online', 'offline'].includes(req.query.mode) ? req.query.mode : '' };
  const w = where();
  if (guest) w.add('l.lecture_type = ANY(?::text[])', GUEST_TYPES);
  if (f.type) w.add('l.lecture_type = ?', f.type);
  if (f.mode) w.add('l.mode = ?', f.mode);
  let order = LEC_ORDER;
  if (tab === 'upcoming') w.add('l.lecture_date >= ?', today);
  if (tab === 'past') { w.add('l.lecture_date < ?', today); order = ' ORDER BY l.lecture_date DESC, l.start_time DESC NULLS LAST, l.id DESC'; }
  if (tab === 'mine') {
    const { courseIds, examIds } = await scope(req);
    w.add(MINE_LEC, courseIds, examIds);
    // upcoming first (soonest first), then past (most recent first)
    w.params.push(today);
    const p = '$' + w.params.length;
    order = ` ORDER BY (l.lecture_date < ${p}::date), CASE WHEN l.lecture_date >= ${p}::date THEN l.lecture_date END, l.lecture_date DESC, l.start_time NULLS LAST, l.id`;
  }
  const lectures = await db.many(`${LEC_SQL}${w.sql()}${order} LIMIT 100`, w.params);
  const base = guest ? '/portal/guest-lectures' : '/portal/lectures';
  res.page('portal/lectures', { title: res.locals.t(guest ? 'portal.guestLectures' : 'portal.myLectures'), guest, base, tabs, types, f, lectures });
}
router.get('/lectures', wrap((req, res) => lectureList(req, res, false)));
router.get('/guest-lectures', wrap((req, res) => lectureList(req, res, true)));

router.get('/lectures/:id', wrap(async (req, res) => {
  const id = toInt(req.params.id);
  const lec = id && await db.one(`${LEC_SQL} AND l.id = $1`, [id]);
  if (!lec) return notFound(res);
  const { courseIds } = await scope(req);
  const tests = await db.many(`${TEST_SQL} AND t.lecture_id = $2 AND (t.course_id IS NULL OR t.course_id = ANY($3::int[])) ORDER BY t.id`, [req.candidate.id, id, courseIds]);
  res.page('portal/lecture-detail', { title: res.locals.L(lec, 'title'), lec, tests, canSee: canSeeLecture(req.candidate, lec) });
}));

// ================================================================ Timetable
router.get('/timetable', wrap(async (req, res) => {
  const q = req.query;
  const f = {
    exam: toInt(q.exam), course: toInt(q.course), subject: toInt(q.subject),
    mode: ['online', 'offline'].includes(q.mode) ? q.mode : '',
    from: isDate(q.from) ? q.from : (q.f ? '' : res.locals.today), to: isDate(q.to) ? q.to : '',
    mine: q.f ? q.mine === '1' : true, // checkbox defaults to ON until the form is submitted
  };
  const w = where();
  if (f.exam) w.add('l.examination_id = ?', f.exam);
  if (f.course) w.add('l.course_id = ?', f.course);
  if (f.subject) w.add('l.subject_id = ?', f.subject);
  if (f.mode) w.add('l.mode = ?', f.mode);
  if (f.from) w.add('l.lecture_date >= ?', f.from);
  if (f.to) w.add('l.lecture_date <= ?', f.to);
  if (f.mine) { const { courseIds, examIds } = await scope(req); w.add(MINE_LEC, courseIds, examIds); }
  const rows = await db.many(`${LEC_SQL}${w.sql()}${LEC_ORDER} LIMIT 200`, w.params);
  const opts = await filterOptions(res, ['exam', 'course', 'subject']);
  const cand = req.candidate;
  res.page('portal/timetable', { title: res.locals.t('portal.timetable'), f, opts, rows, canSee: (l) => canSeeLecture(cand, l) });
}));

// ================================================================ स्पर्धा परीक्षा यात्रा
router.get('/yatra', wrap(async (req, res) => {
  const entries = await db.many(`SELECT ts.*, sp.name_mr AS speaker_mr, sp.designation_en, sp.designation_mr FROM travel_schedules ts
      LEFT JOIN speakers sp ON sp.id = ts.speaker_id WHERE ts.is_published AND ts.schedule_date >= $1
      ORDER BY ts.schedule_date, ts.start_time NULLS LAST, ts.id`, [res.locals.today]);
  res.page('portal/yatra', { title: res.locals.t('portal.yatra'), entries });
}));

// ================================================================ Offline courses, booking
const BATCH_SQL = `SELECT b.*, (b.end_date - b.start_date) AS period_days,
    c.title_en AS course_en, c.title_mr AS course_mr, c.mode AS course_mode, ex.name_en AS exam_en, ex.name_mr AS exam_mr,
    ce.centre_no, ce.name_en AS centre_en, ce.name_mr AS centre_mr, ce.location AS centre_location, ce.address AS centre_address,
    (SELECT string_agg(s.name_en, ', ' ORDER BY s.sort_order, s.id) FROM course_subjects cs JOIN subjects s ON s.id = cs.subject_id AND s.is_active WHERE cs.course_id = c.id) AS subjects_en,
    (SELECT string_agg(COALESCE(s.name_mr, s.name_en), ', ' ORDER BY s.sort_order, s.id) FROM course_subjects cs JOIN subjects s ON s.id = cs.subject_id AND s.is_active WHERE cs.course_id = c.id) AS subjects_mr
  FROM batches b JOIN courses c ON c.id = b.course_id AND c.is_active
  LEFT JOIN examinations ex ON ex.id = c.examination_id LEFT JOIN centres ce ON ce.id = b.centre_id
  WHERE b.is_active`;

router.get('/offline', wrap(async (req, res) => {
  const batches = await db.many(`${BATCH_SQL} ORDER BY b.start_date NULLS LAST, b.id`);
  const bookings = await db.many('SELECT id, batch_id, status FROM offline_bookings WHERE candidate_id = $1', [req.candidate.id]);
  const booked = Object.fromEntries(bookings.map((b) => [b.batch_id, b]));
  res.page('portal/offline', { title: res.locals.t('portal.offline'), batches, booked });
}));

const depositApplies = (batch, accYes) => batch.deposit_applicability === 'all_participants'
  || (batch.deposit_applicability === 'accommodation_only' && accYes);

// Returns the batch if the candidate may book it, otherwise flashes the reason and redirects
async function bookableBatch(req, res) {
  const id = toInt(req.params.batchId);
  const batch = id && await db.one(`${BATCH_SQL} AND b.id = $1`, [id]);
  if (!batch) { notFound(res); return null; }
  const t = res.locals.t;
  let reason = null;
  if (!batch.booking_open) reason = t('pt.bookingClosed');
  else if (req.candidate.verification_status !== 'verified') reason = t('pt.verifiedOnlyBook');
  else if (await db.one('SELECT id FROM offline_bookings WHERE candidate_id = $1 AND batch_id = $2', [req.candidate.id, id])) reason = t('pt.alreadyBooked');
  if (reason) { flash(req, 'warning', reason); res.redirect('/portal/offline'); return null; }
  return batch;
}

function renderBooking(res, batch, values, errors = {}) {
  res.status(Object.keys(errors).length ? 422 : 200)
    .page('portal/offline-book', { title: res.locals.t('pt.bookTitle'), batch, values, errors });
}

router.get('/offline/book/:batchId', wrap(async (req, res) => {
  const batch = await bookableBatch(req, res);
  if (!batch) return;
  renderBooking(res, batch, { contact_mobile: req.candidate.mobile || '', contact_email: req.candidate.email || '', accommodation_required: '', transaction_ref: '', remarks: '' });
}));

const proofUpload = uploader('private/proofs', { images: true, pdf: true }).single('proof');
router.post('/offline/book/:batchId', proofUpload, wrap(async (req, res) => {
  const discard = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  const batch = await bookableBatch(req, res);
  if (!batch) return discard();
  const t = res.locals.t;
  const body = req.body || {};
  const v = {
    contact_mobile: str(body.contact_mobile, 20), contact_email: str(body.contact_email, 200),
    accommodation_required: str(body.accommodation_required, 3), transaction_ref: str(body.transaction_ref, 100), remarks: str(body.remarks, 1000),
  };
  const errors = {};
  if (!v.contact_mobile) errors.contact_mobile = t('pt.errMobile');
  else if (!/^[0-9+\-\s]{10,20}$/.test(v.contact_mobile)) errors.contact_mobile = t('pt.errMobileFormat');
  if (v.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact_email)) errors.contact_email = t('pt.errEmail');
  if (!['yes', 'no'].includes(v.accommodation_required)) errors.accommodation_required = t('pt.errAccommodation');
  else if (v.accommodation_required === 'yes' && !batch.accommodation_available) errors.accommodation_required = t('pt.errAccommodationNA');
  const accYes = v.accommodation_required === 'yes';
  const applies = !errors.accommodation_required && depositApplies(batch, accYes);
  if (applies && !req.file) errors.proof = t('pt.errProof');
  if (Object.keys(errors).length) {
    discard();
    if (req.file) errors.proof = errors.proof || t('pt.errReupload');
    return renderBooking(res, batch, v, errors);
  }
  if (!applies) discard(); // proof not needed – do not keep stray files
  const inserted = await db.one(`INSERT INTO offline_bookings
      (candidate_id, batch_id, contact_mobile, contact_email, accommodation_required, deposit_amount, payment_status, transaction_ref, proof_path, status, refund_status, remarks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted', $10, $11)
      ON CONFLICT (candidate_id, batch_id) DO NOTHING RETURNING id`,
  [req.candidate.id, batch.id, v.contact_mobile, v.contact_email || null, accYes, applies ? batch.deposit_amount : null,
    applies ? 'proof_submitted' : 'not_applicable', applies ? (v.transaction_ref || null) : null, applies ? relUpload(req.file) : null,
    applies ? 'hold' : 'not_applicable', v.remarks || null]);
  if (!inserted) { discard(); flash(req, 'warning', t('pt.alreadyBooked')); return res.redirect('/portal/bookings'); }
  flash(req, 'success', t('pt.bookingSuccess'));
  res.redirect('/portal/bookings');
}));

router.get('/bookings', wrap(async (req, res) => {
  const bookings = await db.many(`SELECT ob.*, b.name AS batch_name, b.start_date, b.end_date, b.deposit_applicability,
      c.title_en AS course_en, c.title_mr AS course_mr, ce.name_en AS centre_en, ce.name_mr AS centre_mr
    FROM offline_bookings ob JOIN batches b ON b.id = ob.batch_id LEFT JOIN courses c ON c.id = b.course_id
    LEFT JOIN centres ce ON ce.id = b.centre_id WHERE ob.candidate_id = $1 ORDER BY ob.created_at DESC`, [req.candidate.id]);
  res.page('portal/bookings', { title: res.locals.t('portal.bookings'), bookings });
}));

router.get('/centres', wrap(async (req, res) => {
  const centres = await db.many('SELECT * FROM centres WHERE is_active ORDER BY centre_no NULLS LAST, id');
  const batches = await db.many(`${BATCH_SQL} AND b.centre_id IS NOT NULL ORDER BY b.start_date NULLS LAST, b.id`);
  res.page('portal/centres', { title: res.locals.t('portal.centres'), centres, batches });
}));

// ================================================================ Announcements & links
const ANN_CATS = ['important', 'event', 'guest_lecture', 'training', 'exam'];
router.get('/announcements', wrap(async (req, res) => {
  const cat = ANN_CATS.includes(req.query.cat) ? req.query.cat : '';
  const params = [res.locals.today];
  let sql = `SELECT * FROM announcements WHERE ${ANN_ACTIVE}`;
  if (cat) { params.push(cat); sql += ' AND category = $2'; }
  const items = await db.many(sql + ' ORDER BY created_at DESC, id DESC', params);
  res.page('portal/announcements', { title: res.locals.t('portal.announcements'), cat, cats: ANN_CATS, items });
}));

const LINK_CATS = ['exam_website', 'syllabus', 'exam_timetable', 'amrut', 'other'];
router.get('/links', wrap(async (req, res) => {
  const links = await db.many(`SELECT il.*, e.name_en AS exam_en, e.name_mr AS exam_mr FROM important_links il
      LEFT JOIN examinations e ON e.id = il.examination_id WHERE il.is_active ORDER BY il.sort_order, il.id`);
  const groups = LINK_CATS.map((c) => ({ cat: c, items: links.filter((l) => l.category === c) })).filter((g) => g.items.length);
  res.page('portal/links', { title: res.locals.t('portal.links'), groups });
}));

// ================================================================ Profile (read-only)
router.get('/profile', wrap(async (req, res) => {
  const courses = await myCourses(req.candidate.id, res.locals.today);
  const grants = (await db.one('SELECT count(*)::int AS n FROM resource_grants WHERE candidate_id = $1', [req.candidate.id])).n;
  res.page('portal/profile', { title: res.locals.t('portal.profile'), courses, grants });
}));

module.exports = router;
