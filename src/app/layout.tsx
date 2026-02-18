import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "SoloBackend — Digital Music Bundles",
  description:
    "Purchase and download professional music scores in PDF, MusicXML, and JSON formats.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-gray-200 bg-white py-8 mt-12">
            <div className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-500">
              &copy; {new Date().getFullYear()} SoloBackend. All rights reserved.
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
