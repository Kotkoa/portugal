# Return Route Plan: Leiria → Pego (single day, highway via Madrid M-50)

## Date & departure
- **2026-04-14, departure 06:00** from Leiria
- Single day, no overnight
- Arrival Pego **~21:30** (sunset 20:35 — last ~1 h in dark through Alcoy mountain pass)

## Goal
Minimum-time highway corridor **through Madrid** (M-50 south ring). All edge-range legs are **split** with a planned mid-stop — no "it should make it" risks. Final leg via Alcoy (user choice).

## Key charging facts
- Inster real-world DC **~80 kW** on 80 kW+ stations, 50 kW on Iberdrola 50 kW stations.
- **User has 20% loyalty discount at Iberdrola / bp pulse** → 4 of 7 planned stops are Iberdrola ★.
- Range: ~240 km from 100 %, ~200 km from a mid-trip 10→85 % top-up.

## Edge-range legs and their splits (safety principle)

| Leg | Nominal distance | Status | Mitigation |
|---|---|---|---|
| Leiria → Badajoz | 284 km | **Over 100 % range** | Split: Abrantes Moeve top-up (97 km) then Badajoz Iberdrola (284 km) |
| Oropesa → Fuenlabrada | 180 km | Near limit | Fallback: Talavera de la Reina (48 km before Fuenlabrada) |
| Fuenlabrada → Motilla | 182 km | Near limit | Fallback: Tarancón (85 km after Fuenlabrada on A-3) |
| Albacete → Pego | 201 km on 95 % | **On the edge** | Fallback: Iberdrola Villena (125 km after Albacete) |

Non-edge legs are explicitly noted in the Timing table so the driver can go 120 km/h freely.

## Corridor

Leiria → A23 → **Abrantes top-up** → A6 → border → Elvas → **A-5 Badajoz** → Mérida → Trujillo → Navalmoral → Oropesa → Talavera → **Madrid M-50 south ring** → **A-3 east** → Tarancón → Motilla → **A-31 south** → Albacete → Almansa → Villena → **A-35 Alcoy** → CV-60 → Pego

Total: **~1250 km**.

---

## 7 charging stops

### Stop 1 — Abrantes Moeve A23 (top-up)
- **Station:** Moeve, A23 service area, 4.7★
- **Coords:** 39.485, −8.155
- **km cum:** 97
- **Action:** 60→90 % (~20 min quick top-up)
- **Why a top-up here:** splits the otherwise impossible Leiria→Badajoz 284 km leg. Adds ~10 min vs. skipping but removes all range risk.
- **Fallback:** Moeve on opposite side of A23 (39.486, −8.159).

### Stop 2 — Badajoz Iberdrola ★
- **Station:** Iberdrola BA-Badajoz-005, 50 kW, 24/7
- **Coords:** 38.875, −6.953
- **km cum:** 284 (leg 2 = 187 km from Abrantes)
- **Action:** 10→100 % (~40 min — full charge for 155 km next leg + reserve)
- **Discount:** ★ −20 % Iberdrola loyalty
- **Fallback:** Repsol MOBI.E Elvas (38.8835, −7.0493) or IONITY Mérida (38.9340, −6.3433).

### Stop 3 — Trujillo (verify on trip day)
- **Station:** verify in Electromaps/ABRP — Trujillo has a service area with Endesa or Iberdrola expected
- **km cum:** 439 (leg 3 = 155 km from Badajoz)
- **Action:** 15→90 % (~30 min)
- **Fallback:** Navalmoral de la Mata (+70 km on A-5).

### Stop 4 — Oropesa Iberdrola bp pulse ★ (LUNCH)
- **Station:** Iberdrola bp pulse, E.S. Oropesa-Saras, 150 kW (Inster ~80 kW)
- **km cum:** 602 (leg 4 = 163 km from Trujillo)
- **Action:** 5→90 % + lunch (~40 min total stop)
- **Discount:** ★ −20 %
- **Why lunch here:** midpoint of trip, service area with café and toilets.
- **Fallback:** Talavera de la Reina (+50 km).

### Stop 5 — Fuenlabrada Iberdrola bp pulse ★ (Madrid M-50)
- **Station:** Iberdrola bp pulse, C/ de Legalés 62, 28940 Fuenlabrada, 150 kW
- **km cum:** 782 (leg 5 = 180 km from Oropesa)
- **Action:** 5→90 % (~30 min)
- **Discount:** ★ −20 %
- **Route note:** on Madrid M-50 south ring, bypasses city center entirely
- **Fallback (before Madrid):** Talavera de la Reina at ~650 km — use if Fuenlabrada offline, to avoid reaching the city with low SoC.
- **Second fallback:** Iberdrola bp pulse Móstoles Xanadu (same operator, nearby).

### Stop 6 — Motilla del Palancar Zunder
- **Station:** Zunder ultra-fast, up to 360 kW (Inster ~80 kW)
- **Coords:** ~39.56, −1.88 (verify on trip day)
- **km cum:** 964 (leg 6 = 182 km from Fuenlabrada)
- **Action:** 5→90 % (~30 min)
- **Discount:** none
- **Fallback mid-leg:** Tarancón (~85 km after Fuenlabrada on A-3) — use if Motilla inaccessible.

