# Website → tabletop model: what the board receives (for the Arduino UNO Q app and its agent)

2026-11-15 · from Angel (website) · for whoever builds the board's "Moon Disc Controller" app.
Paste this whole file to the board's agent as context. It replaces the USB `SUN <az> <el>` plan for issue
#15 in `angel-to-hardware.md` (the UNO Q's USB goes to its Linux side); everything else there still stands.

## How the link works

The website does not talk to the board in the background. When someone clicks **Show on model** on the
website, the browser opens the board's own page in a new tab (always the same tab, named `moon-model`):

```
http://<board-ip>:7000/?site=Shackleton+rim+%28model+site%29&time=2026-Nov-18+08%3A00
  &sun_az=230.1&sun_el=1.4&sun_up=1&earth_az=149.8&earth_el=-0.7&earth_up=0&az=230.1&el=1.4
```

The board's page reads the numbers from its own address and moves **both** motors at once: the horizon
disc (28BYJ-48 stepper, the Sun) and the Earth arm (SG90 servo). One click, both move. Pins, power and the
arm geometry are in `docs/handoffs/wiring.md` (Darren, PRs #26 and #28).

- The button appears only on the website's **Shackleton rim** page (the printed terrain is that site) and
  only on a laptop opened once with `?model=<board-ip>`. The public site never shows it.
- Each click is one moment: the time on the website's clock. Pressing play on the website does not move the
  model continuously; click again to update. (A "follow the clock" mode would need more work on both sides.)

## The fields

| Field | Meaning | Units / values |
|---|---|---|
| `site` | Site name, for display | text |
| `time` | The moment shown, for display | UTC, e.g. `2026-Nov-18 08:00` |
| `sun_az` | Sun's compass direction seen from the site | degrees, **clockwise from north** (0 = N, 90 = E, 180 = S, 270 = W), 0 to 360 |
| `sun_el` | Sun's height above a **flat** horizon | degrees (negative = below) |
| `sun_up` | Is the Sun above the real skyline (hills counted)? | `1` or `0` |
| `earth_az` | Earth's compass direction | degrees, same convention as `sun_az` |
| `earth_el` | Earth's height above a flat horizon | degrees |
| `earth_up` | Is Earth above the real skyline? | `1` or `0` |
| `az`, `el` | Same as `sun_az`, `sun_el` | kept so the board's first version still works |

`cmd=EARTH` is **no longer sent**. The board should not need the skyline: `sun_up` / `earth_up` already
count the hills (worked out by the website with the rules chosen there).

## What each number is for

**`sun_az` → horizon disc (stepper on D8 to D11).** The lamp is fixed; the disc turns so that the terrain's
compass mark `sun_az` faces the lamp. If, at home (Hall sensor on D2), the terrain mark facing the lamp is
`L0`, then:

```
disc turn from home, CLOCKWISE seen from above = (L0 - sun_az) mod 360
```

- **Careful, this is easy to mirror:** with `L0 = 0`, a Sun in the east (`sun_az = 90`) means turning the disc
  a quarter turn **counter-clockwise** (the E mark swings round to the lamp), not clockwise. Over time the
  Sun's azimuth falls (about 0.5° per hour), so the disc creeps clockwise, which is what
  `angel-to-hardware.md` section 2 means by "the disc turns clockwise".
- **`L0` is not settled:** `angel-to-hardware.md` says the lamp sits at **0°** from the Hall sensor;
  Gustavo's wiring guide (`wiring-guide.html`) says **180°**. Use a constant and set it from the real build.
- The 6:1 gear may reverse the motor's direction relative to the disc: set the sign on the bench with the
  first test address below.

**`sun_el`, `sun_up` → display only.** The Sun lamp is a battery keychain light with **no wires**, so the
board cannot switch it. Show "Sun above the skyline: yes/no" on the page (the built-in LED is fine as an
indicator). `sun_el` stays within ±1.8° here, so the lamp's fixed height (LED centre 33 mm, level with the
eye) already matches.

**`earth_el` → Earth arm (SG90 on D6).** From `wiring.md`:

```
arm_angle = atan(10 * tan(earth_el))      software limits -52 to +48 degrees
```

This uses the elevation only. Our data range (-7.30° to +6.38°) maps to -52.0° to +48.2°, exactly those
limits. Converting `arm_angle` to the SG90's 0 to 180° depends on how the horn is mounted (for example
`servo = 90 + arm_angle` if 90 is level) **[verify on the arm]**.

**`earth_az`, `earth_up` → display only.** The Earth arm stands on the fixed base (nothing electrical rides
on the disc), so it shows Earth's height, not its compass direction. Earth's direction stays within
148° to 164° of the terrain (the engraved mark is 156.3°); say in the demo that the engraved mark shows
where Earth is and the arm shows how high. `earth_up` = radio link possible: show it on the page.

**Nice extra (optional):** the photoresistor on A2 measures whether the printed wall shades the lamp. Showing
"photoresistor: lit / shaded" next to the website's `sun_up` is a live check that the model agrees with the
NASA-based answer.

## Real ranges at Shackleton rim (from the site's NASA JPL Horizons data, one year, 6-hour steps)

| | Min | Max | Notes |
|---|---|---|---|
| `sun_az` | 0.2° | 359.9° | Full circle every 29.5 days |
| `sun_el` | -1.75° | +1.74° | Always skimming the horizon |
| `earth_az` | 148.3° | 163.9° | Mean 156.2° (the engraved Earth mark is 156.3°) |
| `earth_el` | -7.30° | +6.38° | Swings over about a month (libration) |
| skyline | -2.42° | +1.04° | Why `sun_up` / `earth_up` are sent instead of a 0° test |

## Behaviour the page should have

- Opening with no numbers, or with a value that is not a number: do nothing to the motors and say why.
- Clamp everything (servo 0 to 180, disc angle mod 360); ignore extra fields.
- Do not move anything on boot (already removed). Show the current disc angle, servo angle and lamp state.
- Keep the manual Sun / Earth / Home controls as the demo backup.

## Test addresses

```
http://<board-ip>:7000/?site=Test&time=test&sun_az=90&sun_el=1&sun_up=1&earth_az=156&earth_el=6&earth_up=1&az=90&el=1
http://<board-ip>:7000/?site=Test&time=test&sun_az=270&sun_el=-1&sun_up=0&earth_az=150&earth_el=-7&earth_up=0&az=270&el=-1
```

With `L0 = 0`: the first should turn the disc a quarter turn **counter-clockwise** from home (the terrain's
E mark at the lamp), show "Sun up" and lift the Earth arm to about +46°; the second a quarter turn **clockwise** (the
W mark at the lamp), show "Sun blocked" and drop the Earth arm to about -51°. With `L0 = 180` each target is half a
turn further round.

Website side: `app/src/model.js` (address checks and this address), `app/src/main.js` (the button).
