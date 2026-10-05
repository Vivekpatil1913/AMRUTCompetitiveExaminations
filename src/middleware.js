const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db/pool');
const settingsSvc = require('./services/settings');
const h = require('./helpers');

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || 'uploads');

// ---------- Language (Marathi / English) ----------
function language(req, res, next) {
  if (req.query.lang === 'en' || req.query.lang === 'mr') {
    req.session.lang = req.query.lang;
    const u = new URL(req.originalUrl, 'http://x');
    u.searchParams.delete('lang');
    return res.redirect(u.pathname + u.search);
  }
  req.lang = req.session.lang || 'mr';
  next();
}

// ---------- CSRF (session token; multipart forms pass it in the query string) ----------
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  if (req.method !== 'POST') return next();
  const token = (req.body && req.body._csrf) || req.query._csrf || req.get('x-csrf-token');
  if (token !== req.session.csrf) {
    const err = new Error('Your session has expired. Please go back, refresh the page and try again.');
    err.status = 403;
    return next(err);
  }
  next();
}

// ---------- Common view locals ----------
async function locals(req, res, next) {
  try {
    const lang = req.lang;
    const site = await settingsSvc.load();
    let candidate = null;
    if (req.session.candidateId) {
      candidate = await db.one('SELECT * FROM candidates WHERE id = $1 AND is_active', [req.session.candidateId]);
      if (!candidate) delete req.session.candidateId;
    }
    let admin = null;
    if (req.session.adminId) admin = await db.one('SELECT id, name, email, role FROM admins WHERE id = $1 AND is_active', [req.session.adminId]);
    req.candidate = candidate;
    req.admin = admin;
    Object.assign(res.locals, {
      lang, t: h.makeT(lang), L: h.makeL(lang), fmt: h.makeFormat(lang), icon: h.icon, esc: h.esc, qs: h.qs,
      youtubeId: h.youtubeId, today: h.today(), S: settingsSvc.accessor(site, lang), C: (k) => site.content[k] || {},
      candidate, admin, path: req.path, url: req.originalUrl, query: req.query,
      flash: req.session.flash || null, title: '', layout: res.locals.layout || 'layouts/public',
      demo: process.env.NODE_ENV !== 'production', // shows prototype hints (demo logins) outside production
    });
    delete req.session.flash;
    // Marquee items (announcements + highlighted lectures) for public & portal headers
    res.locals.marquee = await db.many(`
      SELECT 'ann' AS kind, id, title_en, title_mr, link_url, NULL::date AS lecture_date FROM announcements
       WHERE is_published AND is_marquee AND (publish_from IS NULL OR publish_from <= CURRENT_DATE) AND (publish_to IS NULL OR publish_to >= CURRENT_DATE)
      UNION ALL
      SELECT 'lec', id, title_en, title_mr, NULL, lecture_date FROM lectures
       WHERE is_published AND is_highlighted AND lecture_date >= CURRENT_DATE
      ORDER BY kind DESC, lecture_date NULLS LAST LIMIT 12`);
    next();
  } catch (e) { next(e); }
}

// ---------- Layout rendering: res.page(view, data) ----------
function page(req, res, next) {
  res.page = (view, data = {}) => {
    const layout = data.layout || res.locals.layout;
    res.render(view, data, (err, body) => {
      if (err) return next(err);
      res.render(layout, { ...data, body }, (err2, html) => (err2 ? next(err2) : res.send(html)));
    });
  };
  next();
}

function flash(req, type, msg) { req.session.flash = { type, msg }; }

// ---------- Guards ----------
function requireCandidate(req, res, next) {
  if (req.candidate) return next();
  req.session.returnTo = req.originalUrl;
  flash(req, 'info', res.locals.t('common.loginToAccess'));
  res.redirect('/login');
}
function requireAdmin(req, res, next) {
  if (req.admin) return next();
  res.redirect('/admin/login');
}

// ---------- Uploads ----------
// uploads/public/*  → served statically (logo, favicon, QR, speaker photos)
// uploads/private/* → served only through access-checked routes (study material, transaction proofs)
function uploader(folder, { images = true, pdf = false, maxMb = 10 } = {}) {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  const allowed = [...(images ? ['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'] : []), ...(pdf ? ['application/pdf'] : [])];
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(allowed.includes(file.mimetype) ? null : Object.assign(new Error('Unsupported file type'), { status: 400 }), allowed.includes(file.mimetype)),
  });
}
const relUpload = (file) => (file ? path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/') : null);

module.exports = { language, csrf, locals, page, flash, requireCandidate, requireAdmin, uploader, relUpload, UPLOAD_ROOT };
