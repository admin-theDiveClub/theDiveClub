// particle_physics.js

// -------------------------------
// Physics Constants
// -------------------------------
const dampingRate = 0.99;
const cushionBounceDamping = 0.9;
const ballBounceDamping = 0.8;

const accelerationMin = 0.7;
const accelerationMax = 2;

const spinStrengthMin = 0.15;
const spinStrengthMax = 0.25;

const forwardSpinMin = 0.15;
const forwardSpinMax = 0.25;

const accelerationDecayRate = 0.9;
const sideSpinDecayRate = 0.92;
const forwardSpinDecayRate = 0.92;

const motionScale = 0.75;

// -------------------------------
// Physics Functions
// -------------------------------
export function applyMotion(particle) {
  particle.vx += (particle.ax || 0) * motionScale;
  particle.vy += (particle.ay || 0) * motionScale;

  if (particle.forwardSpin) {
    const len = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy) || 1;
    const dirX = particle.vx / len;
    const dirY = particle.vy / len;
    particle.vx += dirX * particle.forwardSpin;
    particle.vy += dirY * particle.forwardSpin;
    particle.forwardSpin *= forwardSpinDecayRate;
  }

  if (particle.spinForce) {
    const perpX = -particle.vy;
    const perpY = particle.vx;
    const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
    particle.vx += (perpX / len) * particle.spinForce;
    particle.vy += (perpY / len) * particle.spinForce;
    particle.spinForce *= sideSpinDecayRate;
  }

  particle.x += particle.vx * motionScale;
  particle.y += particle.vy * motionScale;

  particle.vx *= dampingRate;
  particle.vy *= dampingRate;

  if (particle.ax) particle.ax *= accelerationDecayRate;
  if (particle.ay) particle.ay *= accelerationDecayRate;
}

export function applyWallBounce(particle, canvas) {
  const r = particle.radius;
  if (particle.x - r <= 0 || particle.x + r >= canvas.width) {
    particle.vx *= -1 * cushionBounceDamping;
    particle.x = Math.max(r, Math.min(particle.x, canvas.width - r));
    particle.vy += particle.spinForce * 5;
  }
  if (particle.y - r <= 0 || particle.y + r >= canvas.height) {
    particle.vy *= -1 * cushionBounceDamping;
    particle.y = Math.max(r, Math.min(particle.y, canvas.height - r));
    particle.vx -= particle.spinForce * 5;
  }
}

export function giveInitialVelocity(particle, target, canvas) {
  const dx = target.x - particle.x;
  const dy = target.y - particle.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return;
  let angle = Math.atan2(dy, dx);
  const maxDeviation = Math.atan(target.radius / distance);
  const deviation = (Math.random() * 2 - 1) * (maxDeviation * 16);
  angle += deviation;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const scale = Math.max(canvas.width, canvas.height) / 1000;
  const baseAcceleration = getRandom(accelerationMin * scale, accelerationMax * scale);
  particle.vx = dirX * baseAcceleration;
  particle.vy = dirY * baseAcceleration;
  particle.ax = dirX * baseAcceleration;
  particle.ay = dirY * baseAcceleration;
}

export function handleBallCollision(white, target, canvas) {
  if (white.hasCollided || target.hasCollided) return;
  const dx = target.x - white.x;
  const dy = target.y - white.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const minDist = (white.radius + target.radius) * 8;
  if (distance > minDist) return;
  white.hasCollided = true;
  target.hasCollided = true;
  const nx = dx / distance;
  const ny = dy / distance;
  const dot = white.vx * nx + white.vy * ny;
  target.vx = nx * dot * ballBounceDamping;
  target.vy = ny * dot * ballBounceDamping;
  white.vx = white.vx - nx * dot;
  white.vy = white.vy - ny * dot;
  white.vx *= dampingRate;
  white.vy *= dampingRate;
  white.ax = 0;
  white.ay = 0;
  const scale = Math.max(canvas.width, canvas.height) / 1000;
  const spinDir = Math.random() < 0.5 ? -1 : 1;
  const spinMag = getRandom(spinStrengthMin * scale, spinStrengthMax * scale);
  white.spinForce = spinDir * spinMag;
  const forwardDir = Math.random() < 0.5 ? -1 : 1;
  const forwardMag = Math.min(
    getRandom(forwardSpinMin * scale, forwardSpinMax * scale),
    Math.sqrt(white.vx * white.vx + white.vy * white.vy)
  );
  white.forwardSpin = forwardDir * forwardMag * 1.5;
}

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}
