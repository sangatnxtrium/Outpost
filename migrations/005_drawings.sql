-- 005_drawings.sql — Monthly prize drawings with listing-earned + free (AMOE) entries.
-- Run manually in the Supabase SQL editor. Safe to re-run (idempotent where practical).
--
-- Model
--   * drawings: one row per (usually monthly) drawing. Sang creates them from /admin.
--     status: 'scheduled' (published; live while now() is between starts_at and ends_at),
--             'drawn' (winner picked), 'cancelled'.
--     Only one drawing may be live at a time: windows of non-cancelled drawings can't overlap.
--   * drawing_entries: one row per entry. source 'listing' (auto, via trigger), 'free' (AMOE RPC),
--     or 'social' (N bonus entries per admin-approved social post; outside the listing cap).
-- Security
--   * No INSERT/UPDATE/DELETE policies for anon/authenticated on either table. Entries are only
--     written by SECURITY DEFINER functions/triggers below; drawings + winners only by the
--     service role (the /api/admin-drawings route, gated by ADMIN_EMAILS).
--   * Users read drawings that aren't cancelled, and only their OWN entry rows.
--   * Totals are exposed via drawing_stats() (aggregate only; no other users' rows).

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prize_description text not null default '',
  prize_image_url text,
  prize_arv_cents integer check (prize_arv_cents is null or prize_arv_cents >= 0),
  prize_listing_id uuid references public.listings(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'drawn', 'cancelled')),
  winner_user_id uuid references auth.users(id) on delete set null,
  winner_entry_id uuid,
  drawn_at timestamptz,
  max_entries_per_user integer not null default 10 check (max_entries_per_user between 1 and 1000),
  social_bonus_entries integer not null default 3 check (social_bonus_entries between 0 and 100),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists drawings_window_idx on public.drawings (starts_at, ends_at);

create table if not exists public.drawing_entries (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('listing', 'free', 'social')),
  -- Deleting the listing deletes its entry.
  listing_id uuid references public.listings(id) on delete cascade,
  -- Social bonus entries point at their approved submission (FK added below).
  social_submission_id uuid,
  created_at timestamptz not null default now(),
  check ((source = 'listing') = (listing_id is not null)),
  check ((source = 'social') = (social_submission_id is not null))
);
-- 1 entry per listing per drawing.
create unique index if not exists drawing_entries_listing_uq on public.drawing_entries (drawing_id, listing_id) where listing_id is not null;
-- 1 free entry per user per drawing.
create unique index if not exists drawing_entries_free_uq on public.drawing_entries (drawing_id, user_id) where source = 'free';
create index if not exists drawing_entries_user_idx on public.drawing_entries (drawing_id, user_id);

