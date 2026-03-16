export class PathGenerator {
  public width: number;
  private seed: number;
  private level: number;

  constructor(level: number) {
    this.level = level;
    // Path gets narrower as level increases, minimum 120px
    this.width = Math.max(120, 260 - level * 20); 
    this.seed = Math.random() * 10000;
  }

  // Get the center X of the path at a specific absolute Y (distance traveled)
  public getCenter(y: number, screenWidth: number): number {
    const baseFreq = 0.002 + this.level * 0.0005; // Faster curves on higher levels
    const maxOffset = Math.max(0, (screenWidth - this.width) / 2 - 20); // 20px padding from screen edge
    
    // Combine sine waves for organic movement
    const rawOffset = Math.sin(y * baseFreq + this.seed) + Math.sin(y * baseFreq * 2.3 + this.seed * 2) * 0.6;
    
    // rawOffset is between -1.6 and 1.6, normalize it to -1 to 1
    const normalizedOffset = rawOffset / 1.6;
    
    return screenWidth / 2 + normalizedOffset * maxOffset;
  }
}
