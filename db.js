/*
  Lapisan data. Antarmuka sama untuk dua mode:
  - lokal    : localStorage browser
  - bersama  : Supabase (tabel `records`, lihat supabase.sql), dengan penarikan berkala
               supaya isi selalu terbaru di semua perangkat.
*/
(function () {
  const cfg = window.MJO_CONFIG, U = window.U;
  const LS = 'mjo_db_v1';
  const COLS = ['akun', 'stok', 'absensi', 'riwayat_absensi', 'pendapatan', 'aturan_ai',
    'selisih_stok', 'pengaturan_laporan', 'laporan', 'notifikasi'];

  const DB = {
    COLS,
    remote: !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY),
    cache: {},
    meta: {},          // `${col}|${id}` -> updated_at (ms) dari server
    listeners: []
  };
  COLS.forEach(c => { DB.cache[c] = new Map(); });

  const H = () => ({
    apikey: cfg.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  });
  const REST = () => cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/records';

  function persist() {
    if (DB.remote) return; // mode bersama: tidak menyimpan lokal (menghindari batas kuota)
    const out = {};
    COLS.forEach(c => { out[c] = [...DB.cache[c].values()]; });
    try { localStorage.setItem(LS, JSON.stringify(out)); }
    catch (e) {
      if (!DB.warned) {
        DB.warned = true;
        window.UI && UI.toast('Penyimpanan browser penuh. Unduh cadangan lalu gunakan database bersama (lihat README).', 'err');
      }
    }
  }

  async function rFetch(url, opt = {}) {
    const r = await fetch(url, { ...opt, headers: { ...H(), ...(opt.headers || {}) } });
    if (!r.ok) throw new Error('Database bersama menolak permintaan (' + r.status + ')');
    return r;
  }

  async function rList(select, extra = '') {
    let all = [], from = 0;
    const step = 1000;
    for (;;) {
      const r = await rFetch(`${REST()}?select=${select}${extra}`, {
        headers: { Range: `${from}-${from + step - 1}`, 'Range-Unit': 'items' }
      });
      const rows = await r.json();
      all = all.concat(rows);
      if (rows.length < step) break;
      from += step;
    }
    return all;
  }

  DB.init = async function () {
    if (!DB.remote) {
      try {
        const raw = JSON.parse(localStorage.getItem(LS) || '{}');
        COLS.forEach(c => (raw[c] || []).forEach(o => DB.cache[c].set(o.id, o)));
      } catch (e) { console.warn('Data lokal tidak terbaca', e); }
      return;
    }
    await DB.sync(true);
  };

  // Mode bersama: tarik hanya data yang berubah. Mengembalikan true bila ada perubahan.
  DB.sync = async function (first) {
    if (!DB.remote) return false;
    const light = await rList('collection,id,updated_at');
    const remoteKeys = new Set();
    const need = {};
    for (const row of light) {
      if (!DB.cache[row.collection]) continue;
      const key = row.collection + '|' + row.id;
      remoteKeys.add(key);
      const ts = Date.parse(row.updated_at);
      if (DB.meta[key] !== ts || !DB.cache[row.collection].has(row.id)) {
        (need[row.collection] = need[row.collection] || []).push({ id: row.id, ts });
      }
    }
    let changed = false;
    for (const col of Object.keys(need)) {
      const list = need[col];
      for (let i = 0; i < list.length; i += 40) {
        const batch = list.slice(i, i + 40);
        const ids = batch.map(b => b.id).join(',');
        const r = await rFetch(`${REST()}?select=id,data,updated_at&collection=eq.${col}&id=in.(${ids})`);
        for (const row of await r.json()) {
          DB.cache[col].set(row.id, row.data);
          DB.meta[col + '|' + row.id] = Date.parse(row.updated_at);
          changed = true;
        }
      }
    }
    for (const col of COLS) {
      for (const id of [...DB.cache[col].keys()]) {
        if (!remoteKeys.has(col + '|' + id)) { DB.cache[col].delete(id); delete DB.meta[col + '|' + id]; changed = true; }
      }
    }
    if (changed && !first) DB.emit();
    return changed;
  };

  DB.all = col => [...DB.cache[col].values()];
  DB.get = (col, id) => DB.cache[col].get(id) || null;

  DB.put = async function (col, obj) {
    const rec = { ...obj };
    const now = U.now();
    if (!rec.id) rec.id = U.uid();
    if (!rec.createdAt) rec.createdAt = now;
    rec.updatedAt = now;
    DB.cache[col].set(rec.id, rec);
    persist();
    if (DB.remote) {
      const ts = new Date().toISOString();
      await rFetch(`${REST()}?on_conflict=collection,id`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ collection: col, id: rec.id, data: rec, updated_at: ts })
      });
      DB.meta[col + '|' + rec.id] = Date.parse(ts);
    }
    return rec;
  };

  DB.del = async function (col, id) {
    DB.cache[col].delete(id);
    persist();
    if (DB.remote) {
      await rFetch(`${REST()}?collection=eq.${col}&id=eq.${id}`, { method: 'DELETE' });
      delete DB.meta[col + '|' + id];
    }
  };

  DB.onChange = fn => DB.listeners.push(fn);
  DB.emit = () => DB.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

  DB.exportAll = () => {
    const out = { _versi: 1, _diekspor: new Date().toISOString() };
    COLS.forEach(c => { out[c] = DB.all(c); });
    return out;
  };
  DB.importAll = async function (obj) {
    if (DB.remote) throw new Error('Pemulihan hanya untuk mode lokal. Gunakan Supabase untuk mode bersama.');
    COLS.forEach(c => { DB.cache[c] = new Map((obj[c] || []).map(o => [o.id, o])); });
    persist();
  };

  window.DB = DB;
})();
