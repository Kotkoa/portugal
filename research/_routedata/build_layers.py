#!/usr/bin/env python3
"""Verify POIs from workflow via place-details, dedupe, emit 3 KML layers (RU labels)."""
import subprocess, json, os, sys, html
try:
    import certifi
    CERT = certifi.where()
except Exception:
    CERT = ""

GMAPS = os.path.expanduser("~/.claude/skills/google-maps-api/scripts/gmaps.py")
ENV = {**os.environ}
if CERT:
    ENV["SSL_CERT_FILE"] = CERT

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


def esc(s):
    return html.escape(str(s or ""), quote=False)


def cdata(s):
    return "<![CDATA[" + str(s or "") + "]]>"


# ---- icon styles -------------------------------------------------------------
CHARGE_ICON = {
    "iberdrola": ("ff00ff00", "grn-stars"),   # green star = preferred (20% discount)
    "tesla":     ("ff0000ff", "red-circle"),
    "zunder":    ("ff00aaff", "orange-circle"),
    "ionity":    ("ffff66cc", "purple-circle"),
    "other":     ("ff999999", "wht-circle"),
}
PHOTO_ICON = {
    "mirador":    ("ff00d7ff", "ylw-stars"),
    "castillo":   ("ff0000ff", "red-circle"),
    "monumento":  ("ff0080ff", "orange-stars"),
    "santuario":  ("ffaa55ff", "pink-stars"),
    "naturaleza": ("ff33cc33", "grn-circle"),
    "embalse":    ("ffd0a000", "blu-circle"),
    "bodega":     ("ff3366cc", "wht-circle"),
    "yacimiento": ("ff6699cc", "wht-circle"),
}


def kml_doc(name, desc, styles, placemarks):
    s = "".join(styles)
    p = "".join(placemarks)
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n'
            f'    <name>{esc(name)}</name>\n    <description>{cdata(desc)}</description>\n'
            f'{s}{p}  </Document>\n</kml>\n')


def style(sid, color, icon, scale=1.1):
    return (f'    <Style id="{sid}"><IconStyle><color>{color}</color>'
            f'<scale>{scale}</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/{icon}.png</href></Icon>'
            f'</IconStyle></Style>\n')


def placemark(name, sid, desc, lat, lng):
    return (f'    <Placemark>\n      <name>{esc(name)}</name>\n'
            f'      <styleUrl>#{sid}</styleUrl>\n'
            f'      <description>{cdata(desc)}</description>\n'
            f'      <Point><coordinates>{lng:.6f},{lat:.6f},0</coordinates></Point>\n'
            f'    </Placemark>\n')


