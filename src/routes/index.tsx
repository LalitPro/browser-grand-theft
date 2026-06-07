import { createFileRoute } from "@tanstack/react-router";
import LosSantosGame from "@/components/game/LosSantosGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Los Pollos Streets — Free Top-Down Driving Game in Your Browser" },
      {
        name: "description",
        content:
          "Play a free GTA-style top-down driving game right in your browser. Grab cash, dodge the cops, and outrun your wanted level. No download required.",
      },
      { property: "og:title", content: "Los Pollos Streets — Browser Driving Game" },
      {
        property: "og:description",
        content:
          "A free GTA-inspired open-city driving game you can play instantly in the browser.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <h1 className="sr-only">Los Pollos Streets — free browser driving game</h1>
      <LosSantosGame />
    </>
  );
}
