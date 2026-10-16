-- Optional: the same Comics searches are built into api/news-ingest.js.
insert into public.news_sources (label, query, category, active)
select v.label, v.query, 'Comics', true
from (values
  ('Marvel Comics', '"Marvel Comics"'),
  ('DC Comics', '"DC Comics"'),
  ('Image Comics', '"Image Comics"'),
  ('Comic book new releases', '"comic book" new release'),
  ('Free Comic Book Day', '"Free Comic Book Day"'),
  ('Boom Studios', '"Boom Studios" OR "BOOM! Studios"'),
  ('Dark Horse Comics', '"Dark Horse Comics"')
) as v(label, query)
where not exists (select 1 from public.news_sources s where lower(s.query) = lower(v.query));
