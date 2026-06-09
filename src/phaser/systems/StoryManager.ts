import Phaser from "phaser";
import { CAMPAIGN_MISSIONS, MissionData, MissionObjective } from "../data/campaign_missions";

export class StoryManager {
  private scene: any;
  public activeMissionIndex = 0;
  public currentMission: MissionData | null = null;
  public activeObjectiveIndex = 0;
  
  // Mission states
  public isMissionActive = false;
  private dialogueTimer = 0;
  private currentDialogueIndex = 0;
  
  // Visual markers
  private startMarkerGraphics: Phaser.GameObjects.Graphics | null = null;
  private startMarkerText: Phaser.GameObjects.Text | null = null;
  private objectiveMarkerGraphics: Phaser.GameObjects.Graphics[] = [];
  
  // Story entities (enemies, collectables)
  private storyEnemies: any[] = [];
  private collectionZones: any[] = [];

  constructor(scene: any) {
    this.scene = scene;
    
    // Check local storage for saved progress
    const saved = localStorage.getItem("mitti_aur_lahu_mission_index");
    this.activeMissionIndex = saved ? parseInt(saved, 10) : 0;
    
    if (this.activeMissionIndex >= CAMPAIGN_MISSIONS.length) {
      // Completed campaign
      this.activeMissionIndex = CAMPAIGN_MISSIONS.length - 1;
    }

    this.createStartMarker();
  }

