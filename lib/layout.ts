/* Portrait screens (phones): the Solutions section is a carousel of cards there, scrolled through
   freely, instead of the train ride between billboards. Everything that knows about the train asks this. */
export const PHONE_QUERY = "(max-aspect-ratio: 1/1)";

let mq: MediaQueryList | null = null;
export const isPhoneLayout = () => {
  if (typeof window === "undefined") return false;
  mq ??= matchMedia(PHONE_QUERY);
  return mq.matches;
};
