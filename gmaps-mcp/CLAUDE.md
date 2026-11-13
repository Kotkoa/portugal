# CLAUDE.md — проект «On Road» / gmaps-mcp

Контекст для Claude в чате, в голосовом режиме в машине (CarPlay) и в Claude Code в репозитории `gmaps-mcp`.

## Кто и зачем

Андрей. Ездит на **Hyundai Inster 2025 (49 кВт·ч)**, живёт в Испании (район Пего / Олива).
`gmaps-mcp` — собственный удалённый MCP-сервер Google Maps. Через него Claude отвечает в машине по реальным данным карт: места, маршруты, зарядки. Ничего не придумывает.

## Машина: Hyundai Inster 2025, Long Range 49 kWh

| Параметр | Значение |
|---|---|
| Батарея | 49 кВт·ч номинал, ≈46,8 полезных |
| Реальный запас хода | 250–450 км (по словам Андрея); WLTP 370 км на 15" дисках |
| Расход для планирования | 17,5 кВт·ч/100 км на трассе (≈265 км на 100%); WLTP 14,9 |
| DC (быстрая) | CCS2, пик ≈85 кВт, в среднем ≈70 кВт на 10→80% |
| 10→80% | ≈30 мин на станции ≥120 кВт · ≈39 мин на 100 кВт · ≈58 мин на 50 кВт |
| AC | Type 2, ≈11 кВт, 10→100% ≈4 ч 35 мин |
| Мануал (EN) | https://www.hyundai.gr/wp-content/uploads/2025/03/2025-model-axev-inster_electric_english.pdf |

Станции мощнее 85 кВт не заряжают Inster быстрее, но 50 кВт заметно медленнее. Поэтому в приоритете станции от 100 кВт.

## Как вести себя в машине (голос)

- Отвечать коротко, как штурман: сначала главное (куда, сколько км и минут), детали только по просьбе.
- Не зачитывать URL, координаты, id и длинные списки. Максимум 2–3 варианта.
- Для поездки на зарядку спросить **текущий заряд в %**, если его не назвали, и вызвать `plan_ev_trip`.
- GPS телефона Claude не видит. Старт берётся со слов Андрея («я на AP-7 у Гандии», «выезжаю из Пего»).
- Холод, сильный ветер, горы, скорость выше 120 км/ч: поднять `consumption` до 19–22.
- Если инструменты карт недоступны (коннектор не подключён или ошибка), сказать об этом прямо. Не выдумывать адреса, расстояния и наличие зарядок.
- «Свободна ли зарядка?» → `charger_live_status` (координаты станции брать из `chargers_along_route` / `search_places`). Если `stale: true`, не говорить «свободно сейчас». Сказать «живых данных нет, последний раз видели <дата>: N из M свободно». Пустой ответ значит, что это не Iberdrola и в EVlibre такой станции нет. Тогда опираться только на Google (`available` в `chargers_along_route`).

## Инструменты MCP

Коннектор в claude.ai называется **google-maps-copilot**, инструменты видны как `google-maps-copilot:<имя>`.

| Инструмент | Для чего |
|---|---|
| `plan_ev_trip` | поездка с остановками на зарядку: км, заряд при прибытии, до скольки заряжать, минуты, свободные порты |
| `chargers_along_route` | зарядки вдоль маршрута по порядку, съезд в км, мощность |
| `charger_live_status` | свободные порты сейчас, только станции Iberdrola (EVlibre): `ports`, `freePorts/totalPorts`, кВт, €/кВт·ч, `observedAt`, `stale` |
| `search_places` / `search_nearby` / `place_details` | места, ближайшие по типу, часы работы и телефон |
| `geocode` | адрес ↔ координаты |
| `compute_route` | маршрут с пробками, платные дороги, шаги |

Точки можно задавать адресом, названием или `lat,lng`.
Умолчания `plan_ev_trip`: CCS2 ≥50 кВт, съезд ≤3 км, прибытие ≥15%, заряд ≤80%, расход 17,5.
Статусы портов EVlibre: `AVAILABLE` свободен · `OCCUPIED` / `EV_CONNECTED` занят · `OUT_OF_SERVICE` сломан · `RESERVED` забронирован.

## Деплой

