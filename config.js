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

  SUPABASE_URL: 'https://glvsrwspwqwhipwfkhkw.supabase.co',        // contoh: 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdnNyd3Nwd3F3aGlwd2ZraGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1OTAyODMsImV4cCI6MjEwOTE2NjI4M30.hiNgb9jS-0RzoBfmDmFdbZxYJ4GQzLqCna3QJ1YY4OE',   // anon public key dari Supabase

  TIMEZONE_OFFSET_HOURS: 7,   // WIB = UTC+7
  SYNC_INTERVAL_MS: 20000     // interval penarikan data terbaru (mode database bersama)
};
