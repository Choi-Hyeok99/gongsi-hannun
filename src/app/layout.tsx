import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "공시한눈",
  description: "기업 공시를 쉽고 빠르게 확인합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{const saved=localStorage.getItem("gongsi-theme");const theme=saved==="dark"||saved==="light"?saved:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=theme}catch{}` }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
