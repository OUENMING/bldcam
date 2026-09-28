/**
 * The canonical origin of the deployed site.
 *
 * One source on purpose: it is load-bearing in places that do not look related —
 * Next's `metadataBase`, the Open Graph URL, the sitemap, the robots file, and the
 * JSON-LD on a photo page. A copy that drifts is not a build error, it is a wrong
 * URL shipped to crawlers, which is the kind of thing nobody notices for months.
 *
 * Not derived from an env var: the domain is a fact about this deployment, and the
 * site is built locally and rsynced, so there is no environment to read it from.
 */
export const SITE_URL = "https://bldcam.page";
