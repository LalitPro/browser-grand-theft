import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

interface PhaserSearch {
  mode?: string;
}

export const Route = createFileRoute("/phaser")({
  validateSearch: (search: Record<string, unknown>): PhaserSearch => {
    return {
      mode: search.mode as string | undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Phaser Open World Map — Navapur, Indrapuri & Bandarkhali" },
      {
        name: "description",
        content: "Explore the custom Indian-themed GTA style open world map in Phaser.js.",
      },
    ],
  }),
  component: PhaserPage,
});

function PhaserPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const [stats, setStats] = useState({
    cash: 1000,
    score: 0,
    wanted: 0,
    district: "Navapur",
    isCoop: false,
    p1Health: 100,
    p1Armor: 0,
    p1Weapon: "pistol",
    p1Ammo: 0,
    p2Health: 0,
    p2Armor: 0,
    p2Weapon: "pistol",
    p2Ammo: 0,
    activeSubtitle: "",
    activeSubtitleSub: "",
    activeObjective: "",
    sideObjective: "",
    shopOpen: false,
    shopAmmo: {} as Record<string, number>,
    shopOwned: [] as string[],
  });

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    let active = true;
    let gameInstance: any = null;

    import("../phaser/config").then(({ startPhaserGame }) => {
      if (!active) return;
      const searchParams = new URLSearchParams(window.location.search);
      const isCoop = searchParams.get("mode") === "coop";
      gameInstance = startPhaserGame(containerRef.current!, isCoop);
      gameRef.current = gameInstance;

      const interval = setInterval(() => {
        if (!gameInstance || !gameInstance.scene || !gameInstance.scene.scenes[0]) return;
        const scene = gameInstance.scene.scenes[0];
        sceneRef.current = scene;
        if (scene && scene.player) {
          let currentDistrict = "Kisanpur Rural";
          const px = scene.player.sprite.x;
          const py = scene.player.sprite.y;

          if (px < 1200) {
            currentDistrict = "Navapur City";
          } else if (px >= 2150 && px < 3080 && py >= 1000 && py < 2000) {
            currentDistrict = "Indrapuri Downtown";
          } else if (px >= 3080) {
            currentDistrict = "Bandarkhali Port";
          }

          const isCoopVal = scene.registry.get("isCoop");
          const p1 = scene.player;
          const p2 = scene.player2;
          const p1Weapon = p1 ? p1.weapons[p1.weaponIndex] : "pistol";
          const p2Weapon = p2 ? p2.weapons[p2.weaponIndex] : "pistol";

          setStats({
            cash: scene.cash || 0,
            score: scene.score || 0,
            wanted: scene.wantedLevel || 0,
            district: currentDistrict,
            isCoop: !!isCoopVal,
            p1Health: p1 ? p1.health : 100,
            p1Armor: p1 ? p1.armor : 0,
            p1Weapon,
            p1Ammo: p1 ? (p1.ammo?.[p1Weapon] ?? 0) : 0,
            p2Health: p2 ? p2.health : 0,
            p2Armor: p2 ? p2.armor : 0,
            p2Weapon,
            p2Ammo: p2 ? (p2.ammo?.[p2Weapon] ?? 0) : 0,
            activeSubtitle: scene.activeSubtitle || "",
            activeSubtitleSub: scene.activeSubtitleSub || "",
            activeObjective: scene.activeObjective || "",
            sideObjective: scene.activeSideObjective || "",
            shopOpen: !!scene.shopState?.open,
            shopAmmo: scene.shopState?.ammo || {},
            shopOwned: scene.shopState?.owned || [],
          });
        }
      }, 250);

      return () => {
        clearInterval(interval);
      };
    });

    return () => {
      active = false;
      if (gameInstance) {
        gameInstance.destroy(true);
      }
    };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950 font-body select-none" suppressHydrationWarning={true}>
      {/* Phaser Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 h-full w-full" id="phaser-game" suppressHydrationWarning={true} />

      {/* React HUD Layer */}
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between" suppressHydrationWarning={true}>
        
        {/* Top-Left: Navigation back, Title, & P1 Info */}
        <div className="pointer-events-auto flex flex-col gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded bg-black/75 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-white border border-white/10 hover:bg-accent hover:text-white transition-all shadow-[var(--shadow-neon)]"
          >
            ← Back to Classic
          </Link>
          <div className="rounded bg-black/60 px-4 py-2 border border-white/10 text-white backdrop-blur-md">
            <h1 className="font-display text-lg uppercase tracking-wide text-[#ffc450] leading-none">
              Mitti Aur Lahu Map
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-white/50 mt-1">
              Zone: <span className="text-white font-bold">{stats.district}</span>
            </p>
          </div>

          {/* P1 Health & Armor Bar */}
          <div className="rounded bg-black/60 p-2.5 border border-white/10 text-white backdrop-blur-md w-48">
            <p className="text-[9px] uppercase tracking-widest text-[#ff4d4d] font-bold mb-1">P1 Health</p>
            <div className="flex h-2.5 w-full gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-full flex-1 transition-colors ${stats.p1Health > i * 10 ? (stats.p1Health > 40 ? "bg-[#41d67e]" : "bg-[#e23b3b]") : "bg-white/10"}`}
                />
              ))}
            </div>
            {stats.p1Armor > 0 && (
              <div className="flex h-1.5 w-full gap-0.5 mt-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 transition-colors ${stats.p1Armor > i * 10 ? "bg-[#39b6ff]" : "bg-white/5"}`}
                  />
                ))}
              </div>
            )}
            <p className="text-[9px] uppercase tracking-wider text-white/60 mt-1.5">
              Gun: <span className="text-white font-bold">{stats.p1Weapon.toUpperCase()}</span>
              <span className="ml-2 text-[#ffc450] font-bold">{stats.p1Ammo}</span>
              <span className="text-white/40"> rounds</span>
            </p>
          </div>
        </div>

        {/* Top-Right: Stats Panel & P2 Info */}
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="rounded bg-black/60 px-5 py-2 border border-white/10 backdrop-blur-md pointer-events-auto">
            <p className="text-[9px] uppercase tracking-widest text-white/55">Wallet</p>
            <span className="font-display text-2xl text-[#7bd88f] drop-shadow leading-none">
              ₹{stats.cash.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex gap-1 rounded bg-black/60 px-3 py-1.5 border border-white/10 backdrop-blur-md pointer-events-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                className={`h-5 w-5 ${i < stats.wanted ? "fill-[#ff4d4d] animate-pulse" : "fill-white/10"}`}
              >
                <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
              </svg>
            ))}
          </div>

          {/* Active Mission Objective Panel */}
          {!stats.isCoop && stats.activeObjective && (
            <div className="rounded border-l-4 border-l-[#ffc450] border-y border-r border-white/10 bg-black/75 p-3 backdrop-blur-md text-left w-64 pointer-events-auto shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="flex h-1.5 w-1.5 rounded-full bg-[#ffc450] animate-ping" />
                <p className="text-[9px] uppercase tracking-widest text-[#ffc450] font-bold">
                  Active Objective
                </p>
              </div>
              <p className="text-xs font-medium text-white/90 leading-relaxed font-sans">
                {stats.activeObjective}
              </p>
            </div>
          )}

          {/* Side Mission Objective Panel */}
          {stats.sideObjective && (
            <div className="rounded border-l-4 border-l-[#22d3ee] border-y border-r border-white/10 bg-black/75 p-3 backdrop-blur-md text-left w-64 pointer-events-auto shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="flex h-1.5 w-1.5 rounded-full bg-[#22d3ee] animate-ping" />
                <p className="text-[9px] uppercase tracking-widest text-[#22d3ee] font-bold">
                  Side Mission
                </p>
              </div>
              <p className="text-xs font-medium text-white/90 leading-relaxed font-sans">
                {stats.sideObjective}
              </p>
            </div>
          )}

          {/* P2 Health & Armor Bar */}
          {stats.isCoop && (
            <div className="rounded bg-black/60 p-2.5 border border-white/10 text-white backdrop-blur-md w-48 text-left pointer-events-auto mt-1">
              <p className="text-[9px] uppercase tracking-widest text-[#39b6ff] font-bold mb-1">P2 Health</p>
              <div className="flex h-2.5 w-full gap-0.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 transition-colors ${stats.p2Health > i * 10 ? (stats.p2Health > 40 ? "bg-[#41d67e]" : "bg-[#e23b3b]") : "bg-white/10"}`}
                  />
                ))}
              </div>
              {stats.p2Armor > 0 && (
                <div className="flex h-1.5 w-full gap-0.5 mt-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 transition-colors ${stats.p2Armor > i * 10 ? "bg-[#39b6ff]" : "bg-white/5"}`}
                    />
                  ))}
                </div>
              )}
              <p className="text-[9px] uppercase tracking-wider text-white/60 mt-1.5">
                Gun: <span className="text-white font-bold">{stats.p2Weapon.toUpperCase()}</span>
                <span className="ml-2 text-[#39b6ff] font-bold">{stats.p2Ammo}</span>
                <span className="text-white/40"> rounds</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom-Right: Controls instructions */}
      <div className="pointer-events-none absolute right-4 bottom-4 z-10 rounded border border-white/10 bg-black/75 px-4 py-2 text-right text-white backdrop-blur-md">
        <p className="text-[10px] uppercase tracking-widest text-[#ffc450] font-bold mb-1">
          Controls Reference
        </p>
        <p className="text-[10px] uppercase tracking-wider text-white/70">
          Player 1: <span className="text-white font-bold">W A S D</span> | Enter: <span className="text-white font-bold">E</span> | Shoot: <span className="text-white font-bold">F / Space</span> | Swap: <span className="text-white font-bold">Q</span>
        </p>
        {stats.isCoop && (
          <p className="text-[10px] uppercase tracking-wider text-white/70 mt-0.5">
            Player 2: <span className="text-white font-bold">Arrows</span> | Enter: <span className="text-white font-bold">Enter</span> | Shoot: <span className="text-white font-bold">/</span> | Swap: <span className="text-white font-bold">.</span>
          </p>
        )}
        <p className="text-[10px] uppercase tracking-wider text-white/70 mt-1 border-t border-white/10 pt-1">
          Cheats: <span className="text-[#ff4d4d] font-bold">K</span> Wanted Up | <span className="text-[#7bd88f] font-bold">L</span> Wanted Clear
        </p>
      </div>

      {/* Subtitles Overlay */}
      {!stats.isCoop && stats.activeSubtitle && (
        <div className="absolute inset-x-4 bottom-24 z-20 flex flex-col items-center justify-center pointer-events-none">
          <div className="rounded-lg bg-black/85 px-6 py-3 border border-[#ffc450]/30 backdrop-blur-md text-center max-w-xl shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_15px_rgba(255,196,80,0.15)] pointer-events-auto">
            <p className="text-sm md:text-base font-semibold text-white tracking-wide">
              {stats.activeSubtitle}
            </p>
            {stats.activeSubtitleSub && (
              <p className="text-xs md:text-sm font-medium text-[#ffc450] mt-1 font-sans">
                {stats.activeSubtitleSub}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
