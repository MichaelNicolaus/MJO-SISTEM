# Sistem Informasi MJO

Website statis (HTML, CSS, JavaScript murni, tanpa build) untuk operasional tenant F&B MJO.
Mencakup 12 use case: stok, absensi selfie, pendapatan, akun, laporan otomatis, dan AI selisih stok.

## Isi proyek

```
index.html          halaman utama (login + aplikasi)
css/style.css       tampilan (terang/gelap otomatis)
js/config.js        konfigurasi (mode data, zona waktu)
js/utils.js         waktu server, format, CSV, kompres gambar
js/db.js            penyimpanan: lokal atau Supabase
js/engine.js        peran, login, laporan terjadwal, mesin aturan AI
js/ui.js            dialog, toast
js/pages.js         semua halaman
js/app.js           router, menu per peran, jadwal
supabase.sql        tabel untuk mode database bersama
.nojekyll           agar GitHub Pages menyajikan apa adanya
```

## Pasang ke GitHub Pages

1. Buat repository baru di GitHub (mis. `mjo-sistem`), lalu unggah seluruh isi folder ini ke branch `main`
   (tombol **Add file > Upload files**, atau `git push`).
2. Buka **Settings > Pages**. Pada *Build and deployment* pilih **Deploy from a branch**,
   branch `main`, folder `/ (root)`, lalu **Save**.
3. Tunggu 1 sampai 2 menit. Alamat situs: `https://<username>.github.io/mjo-sistem/`.

GitHub Pages memakai HTTPS, sehingga kamera untuk absensi dapat dipakai.
Setiap kali Anda `push` perubahan, situs otomatis diperbarui.

## Akun awal

| Username | Password | Catatan |
|---|---|---|
| `admin` | `admin123` | Segera ganti di menu **Akun & hak akses** |

Di Dashboard Admin ada tombol **Muat data contoh** yang membuat akun uji `gudang`, `tenant`, `finance`,
`founder` (password `mjo12345`), contoh stok, pendapatan, dan aturan AI. Hapus akun contoh sebelum dipakai sungguhan.

## Agar isi selalu terbaru di semua perangkat (disarankan)

Tanpa pengaturan, data tersimpan di browser masing-masing perangkat dan **tidak dibagikan**.
GitHub Pages hanya menyajikan file statis, jadi untuk data bersama dipakai Supabase (gratis untuk skala kecil):

1. Daftar di supabase.com, buat project baru.
2. Buka **SQL Editor**, tempel isi `supabase.sql`, klik **Run**.
3. Buka **Project Settings > API**, salin **Project URL** dan **anon public key**.
4. Isi `js/config.js`:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ...',
   ```
5. Commit dan push. Semua pengguna kini membaca dan menulis database yang sama.
   Perubahan dari perangkat lain muncul otomatis (penarikan tiap 20 detik).

### Batasan keamanan yang perlu Anda tahu

- Aplikasi ini sepenuhnya berjalan di browser. Login dan pembatasan peran dicek di sisi klien,
  sehingga **bukan pengamanan sungguhan** terhadap orang yang memahami teknis. Cocok untuk tim kecil tepercaya.
- Pada mode Supabase, anon key terlihat di kode situs dan kebijakan bawaan mengizinkan baca/tulis penuh,
  termasuk hash password dan foto selfie. Untuk produksi: pindahkan login ke Supabase Auth,
  pakai Row Level Security per peran, dan simpan foto di Supabase Storage.
- Password di-hash (SHA-256 + salt) sebelum disimpan, tetapi ini bukan pengganti autentikasi server.

## Perilaku penting

- **Waktu absensi** diambil dari header `Date` server hosting (bukan jam HP). Jika tidak terjangkau
  (mis. file dibuka langsung dari folder), sistem memakai jam perangkat dan menandainya "Waktu perangkat".
- **Laporan otomatis** dibuat saat sistem dibuka setelah jadwal terlewat, karena tidak ada server latar belakang.
  Laporan yang terlewat dibuat satu kali. Untuk pembuatan benar-benar tanpa dibuka, perlu backend
  (mis. Supabase Edge Function + jadwal cron).
- **AI selisih stok** adalah mesin aturan (rule engine) di browser: membandingkan stok tercatat dan
  stok sebenarnya, lalu menjalankan aturan Admin (notifikasi, laporan, atau perbaiki data stok).
  Tidak ada API model bahasa dan tidak ada kunci rahasia di kode.
- **Mode lokal**: foto disimpan di localStorage (batas sekitar 5 MB, kira-kira 50 sampai 80 foto).
  Gunakan Supabase bila volume lebih besar.
- Penghapusan hanya tersedia untuk Stok (sesuai use case). Akun dinonaktifkan, tidak dihapus.

## Pemetaan use case ke halaman

| No | Use case | Aktor | Lokasi |
|---|---|---|---|
| 1 | Input Stock | Staff Gudang | Stok barang > Input stok |
| 2 | Update Stock | Staff Gudang | Stok barang > Update |
| 3 | Delete Stock | Staff Gudang | Stok barang > Hapus |
| 4 | Input Attendance | Karyawan Tenant | Absensi > Absen masuk/pulang (kamera) |
| 5 | Update Attendance | Admin | Absensi > Koreksi (riwayat tersimpan) |
| 6 | Input Revenue Data | Staff Finance | Pendapatan > Input pendapatan |
| 7 | Update Revenue Data | Staff Finance | Pendapatan > Update |
| 8 | Register Account | Admin | Akun & hak akses > Register akun |
| 9 | Update Account | Admin | Akun & hak akses > Update |
| 10 | Atur Monthly Revenue Report otomatis | Admin | Laporan > Laporan laba bulanan otomatis |
| 11 | Atur Report Stock otomatis | Admin | Laporan > Laporan stok otomatis |
| 12 | Atur AI selisih stok | Admin | AI selisih stok > Aturan |

Tambahan di luar 12 use case: peran **Founder** (hanya melihat), verifikasi pembelian oleh Staff Finance
(untuk kasus selisih nominal seperti wortel Rp6.000 vs Rp9.000), dan notifikasi dalam aplikasi.

## Uji di komputer sendiri

```bash
python3 -m http.server 8000     # lalu buka http://localhost:8000
```
