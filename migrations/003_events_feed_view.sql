-- 003_events_feed_view.sql
-- One row per event *series* for the Events tab, so weekly store events
-- ("Friday Night Magic @ Store", every Fri) collapse into a single card with
-- its next date and the upcoming dates, consistently across pages.
-- Store-platform events group by (title, location, weekday); everything else
-- is its own series. Only active, upcoming, non-national rows are included.
-- security_invoker: the view uses the caller's RLS (events are public-read).
create or replace view public.events_feed
with (security_invoker = on) as
with base as (
  select e.*,
    case when e.source in ('wizards', 'ravensburger', 'wizards-recurring', 'ravensburger-recurring')
      then lower(e.title) || '|' || coalesce(lower(e.location), '') || '|' || extract(isodow from e.date)::int
      else e.id::text
    end as series_key
  from public.events e
  where e.is_active
    and e.date >= (now() at time zone 'America/Denver')::date
    and e.is_national is not true
)
select
  (array_agg(id order by date, id))[1]          as id,
  series_key,
  state,
  (array_agg(title order by date, id))[1]       as title,
  min(date)                                     as date,
  (array_agg(end_date order by date, id))[1]    as end_date,
  (array_agg(location order by date, id))[1]    as location,
  (array_agg(city order by date, id))[1]        as city,
  (array_agg(description order by date, id))[1] as description,
  (array_agg(website order by date, id))[1]     as website,
  (array_agg(ticket_url order by date, id))[1]  as ticket_url,
  (array_agg(categories order by date, id))[1]  as categories,
  false                                         as is_national,
  (array_agg(lat order by date, id))[1]         as lat,
  (array_agg(lng order by date, id))[1]         as lng,
  (array_agg(shop_id order by date, id))[1]     as shop_id,
  (array_agg(spots order by date, id))[1]       as spots,
  (array_agg(source order by date, id))[1]      as source,
  count(*)::int                                 as n_dates,
  (array_agg(date order by date))[1:8]          as dates
from base
group by series_key, state;

grant select on public.events_feed to anon, authenticated;