  private createStartMarker() {
    this.currentMission = CAMPAIGN_MISSIONS[this.activeMissionIndex];
    if (!this.currentMission) return;

    // Remove old marker if exists
    this.destroyStartMarker();

    const mx = this.currentMission.startX;
    const my = this.currentMission.startY;

    // Spinning/pulsing ground yellow circle
    this.startMarkerGraphics = this.scene.add.graphics();
    this.startMarkerGraphics.setDepth(5);
    
    // "M" text above marker
    this.startMarkerText = this.scene.add.text(mx, my - 25, "M", {
      fontFamily: "Rajdhani, Arial Black, sans-serif",
      fontSize: "20px",
      color: "#ffc450",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(6);

    // Hide marker in minimap
    this.scene.minimapSystem?.minimapCamera?.ignore(this.startMarkerGraphics);
    this.scene.minimapSystem?.minimapCamera?.ignore(this.startMarkerText);
    
    // Register blip on minimap
    this.scene.minimapSystem?.addLocationBlip(
      "story_trigger",
      mx,
      my,
      0xffc450,
      `Mission: ${this.currentMission.name}`
    );
  }

  private destroyStartMarker() {
    if (this.startMarkerGraphics) {
      this.startMarkerGraphics.destroy();
      this.startMarkerGraphics = null;
    }
    if (this.startMarkerText) {
      this.startMarkerText.destroy();
      this.startMarkerText = null;
    }
    this.scene.minimapSystem?.removeLocationBlip("story_trigger");
  }

  public update(dt: number) {
    if (this.scene.registry.get("isCoop")) {
      this.destroyStartMarker();
      return;
    }

    const player = this.scene.player;
    if (!player || player.isWasted) return;

    const time = this.scene.time.now;

    if (!this.isMissionActive) {
      // 1. Draw and pulse start marker
      if (this.currentMission && this.startMarkerGraphics) {
        const mx = this.currentMission.startX;
        const my = this.currentMission.startY;
        const pulse = 12 + Math.sin(time / 200) * 3;

        this.startMarkerGraphics.clear();
        this.startMarkerGraphics.lineStyle(2, 0xffc450, 0.85);
        this.startMarkerGraphics.strokeCircle(mx, my, pulse);
        this.startMarkerGraphics.fillStyle(0xffc450, 0.2);
        this.startMarkerGraphics.fillCircle(mx, my, pulse - 3);

        // Check if player stands inside start marker to launch mission
        const dist = Math.hypot(player.sprite.x - mx, player.sprite.y - my);
        if (dist < 35) {
          this.scene.showCrimeBanner(`Press E to Start: ${this.currentMission.name}`);
          
          if (player.keys.enter.isDown && !player.isDriving) {
            this.startMission();
          }
        }
      }
    } else {
      // 2. Active Mission Updates
      this.updateActiveMission(dt);
    }
  }

  private startMission() {
    if (!this.currentMission) return;
    this.isMissionActive = true;
    this.activeObjectiveIndex = 0;
    this.currentDialogueIndex = 0;
    this.dialogueTimer = 0;

    // Lock start marker
    this.destroyStartMarker();

    this.scene.showCrimeBanner(`MISSION STARTED: ${this.currentMission.name}`);

    // Set first dialogue
    this.playDialogueStep();
  }

  private playDialogueStep() {
    if (!this.currentMission) return;

    if (this.currentDialogueIndex < this.currentMission.dialogues.length) {
      const line = this.currentMission.dialogues[this.currentDialogueIndex];
      this.scene.activeSubtitle = `${line.speaker}: "${line.text}"`;
      this.scene.activeSubtitleSub = line.sub;
      this.dialogueTimer = line.time;
    } else {
      // Dialogues finished: clear subtitles and show first objective
      this.scene.activeSubtitle = "";
      this.scene.activeSubtitleSub = "";
      this.showCurrentObjective();
    }
  }

  private showCurrentObjective() {
    if (!this.currentMission) return;
    const obj = this.currentMission.objectives[this.activeObjectiveIndex];
    if (!obj) {
      this.completeMission();
      return;
    }

    this.scene.activeObjective = obj.description;
    this.scene.showCrimeBanner(`Objective: ${obj.description}`);

    // Setup objective visual markers
    this.clearObjectiveMarkers();
    
    if (obj.targetX !== undefined && obj.targetY !== undefined) {
      const tx = obj.targetX;
      const ty = obj.targetY;
      const radius = obj.radius || 40;

      // Draw destination radar marker in world scene
      const marker = this.scene.add.graphics();
      marker.lineStyle(3, 0xffc450, 0.75);
      marker.strokeCircle(tx, ty, radius);
      marker.fillStyle(0xffc450, 0.15);
      marker.fillCircle(tx, ty, radius - 3);
      this.objectiveMarkerGraphics.push(marker);

      // Hide marker in minimap camera
      this.scene.minimapSystem?.minimapCamera?.ignore(marker);

      // Add to minimap radar blips
      this.scene.minimapSystem?.addLocationBlip("story_obj", tx, ty, 0xffc450, "Objective Location");
    }

    // Spawn custom story elements based on objective
    this.spawnObjectiveElements(obj);
  }

  private spawnObjectiveElements(obj: MissionObjective) {
    this.clearStoryEntities();

    // 1. Spawning combat gang enforcers
    if (obj.type === "kill" && obj.targetX !== undefined && obj.targetY !== undefined) {
      const count = obj.count || 3;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * 6.28;
        const rx = obj.targetX + Math.cos(ang) * (obj.radius || 60) * Math.random();
        const ry = obj.targetY + Math.sin(ang) * (obj.radius || 60) * Math.random();

        const sprite = this.scene.add.graphics();
        sprite.fillStyle(0xff7f24, 1); // Orange gang shirts
        sprite.fillCircle(0, 0, 7);
        sprite.fillStyle(0x111111, 1); // gun
        sprite.fillRect(6, -2, 8, 3);
        
        sprite.x = rx;
        sprite.y = ry;

        // Add to physics cops/hostiles group for bullet overlap damage
        this.scene.copsPhysicsGroup.add(sprite);
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.setCircle(7, -7, -7);
          body.setCollideWorldBounds(true);
          body.setImmovable(true);
        }

        this.storyEnemies.push({
          sprite,
          health: 60,
          shootCd: Math.random() * 1.5
        });
      }
    }

    // 2. Spawning collections markers
    if (obj.type === "collect" && obj.targetX !== undefined && obj.targetY !== undefined) {
      const count = obj.count || 3;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * 6.28;
        const rx = obj.targetX + Math.cos(ang) * (obj.radius || 80);
        const ry = obj.targetY + Math.sin(ang) * (obj.radius || 80);

        const sprite = this.scene.add.graphics();
        sprite.fillStyle(0x7bd88f, 1); // Green cash marker
        sprite.fillCircle(0, 0, 8);
        sprite.lineStyle(1.5, 0xffffff, 1);
        sprite.strokeCircle(0, 0, 8);
        
        sprite.x = rx;
        sprite.y = ry;

        this.scene.physics.add.existing(sprite, true); // static body
        
        this.collectionZones.push({
          sprite,
          collected: false
        });
      }
    }
  }

  private updateActiveMission(dt: number) {
    const player = this.scene.player;

    // 1. Dialogue Ticking
    if (this.scene.activeSubtitle !== "") {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) {
        this.currentDialogueIndex++;
        this.playDialogueStep();
      }
      return; // pause objective updates while talking
    }

    // 2. Objective Progress Verification
    const obj = this.currentMission?.objectives[this.activeObjectiveIndex];
    if (!obj) return;

    let isCompleted = false;

    switch (obj.type) {
      case "trigger":
        if (obj.targetX !== undefined && obj.targetY !== undefined) {
          const dist = Math.hypot(player.sprite.x - obj.targetX, player.sprite.y - obj.targetY);
          if (dist < (obj.radius || 40)) {
            isCompleted = true;
          }
        }
        break;

      case "steal":
        if (player.isDriving && player.currentVehicle && obj.vehicleType) {
          if (player.currentVehicle.type === obj.vehicleType || obj.vehicleType === "any") {
            isCompleted = true;
          }
        }
        break;

      case "collect":
        // Verify overlapping and collecting all zones
        let collectedCount = 0;
        this.collectionZones.forEach((cz) => {
          if (cz.collected) {
            collectedCount++;
            return;
          }
          const dist = Math.hypot(player.sprite.x - cz.sprite.x, player.sprite.y - cz.sprite.y);
          if (dist < 20) {
            cz.collected = true;
            cz.sprite.destroy(); // remove cash visual
            this.scene.cash += 500; // instant pocket money
            this.scene.showCrimeBanner("Collected Money Stall Bag!");
            collectedCount++;
          }
        });

        if (collectedCount >= this.collectionZones.length) {
          isCompleted = true;
        }
        break;

      case "kill":
        // Shoot and eliminate custom enforcers
        this.storyEnemies.forEach((e) => {
          if (e.health <= 0) return;

          // Simple AI: shoot at player if within 250px
          const dist = Math.hypot(player.sprite.x - e.sprite.x, player.sprite.y - e.sprite.y);
          if (dist < 250 && !player.isWasted) {
            e.shootCd -= dt;
            if (e.shootCd <= 0) {
              e.shootCd = 1.4 + Math.random() * 0.8;
              const angle = Math.atan2(player.sprite.y - e.sprite.y, player.sprite.x - e.sprite.x);
              e.sprite.rotation = angle;
              this.scene.fireBullet(e.sprite.x, e.sprite.y, angle, true); // hostile bullet
            }
          }

          // Check if bullet overlaps and hit enemy
          this.scene.bullets.getChildren().forEach((b: any) => {
            if (b.active && !b.isHostile) {
              const bDist = Math.hypot(b.x - e.sprite.x, b.y - e.sprite.y);
              if (bDist < 16) {
                b.setActive(false);
                b.setVisible(false);
                e.health -= 25; // bullet damage
                if (e.health <= 0) {
                  e.sprite.destroy();
                }
              }
            }
          });
        });

        // Filter active enemies
        this.storyEnemies = this.storyEnemies.filter((e) => e.health > 0);
        if (this.storyEnemies.length === 0) {
          isCompleted = true;
        }
        break;

      case "escape":
        // Lose wanted level
        if (this.scene.wantedLevel === 0) {
          isCompleted = true;
        }
        break;
    }

    if (isCompleted) {
      this.advanceObjective();
    }
  }

  private advanceObjective() {
    this.activeObjectiveIndex++;
    this.showCurrentObjective();
  }

  private completeMission() {
    if (!this.currentMission) return;
    this.isMissionActive = false;
    this.clearObjectiveMarkers();
    this.clearStoryEntities();

    // Reward player
    this.scene.cash += this.currentMission.reward;
    this.scene.score += this.currentMission.reward / 10;
    this.scene.showCrimeBanner(`MISSION PASSED: ${this.currentMission.name} (+₹${this.currentMission.reward})`);

    // Increment campaign progress
    this.activeMissionIndex++;
    localStorage.setItem("mitti_aur_lahu_mission_index", this.activeMissionIndex.toString());

    // Rebuild start marker for next mission
    if (this.activeMissionIndex < CAMPAIGN_MISSIONS.length) {
      this.createStartMarker();
    } else {
      this.scene.showCrimeBanner("CONGRATULATIONS! Campaign Complete!");
    }
  }

  public failMission() {
    if (!this.isMissionActive) return;
    this.isMissionActive = false;
    this.clearObjectiveMarkers();
    this.clearStoryEntities();

    this.scene.showCrimeBanner("MISSION FAILED");
    this.scene.activeSubtitle = "";
    this.scene.activeSubtitleSub = "";
    this.scene.activeObjective = "";

    // Reset and spawn start marker back
    this.createStartMarker();
  }

  private clearObjectiveMarkers() {
    this.objectiveMarkerGraphics.forEach((g) => g.destroy());
    this.objectiveMarkerGraphics = [];
    this.scene.minimapSystem?.removeLocationBlip("story_obj");
  }

  private clearStoryEntities() {
    this.storyEnemies.forEach((e) => {
      if (e.sprite && e.sprite.active) {
        e.sprite.destroy();
      }
    });
    this.storyEnemies = [];

    this.collectionZones.forEach((cz) => {
      if (cz.sprite && cz.sprite.active) {
        cz.sprite.destroy();
      }
    });
    this.collectionZones = [];
  }

  public destroy() {
    this.destroyStartMarker();
    this.clearObjectiveMarkers();
    this.clearStoryEntities();
  }
}
