# +Onz UI/UX audit: laws, motion, design-system consistency

*Last updated 2026-11-27 · branch `feature/onz-deals` · owner: Aaron (UI/UX)*

This document records where the +Onz PWA stands against the Figma design system (`XGKy6UdGcpCukny7ldQ1Z8`), which UI/UX laws each screen follows or breaks, what is missing in the motion flow, and how the remaining legacy styling gets retired. It is a working document for the redesign PR: update it as screens are rebuilt.

Numbers in this document come from automated audits run in Demo mode (Playwright: computed styles, matched CSS rules, centring, overflow) at 390 px and 1440 px, not from estimates.

---

## 1. The design system in one page

Every screen must be built from these pieces. Anything else is legacy and should be replaced, not overridden.

| Layer | Source of truth | Rules |
|---|---|---|
| Tokens | `app/client/css/oz-tokens.css` | Spacing `--oz-space-1..9` (4, 8, 12, 16, 20, 24, 32, 40, 56). Radii `sm 8 · md 12 · lg 16 · xl 24 · pill`. Colours only through `--oz-*` tokens. No raw px for spacing, radius or colour unless Figma has a value with no token (then add the token). |
| Type | Figma text styles | `UI/H1` Bricolage 28/34 800 · `UI/H3` Inter 18/24 600 · `UI/Body` 16/24 · `UI/Body SM` 14/20 · `UI/Label` 14/20 600 · `UI/Caption` 12/16 500 · `UI/Button` 16/20 700. Display headings (page titles, sheet titles, big numbers) use Bricolage; everything else Inter. |
| Components | `app/client/js/oz-ui.js` + `oz-components.css` | `ozButton` (primary = lime, ghost, secondary), `ozTag`, `ozPointsPill`, `ozSegmented`, `ozListRow`, `ozLiveDealCard`, `ozEmpty`, `ozSectionHead`, `ozPointsHero`, `ozRouteSkeleton`, `ozFlame`. Reuse before writing new markup. |
| Icons | `app/client/js/oz-icons.js` | Content icons are **solid**. Stroke only for chevrons, close, plus and a check inside a filled circle. No Lucide outline icon may render in the client. |
| Motion | `app/client/js/oz-motion.js` + `oz-motion.css` | See §3. Animate `transform`/`translate`/`scale`/`opacity`, never `top`/`left`. Entrances from `scale .97` + opacity 0, never from 0. No bounce, no staggered fades. |
| Sheets | `sheet()` in `ui.js` | Centred sheets add `.oz-sheet-center` (symmetric heading padding, see §5.1). Left-aligned sheets keep the default. |

**Process rule:** rebuild a screen's markup with `oz-*` classes from its Figma frame (phone + web), keep every production behaviour and test hook, then remove the legacy CSS it no longer needs. Do not add overrides on top of old markup. Every round of overrides we wrote this month later had to be deleted.

---

## 2. UI/UX laws: how they apply, where we comply, what is missing

Each law has: what it means for +Onz, evidence that it is applied, and the open gaps (with the action).

### 2.1 Hick's law: fewer choices, faster decisions
- **Applied**
  - Campus shops: a single chip row; the old hero with 6 stats was removed.
  - Customise item sheet: 4 statements of the same fact became 1 tag, 1 progress bar and 1 action.
  - Tour: one primary action per step.
  - Merchant Home: one "Next: …" action instead of a list of equal-weight cards.
- **Gaps**
  - **Contact:** offers email, socials, a form and an in-app link at the same weight → lead with the form, collapse the rest.
  - **Rewards:** 3 "earn" rows plus 3 tabs plus 2 extra blocks above the fold → move "Learn & Earn" and "Welfare" into the Earn list.
  - **Admin Overview:** 10+ widgets → follow the lean Figma frame and keep the extras as secondary cards (decision recorded).

### 2.2 Fitts's law: important targets big and close
- **Applied**
  - 44 px minimum targets: friend ⋯, Directions, calendar arrows, quiz answers (56 px).
  - Whole-row tap areas on shop rows (stretched link) and event cards.
  - Lime primary buttons span the full width on phones.
- **Gaps**
  - Event reaction buttons are 32 px tall → raise to 40 px or move into the detail sheet.
  - The legacy `.btn small` (36 px) is still used in Feedback, FESKUM and the submit form.
  - The web calendar's days are 40 px circles inside 64 px cells. That's fine, but make the whole cell the hit area (already true) and show a visible hover state on all cells.

