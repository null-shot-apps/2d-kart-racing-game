import { Track, TrackPoint, Vector2D, Obstacle, PowerupSpawn, SpeedBoost } from '@/types/game';

function generateTrackPoints(seed: number, complexity: number): TrackPoint[] {
  const points: TrackPoint[] = [];
  const numPoints = 20 + Math.floor(complexity * 10);
  const centerX = 400;
  const centerY = 300;
  const baseRadius = 200 + complexity * 50;
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const radiusVariation = Math.sin(angle * 3 + seed) * 50 + Math.cos(angle * 5 + seed * 2) * 30;
    const radius = baseRadius + radiusVariation;
    
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const width = 80 + Math.sin(angle * 2 + seed) * 20;
    
    points.push({ x, y, width });
  }
  
  return points;
}

function generateCheckpoints(points: TrackPoint[]): Vector2D[] {
  const checkpoints: Vector2D[] = [];
  const numCheckpoints = 4;
  
  for (let i = 0; i < numCheckpoints; i++) {
    const index = Math.floor((i / numCheckpoints) * points.length);
    checkpoints.push({ x: points[index].x, y: points[index].y });
  }
  
  return checkpoints;
}

function generateObstacles(points: TrackPoint[], seed: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const numObstacles = 8 + Math.floor(Math.random() * 5);
  
  for (let i = 0; i < numObstacles; i++) {
    const pointIndex = Math.floor((Math.random() + seed * 0.1) * points.length) % points.length;
    const point = points[pointIndex];
    const nextPoint = points[(pointIndex + 1) % points.length];
    
    const offsetX = (nextPoint.x - point.x) * Math.random();
    const offsetY = (nextPoint.y - point.y) * Math.random();
    
    const types: Array<'rock' | 'cone' | 'barrier'> = ['rock', 'cone', 'barrier'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    obstacles.push({
      position: { x: point.x + offsetX, y: point.y + offsetY },
      radius: type === 'rock' ? 15 : type === 'cone' ? 10 : 20,
      type,
    });
  }
  
  return obstacles;
}

function generatePowerups(points: TrackPoint[]): PowerupSpawn[] {
  const powerups: PowerupSpawn[] = [];
  const types: Array<'turbo' | 'shield' | 'projectile'> = ['turbo', 'shield', 'projectile'];
  
  for (let i = 0; i < 6; i++) {
    const pointIndex = Math.floor((i / 6) * points.length);
    const point = points[pointIndex];
    
    powerups.push({
      position: { x: point.x, y: point.y },
      type: types[i % types.length],
      active: true,
      respawnTime: 0,
    });
  }
  
  return powerups;
}

function generateSpeedBoosts(points: TrackPoint[]): SpeedBoost[] {
  const boosts: SpeedBoost[] = [];
  
  for (let i = 0; i < 4; i++) {
    const pointIndex = Math.floor((i / 4) * points.length);
    const point = points[pointIndex];
    const nextPoint = points[(pointIndex + 1) % points.length];
    
    const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x);
    
    boosts.push({
      position: { x: point.x, y: point.y },
      angle,
      width: 60,
      height: 40,
    });
  }
  
  return boosts;
}

export function generateTrack(seed: number, name: string, complexity: number): Track {
  const points = generateTrackPoints(seed, complexity);
  const checkpoints = generateCheckpoints(points);
  const obstacles = generateObstacles(points, seed);
  const powerups = generatePowerups(points);
  const speedBoosts = generateSpeedBoosts(points);
  
  return {
    id: `track-${seed}`,
    name,
    points,
    startPosition: { x: points[0].x, y: points[0].y },
    startAngle: Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x),
    checkpoints,
    obstacles,
    powerups,
    speedBoosts,
  };
}

export const DEMO_TRACKS: Track[] = [
  generateTrack(42, 'Sunset Circuit', 0.5),
  generateTrack(123, 'Neon Loop', 1.0),
  generateTrack(789, 'Chaos Canyon', 1.5),
];

