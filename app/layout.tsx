import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";
import { ToastProvider } from "./components/ToastContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Work Order Management",
  description: "Full stack work order management application",
  icons: {
    icon: [
      { url: "/wms/nac_icon.png", type: "image/png", sizes: "32x32" },
      { url: "/wms/nac_icon.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: "/wms/nac_icon.png",
    apple: "/wms/nac_icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <ToastProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
