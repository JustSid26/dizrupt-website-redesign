"use client";

import { useEffect, useState } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { PHONE_QUERY } from "@/lib/layout";
import { SolutionsTrain } from "@/components/home/SolutionsTrain";
import { SolutionCards } from "@/components/home/SolutionCards";

/* What Dizrupt does: on a wide screen the train ride between six billboards; on a phone, where a ride
   can't be swiped through, a carousel of cards the page scrolls straight past. */
export function Solutions() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = matchMedia(PHONE_QUERY);
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // the page changes height with it: every trigger and stop after it has moved
  useEffect(() => {
    ScrollTrigger.refresh();
  }, [phone]);
  return phone ? <SolutionCards /> : <SolutionsTrain />;
}