### 2.3 Jakob's law: behave like the apps people already use
- **Applied**
  - Capsule tab bar with a sliding pill (OpenTable, Ladder).
  - iOS push/pop for sub-pages.
  - Sheet-style rise for Campus Events.
  - Luma-style event list.
  - Partiful/Slack-style month calendar with a Week strip.
  - Accessible "card with name link" shop rows.
- **Gaps**
  - Sheets cannot be dragged down to dismiss (every native sheet can) → see §3.3.
  - No pull-to-refresh on live lists (Home live deals, Leagues).
  - The web has no `:hover` affordance on several cards (Leagues rows, Me menu).

### 2.4 Miller's law / chunking
- **Applied**
  - Events grouped "Happening now / Coming up" and "Past events / Poster archive".
  - Merchant start steps chunked into 5 with a progress count.
  - About split into Story / Take part / Points / Team.
- **Gaps**
  - The Money Check survey shows all questions at once (long scroll) → paginate into 2–3 short steps with a stepper. This also earns the "slide in the direction of travel" motion.
  - The submit-event form has 10+ fields on one sheet → group into "What / When & where / Contact".

### 2.5 Doherty threshold: respond within 400 ms
- **Applied**
  - Route skeletons in the page's real shape.
  - Skeleton rows for friends, requests, vouchers, Leagues and merchant activity.
  - Press feedback (scale .97 in 150 ms).
  - Optimistic avatar save.
  - Debounced event search (120 ms).
- **Gaps**
  - Rewards → Swap: after the confirm sheet, the redeem call runs with no busy state on the button until the toast → mark it busy and update the balance optimistically.
  - Live deal **Claim**: check the same during the motion pass.
  - The Admin dashboard has no skeletons.

### 2.6 Aesthetic-usability effect and consistency (Gestalt: similarity, proximity, common region)
- **Applied:** one card style (white, 16–24 px radius, no shadow), one chip style, one segmented control, one type scale on rebuilt screens.
- **Gaps (the "mixed old/new" look)**
  - Screens still on legacy components (§4 table): Feedback, FESKUM, Contact, Merchant (all but Home), Admin.
  - Base `app.css` + `onz.css` element rules still match on every screen (8–50 rules each). Harmless where oz sets the same properties; they cause the "old font" look where oz doesn't (headings, `p`, `.btn`).

### 2.7 Von Restorff (isolation) effect
- **Applied:** one lime element per view (the primary action). "Happening now" events get a lime border and a pulsing dot. Today in the calendar is a ring and the selected day is filled.
- **Gaps:** Merchant Home still shows lime on both "Next" and "Create a deal" when there are no claims → only the start-card action should be lime.

### 2.8 Goal-gradient and Zeigarnik effects (progress pulls people forward)
- **Applied:** merchant start-here bar and "N of 5 done", level progress on the Home hero, the unlock bar in Customise, streak 7-day track.
- **Gaps:**
  - The Learn & Earn header shows "50 / 200" but no per-lesson completion ticks animate when finished → tick in place with a short fill.
  - The survey has no progress indicator.

### 2.9 Peak-end rule
- **Applied:** confetti plus a points animation on correct lessons and redemptions; the Onzo hat drops on; the tour ends with a checklist.
- **Gaps:**
  - Voucher redeemed at the counter (merchant side) ends on a plain toast → a success state frame exists in Figma (`Merchant · Redeem success`).
  - Leaving the wardrobe after a save has no moment → a short "saved" hero settle on Home.

### 2.10 Tesler's law and Postel's law (absorb complexity, accept messy input)
- **Applied:** event and shop search match name, place and date text; events without a date show "TBA" rather than failing.
- **Gaps (to verify per form during its rebuild):** input normalisation (case/spacing) on matric, username and referral fields; the event submit form could prefill "Ends" from "Starts".

---

## 3. Motion

### 3.1 What exists (and must stay consistent)

