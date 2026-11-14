# Event day: Space Apps Merced, Nov 14 to 15, 2026

Source: the organizers' opening slides (`SpaceApps_Merced_Opening_Slidespdf.pdf`, outside the repo), read 2026-11-14.
**This file overrides the timeline in `project-plan.md` section 6 and `context-handoff.md` section 9.**
Items tagged [verify] are not confirmed. Ask an organizer or mentor before depending on them.

## 1. Hard constraints

| What | Detail | What it means for us |
| --- | --- | --- |
| **Submission cutoff** | **1:30 PM Sunday**, on spaceappschallenge.org. (NASA's 11:59 PM Sunday deadline is only for the global round.) | Judges read the submission *before* the panels. Target submitting at **1:00 PM**. |
| **Room hours** | ACS 120 closes **11:30 PM Saturday** and reopens 8:00 AM Sunday. No overnight. After close: the Library and other open campus spaces. | About 12 working hours today and 5 tomorrow morning. Pack the hardware up tonight and set it up again in the morning. |
| **Makerspace** | **1 to 7 PM Saturday only**, with trained student workers. You need training before you can use it. | Any print, cut or solder that needs the Makerspace happens today. Get trained early. |
| **Panel judging** | 2:00 PM Sunday, two rooms, **8-minute demo + 3-minute Q&A**. | The demo script is 8 minutes, not 2 to 3 (see section 4). |
| **Judges** | 7 in total: **4 in the room, 3 online**. Finals use all 7. | Online judges only see a screen. The website has to carry the whole pitch, and the model needs to be shown on camera. |
| **Finals** | Each panel sends its top 2. Finalists named 4:30, finals 5:00 in the Grand Ballroom (4 teams). Panel results stay secret, so all finalists start even. | Be ready to give the same pitch again in a bigger room. |
| **Team** | Up to 6 people. The team lead creates the team on spaceappschallenge.org and everyone joins. | We are 3. We could add people from the "middle" section if we need more hands. |
| **Registration** | Every member registered and added to the team right after teams form. | No registration means no judging. |

## 2. What judges score (NASA's five criteria, same in panels and finals)

| Criterion | Their question | Our answer (what to show) |
| --- | --- | --- |
| **Impact** | Does it matter? Who does it help? | South pole landers live or die by sunlight (power) and an Earth link (radio). The audience is mission planners, educators and the public. |
| **Creativity** | Is the approach fresh? | Terrain-aware comparison of two sites in seconds, plus a physical model with the real printed horizon. |
| **Validity** | Does it work? Are the data and science sound? | Our weakest spot right now. JPL Horizons (DE441, includes libration) plus the LOLA terrain skyline, 99 automated tests, and every number traced to NASA data. **Open:** the Quickmap cross-check (issue #1) isn't done, and our sites are picks we derived from LOLA data, not official landing sites. Say that plainly. |
| **Relevance** | Does it answer the challenge? | Map each Challenge 11 sentence to a feature: compare sites and dates, Sun and Earth vs the horizon, power and direct-to-Earth windows. |
| **Presentation** | Can you explain it clearly and convincingly? | Rehearse at Demo Doctor (11:30 Sunday). |

## 3. Local awards and which ones fit us

| Award | Who decides | Fit for us |
| --- | --- | --- |
| **Next Frontier**: best overall, plus **$1,500 toward conference funding** | Judges (finalists) | Yes. Moon exploration is this year's theme. |
| **Signal**: best use of data (with Databricks) | Judges | Strong fit. Every number traces back to NASA data. |
| **Liftoff**: best working build, "it actually runs" (with AWS) | Judges | Strong fit. A running site plus tests. A public link that runs for online judges helps. See section 6 on AWS. |
| **Groundtruth**: local impact on a real Valley problem | Judges | No fit. Skip it. |
| **Rookie Launch**: the team that traveled furthest this weekend | Mentors, any team | Based on progress made this weekend. |
| **People's Choice** | Everyone votes (5:50 Sunday) | A good live demo and the model help here. |

Every team that submits gets a NASA participation certificate. Top projects get nominated to NASA's global judging.

## 4. Eight-minute demo outline (draft)

| Time | Section | Criterion | Content |
| --- | --- | --- | --- |
| 0:00 to 0:45 | The problem | Relevance, Impact | At the south pole the Sun skims the horizon and Earth bobs above and below it. A lander needs both. Existing NASA tools are hard to use for quick comparisons. |
| 0:45 to 1:15 | Who it helps | Impact | Mission planners (CLPS), educators, the public. |
| 1:15 to 4:15 | Live demo | Presentation, Relevance | Pick two sites, slide the time, horizon strip, the numbers (Sun elevation, time to sunset, Earth visible, time to Earthset), yearly windows, and the best 14-day mission window. |
| 4:15 to 5:15 | Physical model | Creativity | Lamp = Sun, disc = the real printed horizon at the Shackleton rim. **Point the camera at it for the online judges.** |
| 5:15 to 6:30 | How we know it's right | Validity | Horizons observer-on-the-Moon queries, LOLA skyline, tests, cross-check result, and known limits (data-derived sites, Sun treated as a point). |
| 6:30 to 7:30 | What's new and next | Creativity | Custom coordinates, whole-Moon terrain, more sites. |
| 7:30 to 8:00 | Close | Presentation | Public link and the one-line takeaway. |

**Q&A prep (3 minutes):** How accurate is it, and what did you check it against? Why these sites? What does libration do? Why no machine learning? What happens off the pole? Who would use this first?

**Backup:** a screen-recorded demo video (record it by 10:30 Sunday) in case the venue Wi-Fi or the hardware fails.

## 5. Timeline from now to the cutoff

Owners: **A** = Angel, **G** = Gustavo, **D** = Darren.

**Saturday, Nov 14**

| Time | Event | Our action |
| --- | --- | --- |
| 11:00 | Challenges unlock | Lead creates the team on spaceappschallenge.org under **Challenge 11**; all three join. Check the challenge name first (section 7). |
| 11:45 | Scope Check | Ask the questions in section 7. Show the MUST list. |
| 12:25 | Lunch | |
| 12:50 | AWS workshop (Sebastian Reyes, ACS 120) | A attends and asks the AWS questions in section 6. |
| 1:00 to 7:00 | Makerspace open | G, D: training first, then every print, cut or solder that needs the Makerspace: disc, terrain wall, lamp tower. |
| Afternoon | Build | A: Quickmap cross-check (#1), or settle the Validity wording. Stepper bench test. Polish the website MUST list. |
| 3:00 | Mentor speed rounds | One specific question on the charter card. Suggested: "Is our method (Horizons az/el vs the LOLA skyline) sound, and what would you check it against?" |
| 6:00 | Dinner | |
| 10:00 | Checkpoint round | Status: website MUST list done? Disc printed? Stepper turns the disc on command? |
| 11:30 | ACS 120 closes | Pack the hardware. In the Library, A drafts the submission text. |

**Sunday, Nov 15**

| Time | Event | Our action |
| --- | --- | --- |
| 8:00 | Room reopens | Set the hardware back up. |
| 9:00 | Final build | |
| **9:30** | **Hardware go/no-go** | If the app is not turning the disc by now, stop hardware work. Demo the website and turn the model by hand. |
| 10:30 | Feature freeze | No new features after this. Record the backup demo video. |
| 11:30 | Demo Doctor | Run the 8-minute pitch against the five criteria. |
| 12:15 | Lunch | |
| **1:00** | **Submit (our target)** | Use the checklist below. |
| **1:30** | **Hard cutoff** | |
| 2:00 | Panels, Rooms A and B | 8 min + 3 min Q&A |
| 4:30 / 5:00 | Finalists named / Finals in the Grand Ballroom | |
| 5:50 / 6:15 | People's Choice vote / Awards | |

### Submission checklist

- [ ] All three members registered and on the team page
- [ ] Filed under the right challenge (Challenge 11)
- [ ] Project summary that answers the challenge in plain language
- [ ] A link judges can actually open. **The GitHub repo is private:** make it public, or give judges a public demo link plus a video. [verify] what the submission form requires.
- [ ] Demo video link
- [ ] Data sources credited: NASA LRO LOLA (LDEM_85S_20M, PDS Geosciences Node) and NASA JPL Horizons (DE441)
- [ ] Known limits stated: sites are our picks from LOLA data, not official landing sites
- [ ] [verify] whether Space Apps asks teams to disclose use of AI tools

## 6. AWS (the Liftoff award and data storage)

**What the slides say:** Liftoff is "Best working build: it actually runs. With AWS." AWS also offers "credits and servers", and the workshop is at 12:50 Saturday with Sebastian Reyes. **The slides do not say that a project has to use AWS to win Liftoff.** "With AWS" may just mean AWS sponsors it. [verify] at the workshop.

**Ask at the workshop:**
1. Does Liftoff require using AWS, or does any working build qualify?
2. How do teams claim the credits? Do we need a credit card on the account?
3. Is S3 static website hosting OK as "using AWS"?

**Can we store our data on AWS?** Yes, and it's an easy fit, because our website is plain static files:

| Option | What goes there | Effort | Value |
| --- | --- | --- | --- |
| **S3 static website** (optionally behind CloudFront for HTTPS) | The Vite `dist/` build, including `public/data/*.json` (about 2.7 MB) | About 30 minutes, no code changes | A public link that runs for online judges and for the submission. Replaces or mirrors the Cloudflare Pages plan (`software-architecture.md` section 5b). |
| **S3 data bucket** | Horizons caches with their `.meta.json` (about 1 MB) and the raw LOLA tile (about 150 MB, which is git-ignored today) | About 15 minutes | Anyone can download and re-check every number. Supports Validity and Signal. |
| Lambda, API Gateway, DynamoDB | A live backend (for example, custom coordinates) | Hours | Not worth it this weekend. |

**Rules if we use it:**
- The demo must **never depend on AWS or the network**. Keep the local copy (laptop or UNO Q) as the main demo and the AWS link as the public one.
- Only NASA data and our own outputs go in a public bucket. No keys, tokens or personal info.
- Do it only after the website MUST list works.

## 7. Questions for Scope Check (11:45 Saturday)

1. **Challenge name.** The slides list "CLPS Lunar Mission Browser". Our challenge page says "Lunar Landing Site Navigator" (Challenge 11, which mentions CLPS). Are they the same challenge?
2. **Prior work.** The slides say challenges "unlock" at 11:00, but we prepared code and data beforehand. What is this event's rule on work done before the start?
3. **Who is team lead** and owns the team page? (Our pick: Angel.)