def main():
    pois = json.load(open(f"{ROOT}/research/_routedata/pois.json"))
    # flatten
    rows = []
    for blk in pois:
        layer = blk["layer"]
        for pt in blk.get("points", []):
            pt = dict(pt)
            pt["layer"] = layer
            rows.append(pt)

    # dedupe by place_id (first wins), verify
    seen = {}
    order = []
    for r in rows:
        pid = r.get("place_id")
        if not pid or pid in seen:
            continue
        seen[pid] = r
        order.append(pid)

    print(f"unique candidates: {len(order)}  — verifying via place-details...")
    verified = []
    for i, pid in enumerate(order):
        r = seen[pid]
        d = details(pid)
        if not d:
            print(f"  DROP (unverified): {r.get('name_orig')}  [{pid[:20]}]")
            continue
        if d.get("businessStatus") in ("CLOSED_PERMANENTLY",):
            print(f"  DROP (closed): {r.get('name_orig')}")
            continue
        loc = d["location"]
        r["lat"] = loc["latitude"]
        r["lng"] = loc["longitude"]
        r["name_orig"] = d.get("displayName", {}).get("text", r.get("name_orig"))
        r["addr"] = d.get("formattedAddress", "")
        r["maps_uri"] = d.get("googleMapsUri", "")
        verified.append(r)
        if (i + 1) % 10 == 0:
            print(f"  ...{i+1}/{len(order)} checked, {len(verified)} ok")
    print(f"VERIFIED: {len(verified)} / {len(order)}")

    layers = {"charging": [], "lavender": [], "photo": []}
    for r in verified:
        layers[r["layer"]].append(r)

    # ---- CHARGING ----------------------------------------------------------
    styles, pms = [], []
    used = set()
    for net, (color, icon) in CHARGE_ICON.items():
        styles.append(style(f"ch-{net}", color, icon, 1.2))
    for r in sorted(layers["charging"], key=lambda x: -(x.get("reviews") or 0)):
        net = (r.get("network") or "other").strip().lower()
        if "iberdrola" in net: net = "iberdrola"
        elif "tesla" in net: net = "tesla"
        elif "zunder" in net: net = "zunder"
        elif "ionity" in net: net = "ionity"
        else: net = "other"
        rt = f"⭐ {r['rating']} ({r.get('reviews','?')} отз.)\n" if r.get("rating") else ""
        pw = f"⚡ {r['power_kw']}\n" if r.get("power_kw") else ""
        desc = f"{rt}{pw}Сеть: {r.get('network','—')}\n{r.get('desc_ru','')}\n\n📍 {r['name_orig']}\n{r.get('addr','')}"
        pms.append(placemark(f"⚡ {r['name_ru']}", f"ch-{net}", desc, r["lat"], r["lng"]))
    open(f"{ROOT}/charging.kml", "w").write(kml_doc(
        "Зарядные станции — Лавандовая поездка",
        "Зарядки по маршруту (приоритет Iberdrola — 20% скидка; зелёная звезда). Tesla/Zunder/IONITY и прочие DC.",
        styles, pms))
    print(f"charging.kml: {len(pms)} точек")

    # ---- LAVENDER ----------------------------------------------------------
    styles = [
        style("lav-field", "ffcc33cc", "purple-stars", 1.4),
        style("lav-farm", "ffcc33cc", "purple-circle", 1.1),
        style("lav-shop", "ff9966cc", "pink-circle", 1.0),
        style("lav-stay", "ff00ffff", "ltblu-circle", 1.1),
    ]
    pms = []
    def lav_sid(cat):
        c = (cat or "").lower()
        if "tienda" in c or "shop" in c: return "lav-shop"
        if "aloj" in c or "stay" in c or "hotel" in c: return "lav-stay"
        if "farm" in c or "ferma" in c or "granja" in c: return "lav-farm"
        return "lav-field"
    for r in sorted(layers["lavender"], key=lambda x: -(x.get("reviews") or 0)):
        rt = f"⭐ {r['rating']} ({r.get('reviews','?')} отз.)\n" if r.get("rating") else ""
        desc = f"{rt}{r.get('desc_ru','')}\n\n📍 {r['name_orig']}\n{r.get('addr','')}"
        pms.append(placemark(f"💜 {r['name_ru']}", lav_sid(r.get("category")), desc, r["lat"], r["lng"]))
    open(f"{ROOT}/lavender-moratalla.kml", "w").write(kml_doc(
        "Лаванда — Moratalla / Zaén",
        "Лавандовые поля, фермы, дистиллерии и магазины северо-запада Мурсии. Цветение: конец июня — июль.",
        styles, pms))
    print(f"lavender-moratalla.kml: {len(pms)} точек")

    # ---- PHOTO -------------------------------------------------------------
    styles = [style(f"ph-{c}", col, ic, 1.1) for c, (col, ic) in PHOTO_ICON.items()]
    styles.append(style("ph-other", "ff00d7ff", "ylw-blank", 1.0))
    pms = []
    def ph_sid(cat):
        c = (cat or "").lower()
        for key in PHOTO_ICON:
            if key in c: return f"ph-{key}"
        return "ph-other"
    for r in sorted(layers["photo"], key=lambda x: -(x.get("reviews") or 0)):
        rt = f"⭐ {r['rating']} ({r.get('reviews','?')} отз.)\n" if r.get("rating") else ""
        desc = f"{rt}{r.get('desc_ru','')}\n\n📍 {r['name_orig']}\n{r.get('addr','')} · {r.get('near','')}"
        pms.append(placemark(f"📸 {r['name_ru']}", ph_sid(r.get("category")), desc, r["lat"], r["lng"]))
    open(f"{ROOT}/photo-spots-route.kml", "w").write(kml_doc(
        "Фото-точки и достопримечательности — маршрут",
        "Смотровые, замки, святилища, природа и памятники вдоль маршрута. Отсортировано по отзывам.",
        styles, pms))
    print(f"photo-spots-route.kml: {len(pms)} точек")

    json.dump(verified, open(f"{ROOT}/research/_routedata/verified.json", "w"), ensure_ascii=False, indent=1)
    print("done.")


if __name__ == "__main__":
    main()
