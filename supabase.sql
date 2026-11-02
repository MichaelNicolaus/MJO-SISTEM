-- Jalankan sekali di Supabase: SQL Editor > New query > Run
-- Satu tabel generik; setiap baris = satu data (stok, absensi, dst.).

create table if not exists public.records (
  collection text not null,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists records_collection_idx on public.records (collection);

alter table public.records enable row level security;

-- PERHATIAN: kebijakan di bawah mengizinkan siapa pun yang memegang anon key
-- (kunci ini tampil di kode situs) membaca dan menulis. Cukup untuk uji coba atau
-- lingkungan internal berisiko rendah. Untuk produksi, pindahkan login ke
-- Supabase Auth dan batasi kebijakan per pengguna/peran (lihat README).
drop policy if exists "mjo_anon_all" on public.records;
create policy "mjo_anon_all" on public.records
  for all to anon
  using (true) with check (true);
