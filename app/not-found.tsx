import type { Metadata } from "next";
import { NotFound } from "@/components/NotFound";

export const metadata: Metadata = { title: "404 | Dizrupt" };

export default function NotFoundPage() {
  return <NotFound />;
}
