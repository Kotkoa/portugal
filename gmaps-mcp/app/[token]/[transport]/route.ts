import { createMcpHandler } from "mcp-handler";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { computeRoute, geocode, placeDetails, searchNearby, searchPlaces } from "@/lib/google";
import { INSTER_49, chargersAlongRoute, evlibreStatusNear, planEvTrip } from "@/lib/ev";

export const maxDuration = 60;

const latLng = z.object({ lat: z.number(), lng: z.number() });
const connector = z.enum(["CCS2", "TYPE2", "CHADEMO"]).optional()
  .describe("Разъём. По умолчанию CCS2 (быстрая DC-зарядка Inster)");
const place = z.string().describe("Адрес, название места или координаты 'lat,lng'");
const lang = z.string().optional().describe("Язык ответа, по умолчанию ru");

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }],
});

async function safe<T>(fn: () => Promise<T>) {
  try {
    return json(await fn());
  } catch (e) {
    return { ...json({ error: (e as Error).message }), isError: true };
  }
}

function buildHandler(token: string) {
  return createMcpHandler(
    (server) => {
      server.tool(
        "search_places",
        "Поиск мест в Google Maps по текстовому запросу (кафе, заправки, магазины, адреса). Возвращает реальные данные карт: адрес, рейтинг, открыто ли сейчас, ссылку.",
        {
          query: z.string().describe("Что искать, можно с городом: 'заправка Repsol в Олива'"),
          near: latLng.optional().describe("Сместить поиск к этой точке"),
          radius: z.number().max(50000).optional().describe("Радиус смещения в метрах"),
          openNow: z.boolean().optional(),
          minRating: z.number().min(0).max(5).optional(),
          max: z.number().int().min(1).max(10).optional(),
          language: lang,
        },
        async (a) => safe(() => searchPlaces(a)),
      );

      server.tool(
        "search_nearby",
        "Ближайшие места заданных типов вокруг точки, по расстоянию. Типы Places API: gas_station, electric_vehicle_charging_station, restaurant, cafe, pharmacy, supermarket, parking, hardware_store и т.д.",
        {
          center: latLng,
          types: z.array(z.string()).min(1),
          radius: z.number().max(50000).optional(),
          max: z.number().int().min(1).max(20).optional(),
          language: lang,
        },
        async (a) => safe(() => searchNearby(a)),
      );

      server.tool(
        "place_details",
        "Подробности о месте по его id из search_places: телефон, сайт, часы работы, описание.",
        { id: z.string(), language: lang },
        async ({ id, language }) => safe(() => placeDetails(id, language)),
      );

      server.tool(
        "geocode",
        "Адрес → координаты, или координаты → адрес (передай lat и lng).",
        {
          address: z.string().optional(),
          lat: z.number().optional(),
          lng: z.number().optional(),
          language: lang,
        },
        async (a) => safe(() => geocode(a)),
      );

      server.tool(
        "compute_route",
        "Маршрут между точками с учётом пробок: расстояние, время, платные дороги, по желанию — пошаговые инструкции.",
        {
          origin: place,
          destination: place,
          via: z.array(z.string()).max(10).optional(),
          mode: z.enum(["DRIVE", "WALK", "BICYCLE", "TRANSIT", "TWO_WHEELER"]).optional(),
          avoidTolls: z.boolean().optional(),
          avoidHighways: z.boolean().optional(),
          withSteps: z.boolean().optional(),
          language: lang,
        },
        async (a) => safe(() => computeRoute(a)),
      );

      server.tool(
        "plan_ev_trip",
        `Планирует поездку на электромобиле с остановками на зарядку. По умолчанию машина пользователя: ${INSTER_49.name} (${INSTER_49.usableKwh} кВт·ч полезных, DC до ${INSTER_49.maxDcKw} кВт, CCS2). Нужен текущий заряд в %. Возвращает остановки: где, на каком км, с каким зарядом приедешь, до скольки заряжать, сколько минут, есть ли свободные порты. Если пользователь говорит о холоде, высокой скорости или горах, увеличь consumption (20–22).`,
        {
          origin: place,
          destination: place,
          startPct: z.number().min(1).max(100).describe("Текущий заряд батареи, %"),
          arrivalMinPct: z.number().min(5).max(50).optional().describe("Минимальный заряд при прибытии к зарядке и в пункт назначения, по умолчанию 15"),
          chargeToPct: z.number().min(50).max(100).optional().describe("До скольки заряжать максимум, по умолчанию 80"),
          consumption: z.number().min(10).max(35).optional().describe("Расход, кВт·ч/100 км. По умолчанию 17.5 (трасса)"),
          usableKwh: z.number().optional(),
          maxDcKw: z.number().optional(),
          minChargerKw: z.number().optional().describe("Минимальная мощность станции, по умолчанию 50"),
          connector,
          maxDetourKm: z.number().max(20).optional().describe("Максимальный съезд с маршрута, км (по умолчанию 3)"),
        },
        async (a) => safe(() => planEvTrip(a)),
      );

      server.tool(
        "chargers_along_route",
        "Список зарядных станций вдоль маршрута, по порядку следования: км от старта, съезд в км, мощность, число разъёмов, свободно сейчас (Google и EVlibre, если подключён).",
        {
          origin: place,
          destination: place,
          minKw: z.number().optional().describe("Минимальная мощность, кВт (по умолчанию 50)"),
          connector,
          maxDetourKm: z.number().max(20).optional(),
          limit: z.number().int().min(1).max(40).optional(),
        },
        async ({ limit, ...a }) =>
          safe(async () => {
            const r = await chargersAlongRoute(a);
            return { ...r, chargers: r.chargers.slice(0, limit ?? 20) };
          }),
      );

      server.tool(
        "charger_live_status",
        "Живой статус портов зарядки Iberdrola рядом с точкой через EVlibre (Испания): сколько свободно прямо сейчас. stale=true — Iberdrola не ответила, показан старый снимок от observedAt.",
        { lat: z.number(), lng: z.number(), radiusM: z.number().max(2000).optional() },
        async ({ lat, lng, radiusM }) =>
          safe(async () => {
            if (!process.env.EVLIBRE_SUPABASE_URL) return { error: "EVlibre не подключён на сервере" };
            return evlibreStatusNear([{ lat, lng }], radiusM ?? 300);
          }),
      );
    },
    { serverInfo: { name: "gmaps-mcp", version: "1.0.0" } },
    { basePath: `/${token}`, maxDuration: 60, verboseLogs: false },
  );
}

function tokenOk(token: string) {
  const secret = process.env.MCP_SECRET ?? "";
  if (secret.length < 24) return false; // не пускаем без нормального секрета
  const a = Buffer.from(token), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Ctx = { params: Promise<{ token: string; transport: string }> };

async function handle(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  if (!tokenOk(token)) return new Response("Not found", { status: 404 });
  return buildHandler(token)(req);
}

export { handle as GET, handle as POST, handle as DELETE };
