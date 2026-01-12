'use client';

import { useEffect, useRef, useState } from 'react';
import { GameState, KartState, Kart, Track, Projectile } from '@/types/game';
import { KARTS } from '@/data/karts';
import { DEMO_TRACKS } from '@/utils/trackGenerator';
import { updateKartPhysics, updateAIKart, updateProjectile, checkProjectileCollision } from '@/utils/physics';

const TOTAL_LAPS = 3;
const OPPONENT_COUNT = 5;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    phase: 'menu',
    opponentStates: [],
    projectiles: [],
    raceTime: 0,
    countdownTime: 3,
    rankings: [],
  });
  
  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    drift: false,
    usePowerup: false,
  });
  
  const cameraRef = useRef({ x: 0, y: 0 });

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') keysRef.current.up = true;
      if (e.key === 'ArrowDown' || e.key === 's') keysRef.current.down = true;
      if (e.key === 'ArrowLeft' || e.key === 'a') keysRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') keysRef.current.right = true;
      if (e.key === 'Shift') keysRef.current.drift = true;
      if (e.key === ' ') {
        e.preventDefault();
        keysRef.current.usePowerup = true;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') keysRef.current.up = false;
      if (e.key === 'ArrowDown' || e.key === 's') keysRef.current.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a') keysRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') keysRef.current.right = false;
      if (e.key === 'Shift') keysRef.current.drift = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState.phase !== 'countdown' && gameState.phase !== 'racing') return;
    
    let lastTime = Date.now();
    const gameLoop = setInterval(() => {
      const now = Date.now();
      const deltaTime = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      
      setGameState(prev => {
        if (prev.phase === 'countdown') {
          const newCountdown = prev.countdownTime - deltaTime;
          if (newCountdown <= 0) {
            return { ...prev, phase: 'racing', countdownTime: 0 };
          }
          return { ...prev, countdownTime: newCountdown };
        }
        
        if (prev.phase === 'racing' && prev.playerState && prev.selectedKart && prev.selectedTrack) {
          // Update player
          let newPlayerState = updateKartPhysics(
            prev.playerState,
            prev.selectedKart,
            keysRef.current,
            prev.selectedTrack,
            deltaTime
          );
          
          // Use powerup
          if (keysRef.current.usePowerup && newPlayerState.powerup) {
            keysRef.current.usePowerup = false;
            
            if (newPlayerState.powerup === 'turbo') {
              newPlayerState.speed *= 2;
            } else if (newPlayerState.powerup === 'projectile') {
              const newProjectile: Projectile = {
                position: { ...newPlayerState.position },
                velocity: {
                  x: Math.cos(newPlayerState.angle) * 10,
                  y: Math.sin(newPlayerState.angle) * 10,
                },
                owner: -1,
                active: true,
              };
              prev.projectiles.push(newProjectile);
            }
            
            newPlayerState.powerup = undefined;
          }
          
          // Check powerup collection
          prev.selectedTrack.powerups.forEach(powerup => {
            if (powerup.active) {
              const dist = Math.sqrt(
                Math.pow(newPlayerState.position.x - powerup.position.x, 2) +
                Math.pow(newPlayerState.position.y - powerup.position.y, 2)
              );
              if (dist < 20) {
                newPlayerState.powerup = powerup.type;
                powerup.active = false;
                powerup.respawnTime = 5;
              }
            } else {
              powerup.respawnTime -= deltaTime;
              if (powerup.respawnTime <= 0) {
                powerup.active = true;
              }
            }
          });
          
          // Update opponents
          const newOpponentStates = prev.opponentStates.map((opponentState, index) => {
            const opponentKart = KARTS[index % KARTS.length];
            const difficulty = 0.7 + (index * 0.05);
            return updateAIKart(opponentState, opponentKart, prev.selectedTrack!, difficulty, deltaTime);
          });
          
          // Update projectiles
          const newProjectiles = prev.projectiles
            .map(p => updateProjectile(p, deltaTime))
            .filter(p => {
              // Check collisions
              const hitIndex = checkProjectileCollision(p, [newPlayerState, ...newOpponentStates], p.owner);
              if (hitIndex !== null) {
                if (hitIndex === 0) {
                  newPlayerState.speed *= 0.3;
                } else {
                  newOpponentStates[hitIndex - 1].speed *= 0.3;
                }
                return false;
              }
              
              // Remove if out of bounds
              const dist = Math.sqrt(p.position.x * p.position.x + p.position.y * p.position.y);
              return dist < 2000;
            });
          
          // Calculate rankings
          const allStates = [newPlayerState, ...newOpponentStates];
          const rankings = allStates
            .map((state, index) => ({ index, state }))
            .sort((a, b) => {
              if (a.state.lap !== b.state.lap) return b.state.lap - a.state.lap;
              const aProgress = a.state.checkpoints.filter(c => c).length;
              const bProgress = b.state.checkpoints.filter(c => c).length;
              return bProgress - aProgress;
            })
            .map(item => item.index);
          
          // Check if race finished
          if (newPlayerState.lap >= TOTAL_LAPS && !newPlayerState.finished) {
            newPlayerState.finished = true;
            newPlayerState.finishTime = prev.raceTime;
            
            // Check if all finished
            const allFinished = [newPlayerState, ...newOpponentStates].every(s => s.finished);
            if (allFinished) {
              return {
                ...prev,
                phase: 'finished',
                playerState: newPlayerState,
                opponentStates: newOpponentStates,
                rankings,
              };
            }
          }
          
          return {
            ...prev,
            playerState: newPlayerState,
            opponentStates: newOpponentStates,
            projectiles: newProjectiles,
            raceTime: prev.raceTime + deltaTime,
            rankings,
          };
        }
        
        return prev;
      });
    }, 1000 / 60);
    
    return () => clearInterval(gameLoop);
  }, [gameState.phase]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (gameState.phase === 'menu') {
        renderMenu(ctx, canvas);
      } else if (gameState.selectedTrack && gameState.playerState) {
        // Update camera
        cameraRef.current = {
          x: gameState.playerState.position.x - canvas.width / 2,
          y: gameState.playerState.position.y - canvas.height / 2,
        };
        
        renderGame(ctx, canvas, gameState, cameraRef.current);
      }
      
      requestAnimationFrame(render);
    };
    
    render();
  }, [gameState]);

  const startRace = (kart: Kart, track: Track) => {
    const initialState: KartState = {
      position: { ...track.startPosition },
      velocity: { x: 0, y: 0 },
      angle: track.startAngle,
      speed: 0,
      lap: 0,
      checkpoints: new Array(track.checkpoints.length).fill(false),
      finished: false,
    };
    
    const opponentStates: KartState[] = [];
    for (let i = 0; i < OPPONENT_COUNT; i++) {
      opponentStates.push({
        ...initialState,
        position: {
          x: track.startPosition.x - 40 * Math.cos(track.startAngle) * (i + 1),
          y: track.startPosition.y - 40 * Math.sin(track.startAngle) * (i + 1),
        },
      });
    }
    
    setGameState({
      phase: 'countdown',
      selectedKart: kart,
      selectedTrack: track,
      playerState: initialState,
      opponentStates,
      projectiles: [],
      raceTime: 0,
      countdownTime: 3,
      rankings: [],
    });
  };

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <canvas
        ref={canvasRef}
        width={1200}
        height={800}
        className="w-full h-full"
      />
      
      {gameState.phase === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-gray-800/90 p-8 rounded-lg max-w-4xl">
            <h1 className="text-4xl font-bold text-white mb-8 text-center">Choose Your Kart</h1>
            <div className="grid grid-cols-5 gap-4 mb-8">
              {KARTS.map(kart => (
                <button
                  key={kart.id}
                  onClick={() => setGameState(prev => ({ ...prev, selectedKart: kart }))}
                  className={`p-4 rounded-lg border-2 transition ${
                    gameState.selectedKart?.id === kart.id
                      ? 'border-white bg-gray-700'
                      : 'border-gray-600 bg-gray-800 hover:border-gray-400'
                  }`}
                >
                  <div
                    className="w-full h-20 rounded mb-2"
                    style={{ backgroundColor: kart.color }}
                  />
                  <h3 className="text-white font-bold text-sm mb-2">{kart.name}</h3>
                  <div className="text-xs text-gray-300 space-y-1">
                    <div>Speed: {'⭐'.repeat(Math.floor(kart.speed / 2))}</div>
                    <div>Accel: {'⭐'.repeat(Math.floor(kart.acceleration / 2))}</div>
                    <div>Handle: {'⭐'.repeat(Math.floor(kart.handling / 2))}</div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{kart.personality}</p>
                </button>
              ))}
            </div>
            
            {gameState.selectedKart && (
              <>
                <h2 className="text-3xl font-bold text-white mb-4 text-center">Choose Your Track</h2>
                <div className="grid grid-cols-3 gap-4">
                  {DEMO_TRACKS.map(track => (
                    <button
                      key={track.id}
                      onClick={() => startRace(gameState.selectedKart!, track)}
                      className="p-6 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition"
                    >
                      <h3 className="text-white font-bold text-xl mb-2">{track.name}</h3>
                      <p className="text-white/80 text-sm">Click to race!</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {gameState.phase === 'countdown' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-9xl font-bold text-white animate-pulse">
            {Math.ceil(gameState.countdownTime)}
          </div>
        </div>
      )}
      
      {gameState.phase === 'finished' && gameState.playerState && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 p-8 rounded-lg text-center">
            <h1 className="text-5xl font-bold text-white mb-4">Race Complete!</h1>
            <div className="text-3xl text-yellow-400 mb-6">
              Position: {gameState.rankings.indexOf(0) + 1} / {gameState.rankings.length}
            </div>
            <div className="text-xl text-white mb-8">
              Time: {gameState.playerState.finishTime?.toFixed(2)}s
            </div>
            <button
              onClick={() => setGameState({ phase: 'menu', opponentStates: [], projectiles: [], raceTime: 0, countdownTime: 3, rankings: [] })}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-blue-500 transition"
            >
              Race Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function renderMenu(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function renderGame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  gameState: GameState,
  camera: { x: number; y: number }
) {
  const { selectedTrack, playerState, opponentStates, projectiles, rankings } = gameState;
  if (!selectedTrack || !playerState) return;
  
  // Background
  ctx.fillStyle = '#0a4d0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Track
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  
  // Draw track
  ctx.strokeStyle = '#333';
  ctx.lineWidth = selectedTrack.points[0].width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  selectedTrack.points.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();
  
  // Draw track surface
  ctx.strokeStyle = '#555';
  ctx.lineWidth = selectedTrack.points[0].width - 10;
  ctx.beginPath();
  selectedTrack.points.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();
  
  // Draw speed boosts
  selectedTrack.speedBoosts.forEach(boost => {
    ctx.save();
    ctx.translate(boost.position.x, boost.position.y);
    ctx.rotate(boost.angle);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(-boost.width / 2, -boost.height / 2, boost.width, boost.height);
    ctx.fillStyle = '#ff8800';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-boost.width / 2 + i * 20, -boost.height / 2, 10, boost.height);
    }
    ctx.restore();
  });
  
  // Draw obstacles
  selectedTrack.obstacles.forEach(obstacle => {
    if (obstacle.type === 'rock') {
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(obstacle.position.x, obstacle.position.y, obstacle.radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (obstacle.type === 'cone') {
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(obstacle.position.x, obstacle.position.y - obstacle.radius);
      ctx.lineTo(obstacle.position.x - obstacle.radius, obstacle.position.y + obstacle.radius);
      ctx.lineTo(obstacle.position.x + obstacle.radius, obstacle.position.y + obstacle.radius);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(
        obstacle.position.x - obstacle.radius,
        obstacle.position.y - obstacle.radius / 2,
        obstacle.radius * 2,
        obstacle.radius
      );
    }
  });
  
  // Draw powerups
  selectedTrack.powerups.forEach(powerup => {
    if (!powerup.active) return;
    
    ctx.save();
    ctx.translate(powerup.position.x, powerup.position.y);
    ctx.rotate(Date.now() / 500);
    
    if (powerup.type === 'turbo') {
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = '#0088ff';
      ctx.fillRect(-6, -6, 12, 12);
    } else if (powerup.type === 'shield') {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  });
  
  // Draw projectiles
  projectiles.forEach(projectile => {
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(projectile.position.x, projectile.position.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Draw checkpoints (debug)
  selectedTrack.checkpoints.forEach((checkpoint, i) => {
    ctx.strokeStyle = playerState.checkpoints[i] ? '#00ff00' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(checkpoint.x, checkpoint.y, 40, 0, Math.PI * 2);
    ctx.stroke();
  });
  
  // Draw opponents
  opponentStates.forEach((state, index) => {
    const kart = KARTS[index % KARTS.length];
    drawKart(ctx, state, kart, false);
  });
  
  // Draw player
  if (gameState.selectedKart) {
    drawKart(ctx, playerState, gameState.selectedKart, true);
  }
  
  ctx.restore();
  
  // HUD
  renderHUD(ctx, canvas, gameState);
}

function drawKart(ctx: CanvasRenderingContext2D, state: KartState, kart: Kart, isPlayer: boolean) {
  ctx.save();
  ctx.translate(state.position.x, state.position.y);
  ctx.rotate(state.angle);
  
  // Kart body
  ctx.fillStyle = kart.color;
  ctx.fillRect(-15, -10, 30, 20);
  
  // Accent
  ctx.fillStyle = kart.accentColor;
  ctx.fillRect(-10, -8, 20, 16);
  
  // Wheels
  ctx.fillStyle = '#000';
  ctx.fillRect(-12, -12, 8, 4);
  ctx.fillRect(-12, 8, 8, 4);
  ctx.fillRect(4, -12, 8, 4);
  ctx.fillRect(4, 8, 8, 4);
  
  // Player indicator
  if (isPlayer) {
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Shield effect
  if (state.powerup === 'shield') {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.restore();
}

function renderHUD(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, gameState: GameState) {
  const { playerState, rankings, raceTime } = gameState;
  if (!playerState) return;
  
  // Position
  const position = rankings.indexOf(0) + 1;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Arial';
  ctx.fillText(`${position}/${rankings.length}`, 20, 60);
  
  // Lap
  ctx.font = 'bold 32px Arial';
  ctx.fillText(`Lap ${Math.min(playerState.lap + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`, 20, 110);
  
  // Speed
  const speedPercent = Math.abs(playerState.speed / 30 * 100);
  ctx.fillText(`Speed: ${speedPercent.toFixed(0)}%`, 20, 160);
  
  // Time
  ctx.fillText(`Time: ${raceTime.toFixed(1)}s`, 20, 210);
  
  // Powerup
  if (playerState.powerup) {
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(canvas.width - 120, 20, 100, 100);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(playerState.powerup.toUpperCase(), canvas.width - 110, 75);
    ctx.fillText('SPACE', canvas.width - 95, 95);
  }
  
  // Controls hint
  ctx.fillStyle = '#fff';
  ctx.font = '16px Arial';
  ctx.fillText('Arrow Keys / WASD: Move', canvas.width - 220, canvas.height - 60);
  ctx.fillText('Shift: Drift', canvas.width - 220, canvas.height - 40);
  ctx.fillText('Space: Use Power-up', canvas.width - 220, canvas.height - 20);
}

