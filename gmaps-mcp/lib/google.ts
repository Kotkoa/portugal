// Тонкий клиент к Google Maps Platform. Ключ берётся только из переменной окружения.
import { parseLatLng } from "./geo";

export const KEY = () => {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new Error("GOOGLE_MAPS_API_KEY is not set on the server");
  return k;
};

type LatLng = { lat: number; lng: number };

export async function call(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error?.message ?? text.slice(0, 300);
    throw new Error(`Google API ${res.status}: ${msg}`);
  }
  if (data?.status && !["OK", "ZERO_RESULTS"].includes(data.status)) {
    throw new Error(`Google API ${data.status}: ${data.error_message ?? ""}`);
  }
  return data;
}

export function placesHeaders(fieldMask: string) {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": KEY(),
    "X-Goog-FieldMask": fieldMask,
  };
}

const PLACE_FIELDS = [
  "id", "displayName", "formattedAddress", "location", "rating",
  "userRatingCount", "primaryTypeDisplayName", "currentOpeningHours.openNow",
  "googleMapsUri", "priceLevel",
];

function slimPlace(p: any) {
  return {
    id: p.id,
    name: p.displayName?.text,
    type: p.primaryTypeDisplayName?.text,
    address: p.formattedAddress,
    location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined,
    rating: p.rating,
    reviews: p.userRatingCount,
    openNow: p.currentOpeningHours?.openNow,
    priceLevel: p.priceLevel,
    mapsUrl: p.googleMapsUri,
  };
}

function circle(center: LatLng, radius: number) {
  return { circle: { center: { latitude: center.lat, longitude: center.lng }, radius } };
}

export async function searchPlaces(a: {
  query: string; near?: LatLng; radius?: number; openNow?: boolean;
  minRating?: number; max?: number; language?: string;
}) {
  const body: any = {
    textQuery: a.query,
    languageCode: a.language ?? "ru",
    pageSize: a.max ?? 5,
  };
  if (a.near) body.locationBias = circle(a.near, a.radius ?? 5000);
  if (a.openNow) body.openNow = true;
  if (a.minRating) body.minRating = a.minRating;
  const data = await call("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: placesHeaders(PLACE_FIELDS.map((f) => `places.${f}`).join(",")),
    body: JSON.stringify(body),
  });
  return (data.places ?? []).map(slimPlace);
}

export async function searchNearby(a: {
  center: LatLng; types: string[]; radius?: number; max?: number; language?: string;
}) {
  const data = await call("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: placesHeaders(PLACE_FIELDS.map((f) => `places.${f}`).join(",")),
    body: JSON.stringify({
      includedTypes: a.types,
      maxResultCount: a.max ?? 5,
      rankPreference: "DISTANCE",
      languageCode: a.language ?? "ru",
      locationRestriction: circle(a.center, a.radius ?? 2000),
    }),
  });
  return (data.places ?? []).map(slimPlace);
}

export async function placeDetails(id: string, language = "ru") {
  const fields = [
    ...PLACE_FIELDS, "nationalPhoneNumber", "websiteUri",
    "regularOpeningHours.weekdayDescriptions", "editorialSummary",
  ];
  const p = await call(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=${language}`,
    { headers: placesHeaders(fields.join(",")) },
  );
  return {
    ...slimPlace(p),
    phone: p.nationalPhoneNumber,
    website: p.websiteUri,
    hours: p.regularOpeningHours?.weekdayDescriptions,
    summary: p.editorialSummary?.text,
  };
}

export async function geocode(a: { address?: string; lat?: number; lng?: number; language?: string }) {
  const q = new URLSearchParams({ key: KEY(), language: a.language ?? "ru" });
  if (a.address) q.set("address", a.address);
  else if (a.lat !== undefined && a.lng !== undefined) q.set("latlng", `${a.lat},${a.lng}`);
  else throw new Error("Give either address or lat+lng");
  const data = await call(`https://maps.googleapis.com/maps/api/geocode/json?${q}`);
  return (data.results ?? []).slice(0, 3).map((r: any) => ({
    address: r.formatted_address,
    location: r.geometry?.location,
    placeId: r.place_id,
    types: r.types,
  }));
}

/** Адрес, название места или "lat,lng" → waypoint Routes API. */
export function waypoint(s: string) {
  const p = parseLatLng(s);
  return p ? { location: { latLng: { latitude: p.lat, longitude: p.lng } } } : { address: s };
}

/** Геометрия маршрута для поиска вдоль него. */
export async function routeGeometry(origin: string, destination: string, via: string[] = []) {
  const body: any = {
    origin: waypoint(origin),
    destination: waypoint(destination),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    polylineQuality: "OVERVIEW",
  };
  if (via.length) body.intermediates = via.map(waypoint);
  const data = await call("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY(),
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify(body),
  });
  const r = data.routes?.[0];
  if (!r) throw new Error("Маршрут не найден");
  return {
    distanceKm: (r.distanceMeters ?? 0) / 1000,
    durationSec: parseInt(r.duration ?? "0", 10),
    polyline: r.polyline.encodedPolyline as string,
  };
}

export const fmtDuration = (s?: string) => {
  const sec = parseInt(s ?? "0", 10);
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
};

export async function computeRoute(a: {
  origin: string; destination: string; via?: string[];
  mode?: "DRIVE" | "WALK" | "BICYCLE" | "TRANSIT" | "TWO_WHEELER";
  avoidTolls?: boolean; avoidHighways?: boolean; withSteps?: boolean; language?: string;
}) {
  const mode = a.mode ?? "DRIVE";
  const body: any = {
    origin: waypoint(a.origin),
    destination: waypoint(a.destination),
    travelMode: mode,
    languageCode: a.language ?? "ru",
    units: "METRIC",
    computeAlternativeRoutes: false,
  };
  if (a.via?.length) body.intermediates = a.via.map(waypoint);
  if (mode === "DRIVE" || mode === "TWO_WHEELER") {
    body.routingPreference = "TRAFFIC_AWARE";
    body.routeModifiers = { avoidTolls: !!a.avoidTolls, avoidHighways: !!a.avoidHighways };
  }
  const mask = [
    "routes.duration", "routes.staticDuration", "routes.distanceMeters",
    "routes.description", "routes.warnings", "routes.travelAdvisory.tollInfo",
    "routes.legs.steps.navigationInstruction", "routes.legs.steps.distanceMeters",
  ].join(",");
  const data = await call("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": mask },
    body: JSON.stringify(body),
  });
  const r = data.routes?.[0];
  if (!r) return { found: false };
  const steps = a.withSteps
    ? r.legs.flatMap((l: any) => l.steps ?? [])
        .map((s: any) => s.navigationInstruction?.instructions)
        .filter(Boolean).slice(0, 40)
    : undefined;
  return {
    found: true,
    distanceKm: Math.round((r.distanceMeters ?? 0) / 100) / 10,
    durationWithTraffic: fmtDuration(r.duration),
    durationNoTraffic: fmtDuration(r.staticDuration),
    via: r.description,
    hasTolls: !!r.travelAdvisory?.tollInfo,
    warnings: r.warnings,
    steps,
  };
}
