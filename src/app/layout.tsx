import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const noto = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "중등 생기부 교사도우미",
  description:
    "학생 문서 기반 교과특기·행발·창체·동아리 특기사항 초안 작성 도우미",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${inter.variable} ${noto.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--canvas)] font-sans text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