- Vercel: проект `kotkoas-projects/google-maps-copilot`, постоянный адрес **https://google-maps-copilot.vercel.app**.
- MCP-эндпоинт: `https://google-maps-copilot.vercel.app/<MCP_SECRET>/mcp`. Секрет нигде не записывать: ни в код, ни в доки, ни в чат.
- В коннекторе использовать только короткий адрес-алиас, а не адрес конкретного деплоя (`google-maps-copilot-<hash>-kotkoas-projects.vercel.app`): он меняется с каждым деплоем и закрыт защитой Vercel.
- Git: репозиторий `Kotkoa/portugal`, сервер лежит в папке `gmaps-mcp`. Деплой: `npx vercel --prod` из этой папки, либо push в `main`, если в настройках проекта Root Directory = `gmaps-mcp`.
- Env (Production): `GOOGLE_MAPS_API_KEY`, `MCP_SECRET`; для EVlibre ещё `EVLIBRE_SUPABASE_URL` = `https://cribsatiisubfyafflmy.supabase.co` и `EVLIBRE_SUPABASE_KEY` = legacy anon JWT (`eyJ…`, не `sb_publishable_…`, не service_role). Новые env-переменные попадают только в новый деплой, после изменения нужен redeploy.
- Google Cloud: проект `portugal-trip`. ID сервисов: `places.googleapis.com` (Places API **New**; `places-backend` — это legacy), `routes.googleapis.com`, `geocoding-backend.googleapis.com`.

Быстрая проверка (секрет подставить локально):
```bash
curl -X POST https://google-maps-copilot.vercel.app/$MCP_SECRET/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"compute_route","arguments":{"origin":"Pego","destination":"Valencia"}}}'
```
Проверка EVlibre (Iberdrola Moratalla): тот же запрос с `"name":"charger_live_status","arguments":{"lat":38.187,"lng":-1.892,"radiusM":1500}`.

## Архитектура (для Claude Code)

- Next.js 15 (App Router) + `mcp-handler` 1.1.0 + `@modelcontextprotocol/sdk` 1.26.0, zod 3. Деплой на Vercel.
- Эндпоинт: `app/[token]/[transport]/route.ts` → `/<MCP_SECRET>/mcp`. Неверный токен отдаёт 404. Сравнение через `timingSafeEqual`, секрет не короче 24 символов.
- `lib/google.ts` — Places API (New), Geocoding, Routes v2; `waypoint()` понимает `lat,lng`.
- `lib/geo.ts` — кодирование и декодирование polyline, проекция точки на маршрут, нарезка на куски.
- `lib/ev.ts` — профиль `INSTER_49`, `chargersAlongRoute` (searchText + searchAlongRouteParameters + evOptions, куски по ~90 км), `planEvTrip` (жадный выбор остановок), клиент EVlibre.
- EVlibre (Supabase `cribsatiisubfyafflmy`, только Iberdrola): RPC `search_stations_nearby(p_lat, p_lon, p_radius_km, p_only_free)` → `cupr_id`, затем edge `poll-station {cupr_id}` → статусы портов, кэш 5 мин; `meta.source_unavailable` = старый снимок (`stale`), в планировщик не попадает. Не больше 10 опросов за вызов. Схему EVlibre не трогаем.

## Правила разработки

- Ключи только в env. Никогда в коде, логах или ответах инструментов. `.env*` в `.gitignore`.
- Ответы инструментов компактные: их зачитывают голосом.
- Новый инструмент: вызов API в `lib/`, регистрация `server.tool(...)` в `route.ts`, zod-схема с описаниями на русском.
- Сначала проверять подход дешёвым прототипом, потом писать продакшен-код.
- Перед деплоем: `npx tsc --noEmit && npx next build`.

## Статус (2026-11-13)

- [x] Код написан, сборка и локальный smoke-тест пройдены, планировщик проверен на моках
- [x] Places (New), Geocoding, Routes включены в Google Cloud
- [x] Деплой на Vercel (`google-maps-copilot`), env заданы
- [x] Проверено вживую: `initialize`, `compute_route` (Пего → Валенсия, 91 км, AP-7), `plan_ev_trip` (Пего → Мадрид с 70%: 2 остановки, Буньоль 60 кВт и Wenea на A-3 200 кВт, прибытие с 15%)
- [x] Custom connector добавлен в claude.ai
- [x] EVlibre: клиент на существующих `search_stations_nearby` + `poll-station`, локально проверен (Moratalla)
- [ ] Добавить env `EVLIBRE_*` в Vercel и передеплоить
- [ ] EVlibre чинит блокировку Iberdrola (HTTP 418 с 12.11), до этого `charger_live_status` отдаёт `stale: true`
- [ ] Проверка голосом в машине (CarPlay), в новом разговоре проекта «On Road»
- [ ] Проверить в Vercel Settings → Root Directory = `gmaps-mcp`, чтобы push в `main` деплоил сервер

## Идеи на потом

- Ссылка Google Maps с точками остановок в ответе `plan_ev_trip`, чтобы открыть маршрут в навигаторе на CarPlay одним нажатием.
- Опция «только станции от 100 кВт» по умолчанию для длинных поездок.
- Погода (Weather API) для поправки расхода в холод и ветер.
