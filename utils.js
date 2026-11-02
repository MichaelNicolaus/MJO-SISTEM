(function () {
  const cfg = window.MJO_CONFIG;
  const OFFSET = cfg.TIMEZONE_OFFSET_HOURS * 3600000;
  const pad = n => String(n).padStart(2, '0');
  const U = {};

  U.uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.rp = n => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  U.num = n => (Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: 3 });
  U.pad = pad;
  U.DAY = 864e5;

  /* ---------- Waktu: memakai jam server (header Date) bila tersedia ---------- */
  U.clockOffset = 0;
  U.clockSource = 'perangkat';
  U.now = () => Date.now() + U.clockOffset;

  U.syncClock = async function () {
    try {
      const url = location.href.split('#')[0];
      const t0 = Date.now();
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      const t1 = Date.now();
      const h = r.headers.get('Date');
      if (h) {
        const server = new Date(h).getTime();
        if (!isNaN(server)) {
          U.clockOffset = server + (t1 - t0) / 2 - t1;
          U.clockSource = 'server';
          return U.clockSource;
        }
      }
    } catch (e) { /* jatuh ke jam perangkat */ }
    U.clockOffset = 0;
    U.clockSource = 'perangkat';
    return U.clockSource;
  };

  // Pecah timestamp menjadi komponen waktu WIB
  U.wib = ms => {
    const d = new Date(ms + OFFSET);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    return {
      y, m, d: dd, h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), dow: d.getUTCDay(),
      date: `${y}-${pad(m)}-${pad(dd)}`,
      time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
    };
  };
  U.fromWib = (y, m, d, h = 0, mi = 0, s = 0) => Date.UTC(y, m - 1, d, h, mi, s) - OFFSET;

  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BLN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  U.monthName = m => BLN_FULL[m - 1];
  U.fmtDate = s => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d} ${BLN[+m - 1]} ${y}`; };
  U.fmtDateTime = ms => { if (!ms) return '—'; const w = U.wib(ms); return `${U.fmtDate(w.date)} ${w.time.slice(0, 5)}`; };
  U.normTime = t => (t && t.length === 5 ? t + ':00' : t || '');

  /* ---------- Berkas ---------- */
  U.csv = rows => '﻿' + rows.map(r => r.map(v => {
    v = v == null ? '' : String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',')).join('\r\n');

  U.download = (name, text, type = 'text/csv;charset=utf-8') => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  // Kompres gambar dari <input type=file> menjadi data URL JPEG
  U.imageToDataURL = (file, maxW = 900, q = 0.7) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc);
      c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('File gambar tidak dapat dibaca')); };
    img.src = url;
  });

  window.U = U;
})();
