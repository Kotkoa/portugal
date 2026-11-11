#!/usr/bin/env python3
"""Build lavender-altiplano.kml: traverse line + village anchors + user satellite pins + verified POIs."""
import subprocess, json, os, html
import certifi
ENV = {**os.environ, "SSL_CERT_FILE": certifi.where()}
GMAPS = os.path.expanduser("~/.claude/skills/google-maps-api/scripts/gmaps.py")
ROOT = "/Users/kotkoa/dev/portugal"


def details(pid):
    try:
        p = subprocess.run(["python3", GMAPS, "place-details", pid],
                           capture_output=True, text=True, env=ENV, timeout=40)
        d = json.loads(p.stdout)
        if "location" in d and d.get("id"):
            return d
    except Exception:
        return None
    return None


def esc(s): return html.escape(str(s or ""), quote=False)
def cdata(s): return "<![CDATA[" + str(s or "") + "]]>"


def style(sid, color, icon, scale=1.1):
    return (f'    <Style id="{sid}"><IconStyle><color>{color}</color><scale>{scale}</scale>'
            f'<Icon><href>http://maps.google.com/mapfiles/kml/paddle/{icon}.png</href></Icon></IconStyle></Style>\n')


def linestyle(sid, color, w):
    return f'    <Style id="{sid}"><LineStyle><color>{color}</color><width>{w}</width></LineStyle></Style>\n'


def pm(name, sid, desc, lat, lng):
    return (f'    <Placemark>\n      <name>{esc(name)}</name>\n      <styleUrl>#{sid}</styleUrl>\n'
            f'      <description>{cdata(desc)}</description>\n'
            f'      <Point><coordinates>{lng:.6f},{lat:.6f},0</coordinates></Point>\n    </Placemark>\n')


PHOTO_ICON = {
    "mirador": ("ff00d7ff", "ylw-stars"), "naturaleza": ("ff33cc33", "grn-circle"),
    "sabinar": ("ff2e8b57", "grn-stars"), "monumento": ("ff0080ff", "orange-stars"),
    "iglesia": ("ffaa55ff", "pink-circle"), "embalse": ("ffd0a000", "blu-circle"),
}


