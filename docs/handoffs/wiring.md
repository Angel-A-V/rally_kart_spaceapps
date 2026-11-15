# Lunar model wiring (UNO Q)

From Darren, Nov 15, 2026. Combines Gustavo's wiring and bench-test guide (Nov 14) with the SG90 Earth pointer arm. **For Angel to confirm**, especially the items under "Still to verify".

Everything powered runs through soldered lines on a **PCB protoboard**, not a breadboard.

## Parts

| Part | What it does | Owner |
|---|---|---|
| **Arduino UNO Q** | Main board. Runs the website server (Linux side) and drives the motors and sensors (STM32 microcontroller side, 3.3 V logic). | Angel |
| **Power supply module** (sold as a "breadboard power supply") | Mounted on / wired to the PCB protoboard. Feeds 5 V onto the protoboard's soldered **5V line**. Jumper set to **5V**, the unused output's jumper set to **OFF**. | Angel |
| **PCB protoboard** | Soldered board holding the shared **5V line** and **GND line** that every powered part connects to. | Darren |
| **Phone charger (USB), at least 1 A, 2 A preferred** | Powers the power supply module. Do not use the 9 V battery: it drains in minutes and heats the regulator. | Angel |
| **USB-C cable** | Powers the UNO Q separately. | Angel |
| **28BYJ-48 stepper + ULN2003 driver module** | Turns the Moon disc (6:1 gearing, 6 motor turns per disc turn). About 240 mA. | Gustavo |
| **Hall sensor + magnet** | Home position for the disc. Reads LOW when the magnet is over it. | Gustavo |
| **Photoresistor + 10 kΩ resistor** | Measures whether the terrain wall shades the lamp. | Gustavo |
| **SG90 servo** | Earth pointer arm. | Darren |
| **470 to 1000 µF capacitor** (recommended) | Smooths the 5V line near the servo so it does not jitter when the stepper runs. | Darren / Angel |
| **10 kΩ knob** (optional) | Timeline scrub. Skip for first tests. | Angel |
| **Sun lamp** (LIGHTFE E2 keychain light) | Battery powered, **no wires**. Fixed 120 to 150 mm from the photoresistor, LED centre at 33 mm height. | Gustavo |

## Signal pins (UNO Q)

| UNO Q pin | Connects to | Owner |
|---|---|---|
| **D2** | Hall sensor OUT (firmware enables the built-in pull-up) | Gustavo |
| **D6** (PWM, ~) | SG90 servo signal (orange wire) | Darren |
| **D8** | ULN2003 IN1 | Gustavo |
| **D9** | ULN2003 IN2 | Gustavo |
| **D10** | ULN2003 IN3 | Gustavo |
| **D11** | ULN2003 IN4 | Gustavo |
| **A2** | Photoresistor / 10 kΩ divider junction | Gustavo |
| **A3** | Knob middle leg (optional) | Angel |

Unused: A0, A1, D3, D4, D5, D7, D12, D13. The UNO Q's **5V pin is left unconnected**.

## Power

| Part | Power from |
|---|---|
| ULN2003 **+** | Protoboard **5V line** |
| SG90 red wire | Protoboard **5V line** |
| Hall sensor VCC | Protoboard **5V line** (A3144 needs at least 4.5 V) |
| Photoresistor leg 1 | UNO Q **3V3** pin |
| Knob outer legs (optional) | UNO Q **3V3** and **GND** |
| Capacitor | Across the protoboard **5V and GND lines**, next to the servo header. Stripe (−) leg to GND. |

## Ground (all joined)

| Part | Ground to |
|---|---|
| Power supply module GND | Protoboard **GND line** |
| ULN2003 **−** | Protoboard **GND line** (or straight to the module's GND, the same point) |
| SG90 brown wire | Protoboard **GND line** |
| Hall sensor GND | Protoboard **GND line** |
| 10 kΩ resistor (photoresistor divider) | GND |
| **UNO Q GND (one pin)** | Protoboard **GND line**. Links the two supplies' grounds so the signals have a common reference. |

## Rules

- No motor current from a UNO Q pin, ever.
- Never connect the two 5 V supplies together. The UNO Q 5V pin stays unconnected.
- All grounds joined.
- Analog inputs stay at 3.3 V or below.

## Still to verify

1. **D6 is PWM on the UNO Q:** check for the ~ mark on the board. Backup pins: D5, then D3.
2. **Lamp angle from the Hall sensor:** Gustavo's guide says **180°**, `angel-to-hardware.md` says **0°**. The firmware home offset depends on which is right.
3. **Hall part:** bare A3144 or KY-003 module, and the magnet size.
4. **3.3 V logic:** bench-check that D2 is safe with the Hall sensor on 5 V (open-collector output with the 3.3 V pull-up should be fine), and that the ULN2003 switches reliably on the UNO Q's 3.3 V signals.
5. **Charger rating:** at least 1 A, 2 A preferred.
6. **After soldering, with a multimeter:** the 5V line reads 4.8 to 5.2 V against the GND line, and the UNO Q GND, the servo brown wire and the ULN2003 − all beep for continuity with the GND line.

## Firmware to-do (Angel)

- Drive the SG90 on **D6**.
- Add the `EARTH <az> <el>` command. The arm uses elevation only: `arm_angle = atan(10 × tan(elevation))`, software limits **-52° to +48°**. Physical hard stops sit a few degrees outside that range.
- Arm geometry for reference: globe centre 181 mm from the servo shaft, 60 mm globe, servo shaft about 180 mm above the ground.
