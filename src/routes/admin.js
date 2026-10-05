const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const crud = require('../admin/crud');
const { resources, byKey } = require('../admin/resources');
const settingsSvc = require('../services/settings');
const { flash, requireAdmin, uploader, relUpload } = require('../middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const int = (v) => (/^\d+$/.test(String(v || '')) ? Number(v) : null);

router.use((req, res, next) => { res.locals.layout = 'layouts/admin'; res.locals.adminResources = resources; next(); });

// ---------------------------------------------------------------- Auth (roles & permissions: HOLD)
router.get('/login', (req, res) => {
  if (req.admin) return res.redirect('/admin');
  res.page('admin/login', { title: 'Admin Login', layout: 'layouts/public', error: null, email: '' });
});
router.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const a = email ? await db.one('SELECT * FROM admins WHERE lower(email) = $1 AND is_active', [email]) : null;
  if (!a || !(await bcrypt.compare(String(req.body.password || ''), a.password_hash))) {
    res.status(401);
    return res.page('admin/login', { title: 'Admin Login', layout: 'layouts/public', error: 'Invalid email or password.', email });
  }
  const langPref = req.session.lang;
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.adminId = a.id;
    req.session.lang = langPref;
    res.redirect('/admin');
  });
}));
router.post('/logout', (req, res) => { delete req.session.adminId; res.redirect('/admin/login'); });

router.use(requireAdmin);

// ---------------------------------------------------------------- Dashboard
router.get('/', wrap(async (req, res) => {
  const c = await db.one(`SELECT
    (SELECT count(*) FROM candidates)::int AS candidates,
    (SELECT count(*) FROM candidates WHERE verification_status = 'pending')::int AS pending,
    (SELECT count(*) FROM examinations WHERE is_active)::int AS exams,
    (SELECT count(*) FROM courses WHERE is_active)::int AS courses,
    (SELECT count(*) FROM lectures WHERE lecture_date >= CURRENT_DATE AND is_published)::int AS upcoming,
    (SELECT count(*) FROM resources WHERE is_published)::int AS resources,
    (SELECT count(*) FROM offline_bookings WHERE status = 'submitted')::int AS bookings,
    (SELECT count(*) FROM offline_bookings WHERE payment_status = 'proof_submitted')::int AS proofs,
    (SELECT count(*) FROM contributors WHERE status = 'new')::int AS contributors,
    (SELECT count(*) FROM questions WHERE is_active)::int AS questions`);
  const [lectures, bookings, contributors] = await Promise.all([
    db.many(`SELECT id, title_en, lecture_date, start_time, mode, lecture_type FROM lectures WHERE lecture_date >= CURRENT_DATE ORDER BY lecture_date, start_time LIMIT 6`),
    db.many(`SELECT b.id, b.created_at, b.payment_status, b.status, c.name, bt.name AS batch FROM offline_bookings b JOIN candidates c ON c.id = b.candidate_id JOIN batches bt ON bt.id = b.batch_id ORDER BY b.created_at DESC LIMIT 5`),
    db.many(`SELECT id, name, contribution_type, created_at FROM contributors ORDER BY created_at DESC LIMIT 5`),
  ]);
  res.page('admin/dashboard', { title: 'Dashboard', c, lectures, bookings, contributors });
}));

// ---------------------------------------------------------------- Candidates & verification
router.get('/verification', (req, res) => res.redirect('/admin/candidates?verification=pending'));

router.get('/candidates', wrap(async (req, res) => {
  const f = { q: req.query.q || '', category: req.query.category || '', verification: req.query.verification || '' };
  const rows = await db.many(`SELECT c.*, (SELECT count(*) FROM enrollments e WHERE e.candidate_id = c.id)::int AS courses
    FROM candidates c
    WHERE ($1 = '' OR c.name ILIKE '%' || $1 || '%' OR c.candidate_uid ILIKE '%' || $1 || '%' OR c.mobile ILIKE '%' || $1 || '%' OR c.email ILIKE '%' || $1 || '%')
      AND ($2 = '' OR c.category = $2) AND ($3 = '' OR c.verification_status = $3)
    ORDER BY c.created_at DESC LIMIT 200`, [f.q, f.category, f.verification]);
  res.page('admin/candidates', { title: 'Candidates', rows, f });
}));

