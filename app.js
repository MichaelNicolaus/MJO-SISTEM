(function () {
  const { U, DB, UI, Auth, Engine, ROLES, PERM, Pages } = window;
  const $ = id => document.getElementById(id);
  const App = {};
  window.App = App;

  const ALL = Object.keys(ROLES);
  const NAV = [
    { id: 'dashboard', label: 'Dashboard', roles: ALL },
    { id: 'stok', label: 'Stok barang', roles: PERM.stok.read },
    { id: 'absensi', label: 'Absensi', roles: PERM.absensi.read },
    { id: 'pendapatan', label: 'Pendapatan', roles: PERM.pendapatan.read },
    { id: 'laporan', label: 'Laporan', roles: PERM.laporan.read },
    { id: 'selisih', label: 'AI selisih stok', roles: PERM.selisih.read },
    { id: 'akun', label: 'Akun & hak akses', roles: PERM.akun.read },
    { id: 'notifikasi', label: 'Notifikasi', roles: ALL }
  ];
  const allowed = id => { const n = NAV.find(x => x.id === id); return n && n.roles.includes(Auth.user.peran); };

  const show = id => ['boot', 'login', 'shell'].forEach(x => $(x).classList.toggle('hidden', x !== id));

  App.updateBell = () => {
    if (!Auth.user) return;
    const n = Engine.unread().length;
    $('bellCount').textContent = n;
    $('bellCount').classList.toggle('hidden', !n);
  };

  App.render = () => {
    if (!Auth.user) return;
    let page = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
    if (!allowed(page)) { page = 'dashboard'; history.replaceState(null, '', '#/dashboard'); }
    $('nav').innerHTML = NAV.filter(n => n.roles.includes(Auth.user.peran))
      .map(n => `<a href="#/${n.id}" class="${n.id === page ? 'active' : ''}">${n.label}</a>`).join('');
    const view = $('view');
    try { Pages[page](view); }
    catch (e) { console.error(e); view.innerHTML = `<div class="card"><h2>Terjadi kesalahan</h2><p class="muted">${U.esc(e.message)}</p></div>`; }
    $('side').classList.remove('open');
    App.updateBell();
  };

  function enter() {
    Auth.refresh();
    if (!Auth.user) return showLogin();
    $('roleLabel').textContent = ROLES[Auth.user.peran];
    $('whoName').textContent = Auth.user.nama;
    $('whoUser').textContent = '@' + Auth.user.username;
    show('shell');
    if (!location.hash) location.hash = '#/dashboard';
    App.render();
    Engine.runScheduler().then(n => { if (n) App.render(); }).catch(console.error);
  }

  function showLogin() {
    show('login');
    const first = DB.all('akun').find(a => a.akunAwal);
    const hint = $('loginHint');
    hint.classList.toggle('hidden', !first);
    if (first) hint.innerHTML = `Akun awal: <code>${U.esc(first.username)}</code> / <code>admin123</code>. Segera ganti password setelah masuk.`;
  }

  function tick() {
    const w = U.wib(U.now());
    $('clock').textContent = `${U.fmtDate(w.date)} · ${w.time} WIB`;
    $('clock').title = U.clockSource === 'server' ? 'Jam sinkron dengan server' : 'Jam server tidak terjangkau, memakai jam perangkat';
    $('clock').dataset.src = U.clockSource;
  }

  async function boot() {
    try {
      await DB.init();
      await Engine.ensureDefaults();
    } catch (e) {
      console.error(e);
      $('boot').innerHTML = `<p class="err">Tidak dapat terhubung ke database bersama.<br><small>${U.esc(e.message)}</small></p><button class="btn primary" onclick="location.reload()">Coba lagi</button>`;
      return;
    }
    await U.syncClock();
    tick(); setInterval(tick, 1000);
    setInterval(() => U.syncClock(), 5 * 60 * 1000);

    Auth.restore();
    Auth.user ? enter() : showLogin();

    window.addEventListener('hashchange', App.render);
    $('menuBtn').onclick = () => $('side').classList.toggle('open');
    $('logoutBtn').onclick = () => { Auth.logout(); location.hash = ''; showLogin(); };

    $('loginForm').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, err = $('loginErr');
      err.classList.add('hidden');
      try {
        await Auth.login(f.username.value, f.password.value);
        f.reset();
        enter();
      } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
    };

    // Isi tetap terbaru: tarik perubahan dari database bersama dan jalankan jadwal laporan
    DB.onChange(() => { if (Auth.user && !UI.isDialogOpen()) { Auth.refresh(); Auth.user ? App.render() : showLogin(); } else App.updateBell(); });
    if (DB.remote) {
      setInterval(() => { if (document.visibilityState === 'visible') DB.sync().catch(console.warn); }, window.MJO_CONFIG.SYNC_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') DB.sync().catch(console.warn); });
    }
    setInterval(() => { if (Auth.user) Engine.runScheduler().then(n => { if (n && !UI.isDialogOpen()) App.render(); }).catch(console.error); }, 60000);
  }

  boot();
})();
