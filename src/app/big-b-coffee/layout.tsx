import { Literata, Public_Sans } from "next/font/google";
import { ReactNode } from "react";

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata = {
  title: "Big B Coffee & Watcharakiat Oil",
  description: "Operational Dashboard",
};

export default function BigBCoffeeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={`${literata.variable} ${publicSans.variable} font-sans min-h-screen bg-[#FDFCF8] text-[#2D2A26]`}
    >
      {children}
    </div>
  );
}
