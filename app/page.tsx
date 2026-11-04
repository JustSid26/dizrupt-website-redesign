import { Intro } from "@/components/home/Intro";
import { Solutions } from "@/components/home/Solutions";
import { AiAutomation } from "@/components/home/AiAutomation";
import { Bridge } from "@/components/home/Bridge";
import { Projects } from "@/components/home/Projects";
import { Contact } from "@/components/home/Contact";
import { HomeEnter } from "@/components/home/HomeEnter";
import { HomeGate } from "@/components/home/HomeGate";
import { LiteHome } from "@/components/home/LiteHome";

// intro → solutions → AI & automation → projects → contact, one scroll (or, without the 3D, the light version)
export default function Home() {
  return (
    <HomeGate lite={<LiteHome />}>
      <HomeEnter />
      <Intro />
      <Solutions />
      <Bridge />
      <AiAutomation />
      <Projects />
      <Contact />
    </HomeGate>
  );
}
