import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SolutionPage } from "@/components/case/SolutionPage";
import { SOLUTIONS, solutionBySlug, solutionSlug } from "@/content/solutions";

export const generateStaticParams = () => SOLUTIONS.map((s) => ({ slug: solutionSlug(s) }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = solutionBySlug((await params).slug);
  return s ? { title: `${s.name} | Dizrupt`, description: s.line } : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const s = solutionBySlug((await params).slug);
  if (!s) notFound();
  return <SolutionPage solution={s} />;
}
