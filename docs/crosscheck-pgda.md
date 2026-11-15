# Cross-check against NASA's published illumination maps (issue #1)

Made by `app/python/scripts/crosscheck_pgda.py` (the website shows the same numbers from
`app/public/data/crosscheck.json`). Our one-year numbers (2026-27, terrain from LOLA, positions
from JPL Horizons) against NASA GSFC's average Sun and Earth visibility maps (Mazarico et al. 2011,
LOLA, 60 m/pixel, 18.6-year average): https://pgda.gsfc.nasa.gov/products/69

Both sides count the Sun (or Earth) as visible when any part of its disc shows. NASA's column
gives the value at the site and, in brackets, the lowest and highest within about 60 m.

| Site | Pole | Sun: ours | Sun: NASA | | Earth: ours | Earth: NASA | |
|---|---|---|---|---|---|---|---|
| Shackleton rim (model site) | south | 84% | 78% (6–85) | agrees within 60 m | 54% | 53% (29–55) | agrees |
| Shackleton | south | 0% | 0% (0–0) | agrees | 0% | 0% (0–0) | agrees |
| de Gerlache | south | 0% | 0% (0–0) | agrees | 0% | 0% (0–0) | agrees |
| Haworth | south | 0% | 0% (0–0) | agrees | 0% | 0% (0–0) | agrees |
| Nobile | south | 37% | 35% (35–35) | agrees | 26% | 28% (28–28) | agrees |
| Mons Mouton | south | 49% | 46% (44–49) | agrees | 100% | 100% (100–100) | agrees |
| Cabeus | south | 0% | 0% (0–0) | agrees | 0% | 0% (0–1) | agrees |
| Peary | north | 21% | 10% (0–26) | agrees within 60 m | 50% | 40% (0–49) | agrees within 60 m |
| Hermite | north | 18% | 9% (2–29) | agrees within 60 m | 27% | 18% (0–39) | agrees within 60 m |
| Whipple | north | 0% | 0% (0–0) | agrees | 0% | 0% (0–0) | agrees |
| Rozhdestvenskiy | north | 17% | 27% (24–28) | DIFFERS | 0% | 0% (0–0) | agrees |
| Byrd | north | 21% | 16% (7–28) | agrees | 61% | 56% (49–63) | agrees within 60 m |
| IM-2 Athena landing site | south | 47% | 46% (40–47) | agrees | 94% | 92% (80–93) | agrees |

Sites compared: 13 (every curated site inside 85-90 deg at either pole).
Sun, ours minus NASA: mean +2.1 points (mean size 3.7).
Earth, ours minus NASA: mean +2.0 points (mean size 2.4).

Expected differences: one year against 18.6 years, our terrain (20-40 m south, about 237 m for the
whole-Moon map used at the north pole) against their 60 m, and ridge-top sites where the value
changes fast within one 60 m pixel (see the bracketed range).

Not in NASA's 85-90 deg maps: Malapert (outside the square map) and all non-polar sites.

## Around the model site (Shackleton rim (model site))

NASA's Sun percentage in a 5 x 5 block of 60 m pixels, the site in the middle (bold):

|   |   |   |   |   |
|---|---|---|---|---|
| 68 | 67 | 85 | 54 | 45 |
| 68 | 43 | 68 | 44 | 47 |
| 0 | 6 | **85** | 51 | 49 |
| 47 | 56 | 80 | 54 | 50 |
| 67 | 62 | 73 | 52 | 44 |