-- Only one live drawing at a time: reject overlapping windows (ignoring cancelled ones).
create or replace function public.drawings_no_overlap() returns trigger
language plpgsql as $$
begin
  if new.status <> 'cancelled' and exists (
    select 1 from public.drawings d
    where d.id <> new.id and d.status <> 'cancelled'
      and tstzrange(d.starts_at, d.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'Another drawing already covers part of this period';
  end if;
  return new;
end $$;
drop trigger if exists drawings_no_overlap on public.drawings;
create trigger drawings_no_overlap before insert or update of starts_at, ends_at, status on public.drawings
  for each row execute function public.drawings_no_overlap();

-- ---------------------------------------------------------------- RLS
alter table public.drawings enable row level security;
alter table public.drawing_entries enable row level security;

drop policy if exists "drawings readable" on public.drawings;
create policy "drawings readable" on public.drawings
  for select to anon, authenticated using (status <> 'cancelled');

drop policy if exists "own entries readable" on public.drawing_entries;
create policy "own entries readable" on public.drawing_entries
  for select to authenticated using (user_id = auth.uid());
-- (no insert/update/delete policies: writes go through the functions below or the service role)

-- The currently live drawing, if any.
create or replace function public.current_drawing_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.drawings
  where status = 'scheduled' and now() >= starts_at and now() < ends_at
  order by starts_at limit 1
$$;

-- ---------------------------------------------------------------- listing -> entry trigger
-- Awards 1 entry for a qualifying listing created during a live drawing:
--   has a photo, price > 0, status active, user under the per-user listing-entry cap.
-- Also fires when an existing listing (created during the drawing) gains a photo/price later.
create or replace function public.award_listing_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d record;
  used integer;
begin
  if coalesce(new.image_url, '') = '' or coalesce(new.price, 0) <= 0 or coalesce(new.status, 'active') <> 'active' then
    return new;
  end if;
  select * into d from public.drawings
   where id = public.current_drawing_id();
  if d.id is null or new.created_at < d.starts_at then return new; end if;

  -- serialize per user+drawing so concurrent inserts can't blow past the cap
  perform pg_advisory_xact_lock(hashtext(d.id::text || new.user_id::text));
  select count(*) into used from public.drawing_entries
   where drawing_id = d.id and user_id = new.user_id and source = 'listing';
  if used >= d.max_entries_per_user then return new; end if;

  insert into public.drawing_entries (drawing_id, user_id, source, listing_id)
  values (d.id, new.user_id, 'listing', new.id)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists listings_award_drawing_entry on public.listings;
create trigger listings_award_drawing_entry
  after insert or update of image_url, price, status on public.listings
  for each row execute function public.award_listing_entry();

-- ---------------------------------------------------------------- free entry (AMOE)
-- 1 free entry per user per drawing. No purchase or listing required.
create or replace function public.claim_free_drawing_entry(p_drawing_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  if auth.uid() is null then raise exception 'Sign in to enter'; end if;
  select * into d from public.drawings where id = p_drawing_id;
  if d.id is null or d.status <> 'scheduled' or now() < d.starts_at or now() >= d.ends_at then
    raise exception 'This drawing is not open for entries';
  end if;
  insert into public.drawing_entries (drawing_id, user_id, source)
  values (p_drawing_id, auth.uid(), 'free')
  on conflict do nothing;
  if not found then return 'already_claimed'; end if;
  return 'ok';
end $$;

-- ---------------------------------------------------------------- stats
-- Public aggregate: total entries (anyone); caller's own counts (signed in).
create or replace function public.drawing_stats(p_drawing_id uuid)
returns table (total_entries bigint, entrants bigint, my_entries bigint, my_listing_entries bigint, my_free_claimed boolean, my_social_entries bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from drawing_entries where drawing_id = p_drawing_id),
    (select count(distinct user_id) from drawing_entries where drawing_id = p_drawing_id),
    (select count(*) from drawing_entries where drawing_id = p_drawing_id and user_id = auth.uid()),
    (select count(*) from drawing_entries where drawing_id = p_drawing_id and user_id = auth.uid() and source = 'listing'),
    exists (select 1 from drawing_entries where drawing_id = p_drawing_id and user_id = auth.uid() and source = 'free'),
    (select count(*) from drawing_entries where drawing_id = p_drawing_id and user_id = auth.uid() and source = 'social')
$$;
-- (return type changed vs. any earlier draft; drop first if re-running an older version:
--  drop function if exists public.drawing_stats(uuid);)

-- ---------------------------------------------------------------- winner (service role only)
-- Uniformly random entry (each entry = one chance) after the drawing ends.
create or replace function public.pick_drawing_winner(p_drawing_id uuid)
returns table (winner_user_id uuid, winner_entry_id uuid, total_entries bigint)
language plpgsql security definer set search_path = public as $$
declare d record; e record; n bigint;
begin
  select * into d from public.drawings where id = p_drawing_id for update;
  if d.id is null then raise exception 'Drawing not found'; end if;
  if d.status <> 'scheduled' then raise exception 'Drawing is already %', d.status; end if;
  if now() < d.ends_at then raise exception 'Drawing has not ended yet'; end if;
  select count(*) into n from public.drawing_entries where drawing_id = p_drawing_id;
  if n = 0 then raise exception 'No entries'; end if;
  -- gen_random_uuid() is backed by a CSPRNG; ordering by it gives a uniform pick.
  select * into e from public.drawing_entries where drawing_id = p_drawing_id order by gen_random_uuid() limit 1;
  update public.drawings set status = 'drawn', winner_user_id = e.user_id, winner_entry_id = e.id, drawn_at = now()
   where id = p_drawing_id;
  return query select e.user_id, e.id, n;
end $$;

-- Grants: lock down, then open only what clients need.
revoke all on function public.pick_drawing_winner(uuid) from public, anon, authenticated;
grant execute on function public.pick_drawing_winner(uuid) to service_role;
revoke all on function public.award_listing_entry() from public, anon, authenticated;
revoke all on function public.claim_free_drawing_entry(uuid) from public, anon;
grant execute on function public.claim_free_drawing_entry(uuid) to authenticated;
grant execute on function public.drawing_stats(uuid) to anon, authenticated;
grant execute on function public.current_drawing_id() to anon, authenticated;
grant select on public.drawings to anon, authenticated;
grant select on public.drawing_entries to authenticated;


-- =====================================================================================
-- Social-post bonus entries
--   Users submit a public post URL (one per platform per drawing). An admin reviews it
--   in /admin; approving inserts drawings.social_bonus_entries (default 3) entries with
--   source 'social' — outside the listing cap. Rejecting / un-approving removes them.
-- =====================================================================================
create table if not exists public.drawing_social_submissions (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  platform text not null check (platform in ('facebook', 'x', 'instagram', 'tiktok')),
  post_url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (drawing_id, user_id, platform),
  unique (post_url)
);
create index if not exists drawing_social_status_idx on public.drawing_social_submissions (status, created_at);

do $$ begin
  alter table public.drawing_entries
    add constraint drawing_entries_social_fk foreign key (social_submission_id)
    references public.drawing_social_submissions(id) on delete cascade;
exception when duplicate_object then null; end $$;
create index if not exists drawing_entries_social_idx on public.drawing_entries (social_submission_id) where social_submission_id is not null;

-- Normalize + validate the URL: https, lowercase host without www./m./mobile., no query/fragment,
-- no trailing slash; host must belong to the chosen platform.
create or replace function public.normalize_social_url(p_url text, p_platform text) returns text
language plpgsql immutable as $$
declare u text; host text; rest text; ok boolean;
begin
  u := btrim(coalesce(p_url, ''));
  if u !~* '^https?://' then u := 'https://' || u; end if;
  u := regexp_replace(u, '[?#].*$', '');
  host := lower(substring(u from '^https?://([^/]+)'));
  rest := coalesce(substring(u from '^https?://[^/]+(/.*)$'), '');
  host := regexp_replace(host, '^(www\.|m\.|mobile\.|web\.)', '');
  rest := regexp_replace(rest, '/+$', '');
  ok := case p_platform
    when 'facebook'  then host in ('facebook.com', 'fb.com', 'fb.watch')
    when 'x'         then host in ('x.com', 'twitter.com')
    when 'instagram' then host in ('instagram.com', 'instagr.am')
    when 'tiktok'    then host in ('tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com')
    else false end;
  if not ok then raise exception 'That link isn''t a % post', p_platform; end if;
  if host = 'twitter.com' then host := 'x.com'; end if;
  if length(rest) < 2 then raise exception 'Paste the link to the post itself'; end if;
  return 'https://' || host || rest;
end $$;

-- Users can only create pending submissions for themselves while a drawing is live.
create or replace function public.drawing_social_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' then
    new.user_id := auth.uid();
    new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null; new.note := null;
    if not exists (select 1 from drawings d where d.id = new.drawing_id and d.status = 'scheduled'
                   and now() >= d.starts_at and now() < d.ends_at) then
      raise exception 'This drawing is not open for entries';
    end if;
  end if;
  new.post_url := public.normalize_social_url(new.post_url, new.platform);
  return new;
end $$;
drop trigger if exists drawing_social_before_insert on public.drawing_social_submissions;
create trigger drawing_social_before_insert before insert on public.drawing_social_submissions
  for each row execute function public.drawing_social_before_insert();

alter table public.drawing_social_submissions enable row level security;
drop policy if exists "own social submissions readable" on public.drawing_social_submissions;
create policy "own social submissions readable" on public.drawing_social_submissions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own social submissions insert" on public.drawing_social_submissions;
create policy "own social submissions insert" on public.drawing_social_submissions
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
-- No update/delete for users. Admin review goes through the service role.
grant select, insert on public.drawing_social_submissions to authenticated;

-- Admin review (service role only, via /api/admin-drawings). Idempotent:
-- approved => exactly N social entries; pending/rejected => none.
create or replace function public.review_social_submission(p_id uuid, p_status text, p_note text, p_reviewer uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare sub record; n integer;
begin
  if p_status not in ('approved', 'rejected', 'pending') then raise exception 'bad status'; end if;
  select * into sub from drawing_social_submissions where id = p_id for update;
  if sub.id is null then raise exception 'Submission not found'; end if;
  if exists (select 1 from drawings where id = sub.drawing_id and status <> 'scheduled') then
    raise exception 'Drawing already % — entries are frozen', (select status from drawings where id = sub.drawing_id);
  end if;
  update drawing_social_submissions
     set status = p_status, note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = p_reviewer, reviewed_at = now()
   where id = p_id;
  delete from drawing_entries where social_submission_id = p_id;
  if p_status = 'approved' then
    select social_bonus_entries into n from drawings where id = sub.drawing_id;
    insert into drawing_entries (drawing_id, user_id, source, social_submission_id)
    select sub.drawing_id, sub.user_id, 'social', p_id from generate_series(1, coalesce(n, 3));
  end if;
  return p_status;
end $$;
revoke all on function public.review_social_submission(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.review_social_submission(uuid, text, text, uuid) to service_role;
