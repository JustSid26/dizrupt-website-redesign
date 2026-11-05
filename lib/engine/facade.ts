import * as THREE from 'three';
import { isMobile, lean } from './config';

/* =========================================================
   Real facades, drawn in the shader so the whole city costs one
   pass: brick walk-ups with fire escapes and cornices, limestone
   and granite with Art Deco piers, glass curtain walls that
   reflect the sky, white concrete grids — each with windows set
   in frames, some lit from inside, and a row of shopfronts along
   the street. Lit by the sky and a low sun (blue hour) or the
   moon (night); both come from the uniforms below, eased between.

   All colour here is in linear light.
   ========================================================= */
export const MAT = { BROWNSTONE: 0, BRICK: 1, LIMESTONE: 2, GLASS: 3, CONCRETE: 4, GRANITE: 5, STEEL: 6 } as const;

export function lightingUniforms() {
  return {
    uSunDir: { value: new THREE.Vector3(0.35, 0.22, -0.9).normalize() },
    uSunCol: { value: new THREE.Color(0.5, 0.3, 0.22) },
    uSkyTop: { value: new THREE.Color(0.022, 0.045, 0.13) },
    uSkyHorizon: { value: new THREE.Color(0.13, 0.12, 0.19) },
    uAmbient: { value: 0.85 },
    uLit: { value: 0.35 }, // the share of windows with a light on
    uNight: { value: 0 },
  };
}

/** Blue hour (0) → full night (1). */
export function setMode(u: ReturnType<typeof lightingUniforms>, night: number) {
  const k = night;
  u.uNight.value = k;
  u.uSunDir.value.set(0.35, 0.22 + 0.25 * k, -0.9).normalize();
  u.uSunCol.value.setRGB(0.75 * (1 - k) + 0.06 * k, 0.45 * (1 - k) + 0.075 * k, 0.32 * (1 - k) + 0.13 * k);
  u.uSkyTop.value.setRGB(0.022 * (1 - k) + 0.005 * k, 0.045 * (1 - k) + 0.008 * k, 0.13 * (1 - k) + 0.028 * k);
  u.uSkyHorizon.value.setRGB(0.13 * (1 - k) + 0.025 * k, 0.12 * (1 - k) + 0.032 * k, 0.19 * (1 - k) + 0.06 * k);
  u.uAmbient.value = 0.85 * (1 - k) + 0.12 * k;
  u.uLit.value = (0.3 + 0.2 * k) * (lean && !isMobile ? 1.25 : 1); // (a lean computer: a few more windows lit, for the bloom it hasn't)
}

