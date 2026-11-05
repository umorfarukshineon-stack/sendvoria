import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sendvoria — Marketing meets Commerce",
  description: "A smarter workspace for email marketing and product campaigns."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}