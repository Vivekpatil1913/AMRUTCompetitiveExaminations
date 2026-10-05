/**
 * Admin-managed entities. One config entry per requirement-backed module (no generic CMS).
 * Table / column names here are trusted identifiers (never taken from user input).
 *
 * Field types: text | textarea | url | number | money | date | time | checkbox | select | ref | file | m2m | readonly
 */
const T = (name, label, extra = {}) => ({ name, label, type: 'text', ...extra });
const bi = (base, label, type = 'text', req = false) => [
  { name: base + '_en', label: label + ' (English)', type, required: req },
  { name: base + '_mr', label: label + ' (मराठी)', type },
];
const ref = (name, label, table, labelSql, { idCol, order, ...extra } = {}) => ({ name, label, type: 'ref', ref: { table, label: labelSql, idCol, order: order || 'label' }, ...extra });
const active = { name: 'is_active', label: 'Active / visible', type: 'checkbox', default: true };
const published = { name: 'is_published', label: 'Published', type: 'checkbox', default: true };
const sort = { name: 'sort_order', label: 'Display order', type: 'number', default: 0 };

const EXAM = (req) => ref('examination_id', 'Examination', 'examinations', 'name_en', { required: req, order: 'sort_order, id' });
const COURSE = ref('course_id', 'Course', 'courses', 'title_en', { order: 'sort_order, id' });
const SUBJECT = ref('subject_id', 'Subject', 'subjects s LEFT JOIN examinations e ON e.id = s.examination_id', "COALESCE(e.short_name || ' – ', '') || s.name_en", { idCol: 's.id', order: 'label' });
const TOPIC = ref('topic_id', 'Topic / Sub-part', 'topics t JOIN subjects s ON s.id = t.subject_id LEFT JOIN examinations e ON e.id = s.examination_id',
  "COALESCE(e.short_name || ' – ', '') || s.name_en || ' › ' || t.name_en", { idCol: 't.id', order: 'label' });
const SPEAKER = ref('speaker_id', 'Speaker / Resource person', 'speakers', 'name_en', { order: 'sort_order, id' });
const CENTRE = ref('centre_id', 'Centre', 'centres', "COALESCE(centre_no || ' – ', '') || name_en", { order: 'label' });

const RESOURCE_FIELDS = [
  ...bi('title', 'Title', 'text', true), ...bi('description', 'Description', 'textarea'),
  EXAM(false), COURSE, SUBJECT, TOPIC,
  { name: 'url', label: 'Link (YouTube / video / external URL)', type: 'url' },
  { name: 'file_path', label: 'File (PDF / document)', type: 'file', accept: 'application/pdf,image/*', help: 'Downloads are served only after the access check below.' },
  { name: 'access_level', label: 'Who can access', type: 'select', required: true, options: [['public', 'Public'], ['registered', 'Registered candidates'], ['verified', 'Verified candidates'], ['lakshit_or_permitted', 'लक्षित गट / Admin-permitted only']], help: 'Final access-control rules: HOLD. Per-candidate grants are managed on the candidate page.' },
  sort, published,
];
const resourceType = (key, title, type, icon, defaultAccess) => ({
  key, title, icon, group: 'Learning Resources', table: 'resources', scope: { resource_type: type }, upload: 'private/resources',
  order: 'sort_order, created_at DESC', list: ['title_en', 'subject_id', 'access_level', 'is_published'], search: ['title_en', 'title_mr'],
  filters: ['examination_id', 'subject_id', 'access_level'],
  fields: RESOURCE_FIELDS.map((f) => (f.name === 'access_level' && defaultAccess ? { ...f, default: defaultAccess } : f)),
});

