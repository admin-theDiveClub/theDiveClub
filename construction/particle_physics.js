// -------------------------------
// Physics Constants
// -------------------------------

const dampingRate = 0.98;
const cushionBounceDamping = 0.75;
const ballBounceDamping = 0.95;

const accelerationMin = 1.2;
const accelerationMax = 4;

const spinStrengthMin = 0.05;
const spinStrengthMax = 0.3;

const forwardSpinMin = 0.05;
const forwardSpinMax = 0.12;

const accelerationDecayRate = 0.95;
const sideSpinDecayRate = 0.95;
const forwardSpinDecayRate = 0.98;

const motionScale = 1;


// -------------------------------
// Physics Functions
// -------------------------------

export function applyMotion(particle) 
{
    // Apply cue acceleration
    particle.vx += (particle.ax || 0) * motionScale;
    particle.vy += (particle.ay || 0) * motionScale;

    // Apply forward/backspin (topspin/draw)
    if (particle.forwardSpin) 
    {
        const len = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy) || 1;
        const dirX = particle.vx / len;
        const dirY = particle.vy / len;

        particle.vx += dirX * particle.forwardSpin;
        particle.vy += dirY * particle.forwardSpin;

        particle.forwardSpin *= forwardSpinDecayRate;
    }

    // Apply side spin (curving arcs)
    if (particle.spinForce) 
    {
        const perpX = -particle.vy;
        const perpY = particle.vx;
        const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;

        particle.vx += (perpX / len) * particle.spinForce;
        particle.vy += (perpY / len) * particle.spinForce;

        particle.spinForce *= sideSpinDecayRate;
    }

    // Move particle
    particle.x += particle.vx * motionScale;
    particle.y += particle.vy * motionScale;

    // General damping (friction)
    particle.vx *= dampingRate;
    particle.vy *= dampingRate;

    // Decay cue acceleration
    if (particle.ax) particle.ax *= accelerationDecayRate;
    if (particle.ay) particle.ay *= accelerationDecayRate;
}

export function applyWallBounce(particle, canvas) 
{
    const r = particle.radius;

    // Bounce off X walls
    if (particle.x - r <= 0 || particle.x + r >= canvas.width) 
    {
        particle.vx *= -1 * cushionBounceDamping;
        particle.x = Math.max(r, Math.min(particle.x, canvas.width - r));

        // Apply spin-induced angular deflection
        particle.vy += particle.spinForce * 3; // tweak multiplier for visual effect
    }

    // Bounce off Y walls
    if (particle.y - r <= 0 || particle.y + r >= canvas.height) 
    {
        particle.vy *= -1 * cushionBounceDamping;
        particle.y = Math.max(r, Math.min(particle.y, canvas.height - r));

        // Apply spin-induced angular deflection
        particle.vx -= particle.spinForce * 3; // tweak multiplier for visual effect
    }
}


export function giveInitialVelocity(particle, target) 
{
    const dx = target.x - particle.x;
    const dy = target.y - particle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    let angle = Math.atan2(dy, dx);

    // Controlled deviation (off-center but still hits)
    const maxDeviation = Math.atan(target.radius / distance);
    const deviation = (Math.random() * 2 - 1) * (maxDeviation * 2);

    angle += deviation;

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    const baseAcceleration = getRandom(accelerationMin, accelerationMax);

    particle.vx = dirX * baseAcceleration;
    particle.vy = dirY * baseAcceleration;

    particle.ax = dirX * baseAcceleration;
    particle.ay = dirY * baseAcceleration;
}

export function handleBallCollision(white, target) 
{
    if (white.hasCollided || target.hasCollided) return;

    const dx = target.x - white.x;
    const dy = target.y - white.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = (white.radius + target.radius) * 2;

    if (distance > minDist) return;

    white.hasCollided = true;
    target.hasCollided = true;

    const nx = dx / distance;
    const ny = dy / distance;
    const dot = white.vx * nx + white.vy * ny;

    // Give target velocity in direction of impact
    target.vx = nx * dot * ballBounceDamping;
    target.vy = ny * dot * ballBounceDamping;

    // Deflect white
    white.vx = white.vx - nx * dot;
    white.vy = white.vy - ny * dot;

    // Damp white
    white.vx *= dampingRate;
    white.vy *= dampingRate;

    // Remove forward push
    white.ax = 0;
    white.ay = 0;

    // Apply random side spin (for arc paths)
    const spinDir = Math.random() < 0.5 ? -1 : 1;
    const spinMag = getRandom(spinStrengthMin, spinStrengthMax);
    white.spinForce = spinDir * spinMag;

    // Apply random top/backspin (for speed changes)
    const forwardDir = Math.random() < 0.5 ? -1 : 1;
    const forwardMag = getRandom(forwardSpinMin, forwardSpinMax);
    white.forwardSpin = forwardDir * forwardMag;
}


// -------------------------------
// Utility
// -------------------------------

function getRandom(min, max) 
{
    return Math.random() * (max - min) + min;
}
