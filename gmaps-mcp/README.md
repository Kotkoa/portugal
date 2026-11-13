# gmaps-mcp — свой MCP-сервер Google Maps для Claude

Удалённый MCP-сервер на Next.js + Vercel. После подключения Claude (в чате, голосе, CarPlay) получает инструменты:

| Инструмент | Что делает | Google API |
|---|---|---|
| `search_places` | поиск мест по запросу | Places API (New) |
| `search_nearby` | ближайшие места по типу | Places API (New) |
| `place_details` | телефон, сайт, часы работы | Places API (New) |
| `geocode` | адрес ↔ координаты | Geocoding API |
| `compute_route` | маршрут с пробками, платные дороги | Routes API |
| `plan_ev_trip` | поездка с остановками на зарядку под Hyundai Inster 49 kWh | Routes + Places |
| `chargers_along_route` | зарядки вдоль маршрута: км, съезд, кВт, свободные порты | Routes + Places |
| `charger_live_status` | свободные порты прямо сейчас из EVlibre | Supabase EVlibre |

Везде, где нужна точка, можно передать адрес, название или координаты `lat,lng`.

## 1. Google Cloud

1. Открой проект, где лежит твой ключ (в папке `portugal`), или создай новый.
2. **APIs & Services → Library**, включи: **Places API (New)**, **Geocoding API**, **Routes API**.
3. **Credentials → Create credentials → API key** (лучше отдельный ключ для этого сервера).
4. Ограничь ключ: *API restrictions → Restrict key* → только эти три API.
   *Application restrictions* оставь «None»: у Vercel нет фиксированных IP.
5. **Billing → Budgets & alerts**: бюджет, например 10 €, с уведомлениями. На всякий случай.

## 1.5. Профиль машины

В `lib/ev.ts` задан профиль `INSTER_49`:
- полезная ёмкость 46,8 кВт·ч (номинал 49);
- DC до 85 кВт по CCS2;
- расход по умолчанию 17,5 кВт·ч/100 км (трасса), то есть около 265 км на 100%.

Оценка намеренно консервативная. Если по опыту расход на трассе другой, поменяй `consumption` в профиле. Или просто скажи голосом: «считай расход 16».

Как работает `plan_ev_trip`:
1. Строит маршрут и режет его на куски по ~90 км.
2. Ищет зарядки CCS2 от 50 кВт вдоль каждого куска, с отклонением не больше 3 км.
3. Выбирает остановки по трём правилам: как можно дальше, но с запасом ≥15%; быстрые станции в приоритете; занятые станции пропускаются.
4. На каждой остановке заряжает только столько, сколько нужно, но не выше 80%.
5. Пересчитывает маршрут через выбранные станции.

Цена: один план — это 1 маршрут, плюс по запросу Places на каждые ~90 км, плюс итоговый маршрут. Выходят центы.

## 2. Секрет для адреса

Адрес коннектора будет `https://<проект>.vercel.app/<СЕКРЕТ>/mcp`. Без правильного секрета сервер отвечает 404.
Сгенерируй секрет в терминале:

```bash
openssl rand -hex 24
```

## 3. Деплой на Vercel

```bash
cd gmaps-mcp
npm install
npx vercel            # первый раз: логин и создание проекта
npx vercel env add GOOGLE_MAPS_API_KEY production   # вставь ключ
npx vercel env add MCP_SECRET production            # вставь секрет
npx vercel --prod
```

Или через сайт: залей папку в GitHub, нажми Import в Vercel и добавь две переменные в *Settings → Environment Variables*.

Проверка (должен вернуть JSON со `serverInfo`):

```bash
curl -X POST https://<проект>.vercel.app/<СЕКРЕТ>/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}'
```

## 3.5. EVlibre (по желанию, живой статус портов Iberdrola)

Сервер ходит в Supabase EVlibre с anon-ключом, в базе EVlibre ничего менять не нужно:
1. RPC `search_stations_nearby` находит станцию Iberdrola рядом с точкой (`cupr_id`).
2. Edge-функция `poll-station` спрашивает статус портов у Iberdrola (кэш 5 мин). Если Iberdrola не ответила, приходит старый снимок, и инструмент помечает его `stale: true`. В планировщик такие данные не попадают.

За один вызов опрашивается не больше 10 станций, чтобы не жечь лимит Iberdrola у EVlibre.

Добавь в Vercel две переменные:
```bash
npx vercel env add EVLIBRE_SUPABASE_URL production   # https://cribsatiisubfyafflmy.supabase.co
npx vercel env add EVLIBRE_SUPABASE_KEY production   # Legacy anon key (JWT eyJ…), НЕ service_role
npx vercel --prod
```
Ключ: Supabase → проект EVlibre → *Project Settings → API Keys → Legacy API keys → anon*. Нужен именно JWT: у `poll-station` включён `verify_jwt`, ключ `sb_publishable_…` он не примет.

Без этих переменных всё работает, только статус портов берётся из Google, а там он есть не у всех станций.

## 4. Подключение к Claude

claude.ai (веб или десктоп) → **Settings → Connectors → Add custom connector**:
- Name: `Google Maps`
- URL: `https://<проект>.vercel.app/<СЕКРЕТ>/mcp`
- OAuth-поля оставь пустыми.

Начни **новый** разговор (в том числе голосовой). Инструменты подхватываются при старте разговора.

## Локальный запуск

```bash
cp .env.example .env.local   # заполни обе переменные
npm run dev
# http://localhost:3000/<СЕКРЕТ>/mcp
```

## Безопасность

- Ключ живёт только в переменных окружения Vercel: не в коде и не в git (`.env*` в `.gitignore`).
- Секрет в URL — это пароль. Никому не показывай адрес коннектора. Если он утёк, поменяй `MCP_SECRET` и обнови коннектор.
- Бюджет в Google Cloud ограничит ущерб, если что-то пойдёт не так.

## Добавить инструмент

Если коннектор уже подключён, после деплоя новые инструменты появятся в новом разговоре сами, переподключать не нужно.

В `app/[token]/[transport]/route.ts` добавь ещё один `server.tool(...)`, а вызов API положи в `lib/google.ts`. Пример: погода (Weather API) или высота над уровнем моря (Elevation API).
