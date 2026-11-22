import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A-Game",
  description:
    "A-Game: open-source NUS module planner with prerequisite checking and degree-requirement tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
