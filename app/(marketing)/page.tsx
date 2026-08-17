import { Hero } from "@/components/scenes/Hero";
import { Problem } from "@/components/scenes/Problem";
import { OneDashboard } from "@/components/scenes/OneDashboard";
import { Psx } from "@/components/scenes/Psx";
import { Funds } from "@/components/scenes/Funds";
import { Goals } from "@/components/scenes/Goals";
import { Loans } from "@/components/scenes/Loans";
import { Bank } from "@/components/scenes/Bank";
import { NetWorth } from "@/components/scenes/NetWorth";
import { Security } from "@/components/scenes/Security";
import { HowItWorks } from "@/components/scenes/HowItWorks";
import { Faq } from "@/components/scenes/Faq";
import { Cta } from "@/components/scenes/Cta";
import { Footer } from "@/components/scenes/Footer";

/**
 * The scroll storyboard, in order. Each scene declares its own ground;
 * GroundLayer reads them and handles every backdrop handoff.
 * See design/LANDING-SPEC.md §2.
 */
export default function Home() {
  return (
    <>
      <Hero />         {/* 01  ink        the promise            */}
      <Problem />      {/* 02  ink→slate  the pain, converging   */}
      <OneDashboard /> {/* 03  slate      the resolution         */}
      <Psx />          {/* 04  warm       proof #1               */}
      <Funds />        {/* 05  warm       proof #2               */}
      <Goals />        {/* 06  paper      the light break        */}
      <Loans />        {/* 07  warm       the honest half        */}
      <Bank />         {/* 08  slate      the daily half         */}
      <NetWorth />     {/* 09  ink        the crescendo          */}
      <Security />     {/* 10  pine       the reassurance        */}
      <HowItWorks />   {/* 11  slate      the ask, made easy     */}
      <Faq />          {/* 12  ink        objections handled     */}
      <Cta />          {/* 13  ink        the close              */}
      <Footer />       {/* 14  ink                               */}
    </>
  );
}
