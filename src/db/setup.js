/**
 * Database setup:  npm run db:setup   (create DB if missing, apply schema, seed if empty)
 *                  npm run db:reset   (drop all tables, re-create, re-seed)
 * Seed content is SAMPLE data for the prototype – replace it from the Admin Panel.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const RESET = process.argv.includes('--reset');
const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.slice(1);

async function ensureDatabase() {
  const adminUrl = new URL(url.href);
  adminUrl.pathname = '/postgres';
  const c = new Client({ connectionString: adminUrl.href, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await c.connect();
  const exists = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) {
    await c.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
    console.log(`Created database ${dbName}`);
  }
  await c.end();
}

const TABLES = ['attempt_answers', 'test_attempts', 'test_questions', 'tests', 'questions', 'resource_grants', 'resources',
  'offline_bookings', 'enrollments', 'travel_schedules', 'lectures', 'batches', 'centres', 'topics', 'course_subjects',
  'subjects', 'courses', 'course_categories', 'exam_stages', 'examinations', 'assessments', 'announcements',
  'important_links', 'contributors', 'speakers', 'candidates', 'admins', 'site_content', 'settings', 'session'];

async function main() {
  await ensureDatabase();
  const db = new Client({ connectionString: url.href, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await db.connect();
  if (RESET) {
    await db.query(TABLES.map((t) => `DROP TABLE IF EXISTS "${t}" CASCADE;`).join('\n'));
    console.log('Dropped existing tables');
  }
  await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log('Schema applied');

  const { rows } = await db.query('SELECT count(*)::int AS n FROM settings');
  if (rows[0].n === 0) {
    await seed(db);
    console.log('Sample data seeded');
  } else {
    console.log('Data already present – seed skipped (use npm run db:reset to re-seed)');
  }
  await db.end();
}

async function ins(db, table, row) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`;
  return (await db.query(sql, keys.map((k) => row[k]))).rows[0];
}
const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return x.toISOString().slice(0, 10); };

function writeSamplePdf(rel, title) {
  const dir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'sample');
  fs.mkdirSync(dir, { recursive: true });
  const text = `(${title} - SAMPLE study material placeholder) Tj`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = `BT /F1 14 Tf 60 780 Td ${text} ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  fs.writeFileSync(path.join(dir, rel), out);
  return `sample/${rel}`;
}

async function seed(db) {
  // ---------------- Settings ----------------
  const settings = [
    ['site_title', 'Various Competitive Examinations Pre-Training Programme', 'विविध स्पर्धा परीक्षा पूर्व प्रशिक्षण कार्यक्रम', 'general', 'Programme title', 'text', 1],
    ['org_name', 'Academy of Maharashtra Research, Upliftment and Training (AMRUT)', 'महाराष्ट्र संशोधन, उन्नती व प्रशिक्षण प्रबोधिनी (अमृत)', 'general', 'Organisation name', 'text', 2],
    ['gov_label', 'Government of Maharashtra', 'महाराष्ट्र शासन', 'general', 'Top bar label', 'text', 3],
    ['logo', '/images/amrut-logo.png', null, 'general', 'Logo', 'image', 4],
    ['emblem', '/images/emblem.png', null, 'general', 'Header emblem', 'image', 5],
    ['favicon', '/images/favicon.png', null, 'general', 'Favicon', 'image', 6],
    ['mahaamrut_register_url', 'https://app.mahaamrut.org.in/amrut-new/signup', null, 'integration', 'Mahaamrut registration / application URL', 'url', 1],
    ['mahaamrut_portal_url', 'https://mahaamrut.org.in/', null, 'integration', 'Mahaamrut portal URL', 'url', 2],
    ['login_help', 'Use the login details provided after successful registration and verification on the Mahaamrut portal. For help, contact the AMRUT helpline.',
      'महाअमृत पोर्टलवर नोंदणी व पडताळणी यशस्वी झाल्यानंतर मिळालेल्या तपशिलांनी लॉगिन करा. मदतीसाठी अमृत हेल्पलाईनशी संपर्क साधा.', 'integration', 'Login help text', 'textarea', 3],
    ['footer_address', '5th Floor, AMRUT Building, near Bhimsen Joshi Sabhagruh, Ward No. 8, PMRDA, Aundh, Pune, Maharashtra 411067.',
      '५ वा मजला, अमृत इमारत, भीमसेन जोशी सभागृहाजवळ, वॉर्ड क्र. ८, पीएमआरडीए, औंध, पुणे, महाराष्ट्र ४११०६७.', 'footer', 'Address', 'textarea', 1],
    ['footer_phone', '+91 9730151450', null, 'footer', 'Phone', 'text', 2],
    ['footer_email', 'info@mahaamrut.org.in', null, 'footer', 'Email', 'text', 3],
    ['footer_about', 'A competitive examination training and study initiative of AMRUT, Government of Maharashtra.',
      'अमृत, महाराष्ट्र शासन यांचा स्पर्धा परीक्षा प्रशिक्षण व अभ्यास उपक्रम.', 'footer', 'Footer description', 'textarea', 4],
    ['footer_copyright', '© AMRUT, Government of Maharashtra. All rights reserved.', '© अमृत, महाराष्ट्र शासन. सर्व हक्क राखीव.', 'footer', 'Copyright line', 'text', 5],
    ['payment_instructions', 'Pay the applicable security deposit using the payment details shown below and upload the transaction screenshot. Payment account details: HOLD – to be confirmed by management.',
      'खाली दिलेल्या तपशिलानुसार लागू असलेली अनामत रक्कम भरा व व्यवहाराचा स्क्रीनशॉट अपलोड करा. पेमेंट खात्याचा तपशील: HOLD – व्यवस्थापनाची पुष्टी आवश्यक.', 'payment', 'Payment instructions', 'textarea', 1],
    ['payment_qr', '', null, 'payment', 'Payment scanner / QR image (HOLD – account not finalised)', 'image', 2],
    ['deposit_note', 'Lectures are free of cost. The amount is a refundable SECURITY DEPOSIT, not a course fee. Refund after successful completion is subject to the final refund policy (HOLD).',
      'व्याख्याने विनामूल्य आहेत. ही रक्कम अनामत (सुरक्षा ठेव) आहे, शुल्क नाही. यशस्वी पूर्णतेनंतरचा परतावा अंतिम परतावा धोरणानुसार (HOLD).', 'payment', 'Security deposit note', 'textarea', 3],
  ];
  for (const [key, value_en, value_mr, group_name, label, input_type, sort_order] of settings) {
    await ins(db, 'settings', { key, value_en, value_mr, group_name, label, input_type, sort_order });
  }

  // ---------------- Site content ----------------
  const content = [
    ['hero', 'Various Competitive Examinations Pre-Training Programme', 'विविध स्पर्धा परीक्षा पूर्व प्रशिक्षण कार्यक्रम',
      'Structured preparation, online and offline training, lectures, learning resources and guidance for competitive examination aspirants – an initiative of AMRUT, Government of Maharashtra.',
      'स्पर्धा परीक्षा इच्छुक उमेदवारांसाठी नियोजनबद्ध तयारी, ऑनलाइन व ऑफलाइन प्रशिक्षण, व्याख्याने, अभ्यास साहित्य व मार्गदर्शन – अमृत, महाराष्ट्र शासन यांचा उपक्रम.'],
    ['intro', 'About the Programme', 'कार्यक्रमाविषयी',
      'The programme supports aspirants preparing for competitive examinations such as UPSC, MPSC, Banking, SSC and Police Recruitment. It provides examination information, training schedules, online and offline training, regular and guest lectures, question banks, online tests, study material, guidance and counselling.\n\nCandidates register and are verified through the Mahaamrut portal, after which they can access the study portal.',
      'हा कार्यक्रम UPSC, MPSC, बँकिंग, SSC, पोलीस भरती यांसारख्या स्पर्धा परीक्षांची तयारी करणाऱ्या उमेदवारांसाठी आहे. यामध्ये परीक्षांची माहिती, प्रशिक्षण वेळापत्रक, ऑनलाइन व ऑफलाइन प्रशिक्षण, नियमित व अतिथी व्याख्याने, प्रश्नसंच, ऑनलाइन चाचण्या, अभ्यास साहित्य, मार्गदर्शन व समुपदेशन उपलब्ध आहे.\n\nउमेदवारांची नोंदणी व पडताळणी महाअमृत पोर्टलद्वारे होते, त्यानंतर त्यांना अभ्यास पोर्टल वापरता येते.'],
    ['about', 'About the Programme', 'कार्यक्रमाविषयी',
      'The Various Competitive Examinations Pre-Training Programme is conducted under AMRUT (Academy of Maharashtra Research, Upliftment and Training), an autonomous institution of the Government of Maharashtra.\n\nThe programme provides information, registration, training schedules, learning resources, online tests, lectures, guidance, counselling and offline training for aspirants preparing for competitive examinations. Both online and offline training are supported. Lectures are free of cost.',
      'विविध स्पर्धा परीक्षा पूर्व प्रशिक्षण कार्यक्रम हा महाराष्ट्र शासनाची स्वायत्त संस्था अमृत (महाराष्ट्र संशोधन, उन्नती व प्रशिक्षण प्रबोधिनी) अंतर्गत राबविला जातो.\n\nस्पर्धा परीक्षांची तयारी करणाऱ्या उमेदवारांसाठी माहिती, नोंदणी, प्रशिक्षण वेळापत्रक, अभ्यास साहित्य, ऑनलाइन चाचण्या, व्याख्याने, मार्गदर्शन, समुपदेशन व ऑफलाइन प्रशिक्षण उपलब्ध आहे. ऑनलाइन व ऑफलाइन दोन्ही प्रकारचे प्रशिक्षण दिले जाते. व्याख्याने विनामूल्य आहेत.'],
    ['accommodation', 'Accommodation', 'निवास व्यवस्था',
      'Accommodation may be available for selected offline batches. Details of the accommodation process and any applicable deposit will be shared by the programme office.\n\nHOLD – Accommodation workflow and payment rules are pending management confirmation.',
      'निवडक ऑफलाइन बॅचसाठी निवास व्यवस्था उपलब्ध असू शकते. निवास प्रक्रिया व लागू अनामत रकमेचा तपशील कार्यक्रम कार्यालयाकडून कळविला जाईल.\n\nHOLD – निवास प्रक्रिया व पेमेंट नियम व्यवस्थापनाच्या पुष्टीच्या प्रतीक्षेत.'],
    ['contribute', 'Support / Contribute to the Programme', 'कार्यक्रमास सहकार्य करा',
      'NGOs, organisations and individuals may support the programme through donations, free lectures, free accommodation, free courses, CSR or other support. Submit your details and the programme office will contact you.',
      'स्वयंसेवी संस्था, संघटना व व्यक्ती देणगी, विनामूल्य व्याख्याने, विनामूल्य निवास, विनामूल्य अभ्यासक्रम, CSR किंवा इतर स्वरूपात सहकार्य करू शकतात. आपली माहिती सादर करा, कार्यक्रम कार्यालय आपल्याशी संपर्क साधेल.'],
  ];
  for (const [key, title_en, title_mr, body_en, body_mr] of content) await ins(db, 'site_content', { key, title_en, title_mr, body_en, body_mr });

  // ---------------- Admin & demo candidates ----------------
  await ins(db, 'admins', { name: 'Programme Administrator', email: 'admin@amrut.local', password_hash: bcrypt.hashSync('Admin@123', 10) });
  const pw = bcrypt.hashSync('Demo@123', 10);
  const c1 = await ins(db, 'candidates', { candidate_uid: 'DEMO-001', mahaamrut_ref: 'SAMPLE-REF-001', name: 'Sample Candidate (Lakshit Gat)', mobile: '9000000001', email: 'candidate1@example.com', category: 'lakshit', verification_status: 'verified', password_hash: pw });
  const c2 = await ins(db, 'candidates', { candidate_uid: 'DEMO-002', mahaamrut_ref: 'SAMPLE-REF-002', name: 'Sample Candidate (Non-Lakshit Gat)', mobile: '9000000002', email: 'candidate2@example.com', category: 'non_lakshit', verification_status: 'verified', password_hash: pw });
  await ins(db, 'candidates', { candidate_uid: 'DEMO-003', mahaamrut_ref: 'SAMPLE-REF-003', name: 'Sample Candidate (Verification Pending)', mobile: '9000000003', category: 'lakshit', verification_status: 'pending', password_hash: pw });

  // ---------------- Examinations (configurable; initial examples only) ----------------
  const exams = {};
  const examRows = [
    ['upsc', 'UPSC', 'यूपीएससी', 'UPSC', 'Union Public Service Commission examinations.', 'संघ लोकसेवा आयोगाच्या परीक्षा.'],
    ['mpsc', 'MPSC', 'एमपीएससी', 'MPSC', 'Maharashtra Public Service Commission examinations.', 'महाराष्ट्र लोकसेवा आयोगाच्या परीक्षा.'],
    ['bank', 'Banking', 'बँकिंग', 'Banking', 'Banking sector recruitment examinations.', 'बँकिंग क्षेत्रातील भरती परीक्षा.'],
    ['ssc', 'SSC (Staff Selection)', 'एसएससी (कर्मचारी निवड)', 'SSC', 'Staff Selection Commission examinations.', 'कर्मचारी निवड आयोगाच्या परीक्षा.'],
    ['police', 'Police Recruitment', 'पोलीस भरती', 'Police', 'Police recruitment examinations.', 'पोलीस भरती परीक्षा.'],
    ['other', 'Other Competitive Examinations', 'इतर स्पर्धा परीक्षा', 'Other', 'Other competitive examinations as configured by the administrator.', 'प्रशासकाने निश्चित केलेल्या इतर स्पर्धा परीक्षा.'],
  ];
  let i = 0;
  for (const [k, name_en, name_mr, short_name, description_en, description_mr] of examRows) {
    exams[k] = await ins(db, 'examinations', { name_en, name_mr, short_name, description_en, description_mr, sort_order: ++i });
  }
  const stages = {};
  for (const k of ['upsc', 'mpsc']) {
    stages[k + '_pre'] = await ins(db, 'exam_stages', { examination_id: exams[k].id, name_en: 'Preliminary Examination', name_mr: 'पूर्व परीक्षा', sort_order: 1 });
    stages[k + '_main'] = await ins(db, 'exam_stages', { examination_id: exams[k].id, name_en: 'Main Examination', name_mr: 'मुख्य परीक्षा', sort_order: 2 });
  }

  // ---------------- Course categories ----------------
  const cats = {};
  const catRows = [['foundation', 'Foundation', 'पायाभूत'], ['preparatory', 'Preparatory', 'पूर्वतयारी'], ['upsc', 'UPSC', 'यूपीएससी'], ['mpsc', 'MPSC', 'एमपीएससी'],
    ['combined', 'Combined', 'संयुक्त'], ['optional', 'Optional', 'वैकल्पिक'], ['crash', 'Crash Course', 'क्रॅश कोर्स'], ['special', 'Special Batch', 'विशेष बॅच']];
  i = 0;
  for (const [k, name_en, name_mr] of catRows) cats[k] = await ins(db, 'course_categories', { name_en, name_mr, sort_order: ++i });

  // ---------------- Subjects & topics (sample) ----------------
  const subj = {};
  const subjRows = [
    ['upsc_hist', 'upsc', 'upsc_pre', 'History', 'इतिहास'], ['upsc_geo', 'upsc', 'upsc_pre', 'Geography', 'भूगोल'], ['upsc_pol', 'upsc', 'upsc_pre', 'Polity', 'राज्यशास्त्र'],
    ['mpsc_hist', 'mpsc', 'mpsc_pre', 'History', 'इतिहास'], ['mpsc_geo', 'mpsc', 'mpsc_pre', 'Geography', 'भूगोल'], ['mpsc_eco', 'mpsc', 'mpsc_main', 'Economics', 'अर्थशास्त्र'],
  ];
  for (const [k, ex, st, name_en, name_mr] of subjRows) subj[k] = await ins(db, 'subjects', { examination_id: exams[ex].id, stage_id: stages[st].id, name_en, name_mr });
  const top = {};
  const topicRows = [
    ['ancient', 'upsc_hist', 'Ancient India', 'प्राचीन भारत'], ['modern', 'upsc_hist', 'Modern India', 'आधुनिक भारत'], ['physical', 'upsc_geo', 'Physical Geography', 'प्राकृतिक भूगोल'],
    ['constitution', 'upsc_pol', 'Indian Constitution', 'भारतीय संविधान'], ['mh_hist', 'mpsc_hist', 'History of Maharashtra', 'महाराष्ट्राचा इतिहास'], ['mh_geo', 'mpsc_geo', 'Geography of Maharashtra', 'महाराष्ट्राचा भूगोल'],
  ];
  for (const [k, s, name_en, name_mr] of topicRows) top[k] = await ins(db, 'topics', { subject_id: subj[s].id, name_en, name_mr });
  await ins(db, 'topics', { subject_id: subj.upsc_hist.id, parent_id: top.modern.id, name_en: 'Freedom Struggle', name_mr: 'स्वातंत्र्य लढा' });

  // ---------------- Courses ----------------
  const crs = {};
  crs.upsc_found = await ins(db, 'courses', { category_id: cats.foundation.id, examination_id: exams.upsc.id, title_en: 'UPSC Foundation Course (Sample)', title_mr: 'यूपीएससी पायाभूत अभ्यासक्रम (नमुना)', description_en: 'Foundation-level online preparation for UPSC Preliminary Examination subjects.', description_mr: 'यूपीएससी पूर्व परीक्षेच्या विषयांची पायाभूत ऑनलाइन तयारी.', mode: 'online', sort_order: 1 });
  crs.mpsc_prep = await ins(db, 'courses', { category_id: cats.preparatory.id, examination_id: exams.mpsc.id, title_en: 'MPSC Preparatory Course (Sample)', title_mr: 'एमपीएससी पूर्वतयारी अभ्यासक्रम (नमुना)', description_en: 'Preparatory online course for MPSC examinations.', description_mr: 'एमपीएससी परीक्षांसाठी पूर्वतयारी ऑनलाइन अभ्यासक्रम.', mode: 'online', sort_order: 2 });
  crs.crash = await ins(db, 'courses', { category_id: cats.crash.id, examination_id: exams.mpsc.id, title_en: 'Offline Crash Course (Sample)', title_mr: 'ऑफलाइन क्रॅश कोर्स (नमुना)', description_en: 'Offline crash course with batch-wise timetable at the training centre. Course duration is configurable per batch (HOLD – 75-day / 15-day to be confirmed).', description_mr: 'प्रशिक्षण केंद्रावर बॅचनिहाय वेळापत्रकासह ऑफलाइन क्रॅश कोर्स. कालावधी बॅचनुसार निश्चित (HOLD – ७५ दिवस / १५ दिवस पुष्टी आवश्यक).', mode: 'offline', sort_order: 3 });
  crs.combined = await ins(db, 'courses', { category_id: cats.combined.id, examination_id: exams.mpsc.id, title_en: 'Combined Examination Course (Sample)', title_mr: 'संयुक्त परीक्षा अभ्यासक्रम (नमुना)', mode: 'both', sort_order: 4 });
  const cs = [['upsc_found', 'upsc_hist'], ['upsc_found', 'upsc_geo'], ['upsc_found', 'upsc_pol'], ['mpsc_prep', 'mpsc_hist'], ['mpsc_prep', 'mpsc_geo'], ['mpsc_prep', 'mpsc_eco'], ['crash', 'mpsc_hist'], ['crash', 'mpsc_geo'], ['combined', 'mpsc_hist']];
  for (const [c, s] of cs) await ins(db, 'course_subjects', { course_id: crs[c].id, subject_id: subj[s].id });

  // ---------------- Centres & batches ----------------
  const cen1 = await ins(db, 'centres', { centre_no: '01', name_en: 'AMRUT Pune (Sample Centre)', name_mr: 'अमृत पुणे (नमुना केंद्र)', location: 'Aundh, Pune', address: '5th Floor, AMRUT Building, near Bhimsen Joshi Sabhagruh, Aundh, Pune 411067', contact: '+91 9730151450' });
  const cen2 = await ins(db, 'centres', { centre_no: '02', name_en: 'Sample Centre 02', name_mr: 'नमुना केंद्र ०२', location: 'To be configured by Admin', address: 'To be configured by Admin' });
  const b1 = await ins(db, 'batches', { course_id: crs.crash.id, centre_id: cen1.id, name: 'Crash Course – Batch A (Sample)', start_date: d(20), end_date: d(95), seats: 60, booking_open: true, accommodation_available: true, deposit_applicability: 'accommodation_only', deposit_amount: 500, remarks: 'Sample configuration. Deposit applicability & amount are HOLD – set by Admin.' });
  await ins(db, 'batches', { course_id: crs.crash.id, centre_id: cen2.id, name: 'Crash Course – Batch B (Sample)', start_date: d(35), end_date: d(50), booking_open: true, accommodation_available: false, deposit_applicability: 'hold', remarks: 'Sample configuration.' });

  // ---------------- Proposed advisory / resource persons ----------------
  const sp = [];
  const spRows = [
    ['Resource Person 1 (name to be updated)', 'संसाधन व्यक्ती १ (नाव अद्ययावत करणे)', 'Designation to be confirmed', 'पद निश्चित करणे'],
    ['Resource Person 2 (name to be updated)', 'संसाधन व्यक्ती २ (नाव अद्ययावत करणे)', 'Guidance / Guest Lectures', 'मार्गदर्शन / अतिथी व्याख्याने'],
    ['Resource Person 3 (name to be updated)', 'संसाधन व्यक्ती ३ (नाव अद्ययावत करणे)', 'IB Retired Officer', 'आयबी निवृत्त अधिकारी'],
    ['Resource Person 4 (name to be updated)', 'संसाधन व्यक्ती ४ (नाव अद्ययावत करणे)', 'Designation to be confirmed', 'पद निश्चित करणे'],
    ['Mr. M. R. Deshpande', 'श्री. एम. आर. देशपांडे', 'Career Consultant (proposed – psychological / career orientation)', 'करिअर सल्लागार (प्रस्तावित – मानसशास्त्रीय / करिअर अभिमुखता)'],
    ['Resource Person 6 (name to be updated)', 'संसाधन व्यक्ती ६ (नाव अद्ययावत करणे)', 'Classes / Personal Guidance / UPSC / MPSC / Other Competitive Examinations', 'वर्ग / वैयक्तिक मार्गदर्शन / UPSC / MPSC / इतर स्पर्धा परीक्षा'],
  ];
  i = 0;
  for (const [name_en, name_mr, designation_en, designation_mr] of spRows) {
    sp.push(await ins(db, 'speakers', { name_en, name_mr, designation_en, designation_mr, is_advisory: true, sort_order: ++i, bio_en: 'Proposed advisory / resource person. Responsibilities: HOLD – to be finalised.', bio_mr: 'प्रस्तावित सल्लागार / संसाधन व्यक्ती. जबाबदाऱ्या: HOLD – निश्चित करणे बाकी.' }));
  }

  // ---------------- Lectures (timetable source) ----------------
  const L = [];
  const lecRows = [
    { title_en: 'Modern India – Freedom Struggle', title_mr: 'आधुनिक भारत – स्वातंत्र्य लढा', lecture_type: 'regular', speaker_id: sp[5].id, examination_id: exams.upsc.id, course_id: crs.upsc_found.id, subject_id: subj.upsc_hist.id, topic_id: top.modern.id, lecture_date: d(1), start_time: '10:00', end_time: '11:30', mode: 'online', online_link: 'https://meet.example.com/sample-link', visibility: 'registered' },
    { title_en: 'Guest Lecture: Approach to Civil Services', title_mr: 'अतिथी व्याख्यान: नागरी सेवा परीक्षेचा दृष्टिकोन', lecture_type: 'guest', speaker_id: sp[1].id, examination_id: exams.upsc.id, lecture_date: d(3), start_time: '16:00', end_time: '18:00', mode: 'offline', centre_id: cen1.id, venue: 'Main Hall', is_highlighted: true, description_en: 'Guest lecture on preparation strategy for civil services examinations.', description_mr: 'नागरी सेवा परीक्षांच्या तयारीच्या रणनीतीवर अतिथी व्याख्यान.' },
    { title_en: 'Geography of Maharashtra – Physiography', title_mr: 'महाराष्ट्राचा भूगोल – प्राकृतिक रचना', lecture_type: 'regular', speaker_id: sp[5].id, examination_id: exams.mpsc.id, course_id: crs.mpsc_prep.id, subject_id: subj.mpsc_geo.id, topic_id: top.mh_geo.id, lecture_date: d(4), start_time: '11:00', end_time: '12:30', mode: 'online', online_link: 'https://meet.example.com/sample-link-2' },
    { title_en: 'Career Guidance Session', title_mr: 'करिअर मार्गदर्शन सत्र', lecture_type: 'guidance', speaker_id: sp[4].id, lecture_date: d(6), start_time: '15:00', end_time: '16:30', mode: 'online', online_link: 'https://meet.example.com/sample-link-3', is_highlighted: true },
    { title_en: 'Special Lecture: Internal Security', title_mr: 'विशेष व्याख्यान: अंतर्गत सुरक्षा', lecture_type: 'special', speaker_id: sp[2].id, examination_id: exams.upsc.id, lecture_date: d(9), start_time: '10:30', end_time: '12:30', mode: 'offline', centre_id: cen1.id, venue: 'Seminar Room', is_highlighted: true },
    { title_en: 'History of Maharashtra – Overview', title_mr: 'महाराष्ट्राचा इतिहास – आढावा', lecture_type: 'regular', speaker_id: sp[5].id, examination_id: exams.mpsc.id, course_id: crs.crash.id, subject_id: subj.mpsc_hist.id, topic_id: top.mh_hist.id, lecture_date: d(21), start_time: '09:30', end_time: '11:00', mode: 'offline', centre_id: cen1.id, batch_id: b1.id },
    { title_en: 'Indian Constitution – Basics', title_mr: 'भारतीय संविधान – मूलतत्त्वे', lecture_type: 'regular', speaker_id: sp[5].id, examination_id: exams.upsc.id, course_id: crs.upsc_found.id, subject_id: subj.upsc_pol.id, topic_id: top.constitution.id, lecture_date: d(-3), start_time: '10:00', end_time: '11:30', mode: 'online', online_link: 'https://meet.example.com/sample-link-4', visibility: 'registered' },
    { title_en: 'Ancient India – Indus Valley Civilisation', title_mr: 'प्राचीन भारत – सिंधू संस्कृती', lecture_type: 'regular', speaker_id: sp[5].id, examination_id: exams.upsc.id, course_id: crs.upsc_found.id, subject_id: subj.upsc_hist.id, topic_id: top.ancient.id, lecture_date: d(-7), start_time: '10:00', end_time: '11:30', mode: 'online', online_link: 'https://meet.example.com/sample-link-5' },
  ];
  for (const r of lecRows) L.push(await ins(db, 'lectures', r));

  // ---------------- स्पर्धा परीक्षा यात्रा (sample) ----------------
  const tr = [[1, 0, '10:00', 'Pune', 'Guidance session'], [2, 2, '11:00', 'Nashik', 'Guest lecture'], [5, 5, '14:00', 'Chhatrapati Sambhajinagar', 'Orientation'], [1, 8, '10:30', 'Nagpur', 'Guidance session'], [2, 12, '15:00', 'Kolhapur', '—']];
  for (const [s, off, t, place, remarks] of tr) {
    await ins(db, 'travel_schedules', { speaker_id: sp[s].id, person_name: sp[s].name_en, schedule_date: d(off), start_time: t, place, remarks: remarks + ' (sample)' });
  }

  // ---------------- Learning resources ----------------
  const pdf1 = writeSamplePdf('modern-india-notes.pdf', 'Modern India Notes');
  const pdf2 = writeSamplePdf('maharashtra-geography-notes.pdf', 'Geography of Maharashtra');
  const pdf3 = writeSamplePdf('polity-question-bank.pdf', 'Polity Question Bank');
  const res = [
    { resource_type: 'study_material', title_en: 'Modern India – Study Notes (Sample)', title_mr: 'आधुनिक भारत – अभ्यास नोट्स (नमुना)', description_en: 'Subject notes in PDF format.', examination_id: exams.upsc.id, course_id: crs.upsc_found.id, subject_id: subj.upsc_hist.id, topic_id: top.modern.id, file_path: pdf1, access_level: 'lakshit_or_permitted' },
    { resource_type: 'study_material', title_en: 'Geography of Maharashtra – Notes (Sample)', title_mr: 'महाराष्ट्राचा भूगोल – नोट्स (नमुना)', description_en: 'Topic-wise notes.', examination_id: exams.mpsc.id, course_id: crs.mpsc_prep.id, subject_id: subj.mpsc_geo.id, topic_id: top.mh_geo.id, file_path: pdf2, access_level: 'lakshit_or_permitted' },
    { resource_type: 'question_bank', title_en: 'Polity – Question Bank PDF (Sample)', title_mr: 'राज्यशास्त्र – प्रश्नसंच PDF (नमुना)', examination_id: exams.upsc.id, subject_id: subj.upsc_pol.id, file_path: pdf3, access_level: 'registered' },
    { resource_type: 'youtube', title_en: 'Orientation Video (Sample – public)', title_mr: 'अभिमुखता व्हिडिओ (नमुना – सार्वजनिक)', subject_id: subj.upsc_hist.id, examination_id: exams.upsc.id, url: 'https://www.youtube.com/@placeholder', access_level: 'public' },
    { resource_type: 'youtube', title_en: 'Modern India Lecture Recording (Sample – registered users)', title_mr: 'आधुनिक भारत व्याख्यान रेकॉर्डिंग (नमुना – नोंदणीकृत)', subject_id: subj.upsc_hist.id, examination_id: exams.upsc.id, topic_id: top.modern.id, url: 'https://www.youtube.com/@placeholder', access_level: 'verified' },
    { resource_type: 'video', title_en: 'Maharashtra Geography – Video (Sample)', title_mr: 'महाराष्ट्र भूगोल – व्हिडिओ (नमुना)', subject_id: subj.mpsc_geo.id, examination_id: exams.mpsc.id, url: 'https://www.youtube.com/@placeholder', access_level: 'registered' },
    { resource_type: 'guest_lecture', title_en: 'Guest Lecture Resources – Civil Services Approach (Sample)', title_mr: 'अतिथी व्याख्यान साहित्य – नागरी सेवा (नमुना)', examination_id: exams.upsc.id, url: 'https://www.youtube.com/@placeholder', access_level: 'public' },
  ];
  for (const r of res) await ins(db, 'resources', r);

  // ---------------- Question bank & tests (sample MCQs) ----------------
  const qs = [
    ['upsc_hist', 'modern', 'In which year was the Indian National Congress founded?', 'भारतीय राष्ट्रीय काँग्रेसची स्थापना कोणत्या वर्षी झाली?', '1885', '1905', '1919', '1857', 'a', 'The INC was founded in 1885.'],
    ['upsc_hist', 'modern', 'The Quit India Movement was launched in which year?', 'भारत छोडो आंदोलन कोणत्या वर्षी सुरू झाले?', '1930', '1942', '1920', '1947', 'b', 'Launched in August 1942.'],
    ['upsc_hist', 'ancient', 'Harappa is located on the banks of which river?', 'हडप्पा कोणत्या नदीच्या काठी आहे?', 'Ravi', 'Indus', 'Sutlej', 'Ganga', 'a', 'Harappa lies on the Ravi river.'],
    ['upsc_hist', 'modern', 'Who founded the Satyashodhak Samaj?', 'सत्यशोधक समाजाची स्थापना कोणी केली?', 'Raja Ram Mohan Roy', 'Jyotirao Phule', 'Swami Dayanand', 'Gopal Krishna Gokhale', 'b', 'Founded by Mahatma Jyotirao Phule in 1873.'],
    ['upsc_hist', 'modern', 'The Dandi March is associated with which movement?', 'दांडी यात्रा कोणत्या चळवळीशी संबंधित आहे?', 'Non-Cooperation', 'Civil Disobedience', 'Quit India', 'Swadeshi', 'b', 'The Salt March began the Civil Disobedience Movement.'],
    ['mpsc_geo', 'mh_geo', 'Which is the highest peak in Maharashtra?', 'महाराष्ट्रातील सर्वोच्च शिखर कोणते?', 'Kalsubai', 'Torna', 'Mahabaleshwar', 'Salher', 'a', 'Kalsubai (about 1,646 m).'],
    ['mpsc_geo', 'mh_geo', 'The Godavari river originates at which place?', 'गोदावरी नदीचा उगम कोठे होतो?', 'Mahabaleshwar', 'Trimbakeshwar', 'Bhimashankar', 'Amarkantak', 'b', 'Trimbakeshwar, Nashik district.'],
    ['mpsc_geo', 'mh_geo', 'The Sahyadri ranges are also known as?', 'सह्याद्री पर्वतरांगांना आणखी काय म्हणतात?', 'Eastern Ghats', 'Western Ghats', 'Satpura', 'Aravalli', 'b', null],
    ['upsc_pol', 'constitution', 'Who is known as the chief architect of the Indian Constitution?', 'भारतीय संविधानाचे प्रमुख शिल्पकार कोणाला म्हणतात?', 'Jawaharlal Nehru', 'Dr. B. R. Ambedkar', 'Sardar Patel', 'Dr. Rajendra Prasad', 'b', null],
    ['upsc_pol', 'constitution', 'The Constitution of India came into force on?', 'भारतीय संविधान कोणत्या दिवशी लागू झाले?', '15 August 1947', '26 November 1949', '26 January 1950', '2 October 1950', 'c', null],
  ];
  const Q = [];
  for (const [s, t, question_en, question_mr, option_a, option_b, option_c, option_d, correct_option, explanation] of qs) {
    Q.push(await ins(db, 'questions', { examination_id: subj[s].examination_id, subject_id: subj[s].id, topic_id: top[t].id, question_en, question_mr, option_a, option_b, option_c, option_d, correct_option, explanation }));
  }
  const t1 = await ins(db, 'tests', { title_en: 'Post-Lecture Test: Modern India (Sample)', title_mr: 'व्याख्यानोत्तर चाचणी: आधुनिक भारत (नमुना)', test_type: 'lecture', lecture_id: L[7].id, examination_id: exams.upsc.id, course_id: crs.upsc_found.id, subject_id: subj.upsc_hist.id, instructions_en: 'Answer all questions and submit. Correct answers are shown immediately after submission.', instructions_mr: 'सर्व प्रश्नांची उत्तरे देऊन सादर करा. सादर केल्यानंतर लगेच योग्य उत्तरे दाखवली जातील.' });
  const t2 = await ins(db, 'tests', { title_en: 'Unit Test: Geography of Maharashtra (Sample)', title_mr: 'घटक चाचणी: महाराष्ट्राचा भूगोल (नमुना)', test_type: 'unit', examination_id: exams.mpsc.id, course_id: crs.mpsc_prep.id, subject_id: subj.mpsc_geo.id, instructions_en: 'Answer all questions and submit. Correct answers are shown immediately after submission.', instructions_mr: 'सर्व प्रश्नांची उत्तरे देऊन सादर करा. सादर केल्यानंतर लगेच योग्य उत्तरे दाखवली जातील.' });
  for (const [k, q] of Q.slice(0, 5).entries()) await ins(db, 'test_questions', { test_id: t1.id, question_id: q.id, sort_order: k });
  for (const [k, q] of Q.slice(5, 8).entries()) await ins(db, 'test_questions', { test_id: t2.id, question_id: q.id, sort_order: k });

  // ---------------- Assessment framework (HOLD) ----------------
  for (const [area, title_en, title_mr] of [['adaptability', 'Adaptability', 'अनुकूलनक्षमता'], ['interest', 'Interest', 'आवड'], ['career_counselling', 'Career Counselling', 'करिअर समुपदेशन']]) {
    await ins(db, 'assessments', { area, title_en, title_mr, conducted_by: 'Mr. M. R. Deshpande (proposed)', status: 'hold' });
  }

  // ---------------- Enrolments ----------------
  for (const c of [c1, c2]) {
    await ins(db, 'enrollments', { candidate_id: c.id, course_id: crs.upsc_found.id });
    await ins(db, 'enrollments', { candidate_id: c.id, course_id: crs.mpsc_prep.id });
  }

  // ---------------- Announcements ----------------
  const ann = [
    ['guest_lecture', 'Guest Lecture: Approach to Civil Services – registrations open (Sample)', 'अतिथी व्याख्यान: नागरी सेवा परीक्षेचा दृष्टिकोन – नोंदणी सुरू (नमुना)', true],
    ['training', 'Offline Crash Course – Batch A booking open (Sample)', 'ऑफलाइन क्रॅश कोर्स – बॅच A नोंदणी सुरू (नमुना)', true],
    ['important', 'Candidates must register and be verified through the Mahaamrut portal to access the study portal.', 'अभ्यास पोर्टल वापरण्यासाठी उमेदवारांनी महाअमृत पोर्टलवर नोंदणी व पडताळणी करणे आवश्यक आहे.', true],
    ['exam', 'Check the official examination website for the latest examination timetable (Sample)', 'नवीनतम परीक्षा वेळापत्रकासाठी अधिकृत संकेतस्थळ पहा (नमुना)', false],
    ['event', 'Career guidance session – details in the Lectures section (Sample)', 'करिअर मार्गदर्शन सत्र – तपशील व्याख्याने विभागात (नमुना)', false],
  ];
  for (const [category, title_en, title_mr, is_marquee] of ann) await ins(db, 'announcements', { category, title_en, title_mr, is_marquee, publish_from: d(-5) });

  // ---------------- Important links ----------------
  const links = [
    ['AMRUT – Mahaamrut Portal', 'अमृत – महाअमृत पोर्टल', 'https://mahaamrut.org.in/', 'amrut', null],
    ['Union Public Service Commission', 'संघ लोकसेवा आयोग', 'https://upsc.gov.in/', 'exam_website', exams.upsc.id],
    ['Maharashtra Public Service Commission', 'महाराष्ट्र लोकसेवा आयोग', 'https://mpsc.gov.in/', 'exam_website', exams.mpsc.id],
    ['Staff Selection Commission', 'कर्मचारी निवड आयोग', 'https://ssc.gov.in/', 'exam_website', exams.ssc.id],
  ];
  i = 0;
  for (const [title_en, title_mr, u, category, examination_id] of links) await ins(db, 'important_links', { title_en, title_mr, url: u, category, examination_id, sort_order: ++i });
}

main().catch((e) => { console.error(e); process.exit(1); });
