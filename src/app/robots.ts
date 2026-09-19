import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // `*` already covers every crawler, and a named rule with identical
      // allow/disallow adds nothing. Baidu needs one only if the policy diverges.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: "https://bldcam.page/sitemap.xml",
  };
}