export const FACADE_GLSL = /* glsl */ `
uniform vec3 uSunDir, uSunCol, uSkyTop, uSkyHorizon;
uniform float uAmbient, uLit, uNight, uTime;
float fhash(vec2 p, float s) { return fract(sin(dot(p, vec2(127.1, 311.7)) + s * 91.3) * 43758.5453); }
// a box from lo to hi in a cell, its edges softened by w (a pixel's share of the cell): clean at any size
float aaBox(vec2 f, vec2 lo, vec2 hi, vec2 w) {
  vec2 a = smoothstep(lo - w, lo + w, f) * (1.0 - smoothstep(hi - w, hi + w, f));
  return a.x * a.y;
}
vec3 skyAt(vec3 d) {
  float h = clamp(d.y, -0.2, 1.0);
  return mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.6, h)) * (h < 0.0 ? 0.35 : 1.0);
}
// mat: see MAT; tint varies each building's stone or brick; u: across the face, y: up it (world units)
vec3 facade(vec3 wp, vec3 n, vec3 view, float mat, vec3 tint, float seed, float u, float width, float y, float h, float groundY) {
  // storey heights and window spacing, fine enough that a tower has the hundreds of windows a real one does
  float fh = mat < 1.5 ? 0.3 : mat < 2.5 ? 0.24 : mat < 3.5 ? 0.22 : mat < 4.5 ? 0.3 : 0.24;
  float bay = mat < 1.5 ? 0.26 : mat < 2.5 ? 0.2 : mat < 3.5 ? 0.2 : mat < 4.5 ? 0.3 : 0.2;
  vec2 cell = vec2(u / bay, y / fh);
  vec2 id = floor(cell);
  vec2 f = fract(cell);
  /* How much of a window's cell one pixel covers, across and up (taken here, before anything branches).
     Every edge below is softened by it, so a window a few pixels across has clean edges, not stair-
     steps; and where a window is smaller than about a pixel it is drawn as its average (the share of
     the cell it covers, the share of rooms lit, their mean lamp) rather than as noise that crawls as the
     camera moves. The same for the bricks' courses and the curtain walls' mullions. Low resolutions
     (a weak computer's 1x or less) need it most; it costs a few sums a pixel */
  vec2 px = max(fwidth(cell), vec2(1e-4));
  vec2 w = min(px * 0.7, vec2(0.2));
  float far = smoothstep(0.55, 1.1, max(px.x, px.y));
  vec2 bk = vec2(u / 0.06 + mod(floor(y / 0.025), 2.0) * 0.5, y / 0.025);
  vec2 bpx = fwidth(bk);
  float brickFar = smoothstep(0.35, 0.9, max(bpx.x, bpx.y));
  // the wall
  vec3 wall;
  if (mat < 1.5) {
    // brick: courses and a little variation from brick to brick, mortar between
    float mortar = mix(clamp(step(0.88, fract(bk.y)) + step(0.94, fract(bk.x)), 0.0, 1.0), 0.17, brickFar);
    wall = mix(tint * (0.8 + 0.4 * mix(fhash(floor(bk), seed), 0.5, brickFar)), vec3(0.2, 0.18, 0.16), mortar * 0.6);
  } else if (mat < 2.5) {
    // limestone, with the Art Deco piers standing proud between the windows
    float pier = 1.0 - smoothstep(0.12, 0.16, abs(f.x - 0.5) > 0.36 ? 0.0 : 1.0);
    wall = tint * (0.9 + 0.1 * fhash(vec2(floor(y / 0.2), floor(u / 0.6)), seed)) * (1.0 + pier * 0.15);
  } else if (mat < 3.5) {
    wall = vec3(0.02, 0.025, 0.035); // the spandrels of a curtain wall
  } else if (mat < 4.5) {
    wall = vec3(0.5, 0.5, 0.48);
  } else if (mat < 5.5) {
    wall = tint * 0.35;
  } else {
    wall = vec3(0.55, 0.57, 0.6);
  }
  // the window in this cell
  vec2 lo = mat < 1.5 ? vec2(0.26, 0.28) : mat < 2.5 ? vec2(0.3, 0.26) : mat < 3.5 ? vec2(0.03, 0.08) : mat < 4.5 ? vec2(0.16, 0.16) : vec2(0.22, 0.26);
  vec2 hi = vec2(1.0) - (mat < 3.5 && mat > 2.5 ? vec2(0.03, 0.03) : lo * vec2(1.0, 0.7));
  float winArea = (hi.x - lo.x) * (hi.y - lo.y), frameArea = (hi.x - lo.x + 0.1) * (hi.y - lo.y + 0.1) - winArea;
  float inWin = mix(aaBox(f, lo, hi, w), winArea, far);
  float frame = mix(aaBox(f, lo - 0.05, hi + 0.05, w), winArea + frameArea, far) - inWin;
  // not at the corners, not on the shopfront floor, not above the roof line
  float usable = step(0.1, u) * step(u, width - 0.1) * step(fh * 1.05, y) * step(y, h - 0.08);
  inWin *= usable; frame *= usable;
  // what the glass shows: the sky, reflected, or a lit room
  vec3 r = reflect(-view, n);
  float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
  vec3 glass = mix(vec3(0.01, 0.012, 0.018), skyAt(r), 0.25 + 0.6 * fres);
  float blue = mat < 2.5 ? 0.75 : 0.4;
  float roomOn = mix(step(1.0 - uLit, fhash(id, seed)) * step(0.12, fhash(vec2(id.y, 3.0), seed)), clamp(uLit, 0.0, 1.0) * 0.88, far);
  vec3 lamp = mix(vec3(1.0, 0.62, 0.3), vec3(0.72, 0.85, 1.0), mix(step(blue, fhash(id + 5.0, seed)), 1.0 - blue, far));
  lamp *= 0.16 + 0.22 * mix(fhash(id + 9.0, seed), 0.5, far);
  // blinds half down in some rooms
  lamp *= mix(1.0 - 0.6 * step(0.7, fhash(id + 2.0, seed)) * step(0.55, f.y), 0.92, far);
  // light it: the sky from above, the sun or moon from its side, darker low down among the streets
  float up = n.y * 0.5 + 0.5;
  vec3 amb = mix(uSkyHorizon * 0.6, uSkyTop, up) * uAmbient * 2.2;
  float ao = 0.45 + 0.55 * smoothstep(0.0, 3.5, y + (wp.y - groundY - y));
  vec3 lit = amb * ao + uSunCol * max(dot(n, uSunDir), 0.0) * 0.8;
  vec3 col = wall * lit;
  // the frame catches a little more light than the wall
  col = mix(col, (mat < 2.5 ? vec3(0.45) : vec3(0.08)) * lit, frame * 0.8);
  col = mix(col, glass + lamp * roomOn * (0.8 + uNight * 0.5), inWin);
  if (mat > 2.5 && mat < 3.5) {
    // the curtain wall is all glass: mullions between, reflection over everything
    float mull = mix(1.0 - smoothstep(0.035 - w.x, 0.035 + w.x, min(f.x, 1.0 - f.x)) * smoothstep(0.05 - w.y, 0.05 + w.y, min(f.y, 1.0 - f.y)), 0.16, far);
    col = mix(glass * (0.8 + 0.4 * mix(fhash(vec2(id.x, 1.0), seed), 0.5, far)) + lamp * roomOn * 0.9 * (1.0 - mull), vec3(0.18, 0.19, 0.2) * lit, mull);
  }
  // fire escapes on the brick walk-ups: a landing at every floor on alternate bays, and the stair
  if (mat > 0.5 && mat < 1.5 && mod(id.x, 4.0) < 2.0 && usable > 0.5) {
    float landing = 1.0 - smoothstep(0.04 - w.y, 0.04 + w.y, abs(f.y - 0.12));
    float stair = 1.0 - smoothstep(0.03 - w.x, 0.03 + w.x, abs(fract(cell.x * 0.5 - f.y * 0.5) - 0.5));
    col = mix(col, vec3(0.015), mix(max(landing, stair * 0.8), 0.12, far) * 0.85);
  }
  // shops along the street: lit glass fronts, signs over them
  if (y < fh * 1.05 && y > 0.02) {
    float shop = step(0.08, fract(u / 0.9)) * step(fract(u / 0.9), 0.92) * step(y, fh * 0.75);
    vec3 shopLight = mix(vec3(1.0, 0.75, 0.45), vec3(0.8, 0.9, 1.0), fhash(vec2(floor(u / 0.9), 7.0), seed));
    col = mix(col, shopLight * (0.12 + 0.18 * uNight), shop * 0.9);
    float sign = step(fh * 0.78, y) * step(y, fh * 0.95) * step(0.5, fhash(vec2(floor(u / 0.9), 11.0), seed));
    vec3 signCol = 0.6 + 0.4 * cos(6.2832 * (fhash(vec2(floor(u / 0.9), 13.0), seed) + vec3(0.0, 0.33, 0.67)));
    col = mix(col, signCol * (0.15 + 0.3 * uNight), sign);
  }
  // a cornice along the top of the older buildings
  if (mat < 2.5 && h - y < 0.1) col = mix(col, vec3(0.5, 0.46, 0.4) * lit, 0.7);
  return col;
}
`;
