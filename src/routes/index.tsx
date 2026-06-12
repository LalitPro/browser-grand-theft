import { createFileRoute } from "@tanstack/react-router";
import LosSantosGame from "@/components/game/LosSantosGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mitti Aur Lahu — Free Indian Open-World Crime Game in Your Browser" },
      {
        name: "description",
        content:
          "Play Mitti Aur Lahu, a free GTA-style Indian open-world crime game. Follow Kabir Thorne through a 27-mission story across Navapur, Indrapuri and Bandarkhali. No download required.",
      },
      { property: "og:title", content: "Mitti Aur Lahu — Indian Open-World Crime Game" },
      {
        property: "og:description",
        content:
          "A free GTA-inspired Indian open-world crime saga with a 27-mission story campaign, playable instantly in the browser.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <h1 className="sr-only">Mitti Aur Lahu — free Indian open-world crime game</h1>
      <LosSantosGame />
    </>
  );
}
