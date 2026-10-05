// Access-checked file delivery for private uploads (study material, transaction proofs, contributor photos).
const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('../db/pool');
const { canAccess, lockReason } = require('../services/access');
const { UPLOAD_ROOT, flash } = require('../middleware');

const router = express.Router();

function send(res, rel, downloadName) {
  const abs = path.resolve(UPLOAD_ROOT, rel || '');
  if (!rel || !abs.startsWith(UPLOAD_ROOT + path.sep) || !fs.existsSync(abs)) return res.status(404).page('public/error', { title: '404', code: 404, message: 'File not found.' });
  res.set('Cache-Control', 'private, no-store');
  return downloadName ? res.download(abs, downloadName) : res.sendFile(abs);
}

router.get('/files/resource/:id', async (req, res, next) => {
  try {
    const r = await db.one('SELECT * FROM resources WHERE id = $1 AND is_published', [req.params.id]);
    if (!r || !r.file_path) return res.status(404).page('public/error', { title: '404', code: 404, message: 'File not found.' });
    let grants = new Set();
    if (req.candidate) grants = new Set((await db.many('SELECT resource_id FROM resource_grants WHERE candidate_id = $1', [req.candidate.id])).map((g) => g.resource_id));
    if (!req.admin && !canAccess(req.candidate, r, grants)) {
      if (lockReason(req.candidate, r) === 'login') {
        req.session.returnTo = req.originalUrl;
        flash(req, 'info', res.locals.t('common.loginToAccess'));
        return res.redirect('/login');
      }
      return res.status(403).page('public/error', { title: '403', code: 403, message: res.locals.t('access.' + r.access_level) + ' – ' + res.locals.t('common.restricted') });
    }
    const safe = (r.title_en || 'material').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + path.extname(r.file_path);
    return send(res, r.file_path, safe);
  } catch (e) { next(e); }
});

// Transaction proof: visible to the candidate who uploaded it and to admins
router.get('/files/proof/:bookingId', async (req, res, next) => {
  try {
    const b = await db.one('SELECT * FROM offline_bookings WHERE id = $1', [req.params.bookingId]);
    if (!b || !(req.admin || (req.candidate && req.candidate.id === b.candidate_id))) return res.status(404).page('public/error', { title: '404', code: 404, message: 'File not found.' });
    return send(res, b.proof_path);
  } catch (e) { next(e); }
});

// Contributor photo: admin only
router.get('/files/contributor/:id', async (req, res, next) => {
  try {
    if (!req.admin) return res.redirect('/admin/login');
    const c = await db.one('SELECT photo_path FROM contributors WHERE id = $1', [req.params.id]);
    return send(res, c && c.photo_path);
  } catch (e) { next(e); }
});

module.exports = router;
