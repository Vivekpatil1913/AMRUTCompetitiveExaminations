const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const cat = require('../services/catalog');
const { canSeeLecture } = require('../services/access');
const { flash, uploader, relUpload } = require('../middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------------------------------------------------------------- Home
router.get('/', wrap(async (req, res) => {
  const [exams, categories, upcoming, featured, yatra, resCounts, announcements, links, advisory] = await Promise.all([
    db.many(`SELECT e.*, (SELECT count(*) FROM subjects s WHERE s.examination_id = e.id AND s.is_active)::int AS subject_count
               FROM examinations e WHERE e.is_active ORDER BY e.sort_order, e.id`),
    db.many(`SELECT cc.*, (SELECT count(*) FROM courses c WHERE c.category_id = cc.id AND c.is_active)::int AS course_count
               FROM course_categories cc WHERE cc.is_active ORDER BY cc.sort_order, cc.id`),
    cat.lectures({ from: res.locals.today }, { limit: 6 }),
    cat.lectures({ from: res.locals.today }, { order: "l.is_highlighted DESC, (l.lecture_type = 'regular'), l.lecture_date, l.start_time", limit: 4 }),
    db.many(`SELECT * FROM travel_schedules WHERE is_published AND schedule_date >= CURRENT_DATE ORDER BY schedule_date, start_time LIMIT 5`),
    db.many(`SELECT resource_type, count(*)::int AS n FROM resources WHERE is_published GROUP BY resource_type`),
    db.many(`SELECT * FROM announcements WHERE is_published AND (publish_from IS NULL OR publish_from <= CURRENT_DATE)
               AND (publish_to IS NULL OR publish_to >= CURRENT_DATE) ORDER BY created_at DESC LIMIT 6`),
    db.many('SELECT * FROM important_links WHERE is_active ORDER BY sort_order, id LIMIT 8'),
    db.many('SELECT * FROM speakers WHERE is_active AND is_advisory ORDER BY sort_order, id'),
  ]);
  const smSubjects = await db.many(`SELECT DISTINCT sb.id, sb.name_en, sb.name_mr, e.short_name FROM resources r JOIN subjects sb ON sb.id = r.subject_id
    LEFT JOIN examinations e ON e.id = sb.examination_id WHERE r.is_published AND r.resource_type = 'study_material' ORDER BY e.short_name, sb.name_en`);
  res.page('public/home', {
    title: '', exams, categories, upcoming, featured, yatra, announcements, links, advisory, smSubjects,
    resCounts: Object.fromEntries(resCounts.map((r) => [r.resource_type, r.n])), canSee: (l) => canSeeLecture(req.candidate, l),
  });
}));

router.get('/about', wrap(async (req, res) => {
  const advisory = await db.many('SELECT * FROM speakers WHERE is_active AND is_advisory ORDER BY sort_order, id');
  res.page('public/about', { title: res.locals.t('nav.about'), advisory });
}));

// ---------------------------------------------------------------- Examinations
router.get('/examinations', wrap(async (req, res) => {
  const exams = await db.many(`SELECT e.*,
      (SELECT count(*) FROM subjects s WHERE s.examination_id = e.id AND s.is_active)::int AS subject_count,
      (SELECT count(*) FROM courses c WHERE c.examination_id = e.id AND c.is_active)::int AS course_count,
      (SELECT count(*) FROM exam_stages st WHERE st.examination_id = e.id)::int AS stage_count
    FROM examinations e WHERE e.is_active ORDER BY e.sort_order, e.id`);
  res.page('public/examinations', { title: res.locals.t('nav.examinations'), exams });
}));

router.get('/examinations/:id', wrap(async (req, res, next) => {
  const exam = await db.one('SELECT * FROM examinations WHERE id = $1 AND is_active', [cat.int(req.params.id)]);
  if (!exam) return next();
  const [stages, subjects, topics, courses, upcoming, tests, links] = await Promise.all([
    db.many('SELECT * FROM exam_stages WHERE examination_id = $1 ORDER BY sort_order, id', [exam.id]),
    db.many('SELECT * FROM subjects WHERE examination_id = $1 AND is_active ORDER BY sort_order, id', [exam.id]),
    db.many(`SELECT t.* FROM topics t JOIN subjects s ON s.id = t.subject_id WHERE s.examination_id = $1 AND t.is_active ORDER BY t.sort_order, t.id`, [exam.id]),
    db.many(`SELECT c.*, cc.name_en AS cat_en, cc.name_mr AS cat_mr FROM courses c LEFT JOIN course_categories cc ON cc.id = c.category_id
             WHERE c.examination_id = $1 AND c.is_active ORDER BY c.sort_order, c.id`, [exam.id]),
    cat.lectures({ exam: exam.id, from: res.locals.today }, { limit: 5 }),
    db.many(`SELECT subject_id, count(*)::int AS n FROM tests WHERE examination_id = $1 AND is_published AND test_type = 'unit' GROUP BY subject_id`, [exam.id]),
    db.many('SELECT * FROM important_links WHERE examination_id = $1 AND is_active ORDER BY sort_order', [exam.id]),
  ]);
  const unitTests = Object.fromEntries(tests.map((x) => [x.subject_id, x.n]));
  subjects.forEach((s) => { s.tree = cat.buildTree(topics.filter((t) => t.subject_id === s.id)); s.unitTests = unitTests[s.id] || 0; });
  res.page('public/examination', { title: res.locals.L(exam, 'name'), exam, stages, subjects, courses, upcoming, links, base: '' });
}));

// ---------------------------------------------------------------- Courses
router.get('/courses', wrap(async (req, res) => {
  const categories = await db.many('SELECT * FROM course_categories WHERE is_active ORDER BY sort_order, id');
  const category = cat.int(req.query.category);
  const courses = await db.many(`
    SELECT c.*, cc.name_en AS cat_en, cc.name_mr AS cat_mr, e.name_en AS exam_en, e.name_mr AS exam_mr,
      ARRAY(SELECT CASE WHEN $2 = 'mr' AND s.name_mr IS NOT NULL THEN s.name_mr ELSE s.name_en END FROM course_subjects cs JOIN subjects s ON s.id = cs.subject_id
            WHERE cs.course_id = c.id ORDER BY s.sort_order, s.id) AS subject_names,
      (SELECT count(*) FROM batches b WHERE b.course_id = c.id AND b.is_active)::int AS batch_count
    FROM courses c LEFT JOIN course_categories cc ON cc.id = c.category_id LEFT JOIN examinations e ON e.id = c.examination_id
    WHERE c.is_active AND ($1::int IS NULL OR c.category_id = $1) ORDER BY cc.sort_order, c.sort_order, c.id`, [category, res.locals.lang]);
  res.page('public/courses', { title: res.locals.t('nav.courses'), categories, category, courses });
}));

router.get('/courses/:id', wrap(async (req, res, next) => {
  const course = await db.one(`SELECT c.*, cc.name_en AS cat_en, cc.name_mr AS cat_mr, e.id AS exam_id, e.name_en AS exam_en, e.name_mr AS exam_mr
    FROM courses c LEFT JOIN course_categories cc ON cc.id = c.category_id LEFT JOIN examinations e ON e.id = c.examination_id
    WHERE c.id = $1 AND c.is_active`, [cat.int(req.params.id)]);
  if (!course) return next();
  const [subjects, topics, batches, upcoming, resources] = await Promise.all([
    db.many(`SELECT s.*, st.name_en AS stage_en, st.name_mr AS stage_mr FROM course_subjects cs JOIN subjects s ON s.id = cs.subject_id
             LEFT JOIN exam_stages st ON st.id = s.stage_id WHERE cs.course_id = $1 AND s.is_active ORDER BY st.sort_order NULLS LAST, s.sort_order, s.id`, [course.id]),
    db.many(`SELECT t.* FROM topics t JOIN course_subjects cs ON cs.subject_id = t.subject_id WHERE cs.course_id = $1 AND t.is_active ORDER BY t.sort_order, t.id`, [course.id]),
    db.many(`SELECT b.*, ce.name_en AS centre_en, ce.name_mr AS centre_mr, ce.location FROM batches b LEFT JOIN centres ce ON ce.id = b.centre_id
             WHERE b.course_id = $1 AND b.is_active ORDER BY b.start_date NULLS LAST`, [course.id]),
    cat.lectures({ course: course.id, from: res.locals.today }, { limit: 6 }),
    cat.resources({ course: course.id }, req.candidate),
  ]);
  subjects.forEach((s) => { s.tree = cat.buildTree(topics.filter((t) => t.subject_id === s.id)); });
  res.page('public/course', { title: res.locals.L(course, 'title'), course, subjects, batches, upcoming, resources, base: '' });
}));

// ---------------------------------------------------------------- Training (online / offline, centres, batches)
router.get('/training', wrap(async (req, res) => {
  const [batches, centres, onlineCourses] = await Promise.all([
    db.many(`SELECT b.*, c.title_en AS course_en, c.title_mr AS course_mr, e.name_en AS exam_en, e.name_mr AS exam_mr,
               ce.name_en AS centre_en, ce.name_mr AS centre_mr, ce.location
             FROM batches b JOIN courses c ON c.id = b.course_id LEFT JOIN examinations e ON e.id = c.examination_id LEFT JOIN centres ce ON ce.id = b.centre_id
             WHERE b.is_active AND c.is_active ORDER BY b.start_date NULLS LAST`),
    db.many('SELECT * FROM centres WHERE is_active ORDER BY centre_no, id'),
    db.many(`SELECT c.*, e.name_en AS exam_en, e.name_mr AS exam_mr FROM courses c LEFT JOIN examinations e ON e.id = c.examination_id
             WHERE c.is_active AND c.mode IN ('online','both') ORDER BY c.sort_order`),
  ]);
  res.page('public/training', { title: res.locals.t('nav.training'), batches, centres, onlineCourses });
}));

router.get('/centres', wrap(async (req, res) => {
  const centres = await db.many('SELECT * FROM centres WHERE is_active ORDER BY centre_no, id');
  const batches = await db.many(`SELECT b.*, c.title_en AS course_en, c.title_mr AS course_mr FROM batches b JOIN courses c ON c.id = b.course_id WHERE b.is_active ORDER BY b.start_date`);
  centres.forEach((ce) => { ce.batches = batches.filter((b) => b.centre_id === ce.id); });
  res.page('public/centres', { title: res.locals.t('nav.centres'), centres });
}));

// ---------------------------------------------------------------- Lectures
router.get('/lectures', wrap(async (req, res) => {
  const tab = req.query.tab === 'past' ? 'past' : 'upcoming';
  const f = { type: req.query.type, mode: req.query.mode };
  const rows = tab === 'past'
    ? await cat.lectures({ ...f, before: res.locals.today }, { order: 'l.lecture_date DESC, l.start_time DESC', limit: 60 })
    : await cat.lectures({ ...f, from: res.locals.today }, { limit: 60 });
  res.page('public/lectures', { title: res.locals.t('nav.lectures'), rows, tab, f, base: '' });
}));

router.get('/lectures/:id', wrap(async (req, res, next) => {
  const lec = await cat.lecture(req.params.id);
  if (!lec) return next();
  res.page('public/lecture', { title: res.locals.L(lec, 'title'), lec, canSee: canSeeLecture(req.candidate, lec) });
}));

// ---------------------------------------------------------------- Timetable
router.get('/timetable', wrap(async (req, res) => {
  const f = {
    exam: req.query.exam || '', course: req.query.course || '', subject: req.query.subject || '', mode: req.query.mode || '',
    from: cat.isDate(req.query.from) ? req.query.from : res.locals.today, to: cat.isDate(req.query.to) ? req.query.to : '',
  };
  const [rows, opts] = await Promise.all([cat.lectures(f, { limit: 300 }), cat.filterOptions()]);
  res.page('public/timetable', { title: res.locals.t('nav.timetable'), rows, f, opts, base: '', canSee: (l) => canSeeLecture(req.candidate, l) });
}));

// ---------------------------------------------------------------- स्पर्धा परीक्षा यात्रा
router.get('/yatra', wrap(async (req, res) => {
  const rows = await db.many(`SELECT ts.*, s.designation_en, s.designation_mr, s.name_mr AS person_mr FROM travel_schedules ts LEFT JOIN speakers s ON s.id = ts.speaker_id
    WHERE ts.is_published AND ts.schedule_date >= CURRENT_DATE ORDER BY ts.schedule_date, ts.start_time NULLS LAST`);
  res.page('public/yatra', { title: res.locals.t('nav.yatra'), rows });
}));

// ---------------------------------------------------------------- Learning resources & study material
const RES_TYPES = ['question_bank', 'video', 'youtube', 'guest_lecture', 'study_material', 'pdf'];
router.get('/resources', wrap(async (req, res) => {
  const type = RES_TYPES.includes(req.query.type) ? req.query.type : '';
  const f = { type, exam: req.query.exam || '', subject: req.query.subject || '', topic: req.query.topic || '', course: req.query.course || '' };
  const [rows, opts, counts] = await Promise.all([
    cat.resources(f, req.candidate), cat.filterOptions(),
    db.many('SELECT resource_type, count(*)::int AS n FROM resources WHERE is_published GROUP BY resource_type'),
  ]);
  res.page('public/resources', { title: res.locals.t('nav.resources'), rows, f, opts, types: RES_TYPES, counts: Object.fromEntries(counts.map((c) => [c.resource_type, c.n])) });
}));

router.get('/study-material', wrap(async (req, res) => {
  const rows = await cat.resources({ type: 'study_material' }, req.candidate);
  // Examination → Course → Subject → Topic → document
  const tree = new Map();
  const node = (map, key, label) => { if (!map.has(key)) map.set(key, { label, children: new Map(), items: [] }); return map.get(key); };
  const pick = (r, a, b) => (res.locals.lang === 'mr' && r[b]) ? r[b] : r[a];
  for (const r of rows) {
    const e = node(tree, r.examination_id || 0, pick(r, 'exam_en', 'exam_mr') || '—');
    const c = node(e.children, r.course_id || 0, pick(r, 'course_en', 'course_mr') || '—');
    const s = node(c.children, r.subject_id || 0, pick(r, 'subject_en', 'subject_mr') || '—');
    const tp = node(s.children, r.topic_id || 0, pick(r, 'topic_en', 'topic_mr') || '—');
    tp.items.push(r);
  }
  res.page('public/study-material', { title: res.locals.t('nav.studyMaterial'), tree, total: rows.length });
}));

// ---------------------------------------------------------------- Announcements & links
router.get('/announcements', wrap(async (req, res) => {
  const category = ['important', 'event', 'guest_lecture', 'training', 'exam'].includes(req.query.category) ? req.query.category : '';
  const rows = await db.many(`SELECT * FROM announcements WHERE is_published AND (publish_from IS NULL OR publish_from <= CURRENT_DATE)
    AND (publish_to IS NULL OR publish_to >= CURRENT_DATE) AND ($1 = '' OR category = $1) ORDER BY created_at DESC`, [category]);
  res.page('public/announcements', { title: res.locals.t('nav.announcements'), rows, category });
}));

router.get('/important-links', wrap(async (req, res) => {
  const rows = await db.many(`SELECT l.*, e.name_en AS exam_en, e.name_mr AS exam_mr FROM important_links l LEFT JOIN examinations e ON e.id = l.examination_id
    WHERE l.is_active ORDER BY l.sort_order, l.id`);
  const exams = await db.many('SELECT id, name_en, name_mr, syllabus_url, timetable_url, website_url FROM examinations WHERE is_active ORDER BY sort_order');
  res.page('public/links', { title: res.locals.t('nav.links'), rows, exams });
}));

// ---------------------------------------------------------------- Contribute (NGOs / organisations / individuals)
const CONTRIB_TYPES = ['donation', 'free_lecture', 'free_accommodation', 'free_course', 'csr', 'other'];
router.get('/contribute', (req, res) => res.page('public/contribute', { title: res.locals.t('contribute.title'), v: {}, errors: {}, types: CONTRIB_TYPES }));
router.post('/contribute', uploader('private/contributors', { images: true, maxMb: 5 }).single('photo'), wrap(async (req, res) => {
  const v = req.body || {};
  const t = res.locals.t;
  const errors = {};
  if (!String(v.name || '').trim()) errors.name = t('common.required');
  if (!/^[0-9+\-\s]{8,15}$/.test(String(v.contact_number || '').trim())) errors.contact_number = lang(res, 'Enter a valid contact number', 'वैध संपर्क क्रमांक लिहा');
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = lang(res, 'Enter a valid email', 'वैध ईमेल लिहा');
  if (!CONTRIB_TYPES.includes(v.contribution_type)) errors.contribution_type = t('common.required');
  if (v.contribution_type === 'other' && !String(v.other_specification || '').trim()) errors.other_specification = t('common.required');
  if (Object.keys(errors).length) {
    res.status(422);
    return res.page('public/contribute', { title: t('contribute.title'), v, errors, types: CONTRIB_TYPES });
  }
  await db.q(`INSERT INTO contributors (name, organization, contact_number, email, address, photo_path, contribution_type, other_specification, description)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
  [v.name.trim(), v.organization || null, v.contact_number.trim(), v.email || null, v.address || null, relUpload(req.file), v.contribution_type,
    v.contribution_type === 'other' ? v.other_specification : null, v.description || null]);
  flash(req, 'success', t('contribute.success'));
  res.redirect('/contribute/thank-you');
}));
router.get('/contribute/thank-you', (req, res) => res.page('public/contribute-done', { title: res.locals.t('contribute.title') }));
function lang(res, en, mr) { return res.locals.lang === 'mr' ? mr : en; }

// ---------------------------------------------------------------- Registration hand-off (Mahaamrut) & login
router.get('/register', (req, res) => res.page('public/register', { title: res.locals.t('reg.title') }));

router.get('/login', (req, res) => {
  if (req.candidate) return res.redirect('/portal');
  res.page('public/login', { title: res.locals.t('login.title'), v: {}, error: null });
});

router.post('/login', wrap(async (req, res) => {
  const t = res.locals.t;
  const id = String(req.body.identifier || '').trim();
  const pw = String(req.body.password || '');
  const c = id ? await db.one('SELECT * FROM candidates WHERE (upper(candidate_uid) = upper($1) OR mobile = $1) LIMIT 1', [id]) : null;
  const ok = c && c.password_hash && await bcrypt.compare(pw, c.password_hash);
  if (!ok || !c.is_active || c.verification_status === 'rejected') {
    res.status(401);
    return res.page('public/login', { title: t('login.title'), v: { identifier: id }, error: ok ? t('login.inactive') : t('login.invalid') });
  }
  const returnTo = req.session.returnTo;
  const langPref = req.session.lang;
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.candidateId = c.id;
    req.session.lang = langPref;
    res.redirect(returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/portal');
  });
}));

router.get('/login/help', (req, res) => res.page('public/login-help', { title: res.locals.t('login.forgot') }));

function logout(req, res) {
  const langPref = req.session.lang;
  delete req.session.candidateId;
  req.session.regenerate(() => { req.session.lang = langPref; res.redirect('/'); });
}
router.post('/logout', logout);

// ---------------------------------------------------------------- Prototype journey & design system
router.get('/journey', wrap(async (req, res) => {
  const firstCourse = await db.one(`SELECT e.course_id FROM enrollments e JOIN candidates c ON c.id = e.candidate_id WHERE c.candidate_uid = 'DEMO-001' ORDER BY e.id LIMIT 1`);
  res.page('public/journey', { title: res.locals.lang === 'mr' ? 'प्रोटोटाइप उमेदवार प्रवास' : 'Prototype Candidate Journey', firstCourse });
}));
router.get('/journey/verified', (req, res) => res.page('public/journey-verified', { title: res.locals.lang === 'mr' ? 'पडताळणी यशस्वी (सिम्युलेशन)' : 'Verification Successful (Simulation)' }));
router.get('/design-system', (req, res) => res.page('public/design-system', { title: res.locals.t('footer.designSystem') }));

module.exports = router;
