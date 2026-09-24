# Dizrupt site — what exists, and what it needs to become

A briefing for another model. The goal at the end of this document is for you to write a prompt
that will get an engineer-agent to turn what exists into a real company website.

---

## 1. What this is

`studio-site` is the website for **Dizrupt**, a solutions-led full-stack digital marketing agency
headquartered in Mumbai. It is live at `studio-site-one-blond.vercel.app` and developed locally at
`localhost:8765` (`python3 serve.py`).

It is **not** a conventional website. It is a single WebGL scene — one particle field of 70,000
points that morphs between shapes — with HTML layered over it. Everything you'd normally call a
"page" is a state of that one scene.

**The problem to solve:** it currently reads as a showpiece, not as a company website. There is no
about page, no services page, no navigation, no way in except scrolling through a sequence. The
owner wants it to keep the craft but gain a real information architecture and user flow.

---

## 2. Technology

Plain ES modules, no framework, no build step. Files are served as-is.

| File | Lines | What it owns |
|---|---|---|
| `main.js` | 2900 | The scene, shaders, intro sequence, project data, all state |
| `spiral.js` | 660 | The project spiral: cards, their particle borders, layout |
| `project.js` | 270 | The project page: its flight animation and content |
| `banners.js` | 21 | Client banner file paths |
| `atmosphere.js` | 145 | Background gradient and drifting dust |
| `static.js` | 100 | The analogue TV snow on the landing |
| `style.css` | 630 | Everything except the project page |
| `project.css` | 190 | The project page |
| `index.html` | 140 | All markup, one file |

- **three.js r0.169** via CDN import map. `EffectComposer` → `RenderPass` → `UnrealBloomPass` →
  `OutputPass`.
- Typeface: **Inter Tight** (300/400/500/700) from Google Fonts, used for everything including
  headings.
- Deployed with `npx vercel --prod --yes`. `.vercelignore` keeps the 3D pipeline and the mascot
  binaries out of production.

### The core mechanism

One `THREE.Points` object with `COUNT` particles (70,000 desktop, 26,000 mobile). Every shape the
site shows is an array of that many positions. Morphing between shapes is a vertex-shader lerp from
`fromAttr` to `aTarget` driven by `uProgress`, with an arc so particles travel on a curve rather
than a straight line. A CPU mirror of that maths (`particleAt`) lets an interrupted morph restart
from wherever the particles actually are, so nothing pops.

Shapes are produced three ways, and this distinction matters:

1. **Formula** — the spine, and simple geometry. ~120 lines of maths describing vertebrae, discs,
   bezier tubes for the arches, blobs for nerve roots. Hand-written.
2. **Image sampling** — the DIZRUPT wordmark. Drawn to an offscreen canvas, bright pixels read
   back, particles land on them.
3. **Mesh sampling** — the mascot. Built in Blender, surface-sampled to a point cloud, quantised to
   int16, loaded as a binary.

---

## 3. What is built, screen by screen

### 3.1 The landing

Black. TV snow over it (six noise tiles cycled at 30fps with random offsets, plus a roll bar and
dropout lines), scanlines across everything including the type, a vignette and animated film grain.

**DIZRUPT** in the centre, the Z mirrored — the brand's one deliberate quirk. The word arrives with
a "counterflow": neighbouring letters rise from opposite directions inside their own masks.

Every 0.7–1.5 seconds the Z loses signal: the red, green and blue channels come apart by 11–44px on
their own axes, bands of the letter drop out, the whole glyph jumps. Driven frame by frame from JS
rather than by keyframes, because a fixed keyframe set plays the identical seizure every time and
the repeat is noticed before the effect is. After the first glitch the Z resolves to brand violet
(`#a310e7`) and stays there while the other letters remain white.

### 3.2 The intro sequence (scroll from the landing)

Five beats, ending in a held state:

1. **0–0.7s — the word tears out.** Every horizontal band of the word exists three times, in white,
   red and blue; they slide against each other until nothing is left. Not a fade.
