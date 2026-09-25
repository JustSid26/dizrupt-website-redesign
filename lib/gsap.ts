"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { CustomEase } from "gsap/CustomEase";

let registered = false;
if (typeof window !== "undefined" && !registered) {
  gsap.registerPlugin(ScrollTrigger, SplitText, Flip, CustomEase);
  CustomEase.create("expo.site", "0.19, 1, 0.22, 1");
  CustomEase.create("inout.site", "0.76, 0, 0.24, 1");
  registered = true;
}

export { gsap, ScrollTrigger, SplitText, Flip };
