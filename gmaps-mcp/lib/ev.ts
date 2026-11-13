// Зарядки вдоль маршрута + планировщик поездки на электромобиле.
import { call, placesHeaders, routeGeometry, computeRoute } from "./google";
import { z } from "zod";
import { Pt, chunks, cumulative, decodePolyline, encodePolyline, project } from "./geo";

/** Профиль по умолчанию: Hyundai Inster Long Range 49 kWh (2025). */
export const INSTER_49 = {
  name: "Hyundai Inster 49 kWh",
  usableKwh: 46.8,        // полезная ёмкость (номинал 49)
  consumption: 17.5,      // кВт·ч/100 км: трасса 110–120 км/ч, мягкий климат. WLTP ≈ 15
  maxDcKw: 85,            // пик DC, CCS2
  avgDcFactor: 0.82,      // средняя мощность 10→80% ≈ 70 кВт на быстрых станциях
  connector: "CCS2" as Connector,
};

export type Connector = "CCS2" | "TYPE2" | "CHADEMO";
const CONNECTOR_ENUM: Record<Connector, string> = {
  CCS2: "EV_CONNECTOR_TYPE_CCS_COMBO_2",
  TYPE2: "EV_CONNECTOR_TYPE_TYPE_2",
  CHADEMO: "EV_CONNECTOR_TYPE_CHADEMO",
};

export type Charger = {
  id: string; name: string; address?: string; location: Pt; mapsUrl?: string; rating?: number;
  maxKw?: number; connectors?: number; available?: number; availabilityUpdated?: string;
  alongKm: number; detourKm: number;
  live?: { free: number; total: number; updatedAt?: string; source: "evlibre" };
};

// ---------- Поиск зарядок вдоль маршрута (Places API New: searchAlongRoute) ----------

async function searchSegment(poly: string, minKw: number, connector: Connector) {
  const mask = [
    "places.id", "places.displayName", "places.formattedAddress", "places.location",
    "places.googleMapsUri", "places.rating", "places.evChargeOptions",
  ].join(",");
  const data = await call("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: placesHeaders(mask),
    body: JSON.stringify({
      textQuery: "EV charging station",
      includedType: "electric_vehicle_charging_station",
      strictTypeFiltering: true,
      pageSize: 20,
      languageCode: "es",
      evOptions: { minimumChargingRateKw: minKw, connectorTypes: [CONNECTOR_ENUM[connector]] },
      searchAlongRouteParameters: { polyline: { encodedPolyline: poly } },
    }),
  });
  return data.places ?? [];
}

export async function chargersAlongRoute(a: {
  origin: string; destination: string; via?: string[];
  minKw?: number; connector?: Connector; maxDetourKm?: number; chunkKm?: number;
}) {
  const geo = await routeGeometry(a.origin, a.destination, a.via);
  const pts = decodePolyline(geo.polyline);
  const cum = cumulative(pts);
  const scale = cum.at(-1)! > 0 ? geo.distanceKm / cum.at(-1)! : 1; // линия → дорожные км
  const connector = a.connector ?? "CCS2";
  const minKw = a.minKw ?? 50;
  const maxDetour = a.maxDetourKm ?? 3;

  // Длинный маршрут режем на куски: на кусок до 20 результатов, иначе дальние участки «теряются».
  const parts = chunks(pts, cum, a.chunkKm ?? 90).slice(0, 12);
  const results = await Promise.all(parts.map((p) => searchSegment(encodePolyline(p), minKw, connector)));

  const seen = new Set<string>();
  const out: Charger[] = [];
  for (const p of results.flat()) {
    if (!p?.id || seen.has(p.id) || !p.location) continue;
    seen.add(p.id);
    const loc = { lat: p.location.latitude, lng: p.location.longitude };
    const pr = project(loc, pts, cum);
    if (pr.offset > maxDetour) continue;
    const agg: any[] = p.evChargeOptions?.connectorAggregation ?? [];
    const fit = agg.filter((c) => c.type === CONNECTOR_ENUM[connector]);
    const pick = fit.length ? fit : agg;
    const known = pick.filter((c) => typeof c.availableCount === "number");
    out.push({
      id: p.id,
      name: p.displayName?.text ?? "Зарядная станция",
      address: p.formattedAddress,
      location: loc,
      mapsUrl: p.googleMapsUri,
      rating: p.rating,
      maxKw: pick.length ? Math.max(...pick.map((c) => c.maxChargeRateKw ?? 0)) : undefined,
      connectors: pick.reduce((s, c) => s + (c.count ?? 0), 0) || undefined,
      available: known.length ? known.reduce((s, c) => s + c.availableCount, 0) : undefined,
      availabilityUpdated: known[0]?.availabilityLastUpdateTime,
      alongKm: Math.round(pr.along * scale * 10) / 10,
      detourKm: Math.round(pr.offset * 10) / 10,
    });
  }
  out.sort((x, y) => x.alongKm - y.alongKm);
  await attachLiveStatus(out);
  return { route: { distanceKm: Math.round(geo.distanceKm), durationSec: geo.durationSec }, chargers: out };
}

