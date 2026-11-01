import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = "https://memovalet.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/meeting",
          "/tasks",
          "/insights",
          "/documents",
          "/history",
          "/teams",
          "/projects",
          "/people",
          "/live/",
          "/assigned/",
          "/preview/",
          "/settings",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
