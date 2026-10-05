require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { pool } = require('./src/db/pool');
const mw = require('./src/middleware');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.set('trust proxy', 1); // behind AWS load balancer / reverse proxy
app.disable('x-powered-by');

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/uploads/public', express.static(path.join(mw.UPLOAD_ROOT, 'public')));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 },
}));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  next();
});
app.use(mw.language, mw.csrf, mw.locals, mw.page);

app.use('/admin', require('./src/routes/admin'));
app.use('/portal', require('./src/routes/portal'));
app.use('/', require('./src/routes/files'));
app.use('/', require('./src/routes/public'));

app.use((req, res) => res.status(404).page('public/error', { title: '404', code: 404, message: 'The page you are looking for was not found.' }));
app.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') err.status = 400;
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  if (!res.page) return res.status(status).send(err.message);
  res.status(status).page('public/error', { title: String(status), code: status, message: status >= 500 ? 'An unexpected error occurred. Please try again later.' : err.message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AMRUT study portal running on http://localhost:${port}`));
