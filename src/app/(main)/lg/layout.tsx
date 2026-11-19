import { LocaleSync } from "@/components/i18n/LocaleSync";

export default function LugandaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LocaleSync locale="lg" />
      {children}
    </>
  );
}