| Pattern | Spec | Where |
|---|---|---|
| Tab / segmented pill | 300 ms `cubic-bezier(.25,1,.5,1)`, no overshoot; follows `aria-current`, `aria-selected`, `aria-pressed`, `.on`; keeps gliding through layout resizes | Nav bar, Community, Leagues, Rewards, History filter, Events views, wardrobe tabs |
| Sub-page push / pop (phones) | 400 ms `cubic-bezier(.32,.72,0,1)`, outgoing page slides back 30% and dims | Depth changes, plus parent→child routes (Learn, Overview, Activities, Customise, About, Contact, Points guide) |
| Rise / drop (phones) | 450 ms iOS sheet curve | Campus Events, FESKUM |
| Sheets | Rise on the sheet curve (phones), pop from .97 (web) | All `sheet()` dialogs |
| Press | `scale .97`, 150 ms ease-out, plus darken on buttons | `.oz-btn`, tiles, rows, chips, tabs |
| Entrances | from `scale .97` + opacity 0 | Tour card, quiz hint, dialogs |
| Stepper | Next slides in from the right, Back from the left (24 px, 260 ms) | Tour |
| Wrong answer | shake 0, −10, 10, −6, 6, −3, 0 px over 360 ms, plus red | Learn quiz |
| Accordion | `interpolate-size: allow-keywords` + `::details-content` 260 ms | FAQ, Me details, Community welfare history, cafés |
| Drag release | velocity-preserving critically damped spring (~0.5 s), rubber-band resistance | Event poster (Home rail) |
| Wardrobe | hat drops on (28 px, 380 ms) then the body settles; glasses slide down; scarf grows from .97; colour cross-fades | `#/avatar` |
| Ambient | streak flame burn (outer 1.8 s sway, inner 1.1 s flicker), "happening now" dot pulse, skeleton sheen 1.4 s | Streak, Events, loading |
| Reduced motion | all of the above become a ≤150 ms dissolve or nothing | `prefers-reduced-motion` |

### 3.2 Consistency problems found and fixed this round
- The hat change moved Onzo 100 px to the right (an animation overwrote the centring `transform`) → all motion now uses `translate`/`scale` properties.
- The third pill didn't animate (a scrollbar resize snapped it) → fixed globally.
- The tour spotlight grew out of the screen corner on its first step → the first placement snaps into place.
- The calendar day "boing" (scale 1.04 overshoot) was removed.

### 3.3 Missing motion (priority order)
*Round 6 (2026-11-27): items 1 (drag-to-dismiss), 3 (row collapse via `collapse()`, friends first) and 7 (toast rise, time-left line, swipe) are done; points now fly from the tapped control to the pill and progress bars fill on first view. Still open: 2 (shared-element poster), 4 (optimistic decrement), 5 (pull-to-refresh), 6 (survey stepper).*
1. **Drag-to-dismiss sheets** (Jakob). Pull the grabber down: follow with resistance, and on release spring with velocity; past 30% or a fast flick closes. Applies to every `sheet()`.
2. **Shared-element transition: event card → detail/poster sheet.** The poster thumbnail should grow into the sheet image (View Transitions API on supported browsers, fade elsewhere).
3. **List insert/remove.**
   - Friend removed, request accepted, voucher redeemed and live deal claimed should collapse their row (height + opacity 200 ms) instead of the list jumping.
   - Implement once in a `listRemove(el)` helper.
4. **Optimistic number changes.** The points pill counts up already; Rewards "Swap", Claim and welfare Donate should animate the balance down immediately.
5. **Pull-to-refresh** on Home live deals, Leagues and Events (custom, rubber band + spinner glyph, phones only).
6. **Survey stepper** (after paginating, §2.4) using the tour's directional slide.
7. **Toasts.** Enter from the bottom (translate 12 px, opacity), auto-dismiss with a progress line; swipe to dismiss.
8. **Calendar.**
   - Swiping left/right on the month grid changes the month, with the same rubber band and spring as the poster.
   - Week mode: horizontal swipe changes the week.
9. **Web hover states.** A consistent 120 ms background tint on rows and cards (Leagues, Me menu, merchant rows), so the web doesn't feel static.
10. **Merchant and Admin.** None of the above is applied yet (no skeletons, no press feedback on legacy `.btn`, no route transitions on Admin).

---

## 4. Screen-by-screen status

Legacy rule counts = rules from the old stylesheets still matching visible elements on that screen (390 px, Demo). "Rebuilt" = markup is on `oz-*` components from its Figma frame.

### 4.1 Student app

