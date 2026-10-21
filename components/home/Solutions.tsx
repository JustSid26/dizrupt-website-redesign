"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { isPhoneLayout, PHONE_QUERY } from "@/lib/layout";
import { SolutionsTrain } from "@/components/home/SolutionsTrain";
import { SolutionCards } from "@/components/home/SolutionCards";

/* What Dizrupt does: on a wide screen the train ride between six billboards; on a phone, where a ride
   can't be swiped through, a carousel of cards the page scrolls straight past. */
const subscribe = (onChange: () => void) => {
  const mq = matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
export function Solutions() {
  /* Known at the first render on the client, not an effect later: the two layouts are several
     screens apart in height, and a page that mounts as one and becomes the other moves everything
     below it (a case study's way back lands on its window before the swap, and is carried past it).
     The server renders the train; hydration corrects it in the same pass. */
  const phone = useSyncExternalStore(subscribe, isPhoneLayout, () => false);
  // the page changes height with it: every trigger and stop after it has moved
  useEffect(() => {
    ScrollTrigger.refresh();
  }, [phone]);
  return phone ? <SolutionCards /> : <SolutionsTrain />;
}
