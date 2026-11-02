/*
  Konfigurasi sistem MJO.

  MODE DATA
  ---------
  1) Lokal (default): SUPABASE_URL dan SUPABASE_ANON_KEY dikosongkan.
     Data disimpan di localStorage browser masing-masing perangkat.
     Cocok untuk demo/uji coba. Data TIDAK dibagikan antar perangkat.

  2) Database bersama (disarankan untuk dipakai sungguhan):
     isi dua nilai di bawah dengan data proyek Supabase Anda
     (langkah lengkap ada di README.md dan supabase.sql).
     Semua pengguna lalu melihat data yang sama dan selalu terbaru.
*/
window.MJO_CONFIG = {
  APP_NAME: 'Sistem Informasi MJO',

  SUPABASE_URL: '',        // contoh: 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: '',   // anon public key dari Supabase

  TIMEZONE_OFFSET_HOURS: 7,   // WIB = UTC+7
  SYNC_INTERVAL_MS: 20000     // interval penarikan data terbaru (mode database bersama)
};
