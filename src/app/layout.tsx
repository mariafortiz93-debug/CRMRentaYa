import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppChrome } from "@/components/layout/AppChrome";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { NotificationChecker } from "@/components/shared/NotificationChecker";
import { SessionProvider } from "@/lib/session-context";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Renta Ya Motocicletas - CRM",
  description:
    "CRM de Renta Ya Motocicletas: pipeline de leads, agenda de visitas y seguimiento de tramites.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex" suppressHydrationWarning>
        <SessionProvider>
          <TooltipProvider>
            <AppChrome>{children}</AppChrome>
            <Toaster />
            <NotificationChecker />
          </TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
