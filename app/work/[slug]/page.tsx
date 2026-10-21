import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CaseStudy } from "@/components/case/CaseStudy";
import { bySlug, clients, slugOf } from "@/content/projects";

export const generateStaticParams = () => clients.map((p) => ({ slug: slugOf(p) }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = bySlug((await params).slug);
  return p ? { title: `${p.title} | Dizrupt`, description: p.summary } : {};
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const project = bySlug((await params).slug);
  if (!project) notFound();
  return <CaseStudy project={project} />;
}
