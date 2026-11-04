"use client";

import { useStore } from "@/lib/store";

/* The home page is the 3D experience (`children`) unless this device can't have it (Stage.tsx), and
   then it is the light version. The server renders the full one; the swap happens behind the count. */
export function HomeGate({ children, lite }: { children: React.ReactNode; lite: React.ReactNode }) {
  const none = useStore((s) => s.gl === "none");
  return <>{none ? lite : children}</>;
}
