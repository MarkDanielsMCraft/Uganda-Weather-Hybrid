import { FloatingAdvisorHost } from "@/components/advisor/FloatingAdvisorHost";
import { AppLaunchSplash } from "@/components/layout/AppLaunchSplash";
import { MainScrollArea } from "@/components/layout/MainScrollArea";
import { TopBar } from "@/components/layout/TopBar";
import { WeatherBackdrop } from "@/components/layout/WeatherBackdrop";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppLaunchSplash />
      <WeatherBackdrop />
      <div className="relative z-10 flex h-dvh min-h-dvh flex-col overflow-hidden bg-transparent">
        <TopBar />
        <MainScrollArea>{children}</MainScrollArea>
      </div>
      <FloatingAdvisorHost />
    </>
  );
}
