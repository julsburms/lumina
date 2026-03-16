import { Assets } from './Assets';

type BossState = 'IDLE' | 'AIMING' | 'DIVING' | 'RETURNING' | 'DONE';

export class Boss {
  public x: number;
  public y: number;
  public width: number = Assets.boss.width;
  public height: number = Assets.boss.height;
  
  public state: BossState = 'IDLE';
  public attacksCompleted: number = 0;
  public maxAttacks: number = 5;
  
  private stateTimer: number = 0;
  private diveSpeed: number = 500;
  private returnSpeed: number = 250;
  private startY: number = 80;

  constructor(startX: number, level: number) {
    this.x = startX;
    this.y = -100; // Start offscreen
    
    // Scale number of attacks based on level
    if (level === 1) {
      this.maxAttacks = 3;
    } else if (level === 2) {
      this.maxAttacks = 5;
    } else {
      this.maxAttacks = 8; // Cap at 8 attacks
    }
    
    // Scale dive speed from level 4 onward
    if (level >= 4) {
      this.diveSpeed = 500 + (level - 3) * 150;
    }
  }

  public update(dt: number, playerX: number, playerY: number) {
    if (this.state === 'DONE') return;

    this.stateTimer -= dt;

    switch (this.state) {
      case 'IDLE':
        // Move to start position if not there
        if (this.y < this.startY) {
          this.y += this.returnSpeed * dt;
        } else {
          this.y = this.startY;
          if (this.stateTimer <= 0) {
            this.state = 'AIMING';
            this.stateTimer = 1.5; // Aim for 1.5 seconds
          }
        }
        break;
        
      case 'AIMING':
        // Slowly track player
        const diff = playerX - this.x;
        this.x += diff * 3 * dt; // Lerp towards player
        
        if (this.stateTimer <= 0) {
          this.state = 'DIVING';
          // Trajectory is locked because we only move Y in DIVING state
        }
        break;
        
      case 'DIVING':
        this.y += this.diveSpeed * dt;
        // If missed player and went off screen
        if (this.y > playerY + 200) {
          this.state = 'RETURNING';
          this.attacksCompleted++;
          if (this.attacksCompleted >= this.maxAttacks) {
            this.state = 'DONE';
          }
        }
        break;
        
      case 'RETURNING':
        this.y -= this.returnSpeed * dt;
        if (this.y <= this.startY) {
          this.y = this.startY;
          this.state = 'IDLE';
          this.stateTimer = 1.0; // Wait 1 second before next attack
        }
        break;
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = Assets.boss.color;
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    
    // Draw aiming laser if aiming
    if (this.state === 'AIMING') {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y + this.height / 2);
      ctx.lineTo(this.x, this.y + 1000);
      ctx.stroke();
    }
  }
}
