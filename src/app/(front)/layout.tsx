import { Header } from "@/components/layout/header";
import { ViewModeProvider } from "@/context/view-mode";

export default function FrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewModeProvider>
      <Header />
      {children}
    </ViewModeProvider>
  );
}
