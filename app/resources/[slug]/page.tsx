import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { buildResourceDetail, buildResources, featuredResources } from "@/lib/marketing-resources";
import ResourceDetailBody from "@/components/marketing/ResourceDetailBody";

export function generateStaticParams() {
  const library = buildResources();
  return [...featuredResources, ...library].map((resource) => ({ slug: resource.slug }));
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const library = buildResources();
  const resource = [...featuredResources, ...library].find((item) => item.slug === slug);
  if (!resource) notFound();

  return (
    <div className="mk-dark relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] mk-grid-fade" />
      <MarketingNav active="/resources" />

      <main className="relative px-6 pt-16 pb-24 md:pt-20 overflow-hidden">
        <div className="orb h-96 w-96 -left-24 top-16 bg-indigo-500/25" />
        <div className="orb h-80 w-80 -right-16 top-64 bg-cyan-400/15" />

        <div className="relative mx-auto max-w-3xl">
          <Link
            href="/resources"
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition mb-8"
          >
            <ArrowLeft size={15} weight="bold" />
            All resources
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70 mb-5">
            {resource.category}
          </span>

          <h1 className="text-3xl md:text-5xl font-display font-light tracking-tighter leading-tight mb-5">
            {resource.title}
          </h1>
          <p className="text-white/55 text-base md:text-lg leading-relaxed mb-12">
            {resource.body}
          </p>

          <ResourceDetailBody detail={buildResourceDetail(slug)} />

          <div className="mt-16 text-center">
            <Link
              href="/login"
              className="mk-glow-btn inline-block px-7 py-3.5 rounded-full text-sm font-medium text-white transition active:scale-[0.98]"
            >
              Get started free
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
