// View helpers shared by public, portal and admin templates.
const dicts = {
  en: { ...require('./i18n/en'), pt: require('./i18n/extra/portal-en'), ad: require('./i18n/extra/admin-en') },
  mr: { ...require('./i18n/mr'), pt: require('./i18n/extra/portal-mr'), ad: require('./i18n/extra/admin-mr') },
};

// Simple stroke icons (24x24 viewBox). Decorative unless a label is given.
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7',
  exam: 'M9 3h6l1 2h3v16H5V5h3zM9 11h6M9 15h4',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clock: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z',
  mic: 'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3',
  map: 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 8a2 2 0 100 4 2 2 0 000-4z',
  route: 'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM6 15V9a4 4 0 014-4h6M18 9v6a4 4 0 01-4 4H8',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  video: 'M4 6h12v12H4zM16 10l5-3v10l-5-3',
  play: 'M12 3a9 9 0 100 18 9 9 0 000-18zM10 8.5l5 3.5-5 3.5z',
  question: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01',
  test: 'M9 11l2 2 4-4M5 4h14v16H5z',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4',
  megaphone: 'M3 10v4h4l6 4V6L7 10zM16 9a4 4 0 010 6M19 6a8 8 0 010 12',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7L12 6.3M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M16 3.5a4 4 0 010 7.5M22 21a7 7 0 00-5-6.7',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
  check: 'M5 12l4 4 10-10',
  x: 'M6 6l12 12M18 6L6 18',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5h.01',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  login: 'M10 17l5-5-5-5M15 12H3M14 4h6v16h-6',
  logout: 'M9 17l-5-5 5-5M4 12h12M14 4h6v16h-6',
  building: 'M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01',
  bed: 'M3 18V7M3 13h18v5M21 13a3 3 0 00-3-3h-7v3M7 10a1.5 1.5 0 100 3',
  rupee: 'M7 4h10M7 8h10M7 4c5 0 7 2 7 4s-2 4-7 4l7 8',
  upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  brain: 'M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 1V5a3 3 0 00-3-1zM15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 1',
  youtube: 'M3 8a3 3 0 013-3h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3zM10 9l5 3-5 3z',
  pause: 'M8 5v14M16 5v14',
};
function icon(name, cls = '', label = '') {
  const d = ICONS[name] || ICONS.info;
  const aria = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" ${aria}><path d="${d}"/></svg>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function makeT(lang) {
  const dict = dicts[lang] || dicts.en;
  return (key) => {
    const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
    if (v != null) return v;
    const f = key.split('.').reduce((o, k) => (o == null ? o : o[k]), dicts.en);
    return f != null ? f : key;
  };
}

// Pick the language variant of a bilingual DB field: L(row, 'title') → title_mr || title_en
function makeL(lang) {
  return (row, field) => {
    if (!row) return '';
    if (lang === 'mr' && row[field + '_mr']) return row[field + '_mr'];
    return row[field + '_en'] ?? row[field] ?? '';
  };
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_MR = ['जाने', 'फेब्रु', 'मार्च', 'एप्रि', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'];
function makeFormat(lang) {
  const months = lang === 'mr' ? MONTHS_MR : MONTHS_EN;
  const ymd = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || ''));
  return {
    date(v) {
      if (!v) return '—';
      const [y, m, dd] = ymd(v).split('-');
      return `${Number(dd)} ${months[Number(m) - 1]} ${y}`;
    },
    day(v) { return v ? Number(ymd(v).split('-')[2]) : ''; },
    month(v) { return v ? months[Number(ymd(v).split('-')[1]) - 1] : ''; },
    time(v) {
      if (!v) return '—';
      const [h, m] = String(v).split(':').map(Number);
      return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    },
    timeRange(a, b) { return a ? (b ? `${this.time(a)} – ${this.time(b)}` : this.time(a)) : '—'; },
    datetime(v) { return v ? new Date(v).toLocaleString(lang === 'mr' ? 'mr-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; },
    money(v) { return v == null || v === '' ? '—' : '₹' + Number(v).toLocaleString('en-IN'); },
  };
}

const today = () => new Date().toISOString().slice(0, 10);

// Build a query string from current filters, overriding some keys
function qs(base, overrides = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? '?' + s : '';
}

function youtubeId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

module.exports = { icon, esc, makeT, makeL, makeFormat, today, qs, youtubeId, dicts };
