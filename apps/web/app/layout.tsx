import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "ADHDCheck · Pentru clinici: informația înainte de consult",
  description:
    "Pilot pentru clinici: copilul joacă 10–15 minute acasă, iar medicul primește rezultatul înainte de consult, doar cu acordul părintelui. Pentru copii de 6–12 ani. Nu este un diagnostic.",
  openGraph: {
    title: "ADHDCheck pentru clinici",
    description:
      "Pilot: părintele programează consultul, clinica trimite un link, copilul joacă acasă, iar medicul primește rezultatul înainte de consult, cu acordul părintelui. Fără marcaj CE.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1430",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning applies to this element's own attributes only ("only works one level deep",
    // react.dev hydrateRoot): browser extensions add attributes to <html> before React hydrates.
    <html lang="ro" className={`${fredoka.variable} ${nunito.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
