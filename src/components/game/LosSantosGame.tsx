import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Game, WEAPONS, WEAPON_ORDER, type GameState, type Mode, type PlayerHud, type WeaponId } from "./engine";

const INITIAL: GameState = {
  mode: "solo",
  cash: 0,
  wanted: 0,
  score: 0,
  players: [
    {
      health: 100,
      armor: 0,
      speedKmh: 0,
      onFoot: true,
      alive: true,
      respawnIn: 0,
      ammo: WEAPONS.pistol.ammoPack,
      weapon: WEAPONS.pistol.name,
      weaponId: "pistol",
      owned: ["pistol"],
      nearShop: false,
    },
  ],
  running: false,
  gameOver: false,
  pvp: false,
  policeSearching: false,
  radioStation: "",
  radioSong: "",
};

type Screen = "menu" | "playing" | "over";

export default function LosSantosGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [state, setState] = useState<GameState>(INITIAL);
  const [screen, setScreen] = useState<Screen>("menu");
  const [best, setBest] = useState(0);
  const [pvp, setPvp] = useState(false);

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

    const blocked = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Slash", "KeyR"];
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

  const startGame = useCallback(
    (mode: Mode) => {
      gameRef.current?.start(mode, pvp);
      setScreen("playing");
    },
    [pvp],
  );

  const buyWeapon = useCallback((id: WeaponId, playerIndex?: number) => {
    gameRef.current?.buyWeapon(id, playerIndex);
  }, []);
  const buyAmmo = useCallback((id: WeaponId, playerIndex?: number) => {
    gameRef.current?.buyAmmo(id, playerIndex);
  }, []);
  const buyArmor = useCallback((playerIndex?: number) => {
    gameRef.current?.buyArmor(playerIndex);
  }, []);

  const shoppers = state.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.alive && p.nearShop);

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
            <div className={`flex gap-1 rounded-sm bg-black/45 px-2 py-1 backdrop-blur-sm ${state.policeSearching ? "animate-pulse" : ""}`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} active={i < state.wanted} />
              ))}
            </div>
            <div className="rounded-sm bg-black/45 px-3 py-0.5 backdrop-blur-sm">
              <span className="text-[11px] uppercase tracking-[0.25em] text-white/70">Score </span>
              <span className="font-display text-sm text-white">{state.score}</span>
            </div>
          </div>

          {/* Car Radio overlay */}
          {state.radioStation && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md border border-white/10 bg-black/75 px-5 py-2 text-center backdrop-blur-md shadow-[var(--shadow-neon)] transition-all">
              <p className="text-[9px] uppercase tracking-[0.25em] text-[#ffc450] font-semibold">Car Radio</p>
              <h2 className="font-display text-lg uppercase text-white leading-none mt-0.5">{state.radioStation}</h2>
              {state.radioSong && (
                <p className="text-[10px] uppercase tracking-wider text-white/70 mt-1 animate-pulse">
                  🎵 {state.radioSong}
                </p>
              )}
            </div>
          )}

          {/* per-player health panels (top corners) */}
          {state.players.map((p, i) => (
             <PlayerPanel key={i} index={i} hud={p} coop={state.mode === "coop"} />
          ))}

          {/* gun shop panel — appears when a player stands on the shop pad */}
          {shoppers.length > 0 && (
            <ShopPanel
              cash={state.cash}
              shoppers={shoppers}
              coop={state.mode === "coop"}
              onBuyWeapon={buyWeapon}
              onBuyAmmo={buyAmmo}
              onBuyArmor={buyArmor}
            />
          )}

          {/* controls hint */}
          <div className="pointer-events-none absolute right-4 bottom-4 z-10 rounded-sm bg-black/40 px-3 py-1.5 text-right backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-widest text-white/60">
              {state.mode === "coop"
                ? "P1 WASD·F·E·Q gun·C seat·R radio  |  P2 Arrows·/·Enter·⇧ gun·, seat"
                : "WASD · F shoot/drive-by · E car · Q gun · R radio"}
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
                   Payday: <span className="text-primary">₹{state.cash.toLocaleString("en-IN")}</span> · Score:{" "}
                  <span className="text-foreground">{state.score}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Best run: {best}</p>
              </div>
            ) : (
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                Roam a small Indian-style city: grab a car or bike, collect cash, and pull off crimes to
                heat up the cops. Share one car in co-op — the driver drives while the other does drive-bys
                (swap seats anytime). Watch for armed thugs who shoot back, and duck into the Pay 'n' Spray
                to lose your wanted level.
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
              <Link
                to="/phaser"
                className="inline-flex w-60 items-center justify-center rounded-md border border-primary/40 bg-primary/20 px-8 py-4 font-display text-xl uppercase tracking-wider text-primary shadow-[var(--shadow-neon)] transition-transform hover:scale-105 active:scale-95 text-center"
              >
                Phaser Solo Map
              </Link>
              <Link
                to="/phaser"
                search={{ mode: "coop" }}
                className="inline-flex w-60 items-center justify-center rounded-md border border-accent bg-accent/15 px-8 py-4 font-display text-xl uppercase tracking-wider text-accent shadow-[var(--shadow-pink)] transition-transform hover:scale-105 active:scale-95 text-center"
              >
                Phaser Co-op Map
              </Link>
            </div>

            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={pvp}
                onChange={(e) => setPvp(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                <span className="font-display uppercase tracking-wider text-accent">PvP</span> friendly fire (co-op) — players can shoot each other
              </span>
            </label>

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
  return <PlayerPanelInner index={index} hud={hud} coop={coop} />;
}

function ShopPanel({
  cash,
  shoppers,
  coop,
  onBuyWeapon,
  onBuyAmmo,
  onBuyArmor,
}: {
  cash: number;
  shoppers: { p: PlayerHud; i: number }[];
  coop: boolean;
  onBuyWeapon: (id: WeaponId, playerIndex?: number) => void;
  onBuyAmmo: (id: WeaponId, playerIndex?: number) => void;
  onBuyArmor: (playerIndex?: number) => void;
}) {
  // In co-op the buyer is chosen; in solo it's always player 0.
  const [buyer, setBuyer] = useState(shoppers[0].i);
  const target = shoppers.find((s) => s.i === buyer) ?? shoppers[0];
  const hud = target.p;
  return (
    <div className="absolute left-1/2 top-20 z-30 w-[340px] -translate-x-1/2 rounded-lg border border-accent/50 bg-black/80 p-4 backdrop-blur-md shadow-[var(--shadow-pink)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl uppercase tracking-wider text-accent">Gun Shop</h2>
        <span className="font-display text-lg text-[#7bd88f]">₹{cash.toLocaleString("en-IN")}</span>
      </div>

      {coop && shoppers.length > 1 && (
        <div className="mb-3 flex gap-2">
          {shoppers.map((s) => (
            <button
              key={s.i}
              onClick={() => setBuyer(s.i)}
              className={`flex-1 rounded px-2 py-1 text-xs font-display uppercase tracking-wider ${
                s.i === buyer ? "bg-accent text-accent-foreground" : "bg-white/10 text-white/70"
              }`}
            >
              Player {s.i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {WEAPON_ORDER.map((id) => {
          const w = WEAPONS[id];
          const owned = hud.owned.includes(id);
          const canBuyGun = !owned && cash >= w.price;
          const canBuyAmmo = owned && cash >= w.ammoPrice;
          return (
            <div key={id} className="flex items-center justify-between rounded bg-white/5 px-3 py-2">
              <div className="flex flex-col">
                <span className="font-display text-sm uppercase tracking-wider text-white">{w.name}</span>
                <span className="text-[10px] uppercase tracking-widest text-white/45">
                  {w.pellets > 1 ? `${w.pellets}x pellets` : "single"} · dmg {w.damage}
                </span>
              </div>
              {owned ? (
                <button
                  onClick={() => onBuyAmmo(id, coop ? buyer : undefined)}
                  disabled={!canBuyAmmo}
                  className="rounded bg-primary/90 px-3 py-1.5 text-xs font-display uppercase tracking-wider text-primary-foreground disabled:opacity-40"
                >
                  +{w.ammoPack} ammo · ₹{w.ammoPrice}
                </button>
              ) : (
                <button
                  onClick={() => onBuyWeapon(id, coop ? buyer : undefined)}
                  disabled={!canBuyGun}
                  className="rounded bg-accent px-3 py-1.5 text-xs font-display uppercase tracking-wider text-accent-foreground disabled:opacity-40"
                >
                  Buy · ₹{w.price.toLocaleString("en-IN")}
                </button>
              )}
            </div>
          );
        })}

        {/* Kevlar Vest / Body Armor */}
        <div className="flex items-center justify-between rounded bg-white/5 px-3 py-2 border-t border-white/10 mt-1">
          <div className="flex flex-col">
            <span className="font-display text-sm uppercase tracking-wider text-[#39b6ff]">Kevlar Vest</span>
            <span className="text-[10px] uppercase tracking-widest text-white/45">
              Armor +100 · Absorbs 75%
            </span>
          </div>
          <button
            onClick={() => onBuyArmor(coop ? buyer : undefined)}
            disabled={cash < 1000 || hud.armor >= 100}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-display uppercase tracking-wider text-white disabled:opacity-45"
          >
            Buy · ₹1,000
          </button>
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-white/40">
        Walk off the pad to close · Q / ⇧ to swap weapon
      </p>
    </div>
  );
}

function PlayerPanelInner({ index, hud, coop }: { index: number; hud: PlayerHud; coop: boolean }) {
  // P1 top-left; in co-op P2 top-right (below the money panel so it never overlaps).
  const top = index === 0 ? "top-4" : "top-28";
  const accent = index === 0 ? "#ff4d4d" : "#39b6ff";
  return (
    <div className={`pointer-events-none absolute ${index === 0 ? "left-4" : "right-4"} ${top} z-10 flex w-52 flex-col ${index === 0 ? "items-start" : "items-end"}`}>
      <div className="w-full rounded-sm bg-black/50 px-3 py-2 backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-display text-xs uppercase tracking-wider" style={{ color: accent }}>
            {coop ? `Player ${index + 1}` : "Health"}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-white/55">
            {hud.onFoot ? "on foot" : `${hud.speedKmh} km/h`}
          </span>
        </div>
        {hud.alive ? (
          <>
            {/* segmented GTA-style health bar */}
            <div className="flex h-2.5 w-full gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = hud.health > i * 10;
                return (
                  <div
                    key={i}
                    className="h-full flex-1 transition-colors"
                    style={{ background: filled ? (hud.health > 40 ? "#41d67e" : "#e23b3b") : "rgba(255,255,255,0.12)" }}
                  />
                );
              })}
            </div>
            {/* segmented GTA-style armor bar */}
            {hud.armor > 0 && (
              <div className="flex h-1.5 w-full gap-0.5 mt-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  const filled = hud.armor > i * 10;
                  return (
                    <div
                      key={i}
                      className="h-full flex-1 transition-colors"
                      style={{ background: filled ? "#39b6ff" : "rgba(255,255,255,0.08)" }}
                    />
                  );
                })}
              </div>
            )}
            <p className="mt-1.5 text-[10px] uppercase tracking-widest text-white/55">
              <span className="text-white/80">{hud.weapon}</span> · Ammo <span className="text-white">{hud.ammo}</span>
            </p>
          </>
        ) : (
          <p className="font-display text-sm uppercase text-[#e23b3b]">
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