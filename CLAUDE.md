# Portugal Road Trip Project

## Trip Overview

- **Date:** Saturday, 2026-04-04 (one way), return later (date TBD)
- **Start/End:** Pego, C/ Sant Pere, 67 (Alicante, Spain)
- **Destination:** Rua da Carregueira 508, Leiria, Portugal
- **Departure:** 6:00 AM
- **Sunrise:** 07:42 | **Sunset:** 20:26

## Travelers

- Driver (user) + wife + child (8 years old)

## Vehicle

- **Car:** Hyundai Inster
- **Battery:** 50 kWh
- **Highway range:** ~240 km
- **Low speed range:** ~450 km
- **Optimal charging interval:** ~150-180 km between stops
- **Charge time per stop:** ~25-30 min

## Route: Southern Scenic (via A-31 → N-430 → A-5 → A23)

- Pego → Oliva → CV-60 → A-7 → A-35 → A-31 → Albacete
- Albacete → A-43 → Manzanares
- Manzanares → N-430 → Sierra de Guadalupe → Herrera del Duque
- Herrera del Duque → EX-116 → Mérida
- Mérida → A-5 → Elvas (Portugal border, UNESCO)
- Elvas → A6 → A23 (direct north) → Abrantes → Leiria

## Charging Stops (ABRP verified, total ~59€)

1. Iberdrola, Albacete — 50kW, 10€
2. Zunder, Manzanares — 180kW, 14€
3. Iberdrola bp pulse, Herrera del Duque — 50kW+, 12€
4. Iberdrola, Badajoz (or IONITY Mérida) — 15€
5. Moeve, Abrantes A23 — fast, 8€

## Project Files

### Navigation
- [ROAD-BOOK.md](ROAD-BOOK.md) — full driver's road book with schedule, cafes, road safety
- [route-links.md](route-links.md) — Google Maps navigation links
- [pego-to-leiria.kml](pego-to-leiria.kml) — main route + charging stops (import to My Maps)

### Photo & Scenic Layers (separate KML imports)
- [photo-spots.kml](photo-spots.kml) — 22 most photographed tourist spots (by Google review count)
- [wave-spots.kml](wave-spots.kml) — 16 wave photography spots on Portuguese coast (100-200km from Leiria)

### Research
- [research/route-plan.md](research/route-plan.md) — detailed itinerary with timestamps
- [research/charging-stations.md](research/charging-stations.md) — all EV chargers researched (50kW+)
- [research/scenic-stops.md](research/scenic-stops.md) — scenic viewpoints database

### Data
- [aBetterRoutePlan.xlsx](aBetterRoutePlan.xlsx) — ABRP planner export (SoC, costs, timing)

## Technical Setup

- Google Maps API key stored in `.env` (not committed to git)
- API used: google-maps-api skill (Geocoding, Routes, Places, Directions)
- Portugal EV charging network: MOBI.E — use Miio app
