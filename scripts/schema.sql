-- ============================================================
-- اللوح المحفوظ — Supabase schema
-- شغّل هذا الملف كاملاً مرة وحدة فـ SQL Editor ديال Supabase
-- (Project → SQL Editor → New query → الصق هذا الملف → Run)
-- ============================================================

-- 1) جدول النص (يتعمر مرة وحدة عبر scripts/seed-data.js من Quranpedia API)
create table if not exists ayahs (
  id integer primary key,
  surah_number integer not null,
  surah_name text not null,
  ayah_number integer not null,
  text text not null,
  page_number integer not null,
  thumn_number integer,
  hizb_number integer,
  juz_number integer
);

create index if not exists idx_ayahs_page on ayahs (page_number);
create index if not exists idx_ayahs_surah on ayahs (surah_number);
create index if not exists idx_ayahs_thumn on ayahs (thumn_number);

-- عمومي للقراءة، بلا RLS (النص ثابت وعمومي)
alter table ayahs enable row level security;
drop policy if exists "ayahs are public" on ayahs;
create policy "ayahs are public" on ayahs for select using (true);

-- 2) إعدادات المستخدم
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  font_size integer default 24,
  theme text default 'sepia',
  dark_mode boolean default false,
  auto_scroll_speed integer default 0,
  preferred_reciter_id integer default 1,
  updated_at timestamptz default now()
);

alter table user_settings enable row level security;
drop policy if exists "own settings" on user_settings;
create policy "own settings" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) آخر موضع قراءة (لكل وضع)
create table if not exists reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  mode text not null check (mode in ('reading','memorizing','reviewing','browsing')),
  page_number integer not null,
  updated_at timestamptz default now(),
  unique(user_id, mode)
);

alter table reading_progress enable row level security;
drop policy if exists "own progress" on reading_progress;
create policy "own progress" on reading_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) المفضلة / العلامات المرجعية
create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  page_number integer not null,
  ayah_number integer,
  note text,
  created_at timestamptz default now()
);

alter table bookmarks enable row level security;
drop policy if exists "own bookmarks" on bookmarks;
create policy "own bookmarks" on bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5) جلسات التكرار (اختياري، لحفظ آخر إعداد تكرار)
create table if not exists repeat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  surah_number integer,
  from_ayah integer,
  to_ayah integer,
  repeat_count integer,
  created_at timestamptz default now()
);

alter table repeat_sessions enable row level security;
drop policy if exists "own repeat sessions" on repeat_sessions;
create policy "own repeat sessions" on repeat_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6) عداد أيام القراءة المتتالية (streak) — بسيط
create table if not exists reading_streak (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer default 0,
  longest_streak integer default 0,
  last_read_date date,
  updated_at timestamptz default now()
);

alter table reading_streak enable row level security;
drop policy if exists "own streak" on reading_streak;
create policy "own streak" on reading_streak
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ملاحظة: فعّل Anonymous Sign-Ins من Supabase Dashboard →
-- Authentication → Providers → Anonymous Sign-In، قبل استعمال التطبيق.