| Screen | Status | Legacy rules still matching | Next action |
|---|---|---|---|
| Home | Rebuilt | app 16 · onz 12 | Base-element cleanup only |
| All activities | Rebuilt | app 8 · onz 4 | none |
| Campus shops (Overview) | Rebuilt this round (779:2321 / 923:31858) | app 31 · onz 49 (map, legacy hereNow card) | Rebuild the "Friends / place sharing" card; Leaflet controls to oz |
| Community | Rebuilt; friend sheet added | app 14 · onz 42 (friends hero, legacy rows CSS) | Remove `.friends-*` legacy styles; request rows to `ozListRow` |
| Leagues | Rebuilt | app 12 · onz 5 | State frames (no points yet, syncing, unranked) |
| Rewards | Rebuilt | app 10 · onz 16 · points 9 | Port `points-summary` to oz; Badges tab spacing |
| Streak + calendar | Rebuilt; flame burns | app 12 · onz 20 | State frames 708:15357… |
| Learn & Earn + quiz | Rebuilt this round (492:8585) | app 10 · onz 5 | Lesson complete / try-again full frames |
| Money Check survey | Rebuilt this round | app 14 · onz 3 | Paginate into steps (§2.4) |
| **Campus Events** | **Rebuilt this round + calendar** | **event-gallery 0 · event-carousel 0 · event-submissions 0** (retired) | Event detail sheet, submit form fields (§6) |
| FESKUM | Legacy | app 16 · onz 6 · feskum.css (48 KB) | Rebuild to 918:32216/32284/32348 |
| Me + sub-pages | Rebuilt | app 9–15 · points 9 on history | Points history "Older activity" card |
| Customise (wardrobe) | Rebuilt; save bug fixed | app 17 · onz 13 | none |
| About | Rebuilt to your hub | app 12 · onz 5 | Team / Get involved sub-pages |
| Contact | **Legacy** | information 65 | Rebuild to 938:52019 / 52181 |
| Feedback | **Legacy** | app 41 · onz 14 · feedback 10 | Rebuild (944:54315) |

### 4.2 Merchant app

| Screen | Status | Legacy rules still matching | Figma |
|---|---|---|---|
| Home | Rebuilt this round | app 16 · onz 8 · merchant 12 · points 9 | 1102:58453 / 58335 / 59069 ✓ |
| My shop + application, assets, map, verification states | Legacy | app 54 · onz 22 · **merchant 90** | 523:11140…11289, 948:54411… |
| Deal QR | Partly (earlier rounds) | merchant 4 | 1121/1117 frames |
| Promote | Legacy | app 25 · **merchant 89** | 1116:60545…60787 |
| Insights | Legacy | merchant 33 | yes |
| Merchant assessment | Legacy | app 38 · merchant 13 | yes |
| Counter poster | Legacy | merchant 6 | yes |

### 4.3 Admin dashboard
In scope since 2026-11-27 (UI only, after merchant). The current dashboard is a solid-blue sidebar, gradient hero, dotted background, mixed card styles. Figma (`Admin · …` 1440, `Mobile admin · …` 390, about 220 frames) is a light sidebar, breadcrumb header, plain stat cards and one action row. Admin loads its own CSS (`app/admin/index.html`); it does not get `oz-*` tokens yet, so the first step is linking `oz-tokens`, `oz-type` and `oz-components` into Admin.

---

## 5. Consistency issues fixed this round (keep them fixed)

### 5.1 Off-centre sheets ("consistent inconsistency")
`shared/css/app.css` gives every sheet heading `padding-right: 40px` (room for the ✕). In centred sheets that pushed headings about 20 px left. Centred sheets now get symmetric padding (`oz-components.css`, `.oz-sheet-center`). **Rule:** any new centred sheet adds `.oz-sheet-center` to its root.

### 5.2 Event listeners on `#view`
A mount that calls `root.addEventListener` must return a cleanup that removes it. The wardrobe didn't, so a second visit ran a stale handler, which caused "sometimes it doesn't save". Audit: only `event-gallery.js` and `feskum.js` also do this, and both clean up.

### 5.3 Hooks vs looks
Tests and the guided tour select by class/id. When rebuilding, keep the hook class on the new element (e.g. `.event-submit`, `.checkout-shop`) and style through the `oz-*` class. If a hook drags in legacy styling, retire that legacy file rather than overriding it.

---

## 6. Eventing: what was removed and what remains

**Retired from the client this round**
- `event-gallery.css` (23 KB): page, cards, filters, view switch and calendar are all oz now. The two rules still needed (date poster, ended floor map) were ported to tokens in `oz-events.css`.
- `event-carousel.css` (11 KB): the Home carousel is gone; the poster viewer was rebuilt on oz.
- `event-submissions.css` (client import): the student-facing rules were ported to tokens. Admin still links it until the Admin redesign.
- About 120 lines of earlier-round `.oz-events` overrides and every "fight the legacy" rule written this month.

