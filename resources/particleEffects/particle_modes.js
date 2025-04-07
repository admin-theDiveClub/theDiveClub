// particle_modes.js

import { BasicParticle, GlowTrailParticle } from './particle_classes.js';
import { applyMotion, applyWallBounce, giveInitialVelocity, handleBallCollision } from './particle_physics.js';

const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

const parent = canvas.parentElement;
canvas.width = parent.clientWidth;
canvas.height = parent.clientHeight;

// Shared variables
let pairs = [];
const _white = 'rgba(232, 232, 232, 0.5)';
const colors = [
    'rgba(37, 37, 37, 0.5)',
    'rgba(234, 0, 121, 0.75)',
    'rgba(0, 53, 97, 0.75)',
    'rgba(230, 161, 0, 0.75)',
    'rgba(1, 110, 194, 1)',
    'rgba(0, 186, 245, 1)',
];

// Generalized ParticlePairs class
class ParticlePairs {
    constructor(whiteP, particles, config) {
        this.whiteP = whiteP;
        this.particles = particles;
        this.target = particles[Math.floor(Math.random() * particles.length)];
        this.started = false;
        this.hasHit = false;
        this.config = config;
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
        if (this.config.trail) {
            this.whiteP.drawTrail(ctx);
            this.particles.forEach(p => p.drawTrail(ctx));
        } else {
            this.whiteP.draw(ctx);
            this.particles.forEach(p => p.draw(ctx));
        }
    }
}

// Shared functions
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function animate(config) {
    requestAnimationFrame(() => animate(config));

    if (config.clearCanvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else if (config.overlay) {
        ctx.fillStyle = config.overlayColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    pairs.forEach(pair => {
        pair.update();
        pair.draw(ctx);
    });
}

function spawnParticlePair(config) {
    const longestSide = Math.max(canvas.width, canvas.height);
    const whiteParticle = new config.particleType(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        _white,
        longestSide / 800
    );
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const maxRadius = longestSide / 2; // Define a maximum radius
    const angle = Math.random() * 2 * Math.PI; // Random angle
    const distance = Math.random() * maxRadius; // Random distance within the radius
    const x = whiteParticle.x + distance * Math.cos(angle); // Calculate x position
    const y = whiteParticle.y + distance * Math.sin(angle); // Calculate y position
    let adjustedX = x;
    let adjustedY = y;

    // Ensure the particle stays within canvas bounds
    if (x < 0) adjustedX = 0;
    if (x > canvas.width) adjustedX = canvas.width;
    if (y < 0) adjustedY = 0;
    if (y > canvas.height) adjustedY = canvas.height;

    const coloredParticle = new config.particleType(
        adjustedX,
        adjustedY,
        randomColor,
        longestSide / 800
    );
    pairs.push(new ParticlePairs(whiteParticle, [coloredParticle], config));
}

function startSpawningParticles(config) {
    const delay = Math.random() * config.pairSpawnRate + config.minSpawnDelay;
    setTimeout(() => {
        spawnParticlePair(config);
        startSpawningParticles(config);
    }, delay);
}

// Mode-specific configurations
const modes = {
  matchMode: {
    particleType: BasicParticle,
    trail: false,
    clearCanvas: false,
    overlay: false,
    pairSpawnRate: 20000,
    minSpawnDelay: 10000,
  },
  persistentTrailMode: {
    particleType: GlowTrailParticle,
    trail: true,
    clearCanvas: false,
    overlay: false, // Removed overlay
    pairSpawnRate: 20000,
    minSpawnDelay: 10000,
  },
  glowTrailMode: {
    particleType: GlowTrailParticle,
    trail: true,
    clearCanvas: true,
    overlay: false,
    pairSpawnRate: 2000,
    minSpawnDelay: 4000,
  },
};

// Mode initialization functions
export function matchMode() {
    initializeMode(modes.matchMode);
}

export function persistentTrailMode() {
    initializeMode(modes.persistentTrailMode);
}

export function glowTrailMode() {
    initializeMode(modes.glowTrailMode);
}

// Initialize a mode
function initializeMode(config) {
    pairs = []; // Reset pairs
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    startSpawningParticles(config);
    animate(config);
}