import { cookies } from "next/headers";
import { Header } from "@/components/layout/header";
import {
  ViewModeProvider,
  VIEW_MODE_COOKIE,
  type ViewMode,
} from "@/context/view-mode";

export default async function FrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read here rather than in the provider: this is a server component, so the
  // layout can render the visitor's actual view mode on the first paint instead of
  // correcting after hydration. Every route in this group is already dynamic.
  const stored = (await cookies()).get(VIEW_MODE_COOKIE)?.value;
  const initialMode: ViewMode = stored === "feed" ? "feed" : "waterfall";

  return (
    <ViewModeProvider initialMode={initialMode}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        跳到主要内容
      </a>
      <Header />
      {/* The skip link targets #main, so the landmark belongs here. Only the
          homepage used to carry it, which left the link pointing at nothing on
          /map and /photo/[slug]. */}
      <main id="main">{children}</main>
    </ViewModeProvider>
  );
}
