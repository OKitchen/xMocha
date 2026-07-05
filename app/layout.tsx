import "./globals.css";

import type { ReactNode } from "react";

export const metadata = {
  title: "xMocha | Parallel future simulation",
  description: "Explore real decisions or play a five-turn role chapter inside a compiled story world.",
  openGraph: {
    title: "xMocha | Parallel future simulation",
    description: "Decision Mode compares possible futures. World Mode turns short story/lore text into a playable role chapter.",
    images: [
      {
        url: "https://xmocha.ai/assets/xmocha-og.jpg",
        width: 1200,
        height: 630,
        alt: "xMocha branching future simulation paths on a dark interface.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "xMocha | Parallel future simulation",
    description: "Explore decisions or play a compiled story world.",
    images: ["https://xmocha.ai/assets/xmocha-og.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