// ---------- Живой статус из EVlibre (опционально, только станции Iberdrola) ----------
// 1) RPC search_stations_nearby находит станцию Iberdrola рядом с точкой (cupr_id).
// 2) Edge-функция poll-station берёт статус портов у Iberdrola (кэш 5 мин).
//    Если Iberdrola не ответила, poll-station отдаёт старый снимок с meta.source_unavailable.

const evlibreOn = () => !!(process.env.EVLIBRE_SUPABASE_URL && process.env.EVLIBRE_SUPABASE_KEY);

/** Сколько станций за один вызов опрашиваем у Iberdrola: не жжём лимит EVlibre. */
const EVLIBRE_MAX_POLLS = 10;

export type EvlibreStatus = {
  idx: number; station: string; ports: string[]; freePorts: number; totalPorts: number;
  powerKw?: number; priceKwh?: number; observedAt: string; stale: boolean;
};

const NearbyRows = z.array(z.object({
  cp_id: z.number(), cupr_id: z.number(), name: z.string().nullable(), address: z.string().nullable(),
}));
const PollResult = z.object({
  data: z.object({
    port1_status: z.string().nullable(), port2_status: z.string().nullable(),
    port1_power_kw: z.number().nullable(), port1_price_kwh: z.number().nullable(),
    observed_at: z.string(),
  }),
  meta: z.object({ source_unavailable: z.boolean() }),
});