**Still to make consistent in eventing**
1. **Event detail sheet** (`eventDetailsHTML`, shared): uses legacy `.btn` actions → oz buttons, Figma 492:8237 / 740:20675 (ended) / web 918:31544.
2. **Submit-an-event form**: inputs still get `app.css` field styles and a legacy `.btn` submit → oz inputs (48 px, 16 px text, token borders), grouped steps (§2.4), lime submit.
3. **My submissions** list: rows are ported; status chips to `ozTag`.
4. **FESKUM** (`feskum.css`, 48 KB): find a booth, booth details and booth map to Figma 918:32216/32284/32348 and the phone frames.
5. **Category colours**: the calendar dots for bazaars, music and summits use colours without tokens → add `--oz-cat-*` tokens to the design system (decision for Aaron).
6. **Malay copy**: review the new strings ("Akan datang", "Terokai gerai FESKUM", "Menunjukkan N acara", etc.).

---

## 7. Legacy CSS retirement plan

`app/client/css/oz-legacy.css` imports the old stylesheets into `@layer legacy`. Retire a file when no client screen matches any of its rules (audit script: load each route plus its sheets, count matching rules per imported sheet).

| File | Status | Blocked by |
|---|---|---|
| `event-gallery.css` | **Retired (client)** | none |
| `event-carousel.css` | **Retired (client)** | none |
| `event-submissions.css` | **Retired (client)**; Admin still links it | Admin redesign |
| `guide.css` | 1 rule on merchant shop | Port the `.league-help` / `.ob-steps` rules, then retire |
| `information.css` | 65 rules on Contact | Contact rebuild |
| `feedback.css` | 10 rules | Feedback rebuild |
| `points.css` | 9 rules (points-summary on Rewards, history, merchant home) | Rebuild `pointsSummaryHTML` for the client (shared with Admin: give the client its own render) |
| `merchant.css` | up to 90 rules | Merchant rebuild |
| `feskum.css` | FESKUM | FESKUM rebuild |
| `motion.css`, `usability.css` | 1–8 rules everywhere (legacy `.btn` press, input sizing) | Last legacy `.btn` removed |
| `app.css`, `onz.css` (shared base) | 8–50 element rules everywhere | Final step: once every screen is oz, stop importing them in the client and keep a small reset in `oz-type.css` |

---

## 8. Roadmap (one PR, in this order)

1. **Merchant**: My shop and its states → Promote → Insights → Deal QR states → assessment → poster. Retire `merchant.css` from the client.
2. **Eventing completion**: detail sheet, submit form (grouped steps), FESKUM.
3. **Contact and Feedback** → retire `information.css` and `feedback.css`.
4. **Motion gaps** (§3.3, items 1, 3, 4 first: they touch every screen).
5. **Admin**: link oz tokens/components → shell → Programme overview → merchant review flow → remaining sections.
6. **Base cleanup**: stop importing `app.css` / `onz.css` in the client.

**Decisions needed from Aaron**
- Category colour tokens for events (§6.5).
- Whether the survey becomes a multi-step flow (§2.4); it changes the screen count against Figma.
- Pull-to-refresh: in or out (it's not in Figma).

**Verification for every step:** Figma phone and web side by side; the centring, legacy-rule, overflow and outline-icon audits; then all suites: `npm test`, `npm run test:views`, `test:e2e`, `test:responsive`, `test:experience`. Last full run on 2026-11-27: all passed (49 e2e journeys, 588 responsive checks).

## Student design system and motion follow-up

The Demo audit covered 17 student views, including nested Rewards and Community screens. The signed-in Help forms were the clearest visible legacy styling. Contact and Questions and feedback now use the same +Onz surfaces, field spacing, action buttons, and focus treatment. Campus Shops' paused place-sharing notice now uses a standard link row. The Welfare Fund cards and actions, the FESKUM ended and source actions, and the route error action also moved to +Onz components.

Remaining legacy areas include the shared sign-in and onboarding forms, the Campus Shops map controls, the FESKUM floor plan and booth detail styling, and some transactional sheets and feedback message styles. Older stylesheet imports still support these surfaces. The Student audit does not cover the Admin or Merchant UI.

Mobile route transitions now keep a snapshot of the outgoing content and defer the route skeleton until 500 ms. Forward transitions run for 300 ms and back transitions for 230 ms. Sheets and disclosures use faster ease-in exits and ease-out entrances. Home event posters expand from the tapped thumbnail when the browser supports animation and Reduce Motion is off. Repeated lists remain immediately interactive without entrance staggering.

The Help form review used [Insight Timer's Contact us screen](https://mobbin.com/screens/e7cb89fd-a311-4e3f-97eb-5e111dada700). Motion choices follow the feedback and orientation guidance in [UX Academy](https://myuxacademy.com/blog/animation-in-ux-design/) and [NN/g](https://www.nngroup.com/articles/animation-purpose-ux/).
