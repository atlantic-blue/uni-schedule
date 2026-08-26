-- Example data for a local database. Replace the areas and the times with the
-- real ones from the paper sheet before you use this for anything.
insert into public.areas (name, description, places, sort_order) values
  ('Kitchen',    'Preparation and service',        4, 1),
  ('Bar',        'Drinks and till',                3, 2),
  ('Front desk', 'Reception and guest questions',  2, 3),
  ('Cleaning',   'Rooms and shared spaces',        3, 4),
  ('Stock',      'Deliveries and store room',      2, 5);

-- The two fixed days. 2 is Tuesday, 5 is Friday.
insert into public.shift_templates (area_id, weekday, starts_at, ends_at, places)
select a.id, d.weekday, '16:00', '20:00', a.places
from public.areas a cross join (values (2), (5)) as d(weekday);