const resources = [
  // ---------------- Academic structure ----------------
  { key: 'examinations', title: 'Examinations', icon: 'exam', group: 'Academic Structure', table: 'examinations', order: 'sort_order, id',
    list: ['name_en', 'name_mr', 'short_name', 'is_active'], search: ['name_en', 'name_mr', 'short_name'],
    fields: [...bi('name', 'Name', 'text', true), T('short_name', 'Short name'), ...bi('description', 'Description', 'textarea'),
      { name: 'syllabus_url', label: 'Official syllabus link', type: 'url', help: 'External link – to be configured by administrator (discussion required).' },
      { name: 'timetable_url', label: 'Official examination timetable link', type: 'url' },
      { name: 'website_url', label: 'Official website', type: 'url' }, sort, active] },
  { key: 'exam-stages', title: 'Exam Stages', icon: 'layers', group: 'Academic Structure', table: 'exam_stages', order: 'examination_id, sort_order',
    hint: 'Optional stages per examination, e.g. Preliminary / Main / Post.',
    list: ['examination_id', 'name_en', 'name_mr', 'sort_order'], filters: ['examination_id'],
    fields: [EXAM(true), ...bi('name', 'Stage name', 'text', true), sort] },
  { key: 'course-categories', title: 'Course Categories', icon: 'grid', group: 'Academic Structure', table: 'course_categories', order: 'sort_order, id',
    hint: 'e.g. Foundation, Preparatory, UPSC, MPSC, Combined, Optional, Crash Course, Special Batch.',
    list: ['name_en', 'name_mr', 'sort_order', 'is_active'], fields: [...bi('name', 'Name', 'text', true), ...bi('description', 'Description', 'textarea'), sort, active] },
  { key: 'courses', title: 'Courses', icon: 'book', group: 'Academic Structure', table: 'courses', order: 'sort_order, id',
    list: ['title_en', 'category_id', 'examination_id', 'mode', 'is_active'], search: ['title_en', 'title_mr'], filters: ['category_id', 'examination_id', 'mode'],
    fields: [ref('category_id', 'Course category', 'course_categories', 'name_en', { order: 'sort_order, id' }), EXAM(false),
      ...bi('title', 'Title', 'text', true), ...bi('description', 'Description', 'textarea'),
      { name: 'mode', label: 'Mode', type: 'select', required: true, options: [['online', 'Online'], ['offline', 'Offline'], ['both', 'Online & Offline']], default: 'online' },
      { name: 'duration_days', label: 'Duration (days)', type: 'number', help: 'Optional. HOLD: requirement mentions both 75-day and 15-day crash course – keep configurable (batch dates also define the period).' },
      { name: 'subjects', label: 'Subjects in this course', type: 'm2m', m2m: { table: 'course_subjects', self: 'course_id', other: 'subject_id' },
        ref: { table: 'subjects s LEFT JOIN examinations e ON e.id = s.examination_id', label: "COALESCE(e.short_name || ' – ', '') || s.name_en", idCol: 's.id', order: 'label' } },
      sort, active] },
  { key: 'subjects', title: 'Subjects', icon: 'book', group: 'Academic Structure', table: 'subjects', order: 'examination_id, sort_order, id',
    list: ['name_en', 'name_mr', 'examination_id', 'stage_id', 'is_active'], search: ['name_en', 'name_mr'], filters: ['examination_id'],
    fields: [EXAM(false), ref('stage_id', 'Exam stage (optional)', 'exam_stages st JOIN examinations e ON e.id = st.examination_id', "e.name_en || ' – ' || st.name_en", { idCol: 'st.id' }),
      ...bi('name', 'Subject name', 'text', true), ...bi('description', 'Description', 'textarea'), sort, active] },
  { key: 'topics', title: 'Topics / Sub-parts', icon: 'layers', group: 'Academic Structure', table: 'topics', order: 'subject_id, sort_order, id',
    hint: 'Choose a parent topic to create sub-topics (any depth).',
    list: ['name_en', 'subject_id', 'parent_id', 'is_active'], search: ['name_en', 'name_mr'], filters: ['subject_id'],
    fields: [{ ...SUBJECT, required: true }, ref('parent_id', 'Parent topic (optional)', 'topics', 'name_en', {}), ...bi('name', 'Topic name', 'text', true), sort, active] },

  // ---------------- Offline training ----------------
  { key: 'centres', title: 'Centres', icon: 'building', group: 'Offline Training', table: 'centres', order: 'centre_no, id',
    hint: 'HOLD: exact centre structure to be finalised.',
    list: ['centre_no', 'name_en', 'location', 'is_active'], search: ['name_en', 'location', 'address'],
    fields: [T('centre_no', 'Centre number'), ...bi('name', 'Centre name', 'text', true), T('location', 'Location'), { name: 'address', label: 'Address', type: 'textarea' },
      { name: 'map_url', label: 'Map link', type: 'url' }, T('contact', 'Contact'), active] },
  { key: 'batches', title: 'Batches', icon: 'users', group: 'Offline Training', table: 'batches', order: 'start_date DESC NULLS LAST, id',
    list: ['name', 'course_id', 'centre_id', 'start_date', 'booking_open', 'deposit_applicability'], search: ['name'], filters: ['course_id', 'centre_id'],
    fields: [{ ...COURSE, required: true }, CENTRE, T('name', 'Batch name', { required: true }), { name: 'start_date', label: 'Start date', type: 'date' }, { name: 'end_date', label: 'End date', type: 'date' },
      { name: 'seats', label: 'Seats', type: 'number' }, { name: 'booking_open', label: 'Registration / booking open', type: 'checkbox' },
      { name: 'accommodation_available', label: 'Accommodation available', type: 'checkbox' },
      { name: 'deposit_applicability', label: 'Security deposit applies to', type: 'select', required: true, default: 'hold',
        options: [['hold', 'HOLD – not decided'], ['not_applicable', 'Not applicable'], ['accommodation_only', 'Only candidates taking accommodation'], ['all_participants', 'All participants of this batch']],
        help: 'Applicability is a management decision (HOLD). Choose per batch once confirmed.' },
      { name: 'deposit_amount', label: 'Security deposit amount (₹)', type: 'money', help: '“₹500 or amount decided from time to time”.' },
      { name: 'remarks', label: 'Remarks', type: 'textarea' }, active] },

  // ---------------- Lectures & schedules ----------------
  { key: 'lectures', title: 'Lectures', icon: 'mic', group: 'Lectures & Schedules', table: 'lectures', order: 'lecture_date DESC, start_time',
    list: ['lecture_date', 'title_en', 'lecture_type', 'mode', 'speaker_id', 'is_highlighted', 'is_published'], search: ['title_en', 'title_mr'],
    filters: ['lecture_type', 'mode', 'examination_id', 'course_id'],
    fields: [...bi('title', 'Lecture / session title', 'text', true),
      { name: 'lecture_type', label: 'Type', type: 'select', required: true, default: 'regular', options: [['regular', 'Regular lecture'], ['guest', 'Guest lecture'], ['guidance', 'Guidance session'], ['special', 'Special lecture']] },
      SPEAKER, EXAM(false), COURSE, SUBJECT, TOPIC, ref('batch_id', 'Batch (offline, optional)', 'batches', 'name', {}),
      { name: 'lecture_date', label: 'Date', type: 'date', required: true }, { name: 'start_time', label: 'Start time', type: 'time' }, { name: 'end_time', label: 'End time', type: 'time' },
      { name: 'mode', label: 'Mode', type: 'select', required: true, default: 'online', options: [['online', 'Online'], ['offline', 'Offline']] },
      CENTRE, T('venue', 'Venue / room (offline)'), { name: 'online_link', label: 'Online link (online)', type: 'url' }, { name: 'youtube_url', label: 'YouTube / recording link', type: 'url' },
      ...bi('description', 'Description', 'textarea'), { name: 'remarks', label: 'Remarks / note', type: 'textarea' },
      { name: 'is_highlighted', label: 'Show in landing-page marquee / highlights', type: 'checkbox' },
      { name: 'visibility', label: 'Online link visible to', type: 'select', required: true, default: 'public', options: [['public', 'Everyone'], ['registered', 'Registered candidates'], ['verified', 'Verified candidates']] },
      published] },
  { key: 'guest-lectures', title: 'Guest Lectures', icon: 'users', group: 'Lectures & Schedules', alias: 'lectures', scope: { lecture_type: 'guest' } },
  { key: 'speakers', title: 'Speakers / Resource Persons', icon: 'user', group: 'Lectures & Schedules', table: 'speakers', order: 'sort_order, id', upload: 'public/speakers',
    hint: 'Advisory / resource persons are shown as “proposed”. Exact responsibilities: HOLD.',
    list: ['name_en', 'designation_en', 'is_advisory', 'is_active'], search: ['name_en', 'name_mr', 'designation_en'],
    fields: [...bi('name', 'Name', 'text', true), ...bi('designation', 'Designation / role'), ...bi('bio', 'Profile / note', 'textarea'),
      { name: 'photo', label: 'Photo', type: 'file', accept: 'image/*', public: true }, { name: 'is_advisory', label: 'Proposed advisory / resource person', type: 'checkbox' }, sort, active] },
  { key: 'travel', title: 'स्पर्धा परीक्षा यात्रा', icon: 'route', group: 'Lectures & Schedules', table: 'travel_schedules', order: 'schedule_date DESC, start_time',
    hint: 'HOLD: detailed scheduling / automation logic. The website shows published entries from today onward.',
    list: ['schedule_date', 'person_name', 'place', 'start_time', 'is_published'], search: ['person_name', 'place'],
    fields: [SPEAKER, T('person_name', 'Name of person', { required: true }), { name: 'schedule_date', label: 'Date', type: 'date', required: true },
      { name: 'start_time', label: 'Start time', type: 'time' }, { name: 'end_time', label: 'End time', type: 'time' }, T('place', 'Place', { required: true }),
      { name: 'remarks', label: 'Remarks', type: 'textarea' }, published] },

  // ---------------- Tests ----------------
  { key: 'questions', title: 'Question Bank', icon: 'question', group: 'Tests & Assessment', table: 'questions', order: 'id DESC',
    list: ['question_en', 'subject_id', 'correct_option', 'in_question_bank', 'is_active'], search: ['question_en', 'question_mr'], filters: ['examination_id', 'subject_id'],
    hint: 'MCQ only. Other question types only if approved later.',
    fields: [EXAM(false), SUBJECT, TOPIC, ...bi('question', 'Question', 'textarea', true),
      T('option_a', 'Option A', { required: true }), T('option_b', 'Option B', { required: true }), T('option_c', 'Option C'), T('option_d', 'Option D'),
      { name: 'correct_option', label: 'Correct option', type: 'select', required: true, options: [['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D']] },
      { name: 'explanation', label: 'Explanation (shown after submission)', type: 'textarea' },
      { name: 'in_question_bank', label: 'Show in candidate practice question bank', type: 'checkbox', default: true }, active] },
  { key: 'tests', title: 'Tests', icon: 'test', group: 'Tests & Assessment', table: 'tests', order: 'id DESC',
    hint: 'HOLD: negative marking, randomisation, question count, scoring rules, time limit. Current behaviour: score = number of correct answers; correct answers shown immediately after submission.',
    list: ['title_en', 'test_type', 'subject_id', 'is_published'], search: ['title_en'], filters: ['test_type', 'examination_id'],
    actions: [{ label: 'Questions', icon: 'question', href: (id) => `/admin/tests/${id}/questions` }],
    fields: [...bi('title', 'Title', 'text', true),
      { name: 'test_type', label: 'Type', type: 'select', required: true, default: 'lecture', options: [['lecture', 'After lecture'], ['unit', 'Unit test'], ['practice', 'Practice']] },
      ref('lecture_id', 'Linked lecture', 'lectures', "to_char(lecture_date, 'DD Mon YYYY') || ' – ' || title_en", { order: 'label DESC' }), EXAM(false), COURSE, SUBJECT,
      ...bi('instructions', 'Instructions', 'textarea'), published] },
  { key: 'assessments', title: 'Assessment', icon: 'brain', group: 'Tests & Assessment', table: 'assessments', order: 'id', noCreate: false,
    hint: 'Psychological / aptitude assessment framework only. Test structure, questions, scoring and result format: HOLD – Management Discussion Required.',
    list: ['title_en', 'area', 'conducted_by', 'status'],
    fields: [...bi('title', 'Title', 'text', true), { name: 'area', label: 'Area', type: 'select', required: true, options: [['adaptability', 'Adaptability'], ['interest', 'Interest'], ['career_counselling', 'Career counselling']] },
      ...bi('description', 'Description', 'textarea'), T('conducted_by', 'Conducted by (proposed)'),
      { name: 'status', label: 'Status', type: 'select', required: true, default: 'hold', options: [['hold', 'HOLD']], help: 'Only HOLD is available until the assessment design is confirmed.' }] },

  // ---------------- Learning resources ----------------
  resourceType('study-material', 'Study Material (PDF)', 'study_material', 'file', 'lakshit_or_permitted'),
  resourceType('videos', 'Videos', 'video', 'video'),
  resourceType('youtube', 'YouTube Resources', 'youtube', 'youtube'),
  resourceType('question-bank-files', 'Question Bank Files', 'question_bank', 'question'),
  resourceType('guest-lecture-resources', 'Guest Lecture Resources', 'guest_lecture', 'mic'),
  resourceType('pdfs', 'Other PDFs', 'pdf', 'download'),

  // ---------------- Communication ----------------
  { key: 'announcements', title: 'Announcements', icon: 'bell', group: 'Communication', table: 'announcements', order: 'created_at DESC',
    list: ['title_en', 'category', 'is_marquee', 'publish_from', 'publish_to', 'is_published'], search: ['title_en', 'title_mr'], filters: ['category'],
    fields: [...bi('title', 'Title', 'text', true), ...bi('body', 'Details', 'textarea'),
      { name: 'category', label: 'Category', type: 'select', required: true, default: 'important', options: [['important', 'Important announcement'], ['event', 'Upcoming event'], ['guest_lecture', 'Guest lecture'], ['training', 'Training update'], ['exam', 'Exam update']] },
      { name: 'link_url', label: 'Link (optional)', type: 'url' }, { name: 'is_marquee', label: 'Show in marquee / highlight strip', type: 'checkbox' },
      { name: 'publish_from', label: 'Publish from', type: 'date' }, { name: 'publish_to', label: 'Publish until', type: 'date' }, published] },
  { key: 'contributors', title: 'Contributors / NGOs', icon: 'heart', group: 'Communication', table: 'contributors', order: 'created_at DESC', noCreate: true,
    hint: 'Submissions from the public “Support / Contribute” form. WhatsApp / email / SMS notifications: HOLD (provider not finalised).',
    list: ['created_at', 'name', 'organization', 'contact_number', 'contribution_type', 'status'], search: ['name', 'organization', 'contact_number', 'email'], filters: ['contribution_type', 'status'],
    fields: [{ name: 'created_at', label: 'Submitted on', type: 'readonly', format: 'datetime' }, { name: 'name', label: 'Name', type: 'readonly' }, { name: 'organization', label: 'Organisation', type: 'readonly' },
      { name: 'contact_number', label: 'Contact number', type: 'readonly' }, { name: 'email', label: 'Email', type: 'readonly' }, { name: 'address', label: 'Address', type: 'readonly' },
      { name: 'photo_path', label: 'Photo', type: 'readonly', format: 'contributorPhoto' },
      { name: 'contribution_type', label: 'Type of contribution', type: 'select', options: [['donation', 'Donation'], ['free_lecture', 'Free lecture'], ['free_accommodation', 'Free accommodation'], ['free_course', 'Free course'], ['csr', 'CSR'], ['other', 'Other']], readonlyOnEdit: true },
      { name: 'other_specification', label: 'Other – specification', type: 'readonly' }, { name: 'description', label: 'Notes / description', type: 'readonly' },
      { name: 'status', label: 'Status', type: 'select', required: true, options: [['new', 'New'], ['in_review', 'In review'], ['contacted', 'Contacted'], ['closed', 'Closed']] },
      { name: 'admin_remarks', label: 'Admin remarks', type: 'textarea' }] },

  // ---------------- Website ----------------
  { key: 'site-content', title: 'Website Content', icon: 'edit', group: 'Website', table: 'site_content', order: 'key', noCreate: true, noDelete: true,
    hint: 'Editable text blocks: hero, programme introduction, about, accommodation info, contribute intro. Not a full CMS.',
    list: ['key', 'title_en', 'updated_at'],
    fields: [{ name: 'key', label: 'Block', type: 'readonly' }, ...bi('title', 'Title'), ...bi('body', 'Text', 'textarea')], touch: 'updated_at' },
  { key: 'important-links', title: 'Important Links', icon: 'link', group: 'Website', table: 'important_links', order: 'sort_order, id',
    list: ['title_en', 'category', 'url', 'is_active'], search: ['title_en', 'url'], filters: ['category'],
    fields: [...bi('title', 'Title', 'text', true), { name: 'url', label: 'URL', type: 'url', required: true },
      { name: 'category', label: 'Category', type: 'select', required: true, default: 'other', options: [['exam_website', 'Official examination website'], ['syllabus', 'Official syllabus'], ['exam_timetable', 'Official examination timetable'], ['amrut', 'AMRUT'], ['other', 'Other official resource']] },
      EXAM(false), sort, active] },
];

// Resolve aliases (e.g. guest-lectures → lectures config with a scope)
const byKey = {};
for (const r of resources) byKey[r.key] = r;
for (const r of resources) {
  if (r.alias) Object.assign(r, { ...byKey[r.alias], key: r.key, title: r.title, icon: r.icon, scope: r.scope, alias: r.alias, filters: (byKey[r.alias].filters || []).filter((f) => !(f in r.scope)) });
}

module.exports = { resources, byKey };