router.get('/candidates/new', (req, res) => res.page('admin/candidate-new', { title: 'Add candidate', v: {}, errors: {} }));
router.post('/candidates', wrap(async (req, res) => {
  const v = req.body; const errors = {};
  if (!String(v.name || '').trim()) errors.name = 'Required';
  if (!['lakshit', 'non_lakshit'].includes(v.category)) errors.category = 'Required';
  if (v.candidate_uid && await db.one('SELECT 1 FROM candidates WHERE upper(candidate_uid) = upper($1)', [v.candidate_uid.trim()])) errors.candidate_uid = 'This Candidate ID already exists';
  if (v.password && v.password.length < 8) errors.password = 'Minimum 8 characters';
  if (Object.keys(errors).length) { res.status(422); return res.page('admin/candidate-new', { title: 'Add candidate', v, errors }); }
  const row = await db.one(`INSERT INTO candidates (candidate_uid, mahaamrut_ref, name, mobile, email, category, verification_status, password_hash)
    VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING id`,
  [v.candidate_uid ? v.candidate_uid.trim() : null, v.mahaamrut_ref || null, v.name.trim(), v.mobile || null, v.email || null, v.category, v.password ? await bcrypt.hash(v.password, 10) : null]);
  flash(req, 'success', 'Candidate added.');
  res.redirect('/admin/candidates/' + row.id);
}));

async function candidatePage(req, res, next, extra = {}) {
  const c = await db.one('SELECT * FROM candidates WHERE id = $1', [int(req.params.id)]);
  if (!c) return next();
  const [enrollments, grants, bookings, attempts, courses, batches, materials] = await Promise.all([
    db.many(`SELECT e.*, co.title_en AS course, b.name AS batch FROM enrollments e JOIN courses co ON co.id = e.course_id LEFT JOIN batches b ON b.id = e.batch_id WHERE e.candidate_id = $1 ORDER BY e.id`, [c.id]),
    db.many(`SELECT g.*, r.title_en, r.resource_type, r.access_level FROM resource_grants g JOIN resources r ON r.id = g.resource_id WHERE g.candidate_id = $1 ORDER BY g.granted_at DESC`, [c.id]),
    db.many(`SELECT b.*, bt.name AS batch FROM offline_bookings b JOIN batches bt ON bt.id = b.batch_id WHERE b.candidate_id = $1 ORDER BY b.created_at DESC`, [c.id]),
    db.many(`SELECT a.*, t.title_en FROM test_attempts a JOIN tests t ON t.id = a.test_id WHERE a.candidate_id = $1 AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC LIMIT 20`, [c.id]),
    db.many('SELECT id, title_en FROM courses WHERE is_active ORDER BY sort_order, id'),
    db.many('SELECT b.id, b.name, b.course_id FROM batches b WHERE b.is_active ORDER BY b.start_date DESC NULLS LAST'),
    db.many(`SELECT id, title_en, resource_type FROM resources WHERE access_level <> 'public' ORDER BY resource_type, title_en`),
  ]);
  res.page('admin/candidate', { title: c.name, c, enrollments, grants, bookings, attempts, courses, batches, materials, errors: {}, ...extra });
}
router.get('/candidates/:id', wrap((req, res, next) => candidatePage(req, res, next)));

router.post('/candidates/:id', wrap(async (req, res, next) => {
  const id = int(req.params.id);
  const v = req.body; const errors = {};
  if (!String(v.name || '').trim()) errors.name = 'Required';
  if (!['lakshit', 'non_lakshit'].includes(v.category)) errors.category = 'Choose a category';
  if (!['pending', 'verified', 'rejected'].includes(v.verification_status)) errors.verification_status = 'Choose a status';
  if (!['registered', 'incomplete'].includes(v.registration_status)) errors.registration_status = 'Choose a status';
  if (v.candidate_uid && await db.one('SELECT 1 FROM candidates WHERE upper(candidate_uid) = upper($1) AND id <> $2', [v.candidate_uid.trim(), id])) errors.candidate_uid = 'This Candidate ID already exists';
  if (Object.keys(errors).length) { res.status(422); return candidatePage(req, res, next, { errors }); }
  await db.q(`UPDATE candidates SET name=$2, candidate_uid=$3, mahaamrut_ref=$4, mobile=$5, email=$6, category=$7, registration_status=$8,
      verification_status=$9, verification_remarks=$10, study_material_permitted=$11, is_active=$12 WHERE id=$1`,
  [id, v.name.trim(), v.candidate_uid ? v.candidate_uid.trim() : null, v.mahaamrut_ref || null, v.mobile || null, v.email || null, v.category,
    v.registration_status, v.verification_status, v.verification_remarks || null, v.study_material_permitted === 'on', v.is_active === 'on']);
  flash(req, 'success', 'Candidate updated.');
  res.redirect('/admin/candidates/' + id);
}));

