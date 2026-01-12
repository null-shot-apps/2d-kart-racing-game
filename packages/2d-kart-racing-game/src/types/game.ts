export interface Kart {
  id: string;
  name: string;
  color: string;
  accentColor: string;
  speed: number;
  acceleration: number;
  handling: number;
  personality: string;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface KartState {
  position: Vector2D;
  velocity: Vector2D;
  angle: number;
  speed: number;
  lap: number;
  checkpoints: boolean[];
  finished: boolean;
  finishTime?: number;
  powerup?: PowerupType;
}

export interface TrackPoint {
  x: number;
  y: number;
  width: number;
}

export interface Track {
  id: string;
  name: string;
  points: TrackPoint[];
  startPosition: Vector2D;
  startAngle: number;
  checkpoints: Vector2D[];
  obstacles: Obstacle[];
  powerups: PowerupSpawn[];
  speedBoosts: SpeedBoost[];
}

export interface Obstacle {
  position: Vector2D;
  radius: number;
  type: 'rock' | 'cone' | 'barrier';
}

export interface PowerupSpawn {
  position: Vector2D;
  type: PowerupType;
  active: boolean;
  respawnTime: number;
}

export interface SpeedBoost {
  position: Vector2D;
  angle: number;
  width: number;
  height: number;
}

export type PowerupType = 'turbo' | 'shield' | 'projectile';

export interface Projectile {
  position: Vector2D;
  velocity: Vector2D;
  owner: number;
  active: boolean;
}

export interface GameState {
  phase: 'menu' | 'countdown' | 'racing' | 'finished';
  selectedKart?: Kart;
  selectedTrack?: Track;
  playerState?: KartState;
  opponentStates: KartState[];
  projectiles: Projectile[];
  raceTime: number;
  countdownTime: number;
  rankings: number[];
}

