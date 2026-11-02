(function () {
  const U = window.U, esc = U.esc;
  const UI = {};

  UI.toast = function (msg, type = 'ok') {
    const box = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, type === 'err' ? 6000 : 3200);
  };

  /*
    Dialog form. onSubmit(form, dlg) boleh async; lempar Error untuk menampilkan pesan,
    return false agar dialog tetap terbuka.
  */
  UI.dialog = function ({ title, body, submit = 'Simpan', cancel = 'Batal', wide = false, hideSubmit = false, onMount, onSubmit }) {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg' + (wide ? ' wide' : '');
    dlg.innerHTML = `<form class="dlg-form">
      <header><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">✕</button></header>
      <div class="dlg-body">${body}</div>
      <footer><button type="button" class="btn ghost" data-close>${esc(cancel)}</button>${hideSubmit ? '' : `<button type="submit" class="btn primary">${esc(submit)}</button>`}</footer>
    </form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    const close = () => { if (dlg.open) dlg.close(); };
    dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    dlg.addEventListener('close', () => setTimeout(() => dlg.remove(), 0));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!onSubmit) return;
      if (!form.reportValidity()) return;
      const btn = form.querySelector('[type=submit]');
      if (btn) btn.disabled = true;
      try {
        const r = await onSubmit(form, dlg);
        if (r !== false) close();
      } catch (err) {
        UI.toast(err.message || String(err), 'err');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
    dlg.showModal();
    if (onMount) onMount(dlg, form, close);
    return dlg;
  };

  UI.confirm = (message, { ok = 'Ya, lanjutkan', danger = false } = {}) => new Promise(resolve => {
    let answered = false;
    const dlg = UI.dialog({
      title: 'Konfirmasi',
      body: `<p>${esc(message)}</p>`,
      submit: ok,
      onSubmit: () => { answered = true; resolve(true); }
    });
    if (danger) dlg.querySelector('[type=submit]').classList.add('danger');
    dlg.addEventListener('close', () => { if (!answered) resolve(false); });
  });

  UI.image = (src, title) => UI.dialog({
    title, wide: true, hideSubmit: true, cancel: 'Tutup',
    body: `<img class="full-img" src="${src}" alt="${esc(title)}">`
  });

  UI.isDialogOpen = () => !!document.querySelector('dialog[open]');

  window.UI = UI;
})();
