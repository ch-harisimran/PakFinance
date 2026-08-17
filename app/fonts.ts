import { Instrument_Serif, Manrope, JetBrains_Mono } from "next/font/google";

/**
 * Design system calls for Instrument Serif / Satoshi / JetBrains Mono.
 *
 * Satoshi is a Fontshare face and is not on Google Fonts, so Manrope stands in
 * for now — it is the closest available geometric grotesk with real character
 * in its numerals. To swap in the real thing: drop Satoshi-Variable.woff2 into
 * app/fonts/, replace `manrope` below with a next/font/local declaration, and
 * change nothing else. The rest of the app only ever sees --font-manrope.
 */

export const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const jetbrains = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const fontVariables = `${instrument.variable} ${manrope.variable} ${jetbrains.variable}`;
