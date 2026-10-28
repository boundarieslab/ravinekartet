Ravinekartet

An open atlas of the clay ravines (leirraviner) of the Oslo region: where they
are, what has happened to them, and what shapes them today. A project of the
Laboratory for Urban Boundaries, built from the archive gathered through the
ravine walks (ravinevandringer) and from public map data.

This repository is the map. It is published with GitHub Pages and embedded in
the project's Cargo site, the same way the Dirty Business map
(`boundarieslab/db_mp`) sits inside dirtybusiness.no.

**Status: version 0, the base.** The public reference layers are in place and
LUB's own record layer exists but is empty. The data model, the archive and the
stories come next.

## How it fits together

```
public WMS services (NGU, NVE, Miljødirektoratet, Kartverket) ──┐
                                                                 ├──> index.html ──> GitHub Pages ──> Cargo page (iframe)
data/ravines.geojson  (LUB's own records, exported from QGIS) ──┘
```

Everything is one file, as in db_mp. `index.html` carries the markup, the CSS
and the application. Only MapLibre GL JS 4.7.1 is loaded from a CDN, and Inter
from Google Fonts. There is no build step: edit, commit, push, and Pages
publishes it.

## Embedding in Cargo

Same pattern as the Dirty Business map page: a full-screen block in the Cargo
page's HTML, holding the iframe.

```html
<div class="fullscreen-map">
  <iframe src="https://boundarieslab.github.io/<repo>/?top=48" allow="fullscreen; geolocation" title="Ravinekartet"></iframe>
</div>
```

and in the Cargo site's custom CSS:

```css
.fullscreen-map{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:1!important;margin:0!important;padding:0!important}
.fullscreen-map iframe{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:none!important;display:block!important}
```

`?top=` is the height of the Cargo header in pixels. The map runs full-bleed
underneath it, and only the panels keep clear of it, so nothing of the map's
interface hides behind the site's menu. Change the number if the header changes;
the map needs no rebuild.

The map position is kept in the URL (`#v=zoom/lat/lon/bearing/pitch`), so a view
can be linked to.

## The layers

Every reference layer is drawn live by the public service that owns it, asked
for in 512px Web Mercator tiles. All of them answer cross-origin (checked
28 October 2026). Several only draw inside a scale range; the panel says
"zoom in" when the map is too far out for a layer.

| Group | Layer | Service | WMS layer(s) | Draws from |
|---|---|---|---|---|
| Ravines | Clay ravines | NGU `LandformerWMS` | `Landformlinjer_leirravine` | all zooms |
| Ravines | Clay landslide scars | NGU `LandformerWMS` | `Landformlinjer_leirskredgrop` | all zooms |
| Ravines | Area mapped for ravines | NGU `LandformerWMS` | `Dekning_leirravine` | all zooms |
| Ground | Marine limit | NGU `MarinGrenseWMS4` | `Marin_grense_linjer` | 1:150 000 (z 10.9) |
| Ground | Possible marine clay | NGU `MarinGrenseWMS4` | `Mulig_marin_leire` | 1:150 000 (z 10.9) |
| Ground | Superficial deposits | NGU `LosmasserWMS2` | `Losmasseflate_N1000`, `Losmasse_flate` | N1000 out, detailed in |
| Nature | Habitat types (DN handbook 13) | Miljødirektoratet `naturtyper_hb13` | `naturtyper_hb13_alle` | 1:1.2 M (z 7.9) |
| Nature | Habitat types (NiN) | Miljødirektoratet `naturtyper_nin` | `naturtyper_nin_alle` | 1:1.2 M (z 7.9) |
| Landslides | Quick clay hazard zones | NVE `SkredKvikkleire2` | `KvikkleireKartlagtOmrade`, `KvikkleireFaregrad` | mapped areas out, hazard degree in |
| LUB | Our records | this repo | `data/ravines.geojson` | all zooms |

Background: Kartverket `topograatone` (map), Esri World Imagery (aerial), and
relief shaded from the national 10 m model with Kartverket's 1 m shading from
zoom 12.

Clicking the map asks each visible layer what lies at that point
(`GetFeatureInfo`). The services answer in HTML, which is shown in a sandboxed
frame, so their markup never runs in the page.

To add a layer, add one entry to `OVERLAYS` in `index.html` (and a service to
`WMS` if it is new). Order in the array is order on the map, bottom first.

### Licences and credit

NGU and Miljødirektoratet data are under the Norwegian Licence for Open
Government Data (NLOD); the attribution line on the map credits each service
that is switched on. NVE and Kartverket are credited the same way.

## LUB's own records

`data/ravines.geojson` is exported from the project GeoPackage, which lives
outside the repository (it is ignored by git). Coordinates in WGS84, as GeoJSON
requires; the master data stays in EUREF89 UTM 33N (EPSG:25833).

Draft fields for a ravine record, to be settled in the data-model phase:

| Field | Meaning |
|---|---|
| `ravine_id` | permanent ID, e.g. `RK-LIL-0001` |
| `name` | the name used locally, if any |
| `name_official` | the name in NGU / Naturbase, if any |
| `municipality` | |
| `status` | `intact` / `partly_filled` / `filled_built` / `piped` / `lost` |
| `ngu_ref` | link to the NGU landform, where one exists |
| `walks` | the walks that visited it |
| `sources` | IDs of sources in the archive |

Changes, sources, stories and walks will be separate tables joined by
`ravine_id`.

## Testing

```
python3 -m http.server 8902 --bind 127.0.0.1      # from the repo root
npm install --no-save maplibre-gl@4.7.1 playwright
node tools/smoke_test.js
```

Every tile service, the CDN and the fonts are stubbed, so the test never depends
on NGU, NVE or Kartverket being up. It checks the panel, the switches, the
language and background switches, the point query, the `?top=` offset, and that
the page never scrolls sideways at 1440 and 390 px. Screenshots go to
`outputs/`.
