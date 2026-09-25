import { siInstagram, siWhatsapp } from "simple-icons";

/* The studio's links, each lit on a skyscraper facing the city view at contact. `path` is a 24×24
   SVG path (simple-icons, CC0); LinkedIn and Mail are drawn by hand in the tower's sign. */
export type Social = { name: string; href: string; color: string; path?: string; mark?: "in" | "mail" };

export const SOCIALS: Social[] = [
  { name: "LinkedIn", href: "https://www.linkedin.com/in/shamit-gandhi-8b727a194/", color: "#0a66c2", mark: "in" },
  // PLACEHOLDER — set the studio's real Instagram handle
  { name: "Instagram", href: "https://www.instagram.com/", color: "#e4405f", path: siInstagram.path },
  { name: "Mail", href: "mailto:shamit.g@dizrupt.in", color: "#a310e7", mark: "mail" },
  { name: "WhatsApp", href: "https://wa.me/919920939203", color: "#25d366", path: siWhatsapp.path },
];
