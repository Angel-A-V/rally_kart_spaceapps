# Independent checks beyond the poles (issue #1)

Made by `app/python/scripts/crosscheck_nonpolar.py`; the website shows the same numbers from
`app/public/data/checks.json`.

## 1. Apollo records: Sun and Earth at each landing, EVA and liftoff

Source: Sun and Earth: Altitudes and Azimuths at the Apollo Landing Sites (Apollo Lunar Surface Journal, NASA), https://www.apollojournals.org/alsj/alsj-EarthSun_AltAz.html (Jim Scotti (values listed) and Paul Fjeld, independently; they agree within 0.5 deg and were spot-checked with JPL Horizons).
Ours: JPL Horizons asked for our site coordinates at the same moments.

| Mission | Events | Our site vs journal coordinate | Largest difference: Sun alt / az, Earth alt / az | |
|---|---|---|---|---|
| Apollo 11 | 4 | 1.62 km | 0.12° / 0.02°, 0.23° / 0.05° | agrees |
| Apollo 12 | 6 | 5.71 km | 0.05° / 0.44°, 0.19° / 0.39° | agrees |
| Apollo 14 | 6 | 1.12 km | 0.02° / 0.03°, 0.13° / 0.19° | agrees |
| Apollo 15 | 10 | 1.59 km | 0.03° / 0.07°, 0.03° / 0.09° | agrees |
| Apollo 16 | 8 | 0.58 km | 0.01° / 0.01°, 0.07° / 0.10° | agrees |
| Apollo 17 | 8 | 2.43 km | 0.05° / 0.06°, 0.26° / 0.10° | agrees |

