import localFont from "next/font/local";

export const fraunces = localFont({
  src: [
    { path: "./Fraunces-Regular.woff2", weight: "300 600", style: "normal" },
    { path: "./Fraunces-Italic.woff2", weight: "300 500", style: "italic" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

export const inter = localFont({
  src: [{ path: "./Inter-Regular.woff2", weight: "300 700", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});

export const jetbrainsMono = localFont({
  src: [{ path: "./JetBrainsMono-Regular.woff2", weight: "300 700", style: "normal" }],
  variable: "--font-jbmono",
  display: "swap",
});