router.post('/candidates/:id/password', wrap(async (req, res) => {
  const id = int(req.params.id);
  if (String(req.body.password || '').length < 8) flash(req, 'error', 'Password must be at least 8 characters.');
  else { await db.q('UPDATE candidates SET password_hash = $2 WHERE id = $1', [id, await bcrypt.hash(req.body.password, 10)]); flash(req, 'success', 'Prototype login password set.'); }
  res.redirect('/admin/candidates/' + id);
}));

router.post('/candidates/:id/enroll', wrap(async (req, res) => {
  const id = int(req.params.id);
  const course = int(req.body.course_id);
  if (course) {
    await db.q(`INSERT INTO enrollments (candidate_id, course_id, batch_id) VALUES ($1,$2,$3)
      ON CONFLICT (candidate_id, course_id) DO UPDATE SET batch_id = EXCLUDED.batch_id, status = 'active'`, [id, course, int(req.body.batch_id)]);
    flash(req, 'success', 'Course assigned.');
  }
  res.redirect('/admin/candidates/' + id + '#courses');
}));
router.post('/candidates/:id/enroll/:eid/delete', wrap(async (req, res) => {
  await db.q('DELETE FROM enrollments WHERE id = $1 AND candidate_id = $2', [int(req.params.eid), int(req.params.id)]);
  flash(req, 'success', 'Course removed.');
  res.redirect('/admin/candidates/' + req.params.id + '#courses');
}));
router.post('/candidates/:id/grants', wrap(async (req, res) => {
  const rid = int(req.body.resource_id);
  if (rid) await db.q('INSERT INTO resource_grants (candidate_id, resource_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [int(req.params.id), rid]);
  flash(req, 'success', 'Resource access granted.');
  res.redirect('/admin/candidates/' + req.params.id + '#access');
}));
router.post('/candidates/:id/grants/:rid/delete', wrap(async (req, res) => {
  await db.q('DELETE FROM resource_grants WHERE candidate_id = $1 AND resource_id = $2', [int(req.params.id), int(req.params.rid)]);
  flash(req, 'success', 'Resource access removed.');
  res.redirect('/admin/candidates/' + req.params.id + '#access');
}));

// ---------------------------------------------------------------- Offline bookings, payments (transaction proofs) & refunds
router.get('/payments', (req, res) => res.redirect('/admin/bookings?tab=proofs'));
router.get('/refunds', (req, res) => res.redirect('/admin/bookings?tab=refunds'));
router.get('/bookings', wrap(async (req, res) => {
  const tab = ['proofs', 'refunds'].includes(req.query.tab) ? req.query.tab : 'all';
  const status = req.query.status || '';
  const cond = tab === 'proofs' ? "AND b.payment_status <> 'not_applicable'" : tab === 'refunds' ? "AND b.deposit_amount IS NOT NULL" : '';
  const rows = await db.many(`SELECT b.*, c.name, c.candidate_uid, bt.name AS batch, co.title_en AS course, ce.name_en AS centre
    FROM offline_bookings b JOIN candidates c ON c.id = b.candidate_id JOIN batches bt ON bt.id = b.batch_id
    LEFT JOIN courses co ON co.id = bt.course_id LEFT JOIN centres ce ON ce.id = bt.centre_id
    WHERE ($1 = '' OR b.status = $1) ${cond} ORDER BY b.created_at DESC LIMIT 300`, [status]);
  res.page('admin/bookings', { title: tab === 'proofs' ? 'Payments / Transaction Proofs' : tab === 'refunds' ? 'Refunds' : 'Offline Bookings', rows, tab, status });
}));
router.get('/bookings/:id', wrap(async (req, res, next) => {
  const b = await db.one(`SELECT b.*, c.name, c.candidate_uid, c.category, c.id AS cid, bt.name AS batch, bt.start_date, bt.end_date, bt.deposit_applicability,
      co.title_en AS course, ce.name_en AS centre
    FROM offline_bookings b JOIN candidates c ON c.id = b.candidate_id JOIN batches bt ON bt.id = b.batch_id
    LEFT JOIN courses co ON co.id = bt.course_id LEFT JOIN centres ce ON ce.id = bt.centre_id WHERE b.id = $1`, [int(req.params.id)]);
  if (!b) return next();
  res.page('admin/booking', { title: 'Booking #' + b.id, b });
}));
router.post('/bookings/:id', wrap(async (req, res) => {
  const v = req.body;
  const ok = (val, list) => list.includes(val);
  if (!ok(v.status, ['submitted', 'confirmed', 'rejected', 'cancelled', 'completed']) || !ok(v.payment_status, ['not_applicable', 'proof_submitted', 'verified', 'rejected'])) {
    flash(req, 'error', 'Invalid status.');
  } else {
    await db.q('UPDATE offline_bookings SET status = $2, payment_status = $3, admin_remarks = $4 WHERE id = $1', [int(req.params.id), v.status, v.payment_status, v.admin_remarks || null]);
    // Refund status is not changed here: refund policy, deductions and authority are HOLD.
    flash(req, 'success', 'Booking updated.');
  }
  res.redirect('/admin/bookings/' + req.params.id);
}));

// ---------------------------------------------------------------- Timetable view (lectures by date)
router.get('/timetable', wrap(async (req, res) => {
  const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const from = isDate(req.query.from) ? req.query.from : res.locals.today;
  const to = isDate(req.query.to) ? req.query.to : '';
  const rows = await db.many(`SELECT l.*, s.name_en AS speaker, e.short_name AS exam, sb.name_en AS subject, ce.name_en AS centre
    FROM lectures l LEFT JOIN speakers s ON s.id = l.speaker_id LEFT JOIN examinations e ON e.id = l.examination_id
    LEFT JOIN subjects sb ON sb.id = l.subject_id LEFT JOIN centres ce ON ce.id = l.centre_id
    WHERE l.lecture_date >= $1 AND ($2 = '' OR l.lecture_date <= $2::date) ORDER BY l.lecture_date, l.start_time LIMIT 500`, [from, to]);
  res.page('admin/timetable', { title: 'Timetable', rows, from, to });
}));

// ---------------------------------------------------------------- Test → question assignment
router.get('/tests/:id/questions', wrap(async (req, res, next) => {
  const test = await db.one('SELECT * FROM tests WHERE id = $1', [int(req.params.id)]);
  if (!test) return next();
  const subjectOnly = req.query.all !== '1' && test.subject_id;
  const questions = await db.many(`SELECT q.*, sb.name_en AS subject, tq.sort_order AS pos, (tq.test_id IS NOT NULL) AS selected
    FROM questions q LEFT JOIN subjects sb ON sb.id = q.subject_id LEFT JOIN test_questions tq ON tq.question_id = q.id AND tq.test_id = $1
    WHERE q.is_active AND ($2::int IS NULL OR q.subject_id = $2 OR tq.test_id IS NOT NULL)
    ORDER BY (tq.test_id IS NULL), tq.sort_order, q.id`, [test.id, subjectOnly ? test.subject_id : null]);
  res.page('admin/test-questions', { title: 'Questions – ' + test.title_en, test, questions, subjectOnly });
}));
router.post('/tests/:id/questions', wrap(async (req, res) => {
  const id = int(req.params.id);
  const ids = [].concat(req.body.question_id || []).map(int).filter(Boolean);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM test_questions WHERE test_id = $1', [id]);
    for (const [i, q] of ids.entries()) await client.query('INSERT INTO test_questions (test_id, question_id, sort_order) VALUES ($1,$2,$3)', [id, q, i]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  flash(req, 'success', `${ids.length} question(s) assigned to the test.`);
  res.redirect('/admin/tests/' + id + '/questions');
}));

// ---------------------------------------------------------------- Settings (general, integration, footer, favicon/logo, payment)
const GROUPS = { general: 'General & Branding', integration: 'Mahaamrut Integration', footer: 'Footer', payment: 'Payment / Security Deposit' };
router.get('/footer', (req, res) => res.redirect('/admin/settings?group=footer'));
router.get('/favicon', (req, res) => res.redirect('/admin/settings?group=general'));
router.get('/settings', wrap(async (req, res) => {
  const group = GROUPS[req.query.group] ? req.query.group : 'general';
  const rows = await db.many('SELECT * FROM settings WHERE group_name = $1 ORDER BY sort_order', [group]);
  res.page('admin/settings', { title: 'Settings – ' + GROUPS[group], rows, group, groups: GROUPS });
}));
router.post('/settings', uploader('public/settings', { images: true }).any(), wrap(async (req, res) => {
  const group = GROUPS[req.query.group] ? req.query.group : 'general';
  const rows = await db.many('SELECT * FROM settings WHERE group_name = $1', [group]);
  const files = Object.fromEntries((req.files || []).map((f) => [f.fieldname, f]));
  for (const s of rows) {
    let en = req.body[s.key + '__en'];
    const mr = req.body[s.key + '__mr'];
    if (s.input_type === 'image') {
      if (files[s.key]) en = '/uploads/' + relUpload(files[s.key]);
      else if (req.body[s.key + '__remove'] === 'on') en = '';
      else continue;
    }
    if (s.input_type === 'url' && en && !/^https?:\/\//i.test(en)) { flash(req, 'error', `${s.label}: link must start with http:// or https://`); return res.redirect('/admin/settings?group=' + group); }
    await db.q('UPDATE settings SET value_en = $2, value_mr = $3 WHERE key = $1', [s.key, en ?? s.value_en, mr === undefined ? s.value_mr : (mr || null)]);
  }
  settingsSvc.clear();
  flash(req, 'success', 'Settings saved.');
  res.redirect('/admin/settings?group=' + group);
}));

// ---------------------------------------------------------------- Admin roles (HOLD)
router.get('/roles', wrap(async (req, res) => {
  const admins = await db.many('SELECT id, name, email, role, is_active, created_at FROM admins ORDER BY id');
  res.page('admin/roles', { title: 'Admin Users & Roles', admins });
}));

// ---------------------------------------------------------------- Generic resource CRUD
function cfgOf(req) { return byKey[req.params.res]; }

router.get('/:res', wrap(async (req, res, next) => {
  const cfg = cfgOf(req); if (!cfg) return next();
  const [data, options] = await Promise.all([crud.list(cfg, req.query), crud.loadOptions(cfg)]);
  res.page('admin/list', { title: cfg.title, cfg, ...data, options });
}));
router.get('/:res/new', wrap(async (req, res, next) => {
  const cfg = cfgOf(req); if (!cfg || cfg.noCreate) return next();
  res.page('admin/form', { title: 'Add – ' + cfg.title, cfg, row: crud.defaults(cfg), options: await crud.loadOptions(cfg), errors: {}, isNew: true });
}));
router.get('/:res/:id/edit', wrap(async (req, res, next) => {
  const cfg = cfgOf(req); if (!cfg) return next();
  const row = await crud.get(cfg, int(req.params.id)); if (!row) return next();
  res.page('admin/form', { title: 'Edit – ' + cfg.title, cfg, row, options: await crud.loadOptions(cfg), errors: {}, isNew: false });
}));

function saveHandler(isNew) {
  return wrap(async (req, res, next) => {
    const cfg = cfgOf(req); if (!cfg || (isNew && cfg.noCreate)) return next();
    const existing = isNew ? null : await crud.get(cfg, int(req.params.id));
    if (!isNew && !existing) return next();
    const options = await crud.loadOptions(cfg);
    const { values, m2m, errors } = crud.parse(cfg, req.body, req.files, existing, options);
    if (Object.keys(errors).length) {
      res.status(422);
      return res.page('admin/form', { title: (isNew ? 'Add – ' : 'Edit – ') + cfg.title, cfg, row: { ...existing, ...req.body, ...values, ...m2m }, options, errors, isNew });
    }
    await crud.save(cfg, isNew ? null : existing.id, values, m2m);
    if (cfg.table === 'site_content') settingsSvc.clear();
    flash(req, 'success', `${cfg.title}: saved.`);
    res.redirect('/admin/' + cfg.key);
  });
}
const upload = (req, res, next) => { const cfg = cfgOf(req); if (!cfg) return next(); return uploader(cfg.upload || 'private/misc', { images: true, pdf: true, maxMb: 20 }).any()(req, res, next); };
router.post('/:res', upload, saveHandler(true));
router.post('/:res/:id', upload, saveHandler(false));

router.post('/:res/:id/delete', wrap(async (req, res, next) => {
  const cfg = cfgOf(req); if (!cfg || cfg.noDelete) return next();
  try {
    await crud.remove(cfg, int(req.params.id));
    flash(req, 'success', `${cfg.title}: deleted.`);
  } catch (e) {
    if (e.code !== '23503') throw e;
    flash(req, 'error', 'This record is in use by other records and cannot be deleted. Mark it inactive instead.');
  }
  res.redirect('/admin/' + cfg.key);
}));

module.exports = router;