2. **0.6–1.1s — the eyes.** Two glowing eyes come up in the exact middle of the screen with nothing
   else in the scene. They catch twice and drop out before holding, the way a filament does, then
   breathe on two slow cycles. The glow is authored as a shader quad, not left to the bloom pass —
   the bloom's coarsest mip is a texel tens of pixels across and drew a visible soft *square* around
   them on black.
3. **1.1–2.3s — the stare.** Eyes alone, holding the centre. The whole field is carried down by
   however far his eyes sit above his centre so they land dead centre, and the view is pushed in
   5.4× on them.
4. **2.3–3.7s — he builds.** The rest of him grows outward from those same points while the view
   pulls back. Cropped to **head, neck, traps and shoulders** — a portrait, not a figure.
5. **3.25s — the count.** He steps off centre and a 2×2 grid arrives beside him: *2023 founded in /
   6 solutions / 8+ countries / 25+ clients*. Hairlines forming a cross, no outer box, the last
   digit of 2023 in the same violet as the Z, numbers rolling up on arrival with tabular figures so
   nothing jitters.

**Then it holds.** The sequence stops here and waits. The next scroll releases it into the site.

### 3.3 The index (the project spiral)

Eleven client projects on a spiral winding around the particle spine. The focused card sits large at
the front, slightly leaning; the rest curve away. Scrolling turns the spiral one project at a time,
with trackpad coasting detected and ignored so one flick doesn't run away down the list.

Each card is a particle border around a panel showing the client's campaign banner, cropped to the
card's shape. Only the focused card shows its banner at full brightness; the rest are held back so
the spiral stays a dark field with one lit card in it.

Cards glitch: the picture tears into horizontal bands that slip sideways, the colour channels come
apart along the torn edges, the odd band blows out white like a dropped line on tape. Bursts of
about a tenth of a second, every one to four seconds, and only on the card you are looking at.

### 3.4 The project page (click a card)

Clicking breaks the card up where it sits, then it straightens, slides to the centre and squares up
to the camera, and the banner grows out of it into a full-bleed hero on a white page while the
particle field turns white and blows apart. The case study is set out below: the name at display
size, the summary against it, a thin-ruled row of client / services / sector, then three numbered
chapters (The Ask, The Solution, The Dizruption) whose numbers stay with you as you read them. At
the foot, back to the index on one side and the next project at display size on the other.

Going back tears the page, contracts it to the card, and only then does the card lean back into the
spiral. Every part of this is scrubbed from one clock so nothing drifts.

### 3.5 Contact

The one other white page. Scrolling past the last project hands over to it, and the handover is
*scrubbed* rather than fired — every frame is tied to how far you've scrolled, so it runs backwards
if you scroll back. The particles scatter and gather into the white surface; the headline assembles
once the white is nearly whole.

Content: email, phone, Mumbai, LinkedIn.

---

## 4. The mascot

Dizrupt has a mascot: a featureless violet humanoid, athletic build, one fist raised, rendered as
particles with RGB glitch flecks. The original is a GIF on dizrupt.in/about-us.

A 3D version was built in Blender to drive the intro:

- Base is **MakeHuman's CC0 mesh** — real ribcage, real joints, topology that deforms. Not modelled
  from primitives, deliberately: that would take far longer and land somewhere worse.
- `mascot3d/claude/build.py` is the pipeline: load, stylise the proportions, cut the facial cavities
  and patch them flat so he has structure but no features, build a rig from the mesh's own joint
  markers, pose, close the hands, shade with a starfield material and an inverted-hull outline.
- `export_transition.py` samples two poses off the same triangles with the same barycentric
  coordinates, so particle *i* stays stuck to the same patch of skin while the rig moves. Writes
  `mascot-neutral-claude.bin`, `mascot-flex-claude.bin` and `mascot-transition-claude.json`.
- The site crops the cloud to the portrait on load, so the binaries stay whole and the framing is a
  constant in `main.js`.

**The mascot is localhost-only.** `USE_MASCOT` gates on hostname, and the binaries are not
deployed. On production the spine holds the centre instead.

