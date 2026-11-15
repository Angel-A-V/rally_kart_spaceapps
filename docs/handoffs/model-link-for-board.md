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

The board's page reads the numbers from its own address and moves **both** parts of the model at once:
the Sun (horizon disc on the stepper, fixed lamp) and Earth (SG90 servo). One click, both move.

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

**Sun → horizon disc (stepper) and lamp.** Already decided in `docs/handoffs/angel-to-hardware.md`:
home on the Hall sensor, call that azimuth 0 (the lamp sits at 0° from the sensor), then turn the disc by
`sun_az`, **clockwise seen from above** (the Sun's azimuth falls about 0.5° per hour, so a fixed lamp means a
clockwise disc). Take the short way round where the wiring allows it.
Lamp: on when `sun_up=1`, off when `0`. `sun_el` hardly changes here (below), so the lamp's height stays fixed.

**Earth → SG90 servo.** Use `earth_el` for the lift angle. Earth only moves a few degrees, so exaggerate it
(issue #7 sets the factor). Example mapping, to tune on the real arm:
`servo_deg = clamp(90 + K * earth_el, 0, 180)` with `K` about 10 (so -7° → 20°, +6.4° → 154°).
`earth_up` can drive an indicator (Earth visible = radio link possible), or just be shown on the page.

## Real ranges at Shackleton rim (from the site's NASA JPL Horizons data, one year, 6-hour steps)

| | Min | Max | Notes |
|---|---|---|---|
| `sun_az` | 0.2° | 359.9° | Full circle every 29.5 days |
| `sun_el` | -1.75° | +1.74° | Always skimming the horizon |
| `earth_az` | 148.3° | 163.9° | Mean 156.2° (the engraved Earth mark is 156.3°) |
| `earth_el` | -7.30° | +6.38° | Swings over about a month (libration) |
| skyline | -2.42° | +1.04° | Why `sun_up` / `earth_up` are sent instead of a 0° test |

## Open design question for the hardware team (not decided here)

Earth's direction is fixed **relative to the terrain** (azimuth 148° to 164°, the engraved mark at 156.3°),
but the disc spins a full turn for the Sun. So:

- If the SG90 Earth stands **off the disc**, fixed in the room (keeping "nothing electrical on the disc"),
  its height is right but its compass direction relative to the terrain is only right when the disc happens
  to put terrain azimuth 156° in front of it. Say so in the demo, or
- mount the Earth arm **on the disc** at 156° so it turns with the terrain. That breaks "nothing electrical
  on the disc": the servo wires would wind up as the disc turns, so the disc would have to unwind (stay
  within about ±180° of home, swinging back when the Sun's azimuth wraps past 0°/360°), or
- give Earth its own rotating stage.

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

The first should turn the disc a quarter turn clockwise from home, light the lamp and lift Earth high; the
second should turn it three quarters, switch the lamp off and drop Earth low.

Website side: `app/src/model.js` (address checks and this address), `app/src/main.js` (the button).
