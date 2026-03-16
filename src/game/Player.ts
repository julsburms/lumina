import { Assets } from './Assets';

export class Player {
  public x: number;
  public y: number;
  public speed: number = 300; // pixels per second
  public health: number = 100;
  public width: number = Assets.player.width;
  public height: number = Assets.player.height;
  public isSlowed: boolean = false;

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
  }

  public update(dt: number, input: { left: boolean; right: boolean }) {
    let currentSpeed = this.isSlowed ? this.speed * 0.4 : this.speed;
    
    if (input.left) {
      this.x -= currentSpeed * dt;
    }
    if (input.right) {
      this.x += currentSpeed * dt;
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = Assets.player.color;
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
  }
}
