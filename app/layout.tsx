import { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Kover roller",
  description: "Kover roller во имя всемогущего рандома!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