### Stop 7 — Albacete Iberdrola ★
- **Station:** Iberdrola, C. Federico García Lorca 1, 50 kW, 4.6★
- **Coords:** 39.0009, −1.8496
- **km cum:** 1049 (leg 7 = 85 km from Motilla — deliberately short)
- **Action:** 15→**95 %** (~45 min extended slow taper)
- **Discount:** ★ −20 %
- **Why short leg:** from Motilla on a full charge, max reachable is ~1204 km — 45 km short of Pego. Albacete top-up is required.
- **Why 95 %:** final leg 201 km needs ~38 kWh + buffer for Alcoy mountain climb.
- **Fallback:** Zunder Av. Sexta Norte (39.0296, −1.8881) or Powerdot Imaginalia.

### Final leg — Albacete → Pego via Alcoy
- **Distance:** ~201 km
- **Route:** A-31 → A-35 Almansa → Villena → A-35 → **Alcoy** → CV-60 → Cocentaina → Muro de Alcoy → Gandia direction → CV-715 → Pego
- **Time:** ~1 h 50 m (first 125 km highway to Villena in dusk/light; last 75 km through Alcoy mountain pass in dark)
- **🛡️ Fallback-charge (insurance only):** **Iberdrola Villena** (Ayuntamiento de Villena, ~125 km from Albacete, ~1174 km cum). Use only if SoC at Villena drops below 30 % (unexpected wind/headwind/traffic cost). 15-min top-up guarantees safe crossing of Alcoy mountain climb. ★ Iberdrola discount applies.
- **Why Alcoy route (not coastal A-7):** user preference, shorter (~30 km saved vs. Alicante detour).

---

## Timing (06:00 departure)

| Leg | Distance | Drive | Arrive | Charge | Depart |
|---|---|---|---|---|---|
| 1. Leiria → Abrantes | 97 km | 55 m | 06:55 | 20 min (top-up) | 07:15 |
| 2. Abrantes → Badajoz | 187 km | 1 h 50 m | 09:05 | 40 min (full) | 09:45 |
| 3. Badajoz → Trujillo | 155 km | 1 h 30 m | 11:15 | 30 min | 11:45 |
| 4. Trujillo → Oropesa | 163 km | 1 h 25 m | 13:10 | 40 min (lunch) | 13:50 |
| 5. Oropesa → Fuenlabrada (M-50) | 180 km | 1 h 45 m | 15:35 | 30 min | 16:05 |
| 6. Fuenlabrada → Motilla | 182 km | 1 h 35 m | 17:40 | 30 min | 18:10 |
| 7. Motilla → Albacete | 85 km | 45 m | 18:55 | 45 min | 19:40 |
| 8. Albacete → Pego (via Alcoy) | 201 km | 1 h 50 m | **~21:30** | — | — |

**Totals:** ~11 h 35 m driving + ~3 h 55 m charging = **~15 h 30 m wall-clock**

---

## Waypoints (for Google Maps / KML)

1. Leiria home — 39.7437, −8.8071
2. Abrantes Moeve A23 — 39.485, −8.155
3. Badajoz Iberdrola ★ — 38.875, −6.953
4. Trujillo (verify) — ~39.46, −5.88
5. Oropesa Iberdrola ★ — ~39.92, −5.18
6. Fuenlabrada Iberdrola ★ — ~40.28, −3.80
7. Motilla Zunder — ~39.56, −1.88
8. Albacete Iberdrola ★ — 39.0009, −1.8496
9. Villena Iberdrola (fallback only) — ~38.64, −0.86
10. Pego home — 38.8375, −0.1167

## Comparison with rejected alternatives

| Plan | Distance | Stops | Days | Notes |
|---|---|---|---|---|
| **This: highway via Madrid, split edge legs** | 1250 km | 7 | 1 | All-highway, safe margins, 4 Iberdrola stops ★ |
| Highway via Madrid, 6 stops (Estremoz IONITY) | 1250 km | 6 | 1 | Rejected — leg 1 was on the edge of range |
| N-430 2-day with overnight Mérida | 990 km | 5 | 2 | Rejected — mountain route, user wants highway |

**Trade-off accepted:** +1 stop vs. the earlier 6-stop version, but zero range anxiety and Iberdrola discount applies to 4 of 7 stops (vs. 3 of 6 in the Estremoz plan).

---

## Verification (D-1 priority list)

1. **Abrantes Moeve A23** — confirm CCS2, which app (Miio? Moeve own?)
2. **Badajoz Iberdrola BA-005** — confirm in Iberdrola app, 20% discount applies
3. **Trujillo** — find and commit to a specific station (research gap)
4. **Oropesa Iberdrola bp pulse** — confirm E.S. Oropesa-Saras location
5. **Fuenlabrada Iberdrola bp pulse** — confirm C/ de Legalés 62 address and availability
6. **Motilla del Palancar Zunder** — confirm exact coordinates on A-3/A-31 junction
7. **Albacete Iberdrola García Lorca** — confirm 24/7 and connector type
8. **Villena Iberdrola (fallback)** — confirm Ayuntamiento de Villena station for emergency final-leg top-up
9. **ABRP run:** Inster 50 kWh, 115 km/h avg highway, arrival 10 %, verify the 7-stop sequence matches
10. **Offline maps:** download Madrid M-50 area + Alcoy mountain pass (CV-60 has weak signal in places)