def main():
    # existing place_ids to avoid cross-layer dups
    existing = set()
    try:
        for r in json.load(open(f"{ROOT}/research/_routedata/verified.json")):
            existing.add(r["place_id"])
    except Exception:
        pass

    pois = json.load(open(f"{ROOT}/research/_routedata/altiplano_pois.json"))
    rows = []
    seen = set()
    for blk in pois:
        for pt in blk.get("points", []):
            pid = pt.get("place_id")
            if not pid or pid in seen or pid in existing:
                continue
            seen.add(pid)
            pt = dict(pt); pt["layer"] = blk["layer"]
            rows.append(pt)

    print(f"new unique candidates: {len(rows)} — verifying...")
    verified = []
    for i, r in enumerate(rows):
        d = details(r["place_id"])
        if not d or d.get("businessStatus") == "CLOSED_PERMANENTLY":
            print(f"  DROP: {r.get('name_orig')}")
            continue
        r["lat"] = d["location"]["latitude"]; r["lng"] = d["location"]["longitude"]
        r["name_orig"] = d.get("displayName", {}).get("text", r.get("name_orig"))
        r["addr"] = d.get("formattedAddress", "")
        verified.append(r)
    print(f"VERIFIED: {len(verified)}/{len(rows)}")

    styles = [
        linestyle("trav", "ffaa00aa", 5),
        style("village", "ff1956c8", "orange-blank", 1.3),   # high villages
        style("satpin", "ff0000ff", "red-stars", 1.4),       # user satellite-search coords
        style("lav", "ffcc33cc", "purple-stars", 1.3),
        style("stay", "ff00ffff", "ltblu-circle", 1.1),
    ] + [style(f"ph-{c}", col, ic, 1.1) for c, (col, ic) in PHOTO_ICON.items()] + [
        style("ph-other", "ff00d7ff", "ylw-blank", 1.0),
    ]

    body = []

    # traverse line
    coords = json.load(open(f"{ROOT}/research/_routedata/altiplano_coords.json"))
    cblock = "\n".join(f"          {lng:.5f},{lat:.5f},0" for lng, lat in coords)
    body.append(
        '    <Placemark>\n      <name>🟣 Траверс: Moratalla → деревни (64 км / 1:28)</name>\n'
        '      <description><![CDATA[Горный траверс через высокогорные деревни. Туда-обратно ~128 км, зарядок наверху НЕТ — выезжать из Moratalla заряженным под 95%.]]></description>\n'
        '      <styleUrl>#trav</styleUrl>\n      <LineString><tessellate>1</tessellate><coordinates>\n'
        f'{cblock}\n      </coordinates></LineString>\n    </Placemark>\n')

    # village anchors (geocoded centers)
    villages = [
        ("Кампо-де-Сан-Хуан", "Campo de San Juan — деревня (~1200 м). Опорная точка плато.", 38.17587, -2.10109),
        ("Эль-Сабинар", "El Sabinar — деревня реликтовых можжевельников (sabina). Лавандовое плато вокруг.", 38.20656, -2.15546),
        ("Кампо-де-Бехар", "Campo de Béjar — горный хутор СЗ Моратальи.", 38.17627, -1.98899),
        ("Каньяда-де-ла-Крус", "Cañada de la Cruz — одна из самых высоких деревень Мурсии, виды + лаванда.", 38.03123, -2.27843),
    ]
    for nm, ds, la, lo in villages:
        body.append(pm(f"🏘 {nm}", "village", ds, la, lo))

    # user satellite-search pins
    satpins = [
        ("📷 Спутник: плато Campo de San Juan", "Точка пользователя для поиска лавандовых полей на спутнике (Casa de la Cabeza). Открой спутниковый вид и ищи фиолетовые полосы полей.", 38.18, -2.34),
        ("📷 Спутник: плато El Sabinar", "Точка пользователя для спутникового поиска лаванды (район Bega).", 38.24, -2.30),
        ("📷 Спутник: плато Graya / Cañada", "Точка пользователя у границы с Альбасете (Graya) — искать поля лаванды на спутнике.", 38.27, -2.37),
    ]
    for nm, ds, la, lo in satpins:
        body.append(pm(nm, "satpin", ds, la, lo))

    # POIs — classify by CATEGORY (agents mixed photo cats into lavender layer)
    def classify(cat):
        c = (cat or "").lower()
        if any(k in c for k in ["lavand", "lavender", "destil"]): return ("lav", "💜")
        if any(k in c for k in ["aloj", "hotel", "stay", "lodging", "casa", "camping",
                                 "rural", "refug", "shelter", "cortijo", "caban", "cabañ", "albergue"]):
            return ("stay", "🛏")
        if any(k in c for k in ["mirador", "viewpoint"]): return ("ph-mirador", "📸")
        if "sabin" in c: return ("ph-sabinar", "🌲")
        if any(k in c for k in ["iglesia", "ermita"]): return ("ph-iglesia", "⛪")
        if any(k in c for k in ["monument", "pueblo", "dolmen", "yacim"]): return ("ph-monumento", "🏛")
        if any(k in c for k in ["embalse", "pantano"]): return ("ph-embalse", "💧")
        if any(k in c for k in ["pico", "sierra", "montañ", "macizo"]): return ("ph-mirador", "🏔")
        return ("ph-naturaleza", "🌿")  # nature/fuente/naturaleza
    for r in sorted(verified, key=lambda x: -(x.get("reviews") or 0)):
        rt = f"⭐ {r['rating']} ({r.get('reviews','?')} отз.)\n" if r.get("rating") else ""
        desc = f"{rt}{r.get('desc_ru','')}\n\n📍 {r['name_orig']}\n{r.get('addr','')} · {r.get('near','')}"
        sid, emoji = classify(r.get("category"))
        body.append(pm(f"{emoji} {r['name_ru']}", sid, desc, r["lat"], r["lng"]))

    doc = (f'<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n'
           f'    <name>Лаванда — высокогорные деревни (Altiplano de Moratalla)</name>\n'
           f'    <description>{cdata("Траверс Moratalla → Campo de San Juan → El Sabinar → Cañada de la Cruz. Деревни ~1200-1400 м, лавандовые поля на плато, реликтовые можжевельники. Цветение: июль. Зарядок наверху нет.")}</description>\n'
           + "".join(styles) + "".join(body) + "  </Document>\n</kml>\n")
    open(f"{ROOT}/lavender-altiplano.kml", "w").write(doc)
    print(f"lavender-altiplano.kml: line + {len(villages)} деревень + {len(satpins)} спутниковых + {len(verified)} POI")
    json.dump(verified, open(f"{ROOT}/research/_routedata/altiplano_verified.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
