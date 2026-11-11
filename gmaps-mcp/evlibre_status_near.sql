-- RPC для gmaps-mcp: живой статус портов EVlibre рядом с набором точек.
-- ⚠️ ШАБЛОН: имена таблиц и колонок ниже придуманы. Замени их на реальные из схемы EVlibre
--    (проще всего попросить Claude Code в репозитории EVlibre адаптировать этот файл).
--
-- Вход:  points = [{"lat":..,"lng":..}, ...], radius_m
-- Выход: по одной строке на точку, где нашлась станция (ближайшая в радиусе)
--
-- Предполагаемая схема (ЗАМЕНИТЬ):
--   stations(id, name, lat, lng)
--   ports(id, station_id, status text /* 'available' | 'charging' | ... */, updated_at timestamptz)

create or replace function public.evlibre_status_near(points jsonb, radius_m int default 150)
returns table (idx int, station_name text, free_ports int, total_ports int, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with pts as (
    select (ord - 1)::int as idx,
           (p->>'lat')::float8 as lat,
           (p->>'lng')::float8 as lng
    from jsonb_array_elements(points) with ordinality as t(p, ord)
  ),
  nearest as (
    select distinct on (pts.idx)
      pts.idx, s.id as station_id, s.name
    from pts
    join stations s                                    -- ЗАМЕНИТЬ
      on s.lat between pts.lat - radius_m / 111000.0 and pts.lat + radius_m / 111000.0
     and s.lng between pts.lng - radius_m / (111000.0 * cos(radians(pts.lat)))
                   and pts.lng + radius_m / (111000.0 * cos(radians(pts.lat)))
    order by pts.idx,
      (s.lat - pts.lat)^2 + ((s.lng - pts.lng) * cos(radians(pts.lat)))^2
  )
  select n.idx,
         n.name,
         count(*) filter (where p.status = 'available')::int,   -- ЗАМЕНИТЬ значение статуса
         count(*)::int,
         max(p.updated_at)
  from nearest n
  join ports p on p.station_id = n.station_id                  -- ЗАМЕНИТЬ
  group by n.idx, n.name;
$$;

-- Ограничим размер запроса и дадим доступ anon-ключу только к этой функции
revoke all on function public.evlibre_status_near(jsonb, int) from public;
grant execute on function public.evlibre_status_near(jsonb, int) to anon;
