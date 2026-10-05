// Config-driven create / read / update / delete for the admin resources in ./resources.js
const db = require('../db/pool');
const { relUpload } = require('../middleware');

const PAGE = 25;

async function loadOptions(cfg) {
  const out = {};
  for (const f of cfg.fields) {
    if (f.type === 'ref' || f.type === 'm2m') {
      const r = f.ref;
      out[f.name] = await db.many(`SELECT ${r.idCol || 'id'} AS id, ${r.label} AS label FROM ${r.table} ORDER BY ${r.order || 'label'}`);
    } else if (f.type === 'select') {
      out[f.name] = f.options.map(([id, label]) => ({ id, label }));
    }
  }
  return out;
}

function scopeWhere(cfg, params) {
  return Object.entries(cfg.scope || {}).map(([k, v]) => { params.push(v); return `${k} = $${params.length}`; });
}

async function list(cfg, q) {
  const params = [];
  const where = scopeWhere(cfg, params);
  if (q.q && cfg.search) {
    params.push('%' + q.q.trim() + '%');
    where.push('(' + cfg.search.map((c) => `${c}::text ILIKE $${params.length}`).join(' OR ') + ')');
  }
  for (const fname of cfg.filters || []) {
    const v = q['f_' + fname];
    if (v === undefined || v === '') continue;
    params.push(v);
    where.push(`${fname}::text = $${params.length}`);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const total = (await db.one(`SELECT count(*)::int AS n FROM ${cfg.table} ${w}`, params)).n;
  const rows = await db.many(`SELECT * FROM ${cfg.table} ${w} ORDER BY ${cfg.order || 'id DESC'} LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`, params);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

async function get(cfg, id) {
  const params = [id];
  const extra = scopeWhere(cfg, params);
  const row = await db.one(`SELECT * FROM ${cfg.table} WHERE id = $1 ${extra.length ? 'AND ' + extra.join(' AND ') : ''}`, params);
  if (!row) return null;
  for (const f of cfg.fields.filter((x) => x.type === 'm2m')) {
    row[f.name] = (await db.many(`SELECT ${f.m2m.other} AS id FROM ${f.m2m.table} WHERE ${f.m2m.self} = $1`, [id])).map((r) => String(r.id));
  }
  return row;
}

function defaults(cfg) {
  const row = {};
  for (const f of cfg.fields) if (f.default !== undefined) row[f.name] = f.default;
  Object.assign(row, cfg.scope || {});
  return row;
}

// Parse & validate the submitted form. Returns { values, m2m, errors }.
function parse(cfg, body, files, existing, options) {
  const values = {}; const m2m = {}; const errors = {};
  const fileMap = Object.fromEntries((files || []).map((f) => [f.fieldname, f]));
  for (const f of cfg.fields) {
    if (f.type === 'readonly' || (existing && f.readonlyOnEdit)) continue;
    if (cfg.scope && f.name in cfg.scope) { values[f.name] = cfg.scope[f.name]; continue; }
    const raw = body[f.name];
    let v = Array.isArray(raw) ? raw : (raw === undefined ? '' : String(raw).trim());
    switch (f.type) {
      case 'checkbox': values[f.name] = raw === 'on' || raw === 'true'; continue;
      case 'm2m': m2m[f.name] = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((x) => options[f.name].some((o) => String(o.id) === String(x))); continue;
      case 'file':
        if (fileMap[f.name]) values[f.name] = (f.public ? '/uploads/' : '') + relUpload(fileMap[f.name]);
        else if (body[f.name + '__remove'] === 'on') values[f.name] = null;
        if (f.required && !fileMap[f.name] && !(existing && existing[f.name])) errors[f.name] = 'Required';
        continue;
      case 'number': case 'money':
        if (v === '') { v = f.default !== undefined ? f.default : null; break; }
        if (Number.isNaN(Number(v)) || (f.type === 'money' && Number(v) < 0)) { errors[f.name] = 'Enter a valid number'; continue; }
        v = Number(v); break;
      case 'date': if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[f.name] = 'Enter a valid date'; break;
      case 'time': if (v && !/^\d{2}:\d{2}(:\d{2})?$/.test(v)) errors[f.name] = 'Enter a valid time'; break;
      case 'url': if (v && !/^(https?:\/\/|\/)/i.test(v)) errors[f.name] = 'Link must start with http:// or https://'; break;
      case 'select': case 'ref':
        if (v && !options[f.name].some((o) => String(o.id) === v)) errors[f.name] = 'Choose a valid option';
        break;
      default: break;
    }
    if (v === '') v = null;
    if (f.required && (v === null || v === undefined)) errors[f.name] = 'Required';
    values[f.name] = v;
  }
  Object.assign(values, cfg.scope || {}); // e.g. resource_type for the Study Material view
  // Prevent a topic from becoming its own parent
  if (cfg.table === 'topics' && existing && String(values.parent_id) === String(existing.id)) errors.parent_id = 'A topic cannot be its own parent';
  return { values, m2m, errors };
}

async function save(cfg, id, values, m2m) {
  const cols = Object.keys(values);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    let rowId = id;
    if (id) {
      const sets = cols.map((c, i) => `${c} = $${i + 2}`);
      if (cfg.touch) sets.push(`${cfg.touch} = now()`);
      if (sets.length) await client.query(`UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE id = $1`, [id, ...cols.map((c) => values[c])]);
    } else {
      const r = await client.query(`INSERT INTO ${cfg.table} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`, cols.map((c) => values[c]));
      rowId = r.rows[0].id;
    }
    for (const f of cfg.fields.filter((x) => x.type === 'm2m')) {
      if (!(f.name in m2m)) continue;
      await client.query(`DELETE FROM ${f.m2m.table} WHERE ${f.m2m.self} = $1`, [rowId]);
      for (const other of m2m[f.name]) await client.query(`INSERT INTO ${f.m2m.table} (${f.m2m.self}, ${f.m2m.other}) VALUES ($1, $2)`, [rowId, other]);
    }
    await client.query('COMMIT');
    return rowId;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function remove(cfg, id) {
  const params = [id];
  const extra = scopeWhere(cfg, params);
  await db.q(`DELETE FROM ${cfg.table} WHERE id = $1 ${extra.length ? 'AND ' + extra.join(' AND ') : ''}`, params);
}

module.exports = { loadOptions, list, get, defaults, parse, save, remove, PAGE };
