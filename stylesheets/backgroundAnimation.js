// === CONFIGURATION ===
const CONFIG = {
  ballSizeRatio: 0.025,
  launchSpeedRatio: 0.75,
  friction: 0.98,
  wallBounceDamping: 0.98,
  maxSpin: 1.5,
  spinDamping: 0.9,
  spinInfluence: 0.1,
  maxDeviationFactor: 1.0,
};

// === SETUP ===
const parentId = 'visualization-container'; // Change this to your desired parent ID
const parent = document.getElementById(parentId);
const canvas = document.createElement('canvas');
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = parent.clientWidth + 'px';
canvas.style.height = parent.clientHeight + 'px';
canvas.style.zIndex = '-1';
canvas.style.backgroundColor = 'transparent';
parent.appendChild(canvas);

const ctx = canvas.getContext('2d');
let width, height, minDim, ballRadius;
function resizeCanvas() {
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
  width = canvas.width;
  height = canvas.height;
  minDim = Math.min(width, height);
  ballRadius = CONFIG.ballSizeRatio * minDim * 0.5;
}
window.addEventListener('resize', () => {
  resizeCanvas();
});
resizeCanvas();

// === STATE ===
let balls = [];
let phase = 'init';

let trailAlpha = 0.25;         // Trail fade strength
let nextCycleDelay = 1500;    // Time in ms to wait after balls stop
let waitingForNext = false;

function randInRange(a, b) {
  return a + Math.random() * (b - a);
}
function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}
function normalize(x, y) {
  const len = Math.hypot(x, y);
  return len === 0 ? [0, 0] : [x / len, y / len];
}
function randomColor() {
  const r = Math.floor(randInRange(100, 255));
  const g = Math.floor(randInRange(100, 255));
  const b = Math.floor(randInRange(100, 255));
  return `rgb(${r},${g},${b})`;
}

