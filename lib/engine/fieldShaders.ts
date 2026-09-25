// The particle field's shaders, ported from the original site. See field.ts for the uniforms.
/* ---------- Shaders ---------- */
// Simplex noise by Ashima Arts / Stefan Gustavson (MIT) — github.com/ashima/webgl-noise
export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uArcStrength;
uniform float uCoil;
uniform float uHeadOn;    // 1 while the mascot is the shape on screen
uniform float uAurora;    // and 1 while he is to be drawn as light rather than as points
uniform float uBustHalf;  // half his height, so the swell knows where his head ends
uniform float uGlitch;    // a burst: 1 while it tears, 0 otherwise
uniform float uGlitchSeed;
uniform float uGlitchLayer; // 0 body, 1 magenta misprint, 2 cyan misprint
uniform float uBodyReveal;  // intro: body grows out of the eyes
uniform float uEyeReveal;   // intro: the curtain of light kindles before the figure gathers
uniform float uKindle;      // the flicker and breath on that light
varying float vChip;
varying float vEcho;
varying float vDrop;
varying float vRay;         // where this point sits across the aurora's vertical rays
varying float vAurora;      // how much of the aurora look applies here at all
varying float vEdge;        // 1 on the silhouette, 0 deep inside him
varying float vLocalY;      // his own height, for the beam to be measured against
uniform float uHeadYaw;   // where the head is looking, radians
uniform float uHeadPitch;
uniform vec3 uHeadPivot;  // the neck, in the mascot's own space
attribute float aHead;    // >0: weighted neck/head turn; <0: full head turn for legacy eye samples
uniform float uDisperse;
uniform float uBeam, uBeamOn;
uniform float uFill;
uniform float uSize;
uniform float uPixelRatio;
uniform vec3 uMouse;
uniform float uMouseStrength;
attribute vec3 aTarget;
attribute float aEdge;    // how near the outline of the shape being headed for this point sits
attribute float aRandom;
varying float vRandom;
varying float vAlpha;
${NOISE}
void main() {
  // Per-particle progress: staggered start, quintic ease in and out.
  // Keep in sync with particleAt() in main.js, which replays this on the CPU.
  float t = clamp((uProgress - aRandom * 0.35) / 0.65, 0.0, 1.0);
  float p = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  vec3 pos = mix(position, aTarget, p);

  // On the way, each particle bows out along its own direction and the cloud swirls a little.
  float arc = sin(p * 3.14159265);
  pos += (vec3(fract(aRandom * 12.9898), fract(aRandom * 78.233), fract(aRandom * 37.719)) - 0.5) * arc * 1.6 * uArcStrength;
  float sw = arc * 0.6 * uArcStrength, c = cos(sw), sn = sin(sw);
  pos.xz = vec2(c * pos.x - sn * pos.z, sn * pos.x + c * pos.z);

  /* uCoil winds the whole shape about its own long axis: the further along a particle sits, the
     further round it is turned, and the turn keeps advancing with time. That is what makes the
     word stand where it is and read as a coil rather than a thing travelling anywhere. Applied
     after the morph, so it is a way of holding the shape, not part of it — no freeze to mirror. */
  if (uCoil > 0.0) {
    float ang = (pos.x * 0.9 + uTime * 1.5) * uCoil;
    float ca = cos(ang), sa = sin(ang);
    pos.yz = vec2(ca * pos.y - sa * pos.z, sa * pos.y + ca * pos.z);
  }

  /* The head turns on the neck to follow the cursor. Weight fades down the neck so the shoulders
     stay put; the eyes (aHead < 0) turn with it fully. Applied in the figure's own space, before the
     scroll's turn of the whole body, so the two compose. */
  float headW = (aHead < 0.0 ? 1.0 : aHead) * uHeadOn;
  if (headW > 0.0) {
    vec3 hp = pos - uHeadPivot;
    float cy = cos(uHeadYaw * headW), sy = sin(uHeadYaw * headW);
    hp.xz = vec2(cy * hp.x + sy * hp.z, -sy * hp.x + cy * hp.z);
    float cp = cos(uHeadPitch * headW), sp = sin(uHeadPitch * headW);
    hp.yz = vec2(cp * hp.y - sp * hp.z, sp * hp.y + cp * hp.z);
    pos = hp + uHeadPivot;
  }
  /* Spider-Verse language: irregular print patches slip independently anywhere on the figure, and
     a minority of bursts knock the whole colour plate out of registration. Two extra point passes
     carry the magenta/cyan echoes while the main body stays readable. */
  vChip = 0.0;
  vEcho = 1.0;
  vDrop = 0.0;
  // gated on the aurora, not the head turn: the head turn is tied to one pose, and he is glitched
  // in both — on the landing he stands in the neutral one
  // stronger when he stands whole over the city, where the same tear would be too small to see
  float glitch = uGlitch * uAurora * (1.0 + uFill * 2.5);
  if (glitch > 0.0) {
    vec2 cell = floor(vec2(
      pos.x * 5.0 + uGlitchSeed * 0.31,
      pos.y * 4.5 - uGlitchSeed * 0.23
    ));
    float cellNoise = fract(sin(dot(cell, vec2(12.9898, 78.233)) + uGlitchSeed * 31.7) * 43758.5453);
    float mode = fract(sin(uGlitchSeed * 19.19) * 43758.5453);
    /* Now and then the entire plate used to slip, which on a figure made of hard points read as
       a fault and on one made of light reads as the whole man teleporting sideways. It still
       happens, but rarely, and it moves him a fraction of what it did. */
    float fullBody = step(0.94, mode);
    float regionHit = step(0.70, cellNoise);
    float activePatch = max(fullBody, regionHit);
    float tear = cellNoise - 0.5;

    /* A heavy fault, RGB split. He is cut into horizontal slices; about half of them lurch
       sideways on every held step, now and then the whole of him jumps, and a few slices drop out
       altogether. He is drawn three times while it lasts — green here, red and blue in the two
       extra passes — and the channels tear apart further on the slices that moved. Where they
       still line up they add back to his own colour. */
    float slice = floor(pos.y * 3.2 + uGlitchSeed * 7.0);
    float sN = fract(sin(slice * 78.233 + uGlitchSeed * 12.9898) * 43758.5453);
    float bandHit = step(0.45, sN);
    float jump = step(0.72, mode);
    pos.x += (bandHit * (sN - 0.72) * 1.6 + jump * (fract(mode * 17.0) - 0.5) * 1.1 + activePatch * tear * 0.12) * glitch;
    pos.y += bandHit * (fract(sN * 7.3) - 0.5) * 0.08 * glitch;
    float chan = uGlitchLayer < 0.5 ? 0.0 : uGlitchLayer < 1.5 ? -1.0 : 1.0;
    pos.x += chan * (0.1 + 0.2 * mode + bandHit * 0.28) * glitch;
    pos.y += chan * bandHit * 0.03 * glitch;
    vDrop = step(0.86, fract(sN * 13.7)) * step(0.3, glitch);
  }

  /* ---------- Aurora ----------
     He is not a dust of points standing in the shape of a man; he is a curtain of light in that
     shape. Two things make that read. The surface hangs on a long swell travelling up through him,
     so the whole form moves the way a curtain does rather than sitting still; and the light is
     organised into narrow vertical rays that slide slowly sideways, which is what an aurora
     actually is — field lines lit end on. Everything here is off unless he is the shape on screen,
     so the spine and the project models are untouched. */
  vAurora = uAurora;
  vEdge = aEdge;
  vRay = 0.0;
  if (vAurora > 0.0) {
    float climb = uTime * 0.26;
    // the long swell: low frequency, travelling upward, so he breathes rather than wobbles
    float swell = snoise(vec3(pos.x * 0.5, pos.y * 0.34 - climb, pos.z * 0.5 + 4.1));
    // and a finer ripple across it, so the motion never resolves into one repeating wave
    float ripple = snoise(vec3(pos.x * 1.9 + climb * 0.7, pos.y * 1.25 - climb * 1.6, 7.3));
    /* Almost none of that reaches his head. The displacement is small in absolute terms, but a
       head is small too, and a wobble worth a fraction of a shoulder is worth a whole jawline on a
       face — it read as the man swelling and subsiding. So the swell is held off the head and neck
       and builds downward into the traps, which is also how anything hanging actually moves: still
       where it is held, loose at the bottom. */
    float h = pos.y / uBustHalf;                       // +1 at his crown, -1 at the cut
    float sway = 0.08 + 0.92 * smoothstep(-0.35, -0.95, h);
    pos.x += (swell * 0.085 + ripple * 0.028) * vAurora * sway;
    pos.y += ripple * 0.022 * vAurora * sway;
    pos.z += (swell * 0.06 - ripple * 0.02) * vAurora * sway;
    /* The rays. Narrow columns running down him, bent by the same swell that moves him, and
       sliding sideways over time. The power curve keeps most of him in the dim body of the light
       with a few bright blades in it, which is how a curtain reads — not an even glow. */
    float ray = 0.5 + 0.5 * sin(pos.x * 6.5 + swell * 2.0 + uTime * 0.42);
    vRay = pow(ray, 2.6);
  }

  vec3 q = pos * 0.55 + uTime * 0.12;
  vec3 n = vec3(snoise(q), snoise(q + 31.4), snoise(q - 17.3));
  pos += n * (0.05 + uDisperse * 1.2);
  pos *= 1.0 + uDisperse * 0.6;

  vLocalY = pos.y;   // read after the head turn, so the beam travels with him
  /* Built from the feet up: while the build line (uBeam) climbs him, the points just above it are
     still arriving — they spiral in from around him and settle as the line passes them. */
  if (uBeamOn > 0.5) {
    float incoming = smoothstep(uBeam - 0.1, uBeam + 1.4, vLocalY);
    float a = aRandom * 40.0 + uTime * 1.5;
    pos += vec3(cos(a), 0.4 + fract(aRandom * 7.3), sin(a)) * incoming * (1.5 + fract(aRandom * 3.1) * 2.5);
  }

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vec2 dir = world.xy - uMouse.xy;
  float dist = length(dir) + 1e-4;
  world.xy += (dir / dist) * smoothstep(1.3, 0.0, dist) * 0.7 * uMouseStrength;

  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;

  /* The odd bright speck, which is what gives the field its starlight — but not on the aurora,
     where a hard point in the middle of a soft light is the one thing that would read as a pixel. */
  float sparkle = step(0.985, fract(aRandom * 13.7)) * 2.0 * (1.0 - vAurora);
  /* Much larger on the aurora, and larger still on the bright rays. The points have to overlap
     several deep before they stop being points and start being light; below that no amount of
     softness will save them. */
  // only the rim is drawn, so only the rim is swollen; the inside stays small and unlit
  float swollen = 1.0 + vAurora * vEdge * (2.6 + vRay * 1.4);
  gl_PointSize = uSize * uPixelRatio * swollen * (0.4 + aRandom + sparkle) / -mv.z;

  vRandom = aRandom;
  vAlpha = 0.16 + 0.32 * fract(aRandom * 7.13) + sparkle * 0.2;
}`;

export const fragmentShader = /* glsl */ `
uniform float uGlitch;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform float uSplit; // 0: smooth blend between the two colours, 1: bone in A, discs tinted, nerves in B
varying float vRandom;
varying float vAlpha;
varying float vChip;
varying float vEcho;
varying float vDrop;
varying float vRay;
varying float vAurora;
varying float vEdge;
varying float vLocalY;
uniform float uBeam;
uniform float uBeamOn;
uniform float uGlitchLayer;
uniform float uTime;
uniform float uBodyReveal;
uniform float uEyeReveal;
uniform float uKindle;
uniform float uFill;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  float tone = mix(vRandom, smoothstep(0.72, 0.8, vRandom), uSplit);
  vec3 col = mix(uColorA, uColorB, tone);
  float alpha = a * a * vAlpha;

  /* ---------- Aurora ----------
     The sprite loses its edge entirely. A disc with a smoothstep falloff still has a boundary, and
     seventy thousand of them read as seventy thousand discs; an exponential never lands on one, so
     where they overlap there is nothing to see but light. Held far down in return — they are piled
     several deep and additive, and what is reasonable for one point is a white hole for all of
     them together. */
  if (vAurora > 0.0) {
    /* An exponential has no edge to find, which is the point — but it also never reaches zero, and
       whatever is left of it where the sprite is clipped draws the sprite. So it is windowed to
       nothing before the boundary, and what is left is light with no shape of its own. */
    float soft = exp(-d * d * 8.0) * smoothstep(0.5, 0.16, d);
    /* Purple throughout: deep indigo in the body of the light, the brand's violet through the
       rays, and only the very crest of a ray running up to white. An aurora is read by its
       gradient, not its hue — it is nearly all the dim part. */
    vec3 deep = vec3(0.24, 0.05, 0.52);
    vec3 lit = vec3(0.64, 0.22, 1.0);
    vec3 crest = vec3(0.92, 0.80, 1.0);
    vec3 aurora = mix(deep, lit, vRay);
    aurora = mix(aurora, crest, pow(vRay, 6.0) * 0.55);
    /* Held very far down. The sprites are wide enough to pile ten deep, they add, and the bloom
       goes over the top of that — what looks reasonable on one point is a white hole for all of
       them at once. The number below was arrived at by turning it down until he stopped being a
       lamp and started being a light. */
    /* Flat across the points on purpose. The field's usual three-fold spread in per-point alpha is
       what gives it its grain, and grain is the one thing an aurora has none of. */
    /* Only the outline. Squaring the band pulls the light onto the very edge and leaves the
       middle of him dark, so what you see is a figure drawn in light rather than filled with it —
       and the inside is not dimmed, it is simply not drawn. */
    /* A threshold, not a curve. Squaring and then cubing the band both still left a haze across
       the middle of him: tens of thousands of points whose band value is small but not nothing,
       each contributing almost none of it and all of them together contributing a fill. Anything
       that is not close to the outline now contributes exactly zero. */
    /* The threshold sits low now: the value it reads is a lighting term, not a distance, and most
       of a body at a grazing angle lands well under half. Cutting at the old level left only the
       hardest edges and threw the modelling away. */
    // uFill lets some light into the body too, so from far off he reads as a figure, not an outline
    float rim = max(smoothstep(0.32, 0.80, vEdge), uFill * (0.35 + 0.65 * vRay));
    /* The rays used to carry nearly all the brightness, which meant a jawline only showed where a
       ray happened to cross it and read as dashes rather than as a jaw. The band itself now carries
       most of it and the rays modulate what is already there, so the structure is continuous and
       the aurora runs over it. */
    float glow = soft * (0.45 + 0.62 * vRay) * uKindle * rim;
    col = mix(col, aurora, vAurora);
    alpha = mix(alpha, glow * (0.019 + 0.060 * vAlpha) * (1.0 + uFill * 2.8), vAurora);
  }

  /* The beam. Everything it has already passed is lit and stays lit; everything below it is still
     dark; and the beam itself is a bright edge travelling down him. He never moves — this is the
     whole of his arrival. */
  float reveal = uBodyReveal;
  if (uBeamOn > 0.5) {
    float passed = 1.0 - smoothstep(uBeam - 0.05, uBeam + 0.22, vLocalY);
    float crest = exp(-pow((vLocalY - uBeam) * 5.5, 2.0));
    // what is still arriving shows faintly above the line, so you see him being gathered
    reveal = max(passed, (1.0 - smoothstep(uBeam, uBeam + 1.4, vLocalY)) * 0.45);
    alpha += crest * a * 0.05 * vAurora * smoothstep(0.02, 0.35, vEdge);
  }
  // during an RGB split each pass carries one channel of him (see the vertex shader)
  float split = step(0.015, uGlitch) * step(0.02, vAurora);
  vec3 channel = uGlitchLayer < 0.5 ? vec3(0.0, 1.0, 0.0) : uGlitchLayer < 1.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
  col *= mix(vec3(1.0), channel, split);
  alpha *= 1.0 - vDrop * split; // the slices that dropped out
  gl_FragColor = vec4(col, alpha * uOpacity * reveal);
}`;
