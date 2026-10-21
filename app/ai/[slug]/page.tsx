import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AiProjectPage } from "@/components/case/AiProjectPage";
import { TECH_PROJECTS, techProjectBySlug } from "@/content/techProjects";

export const generateStaticParams = () => TECH_PROJECTS.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = techProjectBySlug((await params).slug);
  return p ? { title: `${p.name} | AI & Automation | Dizrupt`, description: p.summary } : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const p = techProjectBySlug((await params).slug);
  if (!p) notFound();
  return <AiProjectPage project={p} />;
}
