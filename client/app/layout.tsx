import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drenas Rent a Car | Premium Car Rental in Kosovo",
  description: "Premium car rental service in Drenas, Kosovo. Browse luxury, SUV, and economy vehicles. Book online with instant confirmation.",
  keywords: "rent a car, Drenas, Kosovo, car rental, luxury cars, SUV rental",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-dm">{children}</body>
    </html>
  );
}
