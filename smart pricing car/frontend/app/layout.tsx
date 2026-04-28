import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Dynamic Pricing Platform",
  description: "Production-ready frontend for dynamic pricing",
};

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/search", label: "Search" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <Providers>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
              <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
                Pricing SaaS
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                {nav.map((item) => (
                  <Link key={item.href} href={item.href} className="text-slate-600 hover:text-slate-900">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
