import { MetadataRoute } from "next";
import { buildResources, featuredResources } from "@/lib/marketing-resources";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = "https://memovalet.com";

  const staticRoutes = ["", "/solutions", "/integrations", "/resources", "/pricing", "/privacy", "/terms"].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
    })
  );

  const resourceRoutes = [...featuredResources, ...buildResources()].map((resource) => ({
    url: `${siteUrl}/resources/${resource.slug}`,
    lastModified: new Date(),
  }));

  return [...staticRoutes, ...resourceRoutes];
}
