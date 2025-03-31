// particle_modes.js

import { BasicParticle, GlowTrailParticle, TrailParticle } from './particle_classes.js';
import { applyMotion, applyWallBounce, giveInitialVelocity, handleBallCollision } from './particle_physics.js';

/* 
  Match Mode: Basic particle mode for match/player background 
  (particles are drawn without any trail effect)
*/
var _white = 'rgba(232, 232, 232, 0.5)';

export function matchMode() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');

  let pairs = [];
  const pairSpawnRate = 20 * 1000;
  const white = _white;
  const colors = [
    'rgba(37, 37, 37, 0.5)',
    'rgba(234, 0, 121, 0.75)',
    'rgba(0, 53, 97, 0.75)',
    'rgba(230, 161, 0, 0.75)',
    'rgba(1, 110, 194, 1)',
    'rgba(0, 186, 245, 1)'
  ];

  class ParticlePairs {
    constructor(whiteP, particles) {
      this.whiteP = whiteP;
      this.particles = particles;
      const index = Math.floor(Math.random() * this.particles.length);
      this.target = this.particles[index];
      this.started = false;
      this.hasHit = false;
    }

    update() {
      this.whiteP.update();
      this.particles.forEach(p => p.update());
      if (!this.started && this.whiteP.opacity >= 1) {
        giveInitialVelocity(this.whiteP, this.target, canvas);
        this.started = true;
      }
      if (this.started && !this.hasHit) {
        handleBallCollision(this.whiteP, this.target, canvas);
        if (this.whiteP.hasCollided) {
          this.hasHit = true;
        }
      }
      if (this.started) {
        applyMotion(this.whiteP);
        applyWallBounce(this.whiteP, canvas);
      }
      this.particles.forEach(p => {
        applyMotion(p);
        applyWallBounce(p, canvas);
      });
    }

    draw(ctx) {
      this.whiteP.draw(ctx);
      this.particles.forEach(p => p.draw(ctx));
    }
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function animate() {
    requestAnimationFrame(animate);
    // Fully clear the canvas each frame for a clean basic effect
    pairs.forEach(pair => {
      pair.update();
      pair.draw(ctx);
    });
  }

  function getRandomDelay() {
    return Math.random() * pairSpawnRate + 10 * 1000;
  }

  function spawnParticlePair() {
    const whiteX = Math.random() * canvas.width;
    const whiteY = Math.random() * canvas.height;
    const longestSide = Math.max(canvas.width, canvas.height);
    const whiteParticle = new BasicParticle(whiteX, whiteY, white, longestSide / 800);
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const coloredParticle = new BasicParticle(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      randomColor,
      longestSide / 800
    );
    const newPair = new ParticlePairs(whiteParticle, [coloredParticle]);
    pairs.push(newPair);
  }

  function startSpawningParticles() {
    const randomDelay = getRandomDelay();
    setTimeout(() => {
      spawnParticlePair();
      startSpawningParticles();
    }, randomDelay);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  startSpawningParticles();
  animate();
}

/* 
  Persistent Trail Mode: Uses trail particles that leave a persistent trail.
  Instead of completely clearing the canvas, we overlay a semi-transparent rectangle 
  to gradually fade out older drawings.
*/
export function persistentTrailMode() {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');
  
    let pairs = [];
    const pairSpawnRate = 5000;
    const white = _white;
    const colors = [
      'rgba(37, 37, 37, 0.5)',
      'rgba(234, 0, 121, 0.75)',
      'rgba(0, 53, 97, 0.75)',
      'rgba(230, 161, 0, 0.75)',
      'rgba(1, 110, 194, 1)',
      'rgba(0, 186, 245, 1)'
    ];
  
    class ParticlePairs {
      constructor(whiteP, particles) {
        this.whiteP = whiteP;
        this.particles = particles;
        const index = Math.floor(Math.random() * this.particles.length);
        this.target = this.particles[index];
        this.started = false;
        this.hasHit = false;
      }
  
      update() {
        this.whiteP.update();
        this.particles.forEach(p => p.update());
        if (!this.started && this.whiteP.opacity >= 1) {
          giveInitialVelocity(this.whiteP, this.target, canvas);
          this.started = true;
        }
        if (this.started && !this.hasHit) {
          handleBallCollision(this.whiteP, this.target, canvas);
          if (this.whiteP.hasCollided) {
            this.hasHit = true;
          }
        }
        if (this.started) {
          applyMotion(this.whiteP);
          applyWallBounce(this.whiteP, canvas);
        }
        this.particles.forEach(p => {
          applyMotion(p);
          applyWallBounce(p, canvas);
        });
      }
  
      draw(ctx) {
        // Draw persistent trails using the glow drawing method.
        this.whiteP.drawTrail(ctx);
        this.particles.forEach(p => p.drawTrail(ctx));
      }
    }
  
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  
    function animate() {
      requestAnimationFrame(animate);
      // No overlay – trails remain persistent.
      pairs.forEach(pair => {
        pair.update();
        pair.draw(ctx);
      });
    }
  
    function spawnParticlePair() {
      const longestSide = Math.max(canvas.width, canvas.height);
      const whiteParticle = new GlowTrailParticle(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        white,
        longestSide / 800
      );
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const coloredParticle = new GlowTrailParticle(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        randomColor,
        longestSide / 800
      );
      pairs.push(new ParticlePairs(whiteParticle, [coloredParticle]));
    }
  
    function startSpawningParticles() {
      const delay = Math.random() * pairSpawnRate + 10000;
      setTimeout(() => {
        spawnParticlePair();
        startSpawningParticles();
      }, delay);
    }
  
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    startSpawningParticles();
    animate();
  }
  
  

/* 
  Glow Trail Mode: Uses glow trail particles for a glowing effect.
  The canvas is fully cleared each frame so that only the current glow trail is visible.
*/
export function glowTrailMode() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');

  let pairs = [];
  const pairSpawnRate = 2000;
  const white = _white;
  const colors = [
    'rgba(37, 37, 37, 0.5)',
    'rgba(234, 0, 121, 0.75)',
    'rgba(0, 53, 97, 0.75)',
    'rgba(230, 161, 0, 0.75)',
    'rgba(1, 110, 194, 1)',
    'rgba(0, 186, 245, 1)'
  ];

  class ParticlePairs {
    constructor(whiteP, particles) {
      this.whiteP = whiteP;
      this.particles = particles;
      const index = Math.floor(Math.random() * this.particles.length);
      this.target = this.particles[index];
      this.started = false;
      this.hasHit = false;
    }

    update() {
      this.whiteP.update();
      this.particles.forEach(p => p.update());
      if (!this.started && this.whiteP.opacity >= 1) {
        giveInitialVelocity(this.whiteP, this.target, canvas);
        this.started = true;
      }
      if (this.started && !this.hasHit) {
        handleBallCollision(this.whiteP, this.target, canvas);
        if (this.whiteP.hasCollided) {
          this.hasHit = true;
        }
      }
      if (this.started) {
        applyMotion(this.whiteP);
        applyWallBounce(this.whiteP, canvas);
      }
      this.particles.forEach(p => {
        applyMotion(p);
        applyWallBounce(p, canvas);
      });
    }

    draw(ctx) {
      this.whiteP.drawTrail(ctx);
      this.particles.forEach(p => p.drawTrail(ctx));
    }
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function animate() {
    requestAnimationFrame(animate);
    // Clear the canvas completely each frame for a clean glow effect.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pairs.forEach(pair => {
      pair.update();
      pair.draw(ctx);
    });
  }

  function spawnParticlePair() {
    const longestSide = Math.max(canvas.width, canvas.height);
    const whiteParticle = new GlowTrailParticle(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      white,
      longestSide / 800
    );
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const coloredParticle = new GlowTrailParticle(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      randomColor,
      longestSide / 800
    );
    pairs.push(new ParticlePairs(whiteParticle, [coloredParticle]));
  }

  function startSpawningParticles() {
    const delay = Math.random() * pairSpawnRate + 2000;
    setTimeout(() => {
      spawnParticlePair();
      startSpawningParticles();
    }, delay);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  startSpawningParticles();
  animate();
}
