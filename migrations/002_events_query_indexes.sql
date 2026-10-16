-- 002_events_query_indexes.sql
-- Supports the server-side Events tab queries:
--   local:  is_active = true and state = ? and date >= today [and categories @> {cat}] order by date, id
--   major:  is_active = true and is_national = true and date >= today order by date
--   near:   lat/lng bounding box
create index if not exists events_active_state_date_idx on public.events (is_active, state, date, id);
create index if not exists events_active_national_date_idx on public.events (is_active, is_national, date);
create index if not exists events_categories_gin_idx on public.events using gin (categories);
create index if not exists events_lat_lng_idx on public.events (lat, lng) where is_active;