42 moments; largest difference 0.44°, mean 0.077° (the journal's two calculations differ from each other by up to 0.5°).

## 2. Physics checks

| Site | Check | Rule | Expected | Ours | |
|---|---|---|---|---|---|
| Shackleton rim (model site) | Earth's average altitude | 90° minus the distance from the Earth-facing point (90.2°) | -0.46° | -0.63° | ok |
| Shackleton | Earth's average altitude | 90° minus the distance from the Earth-facing point (90.3°) | -0.51° | -0.68° | ok |
| de Gerlache | Earth's average altitude | 90° minus the distance from the Earth-facing point (90.0°) | -0.27° | -0.44° | ok |
| Haworth | Earth's average altitude | 90° minus the distance from the Earth-facing point (87.2°) | 2.51° | 2.34° | ok |
| Nobile | Earth's average altitude | 90° minus the distance from the Earth-facing point (87.2°) | 2.56° | 2.39° | ok |
| Mons Mouton | Earth's average altitude | 90° minus the distance from the Earth-facing point (85.9°) | 3.82° | 3.65° | ok |
| Malapert | Earth's average altitude | 90° minus the distance from the Earth-facing point (84.9°) | 4.82° | 4.65° | ok |
| Cabeus | Earth's average altitude | 90° minus the distance from the Earth-facing point (86.5°) | 3.26° | 3.09° | ok |
| Peary | Earth's average altitude | 90° minus the distance from the Earth-facing point (88.7°) | 1.03° | 1.2° | ok |
| Hermite | Earth's average altitude | 90° minus the distance from the Earth-facing point (90.1°) | -0.35° | -0.17° | ok |
| Whipple | Earth's average altitude | 90° minus the distance from the Earth-facing point (90.4°) | -0.69° | -0.51° | ok |
| Rozhdestvenskiy | Earth's average altitude | 90° minus the distance from the Earth-facing point (94.2°) | -4.45° | -4.28° | ok |
| Byrd | Earth's average altitude | 90° minus the distance from the Earth-facing point (85.5°) | 4.26° | 4.43° | ok |
| Apollo 11 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (23.5°) | 66.4° | 66.37° | ok |
| Apollo 11 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Apollo 11 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Apollo 11 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (-0.1°) and sunset (1.1°) | 49.72% | 49.96% | ok |
| Apollo 12 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (23.6°) | 66.29° | 66.3° | ok |
| Apollo 12 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Apollo 12 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Apollo 12 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (0.3°) and sunset (-0.1°) | 49.95% | 50.0% | ok |
| Apollo 14 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (17.8°) | 72.1° | 72.1° | ok |
| Apollo 14 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Apollo 14 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Apollo 14 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (6.7°) and sunset (-0.1°) | 48.16% | 48.31% | ok |
| Apollo 15 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (26.3°) | 63.6° | 63.76° | ok |
| Apollo 15 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Apollo 15 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Apollo 15 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (7.5°) and sunset (2.0°) | 47.07% | 46.79% | ok |
| Apollo 16 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (17.9°) | 72.06° | 71.95° | ok |
| Apollo 16 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Apollo 16 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Apollo 16 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (1.3°) and sunset (0.2°) | 49.58% | 49.75% | ok |
| Apollo 17 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (36.2°) | 53.61° | 53.69° | ok |
| Apollo 17 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Apollo 17 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Apollo 17 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (5.3°) and sunset (3.8°) | 47.31% | 47.39% | ok |
| Luna 9 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (64.6°) | 25.19° | 25.24° | ok |
| Luna 9 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Luna 9 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.526 d | ok |
| Luna 9 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (-1.1°) and sunset (8.2°) | 48.01% | 48.0% | ok |
| Surveyor 1 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (43.4°) | 46.43° | 46.45° | ok |
| Surveyor 1 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Surveyor 1 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Surveyor 1 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (0.5°) and sunset (0.1°) | 49.85% | 49.82% | ok |
| Luna 13 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (63.7°) | 26.1° | 26.19° | ok |
| Luna 13 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Luna 13 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.526 d | ok |
| Luna 13 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (0.5°) and sunset (0.3°) | 49.79% | 49.88% | ok |
| Surveyor 3 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (23.6°) | 66.3° | 66.31° | ok |
| Surveyor 3 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Surveyor 3 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Surveyor 3 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (0.5°) and sunset (-0.1°) | 49.9% | 50.07% | ok |
| Surveyor 5 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (23.2°) | 66.66° | 66.64° | ok |
| Surveyor 5 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Surveyor 5 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Surveyor 5 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (-0.2°) and sunset (0.4°) | 49.93% | 50.04% | ok |
| Surveyor 6 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (1.5°) | 88.49° | 88.57° | ok |
| Surveyor 6 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Surveyor 6 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Surveyor 6 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (1.5°) and sunset (0.4°) | 49.47% | 49.47% | ok |
| Surveyor 7 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (42.3°) | 47.54° | 47.37° | ok |
| Surveyor 7 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Surveyor 7 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Surveyor 7 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (1.6°) and sunset (4.8°) | 47.67% | 47.92% | ok |
| Luna 16 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (56.3°) | 33.48° | 33.45° | ok |
| Luna 16 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Luna 16 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Luna 16 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (1.0°) and sunset (-0.2°) | 49.8% | 49.72% | ok |
| Luna 17 / Lunokhod 1 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (50.0°) | 39.82° | 39.98° | ok |
| Luna 17 / Lunokhod 1 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Luna 17 / Lunokhod 1 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Luna 17 / Lunokhod 1 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (1.8°) and sunset (0.5°) | 49.21% | 49.29% | ok |
| Luna 20 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (56.6°) | 33.21° | 33.19° | ok |
| Luna 20 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Luna 20 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Luna 20 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (2.5°) and sunset (10.7°) | 46.3% | 46.37% | ok |
| Luna 21 / Lunokhod 2 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (39.1°) | 50.72° | 50.81° | ok |
| Luna 21 / Lunokhod 2 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Luna 21 / Lunokhod 2 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Luna 21 / Lunokhod 2 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (2.0°) and sunset (1.0°) | 49.06% | 48.84% | ok |
| Luna 24 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (62.9°) | 26.83° | 26.84° | ok |
| Luna 24 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Luna 24 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Luna 24 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (0.7°) and sunset (0.2°) | 49.74% | 49.72% | ok |
| Chang'e 3 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (47.4°) | 42.39° | 42.57° | ok |
| Chang'e 3 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Chang'e 3 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Chang'e 3 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (-0.2°) and sunset (0.3°) | 49.93% | 50.07% | ok |
| Chang'e 4 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (134.5°) | -44.68° | -44.85° | ok |
| Chang'e 4 landing site | Earth visible | far side: never | 0.0% | 0.0% | ok |
| Chang'e 4 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.524 d | ok |
| Chang'e 4 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (1.5°) and sunset (0.4°) | 49.24% | 49.04% | ok |
| Chang'e 5 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (63.2°) | 26.56° | 26.71° | ok |
| Chang'e 5 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Chang'e 5 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.526 d | ok |
| Chang'e 5 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (-0.3°) and sunset (0.6°) | 49.89% | 49.73% | ok |
| Chang'e 6 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (132.2°) | -42.38° | -42.52° | ok |
| Chang'e 6 landing site | Earth visible | far side: never | 0.0% | 0.0% | ok |
| Chang'e 6 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.525 d | ok |
| Chang'e 6 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (0.2°) and sunset (-0.1°) | 49.95% | 49.73% | ok |
| Chandrayaan-3 (Vikram) landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (72.7°) | 17.07° | 16.9° | ok |
| Chandrayaan-3 (Vikram) landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| SLIM landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (28.3°) | 61.54° | 61.42° | ok |
| SLIM landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| SLIM landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| SLIM landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (5.6°) and sunset (2.2°) | 47.75% | 47.92% | ok |
| Blue Ghost Mission 1 landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (63.4°) | 26.37° | 26.4° | ok |
| Blue Ghost Mission 1 landing site | Earth visible | near side: always (Earth never moves more than about 8° in the sky) | 100.0% | 100.0% | ok |
| Blue Ghost Mission 1 landing site | Time between sunrises | one synodic month, 29.53 days | 29.530589 d | 29.529 d | ok |
| Blue Ghost Mission 1 landing site | Sun visible (whole lunar days) | half the time, minus the skyline at sunrise (-0.2°) and sunset (0.2°) | 49.98% | 49.93% | ok |
| IM-2 Athena landing site | Earth's average altitude | 90° minus the distance from the Earth-facing point (85.5°) | 4.29° | 4.11° | ok |

112 of 112 checks pass across 39 sites.

## 3. Terrain: our LOLA terrain angles against LROC stereo models

| Site | LROC model | Directions | Reach | LOLA minus LROC (mean / RMS / max) | Correlation | Directions where our skyline's highest point is inside the model: skyline minus LROC (mean / RMS) |
|---|---|---|---|---|---|---|
| Apollo 11 landing site | NAC_DTM_APOLLO11 (2.0 m) | 284 | 1.0–17.38 km | +0.26° / 0.40° / 1.18° | 0.863 | 209 directions: +0.34° / 0.45° |
| Apollo 12 landing site | NAC_DTM_APOLLO12 (2.0 m) | 360 | 1.07–3.96 km | -0.51° / 0.56° / 1.15° | 0.847 | 264 directions: -0.47° / 0.52° |
| Apollo 14 landing site | NAC_DTM_APOLLO14 (2.0 m) | 360 | 1.97–20.55 km | -0.39° / 0.55° / 1.49° | 0.995 | 245 directions: -0.44° / 0.60° |
| Apollo 15 landing site | NAC_DTM_APOLLO15 (2.0 m) | 360 | 1.53–14.68 km | +0.12° / 0.28° / 0.68° | 0.999 | 91 directions: +0.21° / 0.46° |
| Apollo 16 landing site | NAC_DTM_APOLLO16 (2.0 m) | 360 | 7.67–21.91 km | -0.01° / 0.21° / 0.75° | 0.992 | 269 directions: +0.49° / 0.82° |
| Apollo 17 landing site | NAC_DTM_APOLLO17 (5.0 m) | 360 | 13.56–39.99 km | -0.02° / 0.22° / 2.24° | 0.999 | 286 directions: -0.02° / 0.24° |
