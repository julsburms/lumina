import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/Engine';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const engine = new GameEngine(canvasRef.current);
    engine.start();

    return () => {
      engine.stop();
    };
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900">
      <div className="relative shadow-2xl shadow-black rounded-lg overflow-hidden border border-neutral-800">
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={600} 
          className="block bg-black"
        />
      </div>
    </div>
  );
}
