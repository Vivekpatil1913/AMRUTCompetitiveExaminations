// Cached website settings & content blocks; cache is cleared whenever Admin saves.
const db = require('../db/pool');

let cache = null;

async function load() {
  if (cache) return cache;
  const [settings, content] = await Promise.all([
    db.many('SELECT * FROM settings ORDER BY group_name, sort_order'),
    db.many('SELECT * FROM site_content'),
  ]);
  cache = {
    rows: settings,
    map: Object.fromEntries(settings.map((s) => [s.key, s])),
    content: Object.fromEntries(content.map((c) => [c.key, c])),
  };
  return cache;
}

function clear() { cache = null; }

// Bilingual setting accessor bound to a language
function accessor(data, lang) {
  return (key) => {
    const s = data.map[key];
    if (!s) return '';
    return (lang === 'mr' && s.value_mr) ? s.value_mr : (s.value_en || '');
  };
}

module.exports = { load, clear, accessor };