**The owner is not happy with the model.** That is the open problem — not the pipeline, which
works, but the design of the figure itself.

### 4.1 What has already been tried, and rejected

An alternative figure exists, unused, at `mascot3d/claude/mascot2.blend`, built in one reproducible
pass by `build_mascot2.py`. It is anatomically much better than the one in use: separated pectorals
with a proper shelf, a visible six-pack, lats, traps, a spinal channel, working hands, and the
mascot's own fist-up stance read off the GIF. It was put on the site and **the owner turned it
down**, twice, along with a heavier bodybuilder version before it. The site was reverted both times.

Take this as information, not as a spec. Three versions have been rejected without a stated reason,
which means nobody yet knows what "better" means here. A brief that says "improve the mascot" will
produce a fourth rejection. Either get the owner to say what is wrong with the current figure —
build, pose, face, or how it reads as particles rather than how it looks in Blender — or leave the
mascot out of scope.

### 4.2 Copyright, which is a hard constraint

The owner has twice asked for the mascot to be based on someone else's character: Alien X from Ben
10, and the Rinnegan from Naruto. Both are other people's property. What was built instead borrows
the *geometry* and leaves the identity alone — the figure has no horned crest and no chest emblem,
and the eyes are a generic concentric-ring iris rather than a copy of the specific design. Anything
a new agent builds must hold that line, and should say so plainly rather than quietly complying.

### 4.3 The eyes are load-bearing

The intro is built entirely around the mascot's eyes: they arrive alone in the middle of a black
screen and hold it for over a second before anything else exists. They are drawn as a filled almond
of particles carrying a concentric ring pattern — a shallow spiral, so that when it turns you can
see it turn, with a light travelling round it the other way. The GIF mascot's head is completely
blank. Any redesign that removes the eyes takes the intro's whole first act with it.

---

## 5. Constraints a new agent must respect

1. **A second agent (Codex) works in this repo in parallel.** It owns `mascot3d/build2.py` and
   `mascot.blend`; the `mascot3d/claude/` folder is the other agent's. Both edit `main.js`, so
   changes there can appear from nowhere.
2. **The mascot must not be deployed** until the owner says so. Keep the hostname gate and the
   `.vercelignore` entries.
3. **Blender 5.2.2 LTS** is installed and reachable live over MCP, so an agent can read the scene,
   run Python in it and see the viewport rather than rendering blind.
4. **No build step.** Adding one would be a significant decision, not a detail.
5. Client banners live in `banners/` (resized) with the originals in `Website banners 2/`, which is
   ignored by deploys.

---

## 6. What the owner wants next

Verbatim intent: *"the project window swirl looks good and all but i want it as a company website
too to have a good userflow and about us page and all like that"*

So: **keep the craft, add the company.** Concretely, what is missing:

- **No navigation.** The only way through is a scroll sequence. There is no menu, no way to reach a
  section directly, no URL per view.
- **No About page.** The agency's story, the team, the way it works.
- **No services page.** "6 solutions" is counted on the landing but never named or explained.
- **No entry for someone who arrived to hire them.** A visitor who wants to know what Dizrupt does
  and how to engage has to sit through a reveal and then turn a spiral.
- **No deep links, no shareable URLs, no SEO surface.** One HTML file, one title, one description.
- **Mobile is untested** beyond a few breakpoints.

The hard question for whoever plans this: how do you add conventional navigation and pages to a site
whose entire identity is one continuous particle scene, *without* turning it into a normal website
with a fancy background? The scene is the brand. A nav bar that switches between unrelated pages
would throw away everything that makes it worth looking at.

---

## 7. Your task

Write a prompt to give to the engineer-agent that works in this repo. It should:

- Tell it what to build, in what order, and what the flow between sections should be.
- Take a position on the hard question in section 6 rather than leaving it open.
- Say what to leave alone. The spiral, the project pages and the glitch language are working and the
  owner likes them.
- Be specific about the About page's content and structure, since that is named explicitly.
- Assume the agent can see its own work: it drives a browser and a live Blender, and it should
  verify visually rather than describe.

Do not write the code. Write the brief.
