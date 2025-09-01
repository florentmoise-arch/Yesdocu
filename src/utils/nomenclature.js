const fs = require('fs');
const path = require('path');

function parseName(name){
  const base = name.replace(/\.pdf$/i, '');
  const p = base.split('_');
  return {
    prefix: p[0] || '', dpt: p[1] || '', spr: p[2] || '', com: p[3] || '',
    lvo: p[4] || '', bur: p[5] || '', run: p[6] || '', extra: p[7] || ''
  };
}

function docRowFromPath(dir, file, parsed = parseName(file)){
  const full = path.join(dir, file);
  const st = fs.statSync(full);
  const size_kb = Math.round(st.size / 1024);
  return {
    name: file, ...parsed, total_pages: 0, size_kb,
    status: 'pending', dest_hotfolder: null, source: path.basename(dir),
    created_at: st.birthtime?.toISOString?.() || new Date(st.ctimeMs || Date.now()).toISOString(),
    updated_at: st.mtime?.toISOString?.() || new Date(st.mtimeMs || Date.now()).toISOString(),
  };
}

module.exports = { parseName, docRowFromPath };