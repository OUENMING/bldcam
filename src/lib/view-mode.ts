/**
 * Read by the server layout in `src/app/(front)/layout.tsx`, written by the
 * client provider in `src/context/view-mode.tsx`.
 *
 * It lives here rather than next to the provider because the provider is a
 * `"use client"` module. A Server Component that imports a value from one gets a
 * client-reference proxy instead of the value, so `cookies().get(VIEW_MODE_COOKIE)`
 * was looking up a cookie whose name was an object — it returned undefined on
 * every request and the preference never survived a page load.
 */
export const VIEW_MODE_COOKIE = "bldcam-view-mode";

export type ViewMode = "waterfall" | "feed";
