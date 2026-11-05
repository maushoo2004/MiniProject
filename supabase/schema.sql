-- =====================================================================
--  ToxiFilter / BlogX — complete Supabase schema
--  Paste this whole file into Supabase → SQL Editor → Run.
--  Safe to re-run. Also upgrades a database created with the old setup guide.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'User',
  email text,
  report_count integer not null default 0,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles alter column report_count set default 0;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

-- Auto-create a profile when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), 'User'), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 1b. Backfill profiles for users created before the trigger existed
-- ---------------------------------------------------------------------
insert into public.profiles (id, name, email)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'name', ''), 'User'), u.email
from auth.users u
on conflict (id) do nothing;

-- Helper used by policies
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 2. POSTS
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id serial primary key,
  title text not null,
  content text not null,
  excerpt text,
  image_url text,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts add column if not exists image_url text;
create index if not exists idx_posts_author on public.posts(author_id);
create index if not exists idx_posts_created on public.posts(created_at desc);

-- ---------------------------------------------------------------------
-- 3. COMMENTS  (inserted ONLY by the backend after moderation)
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id serial primary key,
  post_id integer not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_flagged boolean not null default false,
  toxicity_score numeric(5, 4),
  severity text,
  categories text[] not null default '{}',
  moderation_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.comments add column if not exists severity text;
alter table public.comments add column if not exists categories text[] default '{}';
alter table public.comments add column if not exists moderation_source text;
alter table public.comments drop constraint if exists comments_severity_check;
alter table public.comments add constraint comments_severity_check
  check (severity is null or severity in ('low', 'medium', 'high'));
create index if not exists idx_comments_post on public.comments(post_id);
create index if not exists idx_comments_user on public.comments(user_id);
create index if not exists idx_comments_flagged on public.comments(is_flagged);

-- ---------------------------------------------------------------------
-- 4. REPORTS  (inserted ONLY by the backend)
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null, -- null = automatic system report
  comment_id integer references public.comments(id) on delete cascade,
  post_id integer references public.posts(id) on delete cascade,
  reason text,
  source text not null default 'author',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
-- upgrade path from the old schema
alter table public.reports add column if not exists reason text;
alter table public.reports add column if not exists source text not null default 'author';
alter table public.reports add column if not exists resolved boolean not null default false;
alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete set null;
alter table public.reports drop constraint if exists reports_reported_user_id_reporter_id_key;
alter table public.reports drop constraint if exists reports_unique_per_comment;
alter table public.reports drop constraint if exists reports_source_check;
alter table public.reports add constraint reports_source_check check (source in ('author', 'admin', 'system'));
create unique index if not exists reports_one_per_reporter_comment
  on public.reports(reporter_id, comment_id) where reporter_id is not null;
create index if not exists idx_reports_reported_user on public.reports(reported_user_id);

-- Every new report bumps the reported user's counter (no client can touch the counter)
create or replace function public.bump_report_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set report_count = report_count + 1, updated_at = now()
  where id = new.reported_user_id;
  return new;
end;
$$;
drop trigger if exists on_report_created on public.reports;
create trigger on_report_created
  after insert on public.reports
  for each row execute function public.bump_report_count();

-- Old setup let any logged-in user call this — remove it
drop function if exists public.increment_user_report_count(uuid);

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;
alter table public.reports  enable row level security;

-- drop every policy from the old guide + this file, then recreate
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('profiles', 'posts', 'comments', 'reports')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- PROFILES: everyone can see names; email is hidden by column privileges below
create policy "profiles readable" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Column-level privileges: clients can never read emails or change report_count / role
revoke all on public.profiles from anon, authenticated;
grant select (id, name, report_count, role, created_at) on public.profiles to anon, authenticated;
grant update (name) on public.profiles to authenticated;

-- POSTS
create policy "posts readable" on public.posts for select using (true);
create policy "create own posts" on public.posts for insert with check (auth.uid() = author_id);
create policy "update own posts" on public.posts for update using (auth.uid() = author_id);
create policy "delete own posts or admin" on public.posts for delete
  using (auth.uid() = author_id or public.is_admin());

-- COMMENTS: no INSERT policy on purpose → only the backend (service role) can insert
create policy "comments readable" on public.comments for select using (
  is_flagged = false
  or user_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.posts p where p.id = comments.post_id and p.author_id = auth.uid())
);
create policy "delete own comment, post author or admin" on public.comments for delete using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.posts p where p.id = comments.post_id and p.author_id = auth.uid())
);

-- REPORTS: reporters see their own reports, admins see all; no client inserts
create policy "reports visible to reporter or admin" on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- 6. STORAGE — cover images
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update set public = true;

drop policy if exists "blog images public read" on storage.objects;
drop policy if exists "blog images upload own folder" on storage.objects;
drop policy if exists "blog images delete own" on storage.objects;
create policy "blog images public read" on storage.objects for select
  using (bucket_id = 'blog-images');
create policy "blog images upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'blog-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "blog images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'blog-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 7. REALTIME (live updates of posts & comments)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'comments') then
    alter publication supabase_realtime add table public.comments;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Make yourself admin (run separately, with your email):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ---------------------------------------------------------------------
