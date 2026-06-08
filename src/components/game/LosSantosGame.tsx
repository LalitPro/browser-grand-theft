import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type GameState, type Mode, type PlayerHud } from "./engine";

const INITIAL: GameState = {
  mode: "solo",
  cash: 0,
  wanted: 0,
  score: 0,
  players: [{ health: 100, speedKmh: 0, onFoot: true, alive: true, respawnIn: 0, ammo: 48 }],
  running: false,
  gameOver: false,
};

type Screen = "menu" | "playing" | "over";

export default function LosSantosGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [state, setState] = useState<GameState>(INITIAL);
  const [screen, setScreen] = useState<Screen>("menu");
  const [best, setBest] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const parent = canvas.parentElement!;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const game = new Game(canvasRef.current!, (s) => {
      setState(s);
      if (s.gameOver) {
        setScreen("over");
        setBest((b) => Math.max(b, s.score + s.cash));
      }
    });
    gameRef.current = game;

    const blocked = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Slash"];
    const down = (e: KeyboardEvent) => {
      if (blocked.includes(e.code)) e.preventDefault();
      game.setKey(e.code, true);
    };
    const up = (e: KeyboardEvent) => game.setKey(e.code, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      game.stop();
    };
  }, []);

  const startGame = useCallback((mode: Mode) => {
    gameRef.current?.start(mode);
    setScreen("playing");
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {screen === "playing" && (
        <>
          {/* GTA-style top-right: money + wanted stars */}
          <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
            <div className="rounded-sm bg-black/55 px-4 py-1.5 backdrop-blur-sm">
              <span className="font-display text-3xl leading-none tracking-wide text-[#7bd88f] drop-shadow">
                ₹{state.cash.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex gap-1 rounded-sm bg-black/45 px-2 py-1 backdrop-blur-sm">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} active={i < state.wanted} />
              ))}
            </div>
            <div className="rounded-sm bg-black/45 px-3 py-0.5 backdrop-blur-sm">
              <span className="text-[11px] uppercase tracking-[0.25em] text-white/70">Score </span>
              <span className="font-display text-sm text-white">{state.score}</span>
            </div>
          </div>

          {/* per-player health panels (top corners) */}
          {state.players.map((p, i) => (
            <PlayerPanel key={i} index={i} hud={p} coop={state.mode === "coop"} />
          ))}

          {/* controls hint */}
          <div className="pointer-events-none absolute right-4 bottom-4 z-10 rounded-sm bg-black/40 px-3 py-1.5 text-right backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-widest text-white/60">
              {state.mode === "coop" ? "P1 WASD · F · E   |   P2 Arrows · / · Enter" : "WASD move · F shoot · E car"}
            </p>
          </div>
        </>
      )}

      {screen !== "playing" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--gradient-overlay)] px-6">
          <div className="w-full max-w-xl text-center">
            <p className="mb-2 font-display text-sm uppercase tracking-[0.4em] text-accent">Welcome to</p>
            <h1 className="font-display text-6xl uppercase leading-[0.9] sm:text-8xl">
              <span className="text-gradient">Los Pollos</span>
              <br />
              <span className="text-foreground">Streets</span>
            </h1>

            {screen === "over" ? (
              <div className="mt-5">
                <p className="font-display text-2xl uppercase text-destructive">Wasted</p>
                <p className="mt-2 text-muted-foreground">
                  Payday: <span className="text-primary">${state.cash.toLocaleString()}</span> · Score:{" "}
                  <span className="text-foreground">{state.score}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Best run: {best}</p>
              </div>
            ) : (
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                Steal cars, shoot it out, grab the cash and outrun the cops. Play solo or grab a friend for
                split-screen local co-op.
              </p>
            )}

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => startGame("solo")}
                className="inline-flex w-60 items-center justify-center rounded-md bg-primary px-8 py-4 font-display text-xl uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-neon)] transition-transform hover:scale-105 active:scale-95"
              >
                {screen === "over" ? "Play Solo" : "Solo"}
              </button>
              <button
                onClick={() => startGame("coop")}
                className="inline-flex w-60 items-center justify-center rounded-md border border-accent bg-accent/15 px-8 py-4 font-display text-xl uppercase tracking-wider text-accent shadow-[var(--shadow-pink)] transition-transform hover:scale-105 active:scale-95"
              >
                Local Co-op
              </button>
            </div>

            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              <ControlCard player={1} color="text-[#ff6b6b]" rows={[["Move", "W A S D"], ["Shoot", "F / Space"], ["Enter / exit car", "E"]]} />
              <ControlCard player={2} color="text-[#39b6ff]" rows={[["Move", "Arrow keys"], ["Shoot", "/"], ["Enter / exit car", "Enter"]]} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerPanel({ index, hud, coop }: { index: number; hud: PlayerHud; coop: boolean }) {
  const side = index === 0 ? "left-4" : "right-4";
  const accent = index === 0 ? "#ff6b6b" : "#39b6ff";
  return (
    <div className={`pointer-events-none absolute bottom-4 ${side} z-10 w-56`}>
      <div className="rounded-md border border-border bg-card/85 p-3 backdrop-blur">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-display text-sm uppercase tracking-wider" style={{ color: accent }}>
            {coop ? `Player ${index + 1}` : "You"}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {hud.onFoot ? "on foot" : `${hud.speedKmh} km/h`}
          </span>
        </div>
        {hud.alive ? (
          <>
            <div className="h-2.5 w-full overflow-hidden rounded-full border border-border bg-secondary">
              <div
                className="h-full transition-all duration-150"
                style={{ width: `${hud.health}%`, background: hud.health > 40 ? "var(--neon-cyan)" : "var(--destructive)" }}
              />
            </div>
            <p className="mt-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
              Ammo <span className="text-foreground">{hud.ammo}</span>
            </p>
          </>
        ) : (
          <p className="font-display text-sm uppercase text-destructive">
            {coop ? `Down — respawn ${hud.respawnIn}s` : "Wasted"}
          </p>
        )}
      </div>
    </div>
  );
}

function ControlCard({ player, color, rows }: { player: number; color: string; rows: [string, string][] }) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-3">
      <p className={`mb-2 font-display text-sm uppercase tracking-wider ${color}`}>Player {player}</p>
      <div className="space-y-1">
        {rows.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="rounded border border-border bg-card px-2 py-0.5 font-display text-foreground">{keys}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Star({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${active ? "fill-primary" : "fill-muted"}`} aria-hidden>
      <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
    </svg>
  );
}