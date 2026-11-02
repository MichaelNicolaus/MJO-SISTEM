(function () {
  const U = window.U, DB = window.DB;

  /* ================= Peran & hak akses ================= */
  const ROLES = { admin: 'Admin', gudang: 'Staff Gudang', tenant: 'Karyawan Tenant', finance: 'Staff Finance', founder: 'Founder' };
  const PERM = {
    stok:       { read: ['admin', 'gudang', 'finance', 'founder'], write: ['gudang'], verify: ['finance'] },
    absensi:    { read: ['admin', 'tenant', 'founder'], input: ['tenant'], edit: ['admin'] },
    pendapatan: { read: ['admin', 'finance', 'founder'], write: ['finance'] },
    akun:       { read: ['admin'], write: ['admin'] },
    laporan:    { read: ['admin', 'finance', 'founder'], setting: ['admin'] },
    selisih:    { read: ['admin', 'gudang', 'founder'], rules: ['admin'] }
  };
  const ROLE_DESC = {
    admin: 'Mengelola akun & hak akses, koreksi absensi, mengatur laporan otomatis dan aturan AI selisih stok.',
    gudang: 'Input, update, dan hapus data stok beserta struk pembelian.',
    tenant: 'Absen masuk/pulang dengan foto selfie langsung dari aplikasi.',
    finance: 'Input dan update data pendapatan, memverifikasi pembelian stok, melihat laporan.',
    founder: 'Hanya melihat: dashboard, laporan, stok, pendapatan, dan absensi.'
  };

  /* ================= Autentikasi ================= */
  const Auth = { user: null };
  Auth.hash = async (pw, salt) => {
    const data = new TextEncoder().encode(salt + ':' + pw);
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381;
    for (const c of data) h = ((h << 5) + h + c) >>> 0;
    return 'x' + h.toString(16);
  };
  Auth.login = async (username, pw) => {
    const a = DB.all('akun').find(x => x.username.toLowerCase() === String(username).trim().toLowerCase());
    const bad = new Error('Username atau password salah, atau akun nonaktif.');
    if (!a || a.status !== 'aktif') throw bad;
    if ((await Auth.hash(pw, a.salt)) !== a.passHash) throw bad;
    sessionStorage.setItem('mjo_uid', a.id);
    Auth.user = a;
  };
  Auth.restore = () => {
    let id = null;
    try { id = sessionStorage.getItem('mjo_uid'); } catch (e) { /* abaikan */ }
    const a = id && DB.get('akun', id);
    Auth.user = a && a.status === 'aktif' ? a : null;
  };
  Auth.refresh = () => { if (Auth.user) Auth.user = DB.get('akun', Auth.user.id); if (!Auth.user || Auth.user.status !== 'aktif') Auth.logout(); };
  Auth.logout = () => { try { sessionStorage.removeItem('mjo_uid'); } catch (e) { /* abaikan */ } Auth.user = null; };
  Auth.can = (res, act) => !!(Auth.user && PERM[res] && PERM[res][act] && PERM[res][act].includes(Auth.user.peran));
  Auth.newAccount = async (data, password) => {
    const salt = U.uid('s');
    return DB.put('akun', { ...data, salt, passHash: await Auth.hash(password, salt), status: data.status || 'aktif' });
  };

  /* ================= Mesin bisnis ================= */
  const monthPrefix = (y, m) => `${y}-${U.pad(m)}`;
  const Engine = {};

  Engine.selisih = s => {
    if (s.stokSebenarnya === null || s.stokSebenarnya === undefined || s.stokSebenarnya === '') return null;
    return Number(s.stokSebenarnya) - Number(s.jumlah);
  };
  Engine.monthRevenue = (y, m) => DB.all('pendapatan').filter(p => p.tanggal.startsWith(monthPrefix(y, m))).reduce((a, p) => a + Number(p.nominal), 0);
  Engine.monthExpense = (y, m) => DB.all('stok').filter(s => (s.tanggalMasuk || '').startsWith(monthPrefix(y, m))).reduce((a, s) => a + Number(s.hargaBeli || 0), 0);

  /* ---------- Notifikasi ---------- */
  Engine.notify = (untuk, judul, pesan) => DB.put('notifikasi', { untuk, judul, pesan, waktu: U.now(), readBy: [] });
  Engine.unread = () => {
    const u = Auth.user;
    if (!u) return [];
    return DB.all('notifikasi').filter(n => n.untuk.includes(u.peran) && !(n.readBy || []).includes(u.id)).sort((a, b) => b.waktu - a.waktu);
  };

  /* ---------- AI selisih stok (mesin aturan) ----------
     Membandingkan stok tercatat dengan stok sebenarnya. Untuk tiap aturan aktif yang
     cocok dengan besar selisih, jalankan tindakannya: notifikasi / laporan / perbaiki.   */
  Engine.checkSelisih = async stok => {
    const diff = Engine.selisih(stok);
    if (diff === null || diff === 0) return [];
    const key = `${stok.id}|${stok.jumlah}|${stok.stokSebenarnya}`;
    if (DB.all('selisih_stok').some(x => x.key === key)) return [];

    const abs = Math.abs(diff);
    const pct = stok.jumlah ? (abs / Math.abs(Number(stok.jumlah))) * 100 : 100;
    const rules = DB.all('aturan_ai').filter(r => r.aktif).sort((a, b) => a.createdAt - b.createdAt);
    const matched = rules.filter(r => {
      const v = r.satuan === 'persen' ? pct : abs;
      const min = Number(r.min) || 0;
      const max = r.max === '' || r.max == null ? Infinity : Number(r.max);
      return v >= min && v <= max;
    });

    const before = Number(stok.jumlah);
    const out = [];
    const base = {
      key, stokId: stok.id, stokNama: stok.nama, satuan: stok.satuan,
      stokTercatat: before, stokSebenarnya: Number(stok.stokSebenarnya), selisih: diff, waktu: U.now()
    };
    const txt = `${stok.nama}: tercatat ${U.num(before)}, sebenarnya ${U.num(stok.stokSebenarnya)} ${stok.satuan} (selisih ${diff > 0 ? '+' : ''}${U.num(diff)}).`;

    if (!matched.length) {
      out.push(await DB.put('selisih_stok', { ...base, aturanNama: '—', tindakan: 'Tidak ada aturan yang cocok', hasil: 'Menunggu tinjauan Admin' }));
      await Engine.notify(['admin', 'gudang'], 'Selisih stok tanpa aturan', txt);
      return out;
    }

    // perbaiki dijalankan terakhir agar notifikasi/laporan mencatat nilai sebelum diperbaiki
    matched.sort((a, b) => (a.tindakan === 'perbaiki') - (b.tindakan === 'perbaiki'));
    for (const r of matched) {
      let hasil = '';
      if (r.tindakan === 'notifikasi') {
        await Engine.notify(['admin', 'gudang'], 'Selisih stok terdeteksi', `${txt} Aturan: ${r.nama}.`);
        hasil = 'Notifikasi dikirim ke Admin & Staff Gudang';
      } else if (r.tindakan === 'laporan') {
        await DB.put('laporan', {
          jenis: 'selisih', judul: `Laporan selisih stok: ${stok.nama}`, periode: U.wib(U.now()).date,
          waktu: U.now(), trigger: 'otomatis', format: 'csv',
          ringkasan: [{ label: 'Aturan', value: r.nama }, { label: 'Keterangan', value: txt }],
          columns: [{ key: 'nama', label: 'Barang' }, { key: 'tercatat', label: 'Stok tercatat' }, { key: 'sebenarnya', label: 'Stok sebenarnya' }, { key: 'selisih', label: 'Selisih' }, { key: 'satuan', label: 'Satuan' }],
          rows: [{ nama: stok.nama, tercatat: before, sebenarnya: Number(stok.stokSebenarnya), selisih: diff, satuan: stok.satuan }]
        });
        hasil = 'Laporan selisih dibuat';
      } else if (r.tindakan === 'perbaiki') {
        const fresh = DB.get('stok', stok.id);
        await DB.put('stok', { ...fresh, jumlah: Number(stok.stokSebenarnya), catatan: `Dikoreksi otomatis oleh AI (${r.nama}) dari ${U.num(before)} menjadi ${U.num(stok.stokSebenarnya)}` });
        await Engine.notify(['admin', 'gudang'], 'Stok dikoreksi otomatis', `${txt} Data stok diperbaiki sesuai aturan "${r.nama}".`);
        hasil = 'Data stok diperbaiki otomatis';
      }
      out.push(await DB.put('selisih_stok', { ...base, aturanId: r.id, aturanNama: r.nama, tindakan: { notifikasi: 'Kirim notifikasi', laporan: 'Buat laporan', perbaiki: 'Perbaiki data stok' }[r.tindakan], hasil }));
    }
    return out;
  };

  Engine.checkAll = async () => {
    let n = 0;
    for (const s of DB.all('stok')) n += (await Engine.checkSelisih(s)).length;
    return n;
  };

  /* ---------- Laporan ---------- */
  Engine.buildStokReport = jenisData => {
    let items = DB.all('stok').sort((a, b) => a.nama.localeCompare(b.nama));
    if (jenisData === 'selisih') items = items.filter(s => { const d = Engine.selisih(s); return d !== null && d !== 0; });
    if (jenisData === 'belum_verifikasi') items = items.filter(s => !s.verifikasi);
    const rows = items.map(s => ({
      nama: s.nama, jumlah: s.jumlah, satuan: s.satuan,
      stokSebenarnya: s.stokSebenarnya ?? '', selisih: Engine.selisih(s) ?? '',
      lokasi: s.lokasi, tanggalMasuk: s.tanggalMasuk, hargaBeli: Number(s.hargaBeli || 0),
      verifikasi: s.verifikasi ? 'Ya' : 'Belum'
    }));
    return {
      columns: [
        { key: 'nama', label: 'Barang' }, { key: 'jumlah', label: 'Stok tercatat' }, { key: 'satuan', label: 'Satuan' },
        { key: 'stokSebenarnya', label: 'Stok sebenarnya' }, { key: 'selisih', label: 'Selisih' }, { key: 'lokasi', label: 'Lokasi' },
        { key: 'tanggalMasuk', label: 'Tanggal masuk' }, { key: 'hargaBeli', label: 'Biaya pembelian (Rp)' }, { key: 'verifikasi', label: 'Terverifikasi' }
      ],
      rows,
      ringkasan: [
        { label: 'Jumlah jenis barang', value: rows.length },
        { label: 'Barang berselisih', value: rows.filter(r => r.selisih !== '' && r.selisih !== 0).length },
        { label: 'Total biaya pembelian', value: U.rp(rows.reduce((a, r) => a + r.hargaBeli, 0)) }
      ]
    };
  };

  Engine.generateStok = async (set, trigger, occ) => {
    const w = U.wib(U.now());
    const label = { semua: 'Semua stok', selisih: 'Hanya barang berselisih', belum_verifikasi: 'Belum diverifikasi' }[set.jenisData] || 'Semua stok';
    const rep = Engine.buildStokReport(set.jenisData);
    const saved = await DB.put('laporan', {
      id: trigger === 'otomatis' ? `stok-${occ}` : undefined,
      jenis: 'stok', judul: `Laporan stok (${label})`, periode: w.date,
      waktu: U.now(), trigger, format: set.format || 'csv', ...rep
    });
    if (trigger === 'otomatis') {
      await DB.put('pengaturan_laporan', { ...set, terakhirDibuat: occ });
      await Engine.notify(['admin'], 'Laporan stok dibuat otomatis', `${saved.judul} tanggal ${U.fmtDate(w.date)} sudah tersedia di menu Laporan.`);
    }
    return saved;
  };

  Engine.buildPendapatanReport = (y, m) => {
    const pre = monthPrefix(y, m);
    const tx = DB.all('pendapatan').filter(p => p.tanggal.startsWith(pre)).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const beli = DB.all('stok').filter(s => (s.tanggalMasuk || '').startsWith(pre));
    const total = tx.reduce((a, p) => a + Number(p.nominal), 0);
    const exp = beli.reduce((a, s) => a + Number(s.hargaBeli || 0), 0);
    const perSumber = {};
    tx.forEach(p => { perSumber[p.sumber] = (perSumber[p.sumber] || 0) + Number(p.nominal); });
    return {
      columns: [{ key: 'tanggal', label: 'Tanggal' }, { key: 'sumber', label: 'Sumber' }, { key: 'nomor', label: 'No. transaksi' }, { key: 'nominal', label: 'Nominal (Rp)' }],
      rows: tx.map(p => ({ tanggal: p.tanggal, sumber: p.sumber, nomor: p.nomorTransaksi, nominal: Number(p.nominal) })),
      ringkasan: [
        { label: 'Total pendapatan', value: U.rp(total) },
        { label: 'Total pengeluaran (pembelian stok)', value: U.rp(exp) },
        { label: 'Laba / (rugi)', value: U.rp(total - exp) },
        { label: 'Jumlah transaksi', value: tx.length },
        ...Object.keys(perSumber).map(k => ({ label: 'Sumber: ' + k, value: U.rp(perSumber[k]) }))
      ]
    };
  };

  Engine.generatePendapatan = async (y, m, set, trigger, occ) => {
    const rep = Engine.buildPendapatanReport(y, m);
    const saved = await DB.put('laporan', {
      id: `pendapatan-${y}-${U.pad(m)}`,
      jenis: 'pendapatan', judul: `Laporan laba bulanan ${U.monthName(m)} ${y}`, periode: `${y}-${U.pad(m)}`,
      waktu: U.now(), trigger, format: (set && set.format) || 'csv', ...rep
    });
    if (trigger === 'otomatis') {
      await DB.put('pengaturan_laporan', { ...set, terakhirDibuat: occ });
      await Engine.notify(['admin', 'finance', 'founder'], 'Laporan laba bulanan dibuat', `${saved.judul} sudah tersedia di menu Laporan.`);
    }
    return saved;
  };

  // Waktu jadwal terakhir yang seharusnya sudah lewat
  Engine.lastOccurrence = (set, nowMs) => {
    const w = U.wib(nowMs);
    const [h, mi] = (set.jam || '07:00').split(':').map(Number);
    if (set.frekuensi === 'harian') {
      let t = U.fromWib(w.y, w.m, w.d, h, mi);
      if (t > nowMs) t -= U.DAY;
      return t;
    }
    if (set.frekuensi === 'mingguan') {
      let t = U.fromWib(w.y, w.m, w.d, h, mi) - ((w.dow - Number(set.hari) + 7) % 7) * U.DAY;
      if (t > nowMs) t -= 7 * U.DAY;
      return t;
    }
    const tgl = Number(set.tanggal || 1);
    let y = w.y, m = w.m;
    let t = U.fromWib(y, m, tgl, h, mi);
    if (t > nowMs) { m--; if (m < 1) { m = 12; y--; } t = U.fromWib(y, m, tgl, h, mi); }
    return t;
  };

  // Dipanggil saat aplikasi dibuka dan tiap menit selama terbuka
  Engine.runScheduler = async () => {
    const now = U.now();
    let made = 0;
    const st = DB.get('pengaturan_laporan', 'stok');
    if (st && st.aktif) {
      const occ = Engine.lastOccurrence(st, now);
      if ((st.terakhirDibuat || 0) < occ) { await Engine.generateStok(st, 'otomatis', occ); made++; }
    }
    const pd = DB.get('pengaturan_laporan', 'pendapatan');
    if (pd && pd.aktif) {
      const occ = Engine.lastOccurrence({ ...pd, frekuensi: 'bulanan' }, now);
      if ((pd.terakhirDibuat || 0) < occ) {
        const w = U.wib(occ);
        let y = w.y, m = w.m - 1;
        if (m < 1) { m = 12; y--; }
        await Engine.generatePendapatan(y, m, pd, 'otomatis', occ);
        made++;
      }
    }
    return made;
  };

  Engine.reportCSV = rep => {
    const rows = [[rep.judul], ['Periode', rep.periode], ['Dibuat', U.fmtDateTime(rep.waktu)], []];
    (rep.ringkasan || []).forEach(r => rows.push([r.label, r.value]));
    rows.push([]);
    rows.push(rep.columns.map(c => c.label));
    rep.rows.forEach(r => rows.push(rep.columns.map(c => r[c.key])));
    return U.csv(rows);
  };

  Engine.reportHTML = rep => {
    const e = U.esc;
    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${e(rep.judul)}</title>
<style>body{font:13px/1.5 system-ui,sans-serif;margin:28px;color:#111}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 14px;color:#555}
table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #bbb;padding:5px 8px;text-align:left}th{background:#eee}
.s td:first-child{width:60%}</style></head><body>
<h1>${e(rep.judul)}</h1><p>Periode ${e(rep.periode)} · dibuat ${e(U.fmtDateTime(rep.waktu))} · Sistem Informasi MJO</p>
<table class="s">${(rep.ringkasan || []).map(r => `<tr><td>${e(r.label)}</td><td><b>${e(r.value)}</b></td></tr>`).join('')}</table>
<table><thead><tr>${rep.columns.map(c => `<th>${e(c.label)}</th>`).join('')}</tr></thead>
<tbody>${rep.rows.map(r => `<tr>${rep.columns.map(c => `<td>${e(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload=function(){window.print()}<\/script></body></html>`;
  };

  /* ---------- Data awal & contoh ---------- */
  Engine.ensureDefaults = async () => {
    const now = U.now();
    if (!DB.all('akun').length) {
      await Auth.newAccount({ id: 'akun-admin', nama: 'Administrator', username: 'admin', peran: 'admin', akunAwal: true }, 'admin123');
    }
    if (!DB.get('pengaturan_laporan', 'stok')) {
      await DB.put('pengaturan_laporan', { id: 'stok', aktif: true, frekuensi: 'mingguan', hari: 1, tanggal: 1, jam: '07:00', jenisData: 'semua', format: 'csv', terakhirDibuat: now });
    }
    if (!DB.get('pengaturan_laporan', 'pendapatan')) {
      await DB.put('pengaturan_laporan', { id: 'pendapatan', aktif: true, tanggal: 1, jam: '07:00', format: 'csv', terakhirDibuat: now });
    }
  };

  Engine.seedDemo = async () => {
    const pw = 'mjo12345';
    const mk = async (u, n, p) => { if (!DB.all('akun').some(a => a.username === u)) await Auth.newAccount({ nama: n, username: u, peran: p }, pw); };
    await mk('gudang', 'Budi (Staff Gudang)', 'gudang');
    await mk('tenant', 'Sari (Karyawan Tenant)', 'tenant');
    await mk('finance', 'Rina (Staff Finance)', 'finance');
    await mk('founder', 'Founder MJO', 'founder');
    const admin = DB.all('akun').find(a => a.peran === 'admin');
    const gud = DB.all('akun').find(a => a.username === 'gudang');
    const fin = DB.all('akun').find(a => a.username === 'finance');
    const today = U.wib(U.now());

    if (!DB.all('aturan_ai').length) {
      await DB.put('aturan_ai', { nama: 'Selisih kecil: perbaiki otomatis', isiAturan: 'Jika selisih 0–5% dari stok tercatat, anggap salah hitung dan perbaiki data stok.', satuan: 'persen', min: 0, max: 5, tindakan: 'perbaiki', aktif: true, dibuatOleh: admin.id });
      await DB.put('aturan_ai', { nama: 'Selisih besar: beri tahu Admin', isiAturan: 'Jika selisih lebih dari 5%, kirim notifikasi untuk diselidiki.', satuan: 'persen', min: 5.0001, max: '', tindakan: 'notifikasi', aktif: true, dibuatOleh: admin.id });
    }
    if (!DB.all('stok').length) {
      const items = [
        ['Wortel', 20, 'kg', 'Rak A1', 6000 * 20, null],
        ['Ayam fillet', 15, 'kg', 'Freezer 1', 45000 * 15, 12],
        ['Beras', 50, 'kg', 'Rak B2', 14000 * 50, 49],
        ['Minyak goreng', 12, 'liter', 'Rak B1', 17000 * 12, null],
        ['Telur', 30, 'pcs', 'Rak A3', 2300 * 30, null]
      ];
      for (const [nama, jumlah, satuan, lokasi, harga, nyata] of items) {
        const s = await DB.put('stok', { nama, jumlah, satuan, lokasi, tanggalMasuk: today.date, hargaBeli: harga, struk: null, verifikasi: nama === 'Beras', stokSebenarnya: nyata, dibuatOleh: gud.id });
        await Engine.checkSelisih(s);
      }
    }
    if (!DB.all('pendapatan').length) {
      const src = ['Penjualan tenant', 'Penjualan online'];
      for (let i = 9; i >= 0; i--) {
        const d = U.wib(U.now() - i * U.DAY).date;
        for (let k = 0; k < 2; k++) {
          await DB.put('pendapatan', { tanggal: d, sumber: src[k], nomorTransaksi: `TRX-${d.replace(/-/g, '')}-${k + 1}`, nominal: 350000 + Math.round(Math.random() * 600000 / 1000) * 1000, dibuatOleh: fin.id });
        }
      }
    }
    return pw;
  };

  window.ROLES = ROLES; window.PERM = PERM; window.ROLE_DESC = ROLE_DESC;
  window.Auth = Auth; window.Engine = Engine;
})();
