import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type GameState } from "./engine";

const INITIAL: GameState = {
  cash: 0,
  wanted: 0,
  score: 0,
  health: 100,
  speedKmh: 0,
  running: false,
  gameOver: false,
};

type Screen = "menu" | "playing" | "over";

export default function LosSantosGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [state, setState] = useState<GameState>(INITIAL);
  const [screen, setScreen] = useState<Screen>("menu");
  const [best, setBest] = useState(0);

  // resize canvas to container
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

  // init engine
  useEffect(() => {
    const game = new Game(canvasRef.current!, (s) => {
      setState(s);
      if (s.gameOver) {
        setScreen("over");
        setBest((b) => Math.max(b, s.score + s.cash));
      }
    });
    gameRef.current = game;

    const down = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      game.setKey(e.code, true);
    };
    const up = (e: KeyboardEvent) => game.setKey(e.code, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    let raf = 0;
    const tick = () => {
      const mctx = miniRef.current?.getContext("2d");
      if (mctx) game.drawMinimap(mctx, 150);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      cancelAnimationFrame(raf);
      game.stop();
    };
  }, []);

  const startGame = useCallback(() => {
    gameRef.current?.start();
    setScreen("playing");
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* HUD */}
      {screen === "playing" && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
            <div className="rounded-md border border-border bg-card/80 px-4 py-2 backdrop-blur">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Cash</p>
              <p className="font-display text-3xl leading-none text-primary">
                ${state.cash.toLocaleString()}
              </p>
            </div>
            <div className="rounded-md border border-border bg-card/80 px-4 py-2 backdrop-blur">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Score</p>
              <p className="font-display text-2xl leading-none text-foreground">{state.score}</p>
            </div>
          </div>

          {/* Wanted stars */}
          <div className="pointer-events-none absolute right-4 top-4 flex flex-col items-end gap-2">
            <div className="flex gap-1 rounded-md border border-border bg-card/80 px-3 py-2 backdrop-blur">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} active={i < state.wanted} />
              ))}
            </div>
            <canvas
              ref={miniRef}
              width={150}
              height={150}
              className="rounded-md border-2 border-primary/60 shadow-[var(--shadow-neon)]"
            />
          </div>

          {/* Bottom: health + speed */}
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div className="w-56">
              <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Armor</p>
              <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-secondary">
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${state.health}%`,
                    background:
                      state.health > 40 ? "var(--neon-cyan)" : "var(--destructive)",
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-5xl leading-none text-foreground">
                {state.speedKmh}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">km/h</p>
            </div>
          </div>
        </>
      )}

      {/* Menu / Game over overlays */}
      {screen !== "playing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--gradient-overlay)] px-6">
          <div className="w-full max-w-lg text-center">
            <p className="mb-2 font-display text-sm uppercase tracking-[0.4em] text-accent">
              Welcome to
            </p>
            <h1 className="font-display text-7xl uppercase leading-[0.9] sm:text-8xl">
              <span className="bg-[var(--gradient-hero)] bg-clip-text text-transparent">
                Los Pollos
              </span>
              <br />
              <span className="text-foreground">Streets</span>
            </h1>

            {screen === "over" ? (
              <div className="mt-6">
                <p className="font-display text-2xl uppercase text-destructive">Busted</p>
                <p className="mt-2 text-muted-foreground">
                  Payday: <span className="text-primary">${state.cash.toLocaleString()}</span> ·
                  Score: <span className="text-foreground">{state.score}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Best run: {best}</p>
              </div>
            ) : (
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                Cruise the city, grab the cash, dodge the cops. Hit pedestrians and you'll
                raise your wanted level — survive as long as you can.
              </p>
            )}

            <button
              onClick={startGame}
              className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-10 py-4 font-display text-xl uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-neon)] transition-transform hover:scale-105 active:scale-95"
            >
              {screen === "over" ? "Run it again" : "Start driving"}
            </button>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Key>W / ↑</Key> accelerate
              <Key>S / ↓</Key> brake
              <Key>A D / ← →</Key> steer
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Star({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${active ? "fill-primary" : "fill-muted"}`}
      aria-hidden
    >
      <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.8 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" />
    </svg>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border bg-card px-2 py-1 font-display text-foreground">
      {children}
    </span>
  );
}