import { PathGenerator } from './PathGenerator';
import { Player } from './Player';
import { Boss } from './Boss';
import { Assets } from './Assets';

export type GameState = 'MENU' | 'PLAYING' | 'BOSS_FIGHT' | 'GAME_OVER' | 'LEVEL_COMPLETE';

interface Obstacle {
  worldY: number;
  offsetX: number;
  width: number;
  height: number;
  horizontalSpeed: number;
  moveType: 'drift' | 'sine';
  timeAlive: number;
}

interface Pickup {
  worldY: number;
  offsetX: number;
  width: number;
  height: number;
}

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  
  public state: GameState = 'MENU';
  public level: number = 1;
  public distanceTraveled: number = 0;
  public scrollSpeed: number = 200; // pixels per second
  
  public player: Player;
  public pathGen: PathGenerator;
  public boss: Boss | null = null;
  public obstacles: Obstacle[] = [];
  public pickups: Pickup[] = [];
  
  private lastTime: number = 0;
  private animationFrameId: number = 0;
  private keys: { [key: string]: boolean } = {};
  
  private nextObstacleDist: number = 500;
  private nextPickupDist: number = 800;
  private levelLength: number = 5000;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    this.player = new Player(canvas.width / 2, canvas.height - 100);
    this.pathGen = new PathGenerator(this.level);
    
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  public start() {
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public stop() {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  public startGame() {
    this.state = 'PLAYING';
    this.level = 1;
    this.resetLevel();
  }

  private resetLevel() {
    this.distanceTraveled = 0;
    this.scrollSpeed = 200; // Constant scroll speed so level duration is the same
    this.pathGen = new PathGenerator(this.level);
    this.player = new Player(this.canvas.width / 2, this.canvas.height - 100);
    this.obstacles = [];
    this.pickups = [];
    this.boss = null;
    this.nextObstacleDist = 400;
    this.nextPickupDist = 800;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    if (e.code === 'Space') {
      if (this.state === 'MENU' || this.state === 'GAME_OVER' || this.state === 'LEVEL_COMPLETE') {
        if (this.state === 'LEVEL_COMPLETE') {
          this.level++;
          this.state = 'PLAYING';
          this.resetLevel();
        } else {
          this.startGame();
        }
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private loop = (time: number) => {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    
    this.update(Math.min(dt, 0.1)); // Cap dt to avoid large jumps
    this.draw();
    
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.state === 'PLAYING' || this.state === 'BOSS_FIGHT') {
      // Update player
      this.player.update(dt, {
        left: this.keys['ArrowLeft'] || this.keys['KeyA'],
        right: this.keys['ArrowRight'] || this.keys['KeyD'],
      });

      // Keep player on screen horizontally
      this.player.x = Math.max(this.player.width/2, Math.min(this.canvas.width - this.player.width/2, this.player.x));

      let currentScrollSpeed = this.scrollSpeed;
      
      // Path collision
      const playerWorldY = this.distanceTraveled + (this.canvas.height - this.player.y);
      const pathCenter = this.pathGen.getCenter(playerWorldY, this.canvas.width);
      const pathHalfWidth = this.pathGen.width / 2;
      
      this.player.isSlowed = false;
      if (this.player.x - this.player.width / 2 < pathCenter - pathHalfWidth ||
          this.player.x + this.player.width / 2 > pathCenter + pathHalfWidth) {
        this.player.isSlowed = true;
        this.player.health -= 20 * dt; // Damage per second while outside path
        currentScrollSpeed *= 0.5; // Slow down scrolling
      }

      this.distanceTraveled += currentScrollSpeed * dt;

      if (this.state === 'PLAYING') {
        // Spawn obstacles
        if (this.distanceTraveled + this.canvas.height > this.nextObstacleDist) {
          this.spawnObstacle();
          // Spawn more obstacles on higher levels
          const interval = Math.max(100, 300 - this.level * 30);
          this.nextObstacleDist += interval;
        }

        // Spawn health pickups
        if (this.distanceTraveled + this.canvas.height > this.nextPickupDist) {
          this.spawnPickup();
          this.nextPickupDist += 800 + Math.random() * 400;
        }

        // Check level end
        if (this.distanceTraveled > this.levelLength) {
          this.state = 'BOSS_FIGHT';
          this.boss = new Boss(this.canvas.width / 2, this.level);
        }
      }

      // Update obstacles
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.timeAlive += dt;
        
        // Horizontal movement
        if (obs.moveType === 'drift') {
          obs.offsetX += obs.horizontalSpeed * dt;
        } else if (obs.moveType === 'sine') {
          obs.offsetX += Math.sin(obs.timeAlive * 3) * obs.horizontalSpeed * dt;
        }
        
        // Keep obstacle roughly within path bounds
        const maxOffset = this.pathGen.width / 2 - obs.width / 2;
        if (obs.offsetX > maxOffset) {
          obs.offsetX = maxOffset;
          obs.horizontalSpeed *= -1;
        } else if (obs.offsetX < -maxOffset) {
          obs.offsetX = -maxOffset;
          obs.horizontalSpeed *= -1;
        }
        
        const obsCanvasY = this.canvas.height - (obs.worldY - this.distanceTraveled);
        const centerX = this.pathGen.getCenter(obs.worldY, this.canvas.width);
        const obsX = centerX + obs.offsetX;
        
        // Collision with player
        if (this.checkCollision(
          this.player.x - this.player.width/2, this.player.y - this.player.height/2, this.player.width, this.player.height,
          obsX - obs.width/2, obsCanvasY - obs.height/2, obs.width, obs.height
        )) {
          this.player.health -= 30;
          this.obstacles.splice(i, 1);
          continue;
        }

        if (obsCanvasY > this.canvas.height + 50) {
          this.obstacles.splice(i, 1);
        }
      }

      // Update pickups
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pickup = this.pickups[i];
        const pickupCanvasY = this.canvas.height - (pickup.worldY - this.distanceTraveled);
        const centerX = this.pathGen.getCenter(pickup.worldY, this.canvas.width);
        const pickupX = centerX + pickup.offsetX;
        
        // Collision with player
        if (this.checkCollision(
          this.player.x - this.player.width/2, this.player.y - this.player.height/2, this.player.width, this.player.height,
          pickupX - pickup.width/2, pickupCanvasY - pickup.height/2, pickup.width, pickup.height
        )) {
          this.player.health = Math.min(100, this.player.health + 25); // Heal 25 HP
          this.pickups.splice(i, 1);
          continue;
        }

        if (pickupCanvasY > this.canvas.height + 50) {
          this.pickups.splice(i, 1);
        }
      }

      // Update Boss
      if (this.state === 'BOSS_FIGHT' && this.boss) {
        this.boss.update(dt, this.player.x, this.player.y);
        
        // Boss collision
        if (this.checkCollision(
          this.player.x - this.player.width/2, this.player.y - this.player.height/2, this.player.width, this.player.height,
          this.boss.x - this.boss.width/2, this.boss.y - this.boss.height/2, this.boss.width, this.boss.height
        )) {
          this.player.health -= 50;
          // Push boss back to avoid multiple hits
          this.boss.state = 'RETURNING';
        }

        if (this.boss.state === 'DONE') {
          this.state = 'LEVEL_COMPLETE';
        }
      }

      if (this.player.health <= 0) {
        this.state = 'GAME_OVER';
      }
    }
  }

  private spawnObstacle() {
    const worldY = this.distanceTraveled + this.canvas.height + 50;
    // Random offset within path
    const maxOffset = this.pathGen.width / 2 - Assets.obstacle.width;
    const offsetX = (Math.random() * 2 - 1) * maxOffset;
    
    // Obstacle horizontal speed increases with level
    const baseSpeed = 30 + this.level * 15;
    const horizontalSpeed = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
    const moveType = Math.random() > 0.5 ? 'drift' : 'sine';
    
    this.obstacles.push({
      worldY,
      offsetX,
      width: Assets.obstacle.width,
      height: Assets.obstacle.height,
      horizontalSpeed,
      moveType,
      timeAlive: 0
    });
  }

  private spawnPickup() {
    const worldY = this.distanceTraveled + this.canvas.height + 50;
    
    // Position riskily near the edges of the path
    const maxOffset = this.pathGen.width / 2 - Assets.pickup.width;
    const isLeft = Math.random() > 0.5;
    const edgeFactor = 0.7 + Math.random() * 0.2; // 70% to 90% towards the edge
    const offsetX = (isLeft ? -1 : 1) * maxOffset * edgeFactor;
    
    this.pickups.push({
      worldY,
      offsetX,
      width: Assets.pickup.width,
      height: Assets.pickup.height
    });
  }

  private checkCollision(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  private draw() {
    // Clear
    this.ctx.fillStyle = '#0a0a1a'; // Night sky
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'MENU') {
      this.drawText('FIREFLY RIDER', this.canvas.width/2, this.canvas.height/2 - 40, '40px sans-serif', '#fff');
      this.drawText('Press SPACE to Start', this.canvas.width/2, this.canvas.height/2 + 20, '20px sans-serif', '#aaa');
      this.drawText('Use Left/Right Arrows to move', this.canvas.width/2, this.canvas.height/2 + 60, '16px sans-serif', '#888');
      return;
    }

    // Draw Path
    this.ctx.beginPath();
    for (let y = 0; y <= this.canvas.height; y += 20) {
      const worldY = this.distanceTraveled + (this.canvas.height - y);
      const centerX = this.pathGen.getCenter(worldY, this.canvas.width);
      const leftEdge = centerX - this.pathGen.width / 2;
      if (y === 0) this.ctx.moveTo(leftEdge, y);
      else this.ctx.lineTo(leftEdge, y);
    }
    for (let y = this.canvas.height; y >= 0; y -= 20) {
      const worldY = this.distanceTraveled + (this.canvas.height - y);
      const centerX = this.pathGen.getCenter(worldY, this.canvas.width);
      const rightEdge = centerX + this.pathGen.width / 2;
      this.ctx.lineTo(rightEdge, y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = Assets.path.fill;
    this.ctx.fill();
    this.ctx.strokeStyle = Assets.path.border;
    this.ctx.lineWidth = Assets.path.borderWidth;
    this.ctx.stroke();

    // Draw Pickups
    this.ctx.fillStyle = Assets.pickup.color;
    for (const pickup of this.pickups) {
      const pickupCanvasY = this.canvas.height - (pickup.worldY - this.distanceTraveled);
      const centerX = this.pathGen.getCenter(pickup.worldY, this.canvas.width);
      this.ctx.fillRect(centerX + pickup.offsetX - pickup.width/2, pickupCanvasY - pickup.height/2, pickup.width, pickup.height);
    }

    // Draw Obstacles
    this.ctx.fillStyle = Assets.obstacle.color;
    for (const obs of this.obstacles) {
      const obsCanvasY = this.canvas.height - (obs.worldY - this.distanceTraveled);
      const centerX = this.pathGen.getCenter(obs.worldY, this.canvas.width);
      this.ctx.fillRect(centerX + obs.offsetX - obs.width/2, obsCanvasY - obs.height/2, obs.width, obs.height);
    }

    // Draw Boss
    if (this.boss) {
      this.boss.draw(this.ctx);
    }

    // Draw Player
    this.player.draw(this.ctx);

    // UI
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Level: ${this.level}`, 10, 20);
    this.ctx.fillText(`Health: ${Math.max(0, Math.floor(this.player.health))}`, 10, 40);
    
    if (this.state === 'PLAYING') {
      const progress = Math.min(100, Math.floor((this.distanceTraveled / this.levelLength) * 100));
      this.ctx.fillText(`Progress: ${progress}%`, 10, 60);
    } else if (this.state === 'BOSS_FIGHT') {
      this.ctx.fillStyle = '#ff4444';
      this.ctx.fillText(`BOSS: ${this.boss?.attacksCompleted}/${this.boss?.maxAttacks} Attacks`, 10, 60);
    }

    if (this.player.isSlowed) {
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (this.state === 'GAME_OVER') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawText('GAME OVER', this.canvas.width/2, this.canvas.height/2 - 20, '40px sans-serif', '#f44');
      this.drawText('Press SPACE to Restart', this.canvas.width/2, this.canvas.height/2 + 30, '20px sans-serif', '#fff');
    } else if (this.state === 'LEVEL_COMPLETE') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawText('LEVEL COMPLETE!', this.canvas.width/2, this.canvas.height/2 - 20, '40px sans-serif', '#4f4');
      this.drawText('Press SPACE for Next Level', this.canvas.width/2, this.canvas.height/2 + 30, '20px sans-serif', '#fff');
    }
  }

  private drawText(text: string, x: number, y: number, font: string, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.font = font;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, x, y);
  }
}
