import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { DbProvider } from "@/components/DbProvider";
import { ServiceWorker } from "@/components/ServiceWorker";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Humidor",
  description:
    "Track your cigars, your humidor conditions, and how your ratings change with age.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Humidor",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
    { media: "(prefers-color-scheme: light)", color: "#f7f3ec" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies a stored theme before first paint, so there's no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <DbProvider>
          <main className="mx-auto w-full max-w-2xl px-4 pt-5">{children}</main>
          <BottomNav />
          <ServiceWorker />
        </DbProvider>
      </body>
    </html>
  );
}
