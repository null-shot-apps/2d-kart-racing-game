import { Vector2D, KartState, Kart, Track, Obstacle, Projectile } from '@/types/game';

export function updateKartPhysics(
  state: KartState,
  kart: Kart,
  controls: { up: boolean; down: boolean; left: boolean; right: boolean; drift: boolean },
  track: Track,
  deltaTime: number
): KartState {
  const newState = { ...state };
  
  // Base stats
  const maxSpeed = kart.speed * 3;
  const acceleration = kart.acceleration * 0.5;
  const handling = kart.handling * 0.05;
  const friction = 0.98;
  const driftBonus = controls.drift ? 1.2 : 1.0;
  
  // Acceleration/Braking
  if (controls.up) {
    newState.speed = Math.min(newState.speed + acceleration * deltaTime, maxSpeed);
  } else if (controls.down) {
    newState.speed = Math.max(newState.speed - acceleration * 2 * deltaTime, -maxSpeed * 0.5);
  } else {
    newState.speed *= friction;
  }
  
  // Steering
  if (controls.left) {
    newState.angle -= handling * (newState.speed / maxSpeed) * driftBonus * deltaTime;
  }
  if (controls.right) {
    newState.angle += handling * (newState.speed / maxSpeed) * driftBonus * deltaTime;
  }
  
  // Update velocity
  newState.velocity = {
    x: Math.cos(newState.angle) * newState.speed,
    y: Math.sin(newState.angle) * newState.speed,
  };
  
  // Update position
  newState.position = {
    x: newState.position.x + newState.velocity.x * deltaTime,
    y: newState.position.y + newState.velocity.y * deltaTime,
  };
  
  // Check track boundaries
  const onTrack = isOnTrack(newState.position, track);
  if (!onTrack) {
    newState.speed *= 0.5; // Slow down off-track
  }
  
  // Check obstacles
  for (const obstacle of track.obstacles) {
    if (checkCollision(newState.position, obstacle.position, 15, obstacle.radius)) {
      newState.speed *= 0.3;
      // Bounce back
      const dx = newState.position.x - obstacle.position.x;
      const dy = newState.position.y - obstacle.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      newState.position.x = obstacle.position.x + (dx / dist) * (obstacle.radius + 15);
      newState.position.y = obstacle.position.y + (dy / dist) * (obstacle.radius + 15);
    }
  }
  
  // Check speed boosts
  for (const boost of track.speedBoosts) {
    if (checkCollision(newState.position, boost.position, 15, 30)) {
      newState.speed = Math.min(newState.speed * 1.5, maxSpeed * 1.5);
    }
  }
  
  // Check checkpoints
  track.checkpoints.forEach((checkpoint, index) => {
    if (!newState.checkpoints[index] && checkCollision(newState.position, checkpoint, 15, 40)) {
      newState.checkpoints[index] = true;
      
      // Check if lap completed
      if (index === 0 && newState.checkpoints.every(c => c)) {
        newState.lap++;
        newState.checkpoints = new Array(track.checkpoints.length).fill(false);
      }
    }
  });
  
  return newState;
}

export function updateAIKart(
  state: KartState,
  kart: Kart,
  track: Track,
  difficulty: number,
  deltaTime: number
): KartState {
  // Find target point on track
  const targetPoint = findNearestTrackPoint(state.position, track);
  const nextPoint = getNextTrackPoint(targetPoint, track);
  
  // Calculate desired angle
  const dx = nextPoint.x - state.position.x;
  const dy = nextPoint.y - state.position.y;
  const targetAngle = Math.atan2(dy, dx);
  
  // Add some randomness based on difficulty
  const errorMargin = (1 - difficulty) * 0.3;
  const angleError = (Math.random() - 0.5) * errorMargin;
  
  // Determine controls
  const angleDiff = normalizeAngle(targetAngle + angleError - state.angle);
  const controls = {
    up: true,
    down: false,
    left: angleDiff < -0.1,
    right: angleDiff > 0.1,
    drift: Math.abs(angleDiff) > 0.5,
  };
  
  // Occasionally make mistakes
  if (Math.random() > difficulty) {
    controls.up = false;
    controls.down = Math.random() > 0.5;
  }
  
  return updateKartPhysics(state, kart, controls, track, deltaTime);
}

function isOnTrack(position: Vector2D, track: Track): boolean {
  const nearest = findNearestTrackPoint(position, track);
  const dist = distance(position, nearest);
  return dist < nearest.width / 2;
}

function findNearestTrackPoint(position: Vector2D, track: Track): TrackPoint {
  let nearest = track.points[0];
  let minDist = distance(position, nearest);
  
  for (const point of track.points) {
    const dist = distance(position, point);
    if (dist < minDist) {
      minDist = dist;
      nearest = point;
    }
  }
  
  return nearest;
}

function getNextTrackPoint(current: TrackPoint, track: Track): TrackPoint {
  const index = track.points.indexOf(current);
  return track.points[(index + 3) % track.points.length];
}

function distance(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function checkCollision(pos1: Vector2D, pos2: Vector2D, radius1: number, radius2: number): boolean {
  return distance(pos1, pos2) < radius1 + radius2;
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function updateProjectile(projectile: Projectile, deltaTime: number): Projectile {
  return {
    ...projectile,
    position: {
      x: projectile.position.x + projectile.velocity.x * deltaTime,
      y: projectile.position.y + projectile.velocity.y * deltaTime,
    },
  };
}

export function checkProjectileCollision(
  projectile: Projectile,
  kartStates: KartState[],
  ownerIndex: number
): number | null {
  for (let i = 0; i < kartStates.length; i++) {
    if (i === ownerIndex) continue;
    if (checkCollision(projectile.position, kartStates[i].position, 10, 15)) {
      return i;
    }
  }
  return null;
}

