import Phaser from "phaser";
import { WorldScene } from "./scenes/WorldScene";

export const getPhaserConfig = (parent: string | HTMLElement): Phaser.Types.Core.GameConfig => {
  return {
    type: Phaser.AUTO,
    width: "100%",
    height: "100%",
    parent: parent,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    scene: [WorldScene],
    antialias: true,
    backgroundColor: '#2a5a36'
  };
};

export const startPhaserGame = (parent: string | HTMLElement, isCoop = false): Phaser.Game => {
  const config = getPhaserConfig(parent);
  const game = new Phaser.Game(config);
  game.registry.set("isCoop", isCoop);
  return game;
};
