import { Intro } from "@/components/home/Intro";
import { Solutions } from "@/components/home/Solutions";
import { AiAutomation } from "@/components/home/AiAutomation";
import { Bridge } from "@/components/home/Bridge";
import { Projects } from "@/components/home/Projects";
import { Contact } from "@/components/home/Contact";
import { HomeEnter } from "@/components/home/HomeEnter";

// intro → solutions → AI & automation → projects → contact, one scroll
export default function Home() {
  return (
    <>
      <HomeEnter />
      <Intro />
      <Solutions />
      <Bridge />
      <AiAutomation />
      <Projects />
      <Contact />
    </>
  );
}
