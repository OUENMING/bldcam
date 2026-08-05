import { Header } from "@/components/layout/header";
import { ViewModeProvider } from "@/context/view-mode";

export default function FrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewModeProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        跳到主要内容
      </a>
      <Header />
      {children}
    </ViewModeProvider>
  );
}
