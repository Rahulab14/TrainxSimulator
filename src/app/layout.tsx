import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "TrainX Simulator",
  title: {
    default: "TrainX Simulator — 3D Train Driving Experience",
    template: "%s | TrainX Simulator",
  },
  description:
    "Drive high-speed, commuter, and freight trains in an interactive 3D railway simulator. Manage signals, stations, speed limits, doors, and track changes.",
  keywords: [
    "TrainX Simulator",
    "train simulator",
    "3D train game",
    "railway simulator",
    "train driving",
  ],
  openGraph: {
    type: "website",
    title: "TrainX Simulator — 3D Train Driving Experience",
    description:
      "Take the controls of express, commuter, and freight trains in an interactive 3D railway simulator.",
    siteName: "TrainX Simulator",
  },
  twitter: {
    card: "summary",
    title: "TrainX Simulator — 3D Train Driving Experience",
    description:
      "Drive express, commuter, and freight trains in an interactive 3D railway simulator.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