async function evlibre(path: string, body: unknown): Promise<unknown> {
  const key = process.env.EVLIBRE_SUPABASE_KEY!;
  const res = await fetch(`${process.env.EVLIBRE_SUPABASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`EVlibre ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function evlibreStatusNear(points: Pt[], radiusM = 150): Promise<EvlibreStatus[]> {
  if (!evlibreOn() || !points.length) return [];
  const nearest = await Promise.all(points.map(async (p, idx) => {
    const rows = NearbyRows.parse(await evlibre("/rest/v1/rpc/search_stations_nearby", {
      p_lat: p.lat, p_lon: p.lng, p_radius_km: radiusM / 1000, p_only_free: false,
    }));
    return rows[0] ? { idx, row: rows[0] } : null; // RPC сортирует по расстоянию
  }));
  const found = nearest.filter((n) => n !== null).slice(0, EVLIBRE_MAX_POLLS);
  // Одна сломанная станция не должна обнулять остальные.
  const polled = await Promise.allSettled(found.map(async ({ idx, row }) => {
    const { data: d, meta } = PollResult.parse(await evlibre("/functions/v1/poll-station", { cupr_id: row.cupr_id }));
    const ports = [d.port1_status, d.port2_status].filter((s) => s !== null);
    return {
      idx,
      station: row.name ?? row.address ?? `Iberdrola ${row.cp_id}`,
      ports,
      freePorts: ports.filter((s) => s === "AVAILABLE").length,
      totalPorts: ports.length,
      powerKw: d.port1_power_kw ?? undefined,
      priceKwh: d.port1_price_kwh ?? undefined,
      observedAt: d.observed_at,
      stale: meta.source_unavailable,
    } satisfies EvlibreStatus;
  }));
  const ok = polled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failed = polled.find((r) => r.status === "rejected");
  if (!ok.length && failed) throw failed.reason;
  return ok;
}

async function attachLiveStatus(list: Charger[]) {
  if (!evlibreOn() || !list.length) return;
  try {
    const rows = await evlibreStatusNear(list.map((c) => c.location));
    for (const r of rows) {
      const c = list[r.idx];
      // Старый снимок для выбора остановки не годится: «занято» трёхдневной давности ничего не значит.
      if (c && !r.stale) c.live = { free: r.freePorts, total: r.totalPorts, updatedAt: r.observedAt, source: "evlibre" };
    }
  } catch {
    // EVlibre недоступен — работаем на данных Google
  }
}

// ---------- Планировщик ----------

export async function planEvTrip(a: {
  origin: string; destination: string; startPct: number;
  arrivalMinPct?: number; chargeToPct?: number;
  usableKwh?: number; consumption?: number; maxDcKw?: number;
  minChargerKw?: number; connector?: Connector; maxDetourKm?: number;
}) {
  const car = {
    usableKwh: a.usableKwh ?? INSTER_49.usableKwh,
    consumption: a.consumption ?? INSTER_49.consumption,
    maxDcKw: a.maxDcKw ?? INSTER_49.maxDcKw,
  };
  const reserve = a.arrivalMinPct ?? 15;
  const chargeTo = a.chargeToPct ?? 80;
  const kmPerPct = car.usableKwh / 100 / car.consumption * 100; // км на 1%
  const pctFor = (km: number) => km / kmPerPct;

  const { route, chargers } = await chargersAlongRoute({
    origin: a.origin, destination: a.destination,
    minKw: a.minChargerKw ?? 50, connector: a.connector ?? INSTER_49.connector, maxDetourKm: a.maxDetourKm,
  });
  const total = route.distanceKm;

  const stops: any[] = [];
  let pos = 0, pct = a.startPct;

  for (let guard = 0; guard < 8; guard++) {
    const reachKm = (pct - reserve) * kmPerPct;
    if (pos + reachKm >= total) break; // доезжаем

    const cands = chargers.filter((c) => c.alongKm > pos + 5 && c.alongKm + 2 * c.detourKm <= pos + reachKm);
    if (!cands.length) {
      return {
        ok: false,
        problem: `Нет подходящей зарядки в пределах ~${Math.round(reachKm)} км от ${pos ? "последней остановки" : "старта"}`,
        hint: "Попробуй minChargerKw: 22, maxDetourKm: 8, или выезжай с бóльшим зарядом",
        stopsSoFar: stops,
      };
    }
    // Оценка: дальше по маршруту — лучше; мощнее (до предела машины) — лучше; крюк и занятость — хуже.
    const score = (c: Charger) => {
      const kw = Math.min(c.maxKw ?? 50, car.maxDcKw);
      let s = c.alongKm + (kw - 50) * 0.6 - c.detourKm * 4;
      const free = c.live?.free ?? c.available;
      if (free === 0) s -= 80;
      else if (free !== undefined && free > 0) s += 15;
      if ((c.connectors ?? 1) >= 4) s += 5; // больше разъёмов — меньше шанс очереди
      return s;
    };
    const best = cands.reduce((b, c) => (score(c) > score(b) ? c : b));

    const arrivePct = pct - pctFor(best.alongKm - pos + best.detourKm);
    const restKm = total - best.alongKm + best.detourKm;
    const needForRest = pctFor(restKm) + reserve + 3;
    const target = Math.min(chargeTo, Math.max(needForRest, arrivePct + 10)); // не заряжаем лишнего
    const kw = Math.min(best.maxKw ?? 50, car.maxDcKw);
    const low = Math.max(0, Math.min(target, 80) - arrivePct);
    const high = Math.max(0, target - Math.max(80, arrivePct));
    const minutes = Math.round(
      ((low / 100) * car.usableKwh) / (kw * INSTER_49.avgDcFactor) * 60 +
      ((high / 100) * car.usableKwh) / (kw * 0.35) * 60 + 3,
    );

    stops.push({
      name: best.name, address: best.address, mapsUrl: best.mapsUrl, location: best.location,
      atKm: best.alongKm, detourKm: best.detourKm,
      arrivePct: Math.round(arrivePct), chargeToPct: Math.round(target), chargeMin: minutes,
      chargerKw: best.maxKw, connectors: best.connectors,
      freeNow: best.live ? `${best.live.free}/${best.live.total} (EVlibre)` :
        best.available !== undefined ? `${best.available}/${best.connectors ?? "?"} (Google)` : "нет данных",
    });
    pos = best.alongKm;
    pct = target - pctFor(best.detourKm);
  }

  const arrivePct = Math.round(pct - pctFor(total - pos));
  const via = stops.map((s) => `${s.location.lat},${s.location.lng}`);
  const drive = await computeRoute({ origin: a.origin, destination: a.destination, via });
  const chargeMinTotal = stops.reduce((s, x) => s + x.chargeMin, 0);

  return {
    ok: true,
    car: `${INSTER_49.name}: ${car.usableKwh} кВт·ч полезных, расход ${car.consumption} кВт·ч/100 км, запас ≈ ${Math.round(100 * kmPerPct)} км на 100%`,
    distanceKm: total,
    driving: drive.found ? (drive as any).durationWithTraffic : undefined,
    chargingMin: chargeMinTotal,
    startPct: a.startPct,
    arrivePct,
    stops,
    note: "Расход оценочный. Холод, ветер, скорость выше 120 и кондиционер увеличивают его. Сверяйся с прогнозом запаса хода в машине.",
  };
}
