import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./ui/Providers";

export const metadata: Metadata = {
  title: "OpenScene Admin",
  description: "OpenScene content and runtime administration",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