function randomTDCColor() {
  const colors = [
    'rgba(230, 161, 0, 1)',    // highlight
    'rgba(1, 110, 194, 1)',    // secondary-light
    'rgba(0, 186, 245, 1)',    // secondary-lighter
    'rgba(234, 0, 103, 1)',    // primary
    'rgba(0, 53, 97, 1)'       // secondary
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function spawnBalls() {
  const ox = randInRange(ballRadius * 4, width - ballRadius * 4);
  const oy = randInRange(ballRadius * 4, height - ballRadius * 4);
  const wx = randInRange(ballRadius * 4, width - ballRadius * 4);
  const wy = randInRange(ballRadius * 4, height - ballRadius * 4);

  const contactOffset = randInRange(-CONFIG.maxDeviationFactor, CONFIG.maxDeviationFactor) * ballRadius;
  const dx = ox - wx;
  const dy = oy - wy;
  const [nx, ny] = normalize(dx, dy);
  const perp = [-ny, nx];
  
  // Adjust speed based on distance to ensure collision
  const distance = Math.hypot(dx, dy);
  const baseSpeed = CONFIG.launchSpeedRatio * minDim / 60;
  // Scale speed: closer objects need less speed, farther objects need more speed
  const distanceRatio = distance / minDim; // Normalize distance to canvas size
  const speedMultiplier = Math.min(3.0, Math.max(0.8, 1.0 + distanceRatio * 2.0)); // Scale from 0.8x to 3.0x
  const speed = baseSpeed * speedMultiplier;

  const white = {
    color: 'white',
    x: wx,
    y: wy,
    vx: nx * speed + perp[0] * contactOffset * 0.01,
    vy: ny * speed + perp[1] * contactOffset * 0.01,
    spin: 0,
    type: 'white',
    active: true,
    collided: false
  };

  const object = {
    color: randomTDCColor(),
    x: ox,
    y: oy,
    vx: 0,
    vy: 0,
    spin: 0,
    type: 'object',
    active: true,
  };

  balls = [white, object];
  phase = 'active';
}

function applyPhysics(ball) {
  // Add trail point before moving
  if (!ball.trail) ball.trail = [];
  ball.trail.push({ x: ball.x, y: ball.y, alpha: 1.0 });
  if (ball.trail.length > 50) ball.trail.shift();

  if (ball.type === 'white' && ball.collided && Math.abs(ball.spin) > 0.01) {
    const angle = Math.atan2(ball.vy, ball.vx);
    ball.vx += Math.cos(angle + Math.PI / 2) * ball.spin * CONFIG.spinInfluence;
    ball.vy += Math.sin(angle + Math.PI / 2) * ball.spin * CONFIG.spinInfluence;
    ball.spin *= CONFIG.spinDamping;
  }

  ball.vx *= CONFIG.friction;
  ball.vy *= CONFIG.friction;
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < ballRadius || ball.x > width - ballRadius) {
    ball.vx *= -CONFIG.wallBounceDamping;
    ball.x = Math.max(ballRadius, Math.min(ball.x, width - ballRadius));
  }
  if (ball.y < ballRadius || ball.y > height - ballRadius) {
    ball.vy *= -CONFIG.wallBounceDamping;
    ball.y = Math.max(ballRadius, Math.min(ball.y, height - ballRadius));
  }

  if (Math.hypot(ball.vx, ball.vy) < 0.1) {
    ball.active = false;
  }
}

function checkCollision() {
  const [white, object] = balls;
  if (!white || !object || white.collided) return;

  const dx = object.x - white.x;
  const dy = object.y - white.y;
  const distance = Math.hypot(dx, dy);
  if (distance < ballRadius * 2) {
    const [nx, ny] = normalize(dx, dy);

    const dvx = white.vx - object.vx;
    const dvy = white.vy - object.vy;
    const relVel = dvx * nx + dvy * ny;

    if (relVel > 0) return; // skip if moving apart

    // Elastic collision assuming equal mass
    white.vx -= nx * relVel;
    white.vy -= ny * relVel;
    object.vx += nx * relVel;
    object.vy += ny * relVel;

    // Add spin to white ball after impact
    white.spin = randInRange(-CONFIG.maxSpin, CONFIG.maxSpin);
    white.collided = true;
  }
}

function drawBall(ball) {
  // Draw trail with glow effect
  if (ball.trail && ball.trail.length > 1) {
    for (let i = 0; i < ball.trail.length - 1; i++) {
      const point = ball.trail[i];
      const nextPoint = ball.trail[i + 1];
      const alpha = (i / ball.trail.length) * 0.3;
      
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(nextPoint.x, nextPoint.y);
      
      // Set glow properties
      ctx.shadowBlur = 15;
      ctx.shadowColor = ball.type === 'white' ? 'rgba(255, 255, 255, 0.8)' : ball.color;
      
      // Use white for white ball, TDC color for object ball
      if (ball.type === 'white') {
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      } else {
        // Extract RGB values from ball.color (rgba format) and apply alpha
        const colorMatch = ball.color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
        if (colorMatch) {
          const [, r, g, b] = colorMatch;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } else {
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`; // fallback
        }
      }
      
      ctx.lineWidth = ballRadius * 0.5;
      ctx.lineCap = 'round'; // Add round line caps
      ctx.lineJoin = 'round'; // Add round line joins
      ctx.stroke();
      
      // Reset shadow for next drawing operations
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }
  }

  // Draw ball - commented out to hide balls
  // ctx.beginPath();
  // ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
  // ctx.fillStyle = ball.color;
  // ctx.fill();
}

function update() {
  if (phase === 'init') {
    spawnBalls();
  }

  // Use clearRect for transparency instead of black fill
  ctx.clearRect(0, 0, width, height);

  if (phase === 'active') {
    checkCollision();
    balls.forEach(applyPhysics);
    balls.forEach(drawBall);

    if (balls.every(b => !b.active)) {
      if (!waitingForNext) {
        waitingForNext = true;
        setTimeout(() => {
          phase = 'init';
          waitingForNext = false;
        }, nextCycleDelay);
      }
    }
  }

  requestAnimationFrame(update);
}

update();
