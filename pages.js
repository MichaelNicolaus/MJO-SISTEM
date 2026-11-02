(function () {
  const { U, DB, UI, Auth, Engine, ROLES, ROLE_DESC } = window;
  const esc = U.esc;
  const P = {};
  window.Pages = P;

  /* ---------- helper tampilan ---------- */
  const F = (label, inner, hint) => `<label class="fld"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
  const head = (title, sub, actions = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="actions">${actions}</div></div>`;
  const badge = (t, k = '') => `<span class="badge ${k}">${esc(t)}</span>`;
  const empty = m => `<div class="empty">${m}</div>`;
  const today = () => U.wib(U.now()).date;
  const nameOf = id => (DB.get('akun', id) || {}).nama || '—';

  function bindSearch(root) {
    const q = root.querySelector('#q');
    if (!q) return;
    q.oninput = () => {
      const v = q.value.toLowerCase();
      root.querySelectorAll('tbody tr[data-q]').forEach(tr => { tr.hidden = !tr.dataset.q.includes(v); });
    };
  }
  const short = v => (v >= 1e6 ? (v / 1e6).toFixed(1).replace('.0', '') + 'jt' : v >= 1e3 ? Math.round(v / 1e3) + 'rb' : String(v));

  function barChart(data) {
    const W = 560, H = 170, pad = 28, max = Math.max(1, ...data.map(d => d.value));
    const bw = (W - pad * 2) / data.length;
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Pendapatan 7 hari terakhir">` + data.map((d, i) => {
      const h = Math.round((H - pad - 26) * d.value / max);
      const x = pad + i * bw + bw * 0.18, w = bw * 0.64;
      return `<rect x="${x}" y="${H - pad - h}" width="${w}" height="${Math.max(h, 1)}" rx="3" class="bar"><title>${esc(d.label)}: ${U.rp(d.value)}</title></rect>
      <text x="${x + w / 2}" y="${H - 10}" text-anchor="middle" class="axis">${esc(d.label)}</text>
      ${d.value ? `<text x="${x + w / 2}" y="${H - pad - h - 5}" text-anchor="middle" class="val">${short(d.value)}</text>` : ''}`;
    }).join('') + '</svg>';
  }

  /* ======================== DASHBOARD ======================== */
  P.dashboard = root => {
    const u = Auth.user, role = u.peran, t = U.wib(U.now());
    const stoks = DB.all('stok');
    const selisihN = stoks.filter(s => { const d = Engine.selisih(s); return d !== null && d !== 0; }).length;
    const absToday = DB.all('absensi').filter(a => a.tanggal === t.date);
    const rev = Engine.monthRevenue(t.y, t.m), exp = Engine.monthExpense(t.y, t.m);
    const unread = Engine.unread().length;
    const C = (label, value, tone = '') => `<div class="stat ${tone}"><small>${label}</small><b>${value}</b></div>`;
    let cards = '';

    if (role === 'admin') {
      cards = C('Akun aktif', DB.all('akun').filter(a => a.status === 'aktif').length) + C('Jenis barang', stoks.length) +
        C('Barang berselisih', selisihN, selisihN ? 'warn' : '') + C('Absensi hari ini', absToday.length) +
        C('Pendapatan bulan ini', U.rp(rev)) + C('Notifikasi baru', unread, unread ? 'warn' : '');
    } else if (role === 'gudang') {
      cards = C('Jenis barang', stoks.length) + C('Barang berselisih', selisihN, selisihN ? 'warn' : '') + C('Notifikasi baru', unread, unread ? 'warn' : '');
    } else if (role === 'finance') {
      cards = C('Pendapatan bulan ini', U.rp(rev)) + C('Pengeluaran bulan ini', U.rp(exp)) + C('Laba bulan ini', U.rp(rev - exp), rev - exp < 0 ? 'bad' : 'good') +
        C('Pembelian belum diverifikasi', stoks.filter(s => !s.verifikasi).length, 'warn');
    } else if (role === 'founder') {
      cards = C('Pendapatan bulan ini', U.rp(rev)) + C('Pengeluaran bulan ini', U.rp(exp)) + C('Laba bulan ini', U.rp(rev - exp), rev - exp < 0 ? 'bad' : 'good') +
        C('Barang berselisih', selisihN, selisihN ? 'warn' : '') + C('Absensi hari ini', absToday.length);
    } else if (role === 'tenant') {
      const mine = absToday.filter(a => a.akunId === u.id);
      const st = mine.find(a => a.jenis === 'pulang') ? 'Sudah pulang' : mine.find(a => a.jenis === 'masuk') ? 'Sudah masuk' : 'Belum absen';
      cards = C('Status absensi hari ini', st, mine.length ? 'good' : 'warn');
    }

    const showChart = ['admin', 'finance', 'founder'].includes(role);
    let chart = '';
    if (showChart) {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = U.wib(U.now() - i * U.DAY).date;
        const v = DB.all('pendapatan').filter(p => p.tanggal === d).reduce((a, p) => a + Number(p.nominal), 0);
        days.push({ label: d.slice(8) + '/' + d.slice(5, 7), value: v });
      }
      chart = `<section class="card"><h2>Pendapatan 7 hari terakhir</h2>${barChart(days)}</section>`;
    }

    const notes = Engine.unread().slice(0, 4);
    const seedBox = role === 'admin' && DB.all('akun').length === 1 && !stoks.length
      ? `<section class="card notice"><h2>Data masih kosong</h2><p>Muat data contoh (akun uji, stok, pendapatan, dan aturan AI) untuk mencoba semua fitur. Password akun contoh: <code>mjo12345</code>.</p><button class="btn primary" data-act="seed">Muat data contoh</button></section>` : '';
    const warn = u.akunAwal ? `<section class="card notice warnbox"><h2>Ganti password awal</h2><p>Anda masih memakai akun awal. Buka menu Akun, ubah password <b>admin</b>, atau buat Admin baru.</p><a class="btn" href="#/akun">Buka menu Akun</a></section>` : '';

    root.innerHTML = head(`Halo, ${esc(u.nama)}`, `${ROLES[role]} · ${U.fmtDate(t.date)}`) +
      warn + seedBox + `<div class="stats">${cards}</div>` + chart +
      `<section class="card"><h2>Notifikasi terbaru</h2>${notes.length ? `<ul class="list">${notes.map(n => `<li><b>${esc(n.judul)}</b><span>${esc(n.pesan)}</span><small>${U.fmtDateTime(n.waktu)}</small></li>`).join('')}</ul>` : empty('Tidak ada notifikasi baru.')}</section>`;

    root.onclick = async e => {
      const b = e.target.closest('[data-act="seed"]');
      if (!b) return;
      b.disabled = true;
      await Engine.seedDemo();
      UI.toast('Data contoh dimuat. Login contoh: gudang, tenant, finance, founder (password mjo12345).');
      P.dashboard(root);
    };
  };

  /* ======================== STOK ======================== */
  P.stok = root => {
    const canW = Auth.can('stok', 'write'), canV = Auth.can('stok', 'verify');
    const rows = DB.all('stok').sort((a, b) => a.nama.localeCompare(b.nama)).map(s => {
      const d = Engine.selisih(s);
      return `<tr data-id="${s.id}" data-q="${esc((s.nama + ' ' + s.lokasi).toLowerCase())}">
        <td><b>${esc(s.nama)}</b>${s.catatan ? `<small class="block muted">${esc(s.catatan)}</small>` : ''}</td>
        <td class="num">${U.num(s.jumlah)} ${esc(s.satuan)}</td>
        <td class="num">${s.stokSebenarnya == null ? '—' : U.num(s.stokSebenarnya)}${d ? ` ${badge((d > 0 ? '+' : '') + U.num(d), d < 0 ? 'bad' : 'warn')}` : ''}</td>
        <td>${esc(s.lokasi)}</td><td>${U.fmtDate(s.tanggalMasuk)}</td>
        <td class="num">${U.rp(s.hargaBeli)}</td>
        <td>${s.struk ? `<button class="link" data-act="struk">Lihat</button>` : '—'}</td>
        <td>${s.verifikasi ? badge('Terverifikasi', 'good') : canV ? `<button class="btn sm" data-act="verif">Verifikasi</button>` : badge('Belum', 'muted')}</td>
        <td class="row-actions">${canW ? `<button class="btn sm" data-act="edit">Update</button><button class="btn sm danger" data-act="del">Hapus</button>` : ''}</td>
      </tr>`;
    }).join('');

    root.innerHTML = head('Stok barang', 'Catatan stok terpusat beserta struk pembelian dan hasil hitung fisik.',
      canW ? '<button class="btn primary" data-act="add">+ Input stok</button>' : '') +
      `<div class="toolbar"><input type="search" id="q" placeholder="Cari barang atau lokasi…" aria-label="Cari"></div>
      <div class="card flush table-wrap">${rows ? `<table class="tbl"><thead><tr><th>Barang</th><th class="num">Tercatat</th><th class="num">Sebenarnya</th><th>Lokasi</th><th>Tgl masuk</th><th class="num">Biaya beli</th><th>Struk</th><th>Verifikasi</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : empty('Belum ada data stok.')}</div>`;
    bindSearch(root);

    const refresh = () => P.stok(root);
    root.onclick = async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = b.closest('tr') && b.closest('tr').dataset.id;
      const s = id && DB.get('stok', id);
      const act = b.dataset.act;
      if (act === 'add') stokDialog(null, refresh);
      else if (act === 'edit') stokDialog(s, refresh);
      else if (act === 'struk') UI.image(s.struk, 'Struk pembelian: ' + s.nama);
      else if (act === 'verif') {
        if (await UI.confirm(`Tandai pembelian "${s.nama}" (${U.rp(s.hargaBeli)}) sebagai terverifikasi? Pastikan nominal sama dengan struk.`)) {
          await DB.put('stok', { ...s, verifikasi: true, diverifikasiOleh: Auth.user.id });
          UI.toast('Pembelian terverifikasi.');
          refresh();
        }
      } else if (act === 'del') {
        if (await UI.confirm(`Hapus data stok "${s.nama}"? Tindakan ini tidak dapat dibatalkan.`, { ok: 'Hapus', danger: true })) {
          await DB.del('stok', s.id);
          UI.toast('Data stok dihapus.');
          refresh();
        }
      }
    };
  };

  function stokDialog(s, done) {
    const isNew = !s;
    UI.dialog({
      title: isNew ? 'Input stok baru' : 'Update stok: ' + s.nama,
      body: `<div class="grid2">
        ${F('Nama barang', `<input name="nama" required maxlength="80" value="${esc(s && s.nama)}">`)}
        ${F('Satuan', `<input name="satuan" required maxlength="12" list="satuan-list" value="${esc((s && s.satuan) || 'kg')}"><datalist id="satuan-list"><option>kg<option>gram<option>liter<option>pcs<option>pack<option>ikat</datalist>`)}
        ${F('Jumlah tercatat', `<input name="jumlah" type="number" step="any" min="0" required value="${s ? s.jumlah : ''}">`)}
        ${F('Lokasi penyimpanan', `<input name="lokasi" required maxlength="60" value="${esc(s && s.lokasi)}" placeholder="mis. Rak A1">`)}
        ${F('Tanggal masuk', `<input name="tanggalMasuk" type="date" required value="${(s && s.tanggalMasuk) || today()}">`)}
        ${F('Biaya pembelian (Rp)', `<input name="hargaBeli" type="number" min="0" step="1" required value="${s ? s.hargaBeli : ''}">`, 'Total nominal sesuai struk. Mengubahnya akan mereset verifikasi.')}
      </div>
      ${F('Struk pembelian (foto)', `<input name="struk" type="file" accept="image/*" ${isNew ? 'required' : ''}>`, isNew ? 'Wajib dilampirkan.' : 'Kosongkan jika tidak ingin mengganti struk.')}
      ${isNew ? '' : F('Stok sebenarnya (hasil hitung fisik)', `<input name="sebenarnya" type="number" step="any" min="0" value="${s.stokSebenarnya == null ? '' : s.stokSebenarnya}">`, 'Jika diisi dan berbeda dari stok tercatat, AI selisih stok akan memeriksanya sesuai aturan Admin.')}`,
      onSubmit: async form => {
        const fd = new FormData(form);
        const file = form.struk.files[0];
        let struk = s ? s.struk || null : null;
        if (file) struk = await U.imageToDataURL(file, 900, 0.7);
        if (isNew && !struk) throw new Error('Struk pembelian wajib dilampirkan.');
        const harga = Number(fd.get('hargaBeli'));
        const sebRaw = isNew ? '' : form.sebenarnya.value;
        const rec = {
          ...(s || {}),
          nama: fd.get('nama').trim(), satuan: fd.get('satuan').trim(), jumlah: Number(fd.get('jumlah')),
          lokasi: fd.get('lokasi').trim(), tanggalMasuk: fd.get('tanggalMasuk'), hargaBeli: harga, struk,
          stokSebenarnya: sebRaw === '' ? null : Number(sebRaw),
          verifikasi: s && s.hargaBeli === harga && !file ? !!s.verifikasi : false,
          dibuatOleh: (s && s.dibuatOleh) || Auth.user.id, diubahOleh: Auth.user.id, catatan: ''
        };
        const saved = await DB.put('stok', rec);
        const res = await Engine.checkSelisih(saved);
        UI.toast(res.length ? 'Stok disimpan. AI selisih stok memproses ' + res.length + ' aturan.' : 'Stok disimpan.');
        done();
      }
    });
  }

  /* ======================== ABSENSI ======================== */
  P.absensi = root => {
    const u = Auth.user, isTenant = u.peran === 'tenant', canEdit = Auth.can('absensi', 'edit');
    const w = U.wib(U.now());
    let list = DB.all('absensi');
    if (isTenant) list = list.filter(a => a.akunId === u.id);
    list.sort((a, b) => (b.tanggal + b.jam).localeCompare(a.tanggal + a.jam));

    let panel = '';
    if (isTenant) {
      const mine = list.filter(a => a.tanggal === w.date);
      const masuk = mine.find(a => a.jenis === 'masuk'), pulang = mine.find(a => a.jenis === 'pulang');
      panel = `<section class="card absen-panel">
        <div><small class="muted">Absensi hari ini · ${U.fmtDate(w.date)}</small>
        <p class="big-status">${pulang ? 'Sudah absen pulang' : masuk ? 'Sudah absen masuk' : 'Belum absen'}</p>
        <p class="muted small">${masuk ? 'Masuk ' + masuk.jam : ''}${pulang ? ' · Pulang ' + pulang.jam : ''}</p></div>
        <div class="row">
          <button class="btn primary" data-act="masuk" ${masuk ? 'disabled' : ''}>Absen masuk</button>
          <button class="btn" data-act="pulang" ${!masuk || pulang ? 'disabled' : ''}>Absen pulang</button>
        </div></section>`;
    }

    const dates = [...new Set(list.map(a => a.tanggal))];
    const filterBar = !isTenant ? `<div class="toolbar"><input type="search" id="q" placeholder="Cari nama karyawan atau tanggal…"></div>` : '';
    const rows = list.map(a => `<tr data-id="${a.id}" data-q="${esc((a.nama + ' ' + a.tanggal + ' ' + a.jenis).toLowerCase())}">
      <td>${a.foto ? `<img class="thumb" src="${a.foto}" alt="Foto ${esc(a.nama)}" data-act="foto">` : '—'}</td>
      <td><b>${esc(a.nama)}</b></td><td>${badge(a.jenis === 'masuk' ? 'Masuk' : 'Pulang', a.jenis === 'masuk' ? 'good' : '')}</td>
      <td>${U.fmtDate(a.tanggal)}</td><td class="num">${esc(a.jam)}</td>
      <td>${a.sumberWaktu === 'server' ? badge('Waktu server', 'good') : badge('Waktu perangkat', 'warn')}${a.dikoreksi ? ' ' + badge('Dikoreksi', 'warn') : ''}</td>
      <td class="row-actions">${a.dikoreksi ? `<button class="btn sm" data-act="riwayat">Riwayat</button>` : ''}${canEdit ? `<button class="btn sm" data-act="koreksi">Koreksi</button>` : ''}</td></tr>`).join('');

    root.innerHTML = head('Absensi', isTenant ? 'Absen dengan foto selfie langsung dari kamera. Waktu dicatat saat foto dikirim.' : 'Data absensi karyawan tenant.') + panel + filterBar +
      `<div class="card flush table-wrap">${rows ? `<table class="tbl"><thead><tr><th>Foto</th><th>Nama</th><th>Jenis</th><th>Tanggal</th><th>Jam</th><th>Sumber waktu</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : empty('Belum ada data absensi.')}</div>`;
    bindSearch(root);

    root.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const act = b.dataset.act, id = b.closest('tr') && b.closest('tr').dataset.id;
      const a = id && DB.get('absensi', id);
      if (act === 'masuk' || act === 'pulang') selfieDialog(act, () => P.absensi(root));
      else if (act === 'foto') UI.image(a.foto, `Foto ${a.nama}, ${U.fmtDate(a.tanggal)} ${a.jam}`);
      else if (act === 'koreksi') koreksiDialog(a, () => P.absensi(root));
      else if (act === 'riwayat') riwayatDialog(a);
    };
  };

  function selfieDialog(jenis, done) {
    const u = Auth.user;
    let stream = null, shot = null;
    UI.dialog({
      title: 'Absen ' + jenis, hideSubmit: true, cancel: 'Tutup',
      body: `<div class="cam"><video id="cv" autoplay playsinline muted></video><img id="cimg" class="hidden" alt="Hasil foto selfie"></div>
        <p class="muted small" id="cmsg">Mengaktifkan kamera… izinkan akses kamera pada browser.</p>
        <div class="row center"><button type="button" class="btn primary" id="snap" disabled>Ambil foto</button>
        <button type="button" class="btn hidden" id="retake">Ulangi</button>
        <button type="button" class="btn primary hidden" id="send">Kirim absensi</button></div>`,
      onMount: async (dlg, form, close) => {
        const $ = id => dlg.querySelector(id);
        const v = $('#cv'), img = $('#cimg'), msg = $('#cmsg'), snap = $('#snap'), retake = $('#retake'), send = $('#send');
        dlg.addEventListener('close', () => { if (stream) stream.getTracks().forEach(t => t.stop()); });
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Browser tidak mendukung kamera atau halaman tidak memakai HTTPS.');
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
          v.srcObject = stream;
          await v.play().catch(() => {});
          msg.textContent = 'Posisikan wajah di dalam bingkai, lalu ambil foto.';
          snap.disabled = false;
        } catch (err) {
          msg.textContent = 'Kamera tidak dapat dipakai: ' + (err.message || err.name) + '. Absensi hanya dapat dilakukan lewat kamera langsung.';
          msg.classList.add('err');
          return;
        }
        snap.onclick = () => {
          const c = document.createElement('canvas');
          const sc = Math.min(1, 480 / (v.videoWidth || 480));
          c.width = Math.round((v.videoWidth || 480) * sc); c.height = Math.round((v.videoHeight || 360) * sc);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          shot = c.toDataURL('image/jpeg', 0.65);
          img.src = shot; img.classList.remove('hidden'); v.classList.add('hidden');
          snap.classList.add('hidden'); retake.classList.remove('hidden'); send.classList.remove('hidden');
          msg.textContent = 'Periksa foto. Waktu dicatat saat Anda menekan "Kirim absensi".';
        };
        retake.onclick = () => {
          shot = null; img.classList.add('hidden'); v.classList.remove('hidden');
          snap.classList.remove('hidden'); retake.classList.add('hidden'); send.classList.add('hidden');
        };
        send.onclick = async () => {
          send.disabled = true;
          try {
            await U.syncClock();
            const now = U.now(), t = U.wib(now);
            const dup = DB.all('absensi').some(a => a.akunId === u.id && a.tanggal === t.date && a.jenis === jenis);
            if (dup) throw new Error('Anda sudah absen ' + jenis + ' hari ini.');
            if (jenis === 'pulang' && !DB.all('absensi').some(a => a.akunId === u.id && a.tanggal === t.date && a.jenis === 'masuk')) throw new Error('Absen masuk dulu sebelum absen pulang.');
            await DB.put('absensi', { akunId: u.id, nama: u.nama, jenis, foto: shot, tanggal: t.date, jam: t.time, sumberWaktu: U.clockSource, createdAt: now });
            UI.toast(`Absen ${jenis} tercatat pukul ${t.time} WIB.`);
            close(); done();
          } catch (err) { UI.toast(err.message, 'err'); send.disabled = false; }
        };
      }
    });
  }

  function koreksiDialog(a, done) {
    UI.dialog({
      title: `Koreksi absensi: ${a.nama}`,
      body: `<div class="grid2">
        ${F('Tanggal', `<input name="tanggal" type="date" required value="${a.tanggal}">`)}
        ${F('Jam', `<input name="jam" type="time" step="1" required value="${a.jam}">`)}
        ${F('Jenis', `<select name="jenis"><option value="masuk" ${a.jenis === 'masuk' ? 'selected' : ''}>Masuk</option><option value="pulang" ${a.jenis === 'pulang' ? 'selected' : ''}>Pulang</option></select>`)}
      </div>${F('Alasan koreksi', `<textarea name="alasan" required rows="3" maxlength="300" placeholder="mis. Jam salah karena sinyal lambat"></textarea>`, 'Perubahan dan alasan disimpan sebagai riwayat.')}`,
      onSubmit: async form => {
        const fd = new FormData(form);
        const baru = { tanggal: fd.get('tanggal'), jam: U.normTime(fd.get('jam')), jenis: fd.get('jenis') };
        const lama = { tanggal: a.tanggal, jam: a.jam, jenis: a.jenis };
        if (JSON.stringify(baru) === JSON.stringify(lama)) throw new Error('Tidak ada perubahan.');
        await DB.put('riwayat_absensi', { absensiId: a.id, akunNama: a.nama, lama, baru, alasan: fd.get('alasan').trim(), diubahOleh: Auth.user.id, diubahNama: Auth.user.nama, waktu: U.now() });
        await DB.put('absensi', { ...a, ...baru, dikoreksi: true });
        UI.toast('Absensi dikoreksi dan riwayat tersimpan.');
        done();
      }
    });
  }

  function riwayatDialog(a) {
    const h = DB.all('riwayat_absensi').filter(r => r.absensiId === a.id).sort((x, y) => y.waktu - x.waktu);
    UI.dialog({
      title: `Riwayat perubahan: ${a.nama}`, wide: true, hideSubmit: true, cancel: 'Tutup',
      body: h.length ? `<table class="tbl"><thead><tr><th>Waktu</th><th>Oleh</th><th>Sebelum</th><th>Sesudah</th><th>Alasan</th></tr></thead><tbody>${h.map(r => `<tr><td>${U.fmtDateTime(r.waktu)}</td><td>${esc(r.diubahNama)}</td><td>${r.lama.jenis} · ${U.fmtDate(r.lama.tanggal)} ${r.lama.jam}</td><td>${r.baru.jenis} · ${U.fmtDate(r.baru.tanggal)} ${r.baru.jam}</td><td>${esc(r.alasan)}</td></tr>`).join('')}</tbody></table>` : empty('Belum ada riwayat.')
    });
  }

  /* ======================== PENDAPATAN ======================== */
  P.pendapatan = root => {
    const canW = Auth.can('pendapatan', 'write');
    const t = U.wib(U.now());
    const state = P.pendapatan.state || (P.pendapatan.state = { bulan: `${t.y}-${U.pad(t.m)}` });
    const all = DB.all('pendapatan').filter(p => p.tanggal.startsWith(state.bulan)).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.createdAt - a.createdAt);
    const total = all.reduce((a, p) => a + Number(p.nominal), 0);
    const rows = all.map(p => `<tr data-id="${p.id}" data-q="${esc((p.sumber + ' ' + p.nomorTransaksi).toLowerCase())}">
      <td>${U.fmtDate(p.tanggal)}</td><td>${esc(p.sumber)}</td><td><code>${esc(p.nomorTransaksi)}</code></td>
      <td class="num">${U.rp(p.nominal)}</td><td>${esc(nameOf(p.dibuatOleh))}</td>
      <td class="row-actions">${canW ? '<button class="btn sm" data-act="edit">Update</button>' : ''}</td></tr>`).join('');

    root.innerHTML = head('Pendapatan', 'Catatan pendapatan per transaksi.', canW ? '<button class="btn primary" data-act="add">+ Input pendapatan</button>' : '') +
      `<div class="toolbar"><label class="inline">Bulan <input type="month" id="bulan" value="${state.bulan}"></label><input type="search" id="q" placeholder="Cari sumber atau nomor transaksi…"><div class="grow"></div><div class="sum">Total bulan ini <b>${U.rp(total)}</b></div></div>
      <div class="card flush table-wrap">${rows ? `<table class="tbl"><thead><tr><th>Tanggal</th><th>Sumber</th><th>No. transaksi</th><th class="num">Nominal</th><th>Dicatat oleh</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : empty('Belum ada pendapatan pada bulan ini.')}</div>`;
    bindSearch(root);
    root.querySelector('#bulan').onchange = e => { state.bulan = e.target.value || state.bulan; P.pendapatan(root); };
    root.onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const p = b.closest('tr') && DB.get('pendapatan', b.closest('tr').dataset.id);
      pendapatanDialog(b.dataset.act === 'edit' ? p : null, () => P.pendapatan(root));
    };
  };

  function pendapatanDialog(p, done) {
    const sumber = [...new Set(['Penjualan tenant', 'Penjualan online', 'Lainnya', ...DB.all('pendapatan').map(x => x.sumber)])];
    UI.dialog({
      title: p ? 'Update pendapatan' : 'Input pendapatan',
      body: `<div class="grid2">
        ${F('Tanggal', `<input name="tanggal" type="date" required value="${(p && p.tanggal) || today()}">`)}
        ${F('Sumber pendapatan', `<input name="sumber" required maxlength="60" list="sumber-list" value="${esc(p && p.sumber)}"><datalist id="sumber-list">${sumber.map(s => `<option>${esc(s)}`).join('')}</datalist>`)}
        ${F('Nomor transaksi', `<input name="nomor" required maxlength="40" value="${esc(p && p.nomorTransaksi)}">`, 'Harus unik.')}
        ${F('Nominal (Rp)', `<input name="nominal" type="number" min="0" step="1" required value="${p ? p.nominal : ''}">`)}
      </div>`,
      onSubmit: async form => {
        const fd = new FormData(form), nomor = fd.get('nomor').trim();
        if (DB.all('pendapatan').some(x => x.nomorTransaksi.toLowerCase() === nomor.toLowerCase() && (!p || x.id !== p.id))) throw new Error('Nomor transaksi sudah dipakai.');
        await DB.put('pendapatan', { ...(p || {}), tanggal: fd.get('tanggal'), sumber: fd.get('sumber').trim(), nomorTransaksi: nomor, nominal: Number(fd.get('nominal')), dibuatOleh: (p && p.dibuatOleh) || Auth.user.id, diubahOleh: Auth.user.id });
        UI.toast('Pendapatan disimpan.');
        done();
      }
    });
  }

  /* ======================== AKUN ======================== */
  P.akun = root => {
    const me = Auth.user;
    const rows = DB.all('akun').sort((a, b) => a.nama.localeCompare(b.nama)).map(a => `<tr data-id="${a.id}">
      <td><b>${esc(a.nama)}</b></td><td><code>${esc(a.username)}</code></td><td>${esc(ROLES[a.peran])}</td>
      <td>${a.status === 'aktif' ? badge('Aktif', 'good') : badge('Nonaktif', 'muted')}</td><td>${U.fmtDate(U.wib(a.createdAt).date)}</td>
      <td class="row-actions"><button class="btn sm" data-act="edit">Update</button></td></tr>`).join('');
    const perm = Object.keys(ROLES).map(r => `<tr><td><b>${ROLES[r]}</b></td><td>${esc(ROLE_DESC[r])}</td></tr>`).join('');

    root.innerHTML = head('Akun & hak akses', 'Buat akun, tetapkan peran, ubah status atau password.', '<button class="btn primary" data-act="add">+ Register akun</button>') +
      `<div class="card flush table-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Status</th><th>Dibuat</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <section class="card"><h2>Hak akses per peran</h2><table class="tbl plain"><tbody>${perm}</tbody></table></section>
      <section class="card"><h2>Cadangan data</h2>
        <p class="muted">${DB.remote ? 'Mode database bersama aktif: data tersimpan di Supabase. Unduh cadangan berikut untuk arsip.' : 'Mode lokal: data hanya ada di browser ini. Unduh cadangan secara berkala.'}</p>
        <div class="row"><button class="btn" data-act="backup">Unduh cadangan (JSON)</button>${DB.remote ? '' : '<label class="btn">Pulihkan dari file<input type="file" accept="application/json" id="restore" hidden></label>'}</div>
      </section>`;

    root.onclick = async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'backup') {
        U.download(`cadangan-mjo-${today()}.json`, JSON.stringify(DB.exportAll()), 'application/json');
      } else {
        const a = b.closest('tr') && DB.get('akun', b.closest('tr').dataset.id);
        akunDialog(act === 'edit' ? a : null, () => { Auth.refresh(); P.akun(root); });
      }
    };
    const rs = root.querySelector('#restore');
    if (rs) rs.onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        if (!obj.akun || !obj.akun.length) throw new Error('Berkas cadangan tidak valid.');
        if (!await UI.confirm('Pulihkan data dari cadangan? Seluruh data saat ini akan diganti.', { ok: 'Pulihkan', danger: true })) return;
        await DB.importAll(obj);
        Auth.logout();
        location.reload();
      } catch (err) { UI.toast(err.message, 'err'); }
    };
  };

  function akunDialog(a, done) {
    const isNew = !a, self = a && a.id === Auth.user.id;
    UI.dialog({
      title: isNew ? 'Register akun baru' : 'Update akun: ' + a.nama,
      body: `<div class="grid2">
        ${F('Nama lengkap', `<input name="nama" required maxlength="60" value="${esc(a && a.nama)}">`)}
        ${F('Username', `<input name="username" required pattern="[A-Za-z0-9._\\-]{3,20}" ${isNew ? '' : 'readonly'} value="${esc(a && a.username)}">`, isNew ? '3–20 karakter: huruf, angka, titik, strip.' : 'Username tidak dapat diubah.')}
        ${F('Peran (hak akses)', `<select name="peran" ${self ? 'disabled' : ''}>${Object.keys(ROLES).map(r => `<option value="${r}" ${a && a.peran === r ? 'selected' : ''}>${ROLES[r]}</option>`).join('')}</select>`, self ? 'Peran akun sendiri tidak dapat diubah.' : '')}
        ${F('Status akun', `<select name="status" ${self ? 'disabled' : ''}><option value="aktif" ${!a || a.status === 'aktif' ? 'selected' : ''}>Aktif</option><option value="nonaktif" ${a && a.status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option></select>`, self ? 'Akun sendiri tidak dapat dinonaktifkan.' : 'Akun nonaktif tidak dapat masuk.')}
      </div>
      ${F(isNew ? 'Password' : 'Password baru', `<input name="password" type="password" minlength="8" autocomplete="new-password" ${isNew ? 'required' : ''}>`, isNew ? 'Minimal 8 karakter.' : 'Kosongkan jika tidak diubah. Minimal 8 karakter.')}`,
      onSubmit: async form => {
        const fd = new FormData(form);
        const peran = self ? a.peran : fd.get('peran'), status = self ? a.status : fd.get('status');
        const username = (isNew ? fd.get('username') : a.username).trim();
        if (isNew && DB.all('akun').some(x => x.username.toLowerCase() === username.toLowerCase())) throw new Error('Username sudah dipakai.');
        const admins = DB.all('akun').filter(x => x.peran === 'admin' && x.status === 'aktif' && (!a || x.id !== a.id));
        if (!isNew && a.peran === 'admin' && (peran !== 'admin' || status !== 'aktif') && !admins.length) throw new Error('Harus ada minimal satu Admin aktif.');
        const pw = fd.get('password');
        if (isNew) {
          await Auth.newAccount({ nama: fd.get('nama').trim(), username, peran, status }, pw);
        } else {
          const rec = { ...a, nama: fd.get('nama').trim(), peran, status };
          if (pw) { rec.salt = U.uid('s'); rec.passHash = await Auth.hash(pw, rec.salt); rec.akunAwal = false; }
          await DB.put('akun', rec);
        }
        UI.toast('Akun disimpan.');
        done();
      }
    });
  }

  /* ======================== LAPORAN ======================== */
  P.laporan = root => {
    const admin = Auth.can('laporan', 'setting');
    const st = DB.get('pengaturan_laporan', 'stok') || {}, pd = DB.get('pengaturan_laporan', 'pendapatan') || {};
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const opt = (arr, sel) => arr.map(([v, l]) => `<option value="${v}" ${String(sel) === String(v) ? 'selected' : ''}>${l}</option>`).join('');
    const tglOpt = Array.from({ length: 28 }, (_, i) => [i + 1, 'Tanggal ' + (i + 1)]);

    const settings = admin ? `<div class="grid2 cards">
      <form class="card" id="fStok"><h2>Laporan stok otomatis</h2>
        <label class="check"><input type="checkbox" name="aktif" ${st.aktif ? 'checked' : ''}> Aktifkan</label>
        <div class="grid2">
          ${F('Jadwal', `<select name="frekuensi" id="frek">${opt([['harian', 'Setiap hari'], ['mingguan', 'Setiap minggu'], ['bulanan', 'Setiap bulan']], st.frekuensi)}</select>`)}
          ${F('Jam (WIB)', `<input type="time" name="jam" required value="${st.jam || '07:00'}">`)}
          <div id="wrapHari">${F('Hari', `<select name="hari">${opt(hari.map((h, i) => [i, h]), st.hari ?? 1)}</select>`)}</div>
          <div id="wrapTgl">${F('Tanggal', `<select name="tanggal">${opt(tglOpt, st.tanggal || 1)}</select>`)}</div>
          ${F('Jenis data stok', `<select name="jenisData">${opt([['semua', 'Semua stok'], ['selisih', 'Hanya barang berselisih'], ['belum_verifikasi', 'Belum diverifikasi']], st.jenisData)}</select>`)}
          ${F('Format', `<select name="format">${opt([['csv', 'CSV (Excel)'], ['pdf', 'PDF (cetak)']], st.format)}</select>`)}
        </div>
        <div class="row"><button class="btn primary" type="submit">Simpan pengaturan</button><button class="btn" type="button" data-act="now-stok">Buat sekarang</button></div>
      </form>
      <form class="card" id="fPend"><h2>Laporan laba bulanan otomatis</h2>
        <label class="check"><input type="checkbox" name="aktif" ${pd.aktif ? 'checked' : ''}> Aktifkan</label>
        <div class="grid2">
          ${F('Dibuat pada', `<select name="tanggal">${opt(tglOpt, pd.tanggal || 1)}</select>`, 'Memuat bulan sebelumnya.')}
          ${F('Jam (WIB)', `<input type="time" name="jam" required value="${pd.jam || '07:00'}">`)}
          ${F('Format', `<select name="format">${opt([['csv', 'CSV (Excel)'], ['pdf', 'PDF (cetak)']], pd.format)}</select>`)}
        </div>
        <div class="row"><button class="btn primary" type="submit">Simpan pengaturan</button><button class="btn" type="button" data-act="now-pend">Buat laporan bulan lalu</button></div>
      </form></div>
      <p class="muted small note">Laporan dibuat otomatis saat sistem dibuka setelah jadwal terlewat (tanpa server latar belakang). Laporan yang terlewat dibuat sekali, tidak berulang.</p>` : '';

    const reps = DB.all('laporan').sort((a, b) => b.waktu - a.waktu);
    const rows = reps.map(r => `<tr data-id="${r.id}"><td><b>${esc(r.judul)}</b></td><td>${esc(r.periode)}</td><td>${U.fmtDateTime(r.waktu)}</td><td>${badge(r.trigger === 'otomatis' ? 'Otomatis' : 'Manual', r.trigger === 'otomatis' ? 'good' : '')}</td><td class="row-actions"><button class="btn sm" data-act="lihat">Lihat</button></td></tr>`).join('');
    root.innerHTML = head('Laporan', 'Arsip laporan stok dan laba bulanan.') + settings +
      `<section class="card flush table-wrap"><div class="card-pad"><h2>Arsip laporan</h2></div>${rows ? `<table class="tbl"><thead><tr><th>Laporan</th><th>Periode</th><th>Dibuat</th><th>Pembuatan</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : empty('Belum ada laporan.')}</section>`;

    const sync = () => {
      const f = root.querySelector('#frek');
      if (!f) return;
      root.querySelector('#wrapHari').style.display = f.value === 'mingguan' ? '' : 'none';
      root.querySelector('#wrapTgl').style.display = f.value === 'bulanan' ? '' : 'none';
    };
    const frek = root.querySelector('#frek');
    if (frek) { frek.onchange = sync; sync(); }

    const save = (id, extra) => async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const cur = DB.get('pengaturan_laporan', id) || { id };
      const rec = { ...cur, aktif: fd.get('aktif') === 'on', jam: fd.get('jam'), format: fd.get('format'), tanggal: Number(fd.get('tanggal') || 1), ...extra(fd) };
      if (!cur.aktif && rec.aktif) rec.terakhirDibuat = U.now();
      await DB.put('pengaturan_laporan', rec);
      UI.toast('Pengaturan laporan disimpan.');
    };
    const fS = root.querySelector('#fStok'), fP = root.querySelector('#fPend');
    if (fS) fS.onsubmit = save('stok', fd => ({ frekuensi: fd.get('frekuensi'), hari: Number(fd.get('hari')), jenisData: fd.get('jenisData') }));
    if (fP) fP.onsubmit = save('pendapatan', () => ({}));

    root.onclick = async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'now-stok') {
        const set = { ...(DB.get('pengaturan_laporan', 'stok') || {}), jenisData: fS.jenisData.value, format: fS.format.value };
        await Engine.generateStok(set, 'manual');
        UI.toast('Laporan stok dibuat.'); P.laporan(root);
      } else if (act === 'now-pend') {
        const t = U.wib(U.now());
        let y = t.y, m = t.m - 1;
        if (m < 1) { m = 12; y--; }
        await Engine.generatePendapatan(y, m, { format: fP.format.value }, 'manual');
        UI.toast(`Laporan ${U.monthName(m)} ${y} dibuat.`); P.laporan(root);
      } else if (act === 'lihat') {
        reportDialog(DB.get('laporan', b.closest('tr').dataset.id));
      }
    };
  };

  function reportDialog(r) {
    const dlg = UI.dialog({
      title: r.judul, wide: true, hideSubmit: true, cancel: 'Tutup',
      body: `<p class="muted">Periode ${esc(r.periode)} · dibuat ${U.fmtDateTime(r.waktu)} · ${r.trigger === 'otomatis' ? 'otomatis' : 'manual'}</p>
        <div class="stats mini">${(r.ringkasan || []).map(s => `<div class="stat"><small>${esc(s.label)}</small><b>${esc(s.value)}</b></div>`).join('')}</div>
        <div class="table-wrap">${r.rows.length ? `<table class="tbl"><thead><tr>${r.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${r.rows.map(row => `<tr>${r.columns.map(c => `<td>${esc(typeof row[c.key] === 'number' && /rp|nominal|harga/i.test(c.key + c.label) ? U.num(row[c.key]) : row[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>` : empty('Tidak ada baris data.')}</div>
        <div class="row"><button type="button" class="btn ${r.format !== 'pdf' ? 'primary' : ''}" data-dl="csv">Unduh CSV</button><button type="button" class="btn ${r.format === 'pdf' ? 'primary' : ''}" data-dl="pdf">Cetak / simpan PDF</button></div>`
    });
    dlg.querySelector('[data-dl=csv]').onclick = () => U.download(`${r.id}.csv`, Engine.reportCSV(r));
    dlg.querySelector('[data-dl=pdf]').onclick = () => {
      const w = window.open('', '_blank');
      if (!w) return UI.toast('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.', 'err');
      w.document.write(Engine.reportHTML(r)); w.document.close();
    };
  }

  /* ======================== AI SELISIH STOK ======================== */
  P.selisih = root => {
    const admin = Auth.can('selisih', 'rules');
    const ACT = { notifikasi: 'Kirim notifikasi', laporan: 'Buat laporan', perbaiki: 'Perbaiki data stok' };
    const rules = DB.all('aturan_ai').sort((a, b) => a.createdAt - b.createdAt);
    const range = r => { const u = r.satuan === 'persen' ? '%' : ' unit'; return `${U.num(r.min || 0)}${u} – ${r.max === '' || r.max == null ? '∞' : U.num(r.max) + u}`; };
    const ruleRows = rules.map(r => `<tr data-id="${r.id}"><td><b>${esc(r.nama)}</b><small class="block muted">${esc(r.isiAturan)}</small></td><td>${range(r)}</td><td>${ACT[r.tindakan]}</td><td>${r.aktif ? badge('Aktif', 'good') : badge('Nonaktif', 'muted')}</td><td class="row-actions"><button class="btn sm" data-act="edit">Ubah</button></td></tr>`).join('');
    const res = DB.all('selisih_stok').sort((a, b) => b.waktu - a.waktu);
    const resRows = res.map(r => `<tr><td>${U.fmtDateTime(r.waktu)}</td><td><b>${esc(r.stokNama)}</b></td><td class="num">${U.num(r.stokTercatat)}</td><td class="num">${U.num(r.stokSebenarnya)}</td><td class="num">${badge((r.selisih > 0 ? '+' : '') + U.num(r.selisih) + ' ' + r.satuan, r.selisih < 0 ? 'bad' : 'warn')}</td><td>${esc(r.aturanNama)}</td><td>${esc(r.tindakan)}<small class="block muted">${esc(r.hasil)}</small></td></tr>`).join('');

    root.innerHTML = head('AI selisih stok', 'Membandingkan stok tercatat dengan stok sebenarnya, lalu bertindak sesuai aturan Admin.',
      admin ? '<button class="btn" data-act="check">Periksa semua stok</button><button class="btn primary" data-act="add">+ Aturan baru</button>' : '') +
      (admin ? `<section class="card flush table-wrap"><div class="card-pad"><h2>Aturan</h2><p class="muted small">Mesin berjalan berbasis aturan di browser, tanpa API AI eksternal dan tanpa kunci rahasia. Teks aturan disimpan sebagai dokumentasi dan dapat dihubungkan ke model bahasa lewat backend di kemudian hari.</p></div>${rows(ruleRows, 'Belum ada aturan.', '<th>Aturan</th><th>Berlaku untuk selisih</th><th>Tindakan</th><th>Status</th><th></th>')}</section>` : '') +
      `<section class="card flush table-wrap"><div class="card-pad"><h2>Hasil pemeriksaan</h2><p class="muted small">Staff Gudang mengisi "stok sebenarnya" pada menu Stok; pemeriksaan berjalan otomatis saat disimpan.</p></div>${rows(resRows, 'Belum ada selisih terdeteksi.', '<th>Waktu</th><th>Barang</th><th class="num">Tercatat</th><th class="num">Sebenarnya</th><th class="num">Selisih</th><th>Aturan</th><th>Tindakan</th>')}</section>`;

    function rows(body, emptyMsg, headCols) { return body ? `<table class="tbl"><thead><tr>${headCols}</tr></thead><tbody>${body}</tbody></table>` : empty(emptyMsg); }

    root.onclick = async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'check') {
        const n = await Engine.checkAll();
        UI.toast(n ? `${n} tindakan baru dijalankan.` : 'Tidak ada selisih baru.'); P.selisih(root);
      } else {
        aturanDialog(b.dataset.act === 'edit' ? DB.get('aturan_ai', b.closest('tr').dataset.id) : null, () => P.selisih(root));
      }
    };
  };

  function aturanDialog(r, done) {
    UI.dialog({
      title: r ? 'Ubah aturan' : 'Aturan AI baru', wide: true,
      body: `${F('Nama aturan', `<input name="nama" required maxlength="80" value="${esc(r && r.nama)}">`)}
        ${F('Isi aturan (penjelasan)', `<textarea name="isi" rows="3" required maxlength="400" placeholder="Jelaskan cara menangani selisih stok…">${esc(r && r.isiAturan)}</textarea>`)}
        <div class="grid2">
          ${F('Satuan batas', `<select name="satuan"><option value="persen" ${r && r.satuan === 'persen' ? 'selected' : ''}>Persen dari stok tercatat</option><option value="unit" ${r && r.satuan === 'unit' ? 'selected' : ''}>Jumlah unit</option></select>`)}
          ${F('Tindakan', `<select name="tindakan"><option value="notifikasi" ${r && r.tindakan === 'notifikasi' ? 'selected' : ''}>Kirim notifikasi</option><option value="laporan" ${r && r.tindakan === 'laporan' ? 'selected' : ''}>Buat laporan</option><option value="perbaiki" ${r && r.tindakan === 'perbaiki' ? 'selected' : ''}>Perbaiki data stok otomatis</option></select>`)}
          ${F('Selisih minimal', `<input name="min" type="number" step="any" min="0" value="${r ? r.min : 0}" required>`)}
          ${F('Selisih maksimal', `<input name="max" type="number" step="any" min="0" value="${r && r.max !== '' && r.max != null ? r.max : ''}">`, 'Kosongkan = tanpa batas atas.')}
        </div>
        <label class="check"><input type="checkbox" name="aktif" ${!r || r.aktif ? 'checked' : ''}> Aturan aktif</label>`,
      onSubmit: async form => {
        const fd = new FormData(form);
        const min = Number(fd.get('min')), max = fd.get('max') === '' ? '' : Number(fd.get('max'));
        if (max !== '' && max < min) throw new Error('Batas maksimal harus lebih besar dari minimal.');
        await DB.put('aturan_ai', { ...(r || {}), nama: fd.get('nama').trim(), isiAturan: fd.get('isi').trim(), satuan: fd.get('satuan'), tindakan: fd.get('tindakan'), min, max, aktif: fd.get('aktif') === 'on', dibuatOleh: (r && r.dibuatOleh) || Auth.user.id });
        UI.toast('Aturan disimpan.');
        done();
      }
    });
  }

  /* ======================== NOTIFIKASI ======================== */
  P.notifikasi = root => {
    const u = Auth.user;
    const list = DB.all('notifikasi').filter(n => n.untuk.includes(u.peran)).sort((a, b) => b.waktu - a.waktu);
    root.innerHTML = head('Notifikasi', '', list.some(n => !(n.readBy || []).includes(u.id)) ? '<button class="btn" data-act="all">Tandai semua dibaca</button>' : '') +
      `<section class="card">${list.length ? `<ul class="list">${list.map(n => { const unread = !(n.readBy || []).includes(u.id); return `<li class="${unread ? 'unread' : ''}"><b>${esc(n.judul)}</b><span>${esc(n.pesan)}</span><small>${U.fmtDateTime(n.waktu)}</small></li>`; }).join('')}</ul>` : empty('Belum ada notifikasi.')}</section>`;
    root.onclick = async e => {
      if (!e.target.closest('[data-act=all]')) return;
      for (const n of list) if (!(n.readBy || []).includes(u.id)) await DB.put('notifikasi', { ...n, readBy: [...(n.readBy || []), u.id] });
      P.notifikasi(root);
      window.App && App.updateBell();
    };
  };
})();
