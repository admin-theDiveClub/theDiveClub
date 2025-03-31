import { Particle } from './particle_with_trail.js';
import {
    applyMotion,
    applyWallBounce,
    giveInitialVelocity,
    handleBallCollision
} from './particle_physics.js';

const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

var pairs = [];
const pairSpawnRate = 5000;
const white = 'rgb(232, 232, 232)';
const colors = [
    'rgb(37, 37, 37)',
    'rgba(234, 0, 121, 1)',
    'rgba(0, 53, 97, 1)',
    'rgba(230, 161, 0, 1)',
    'rgba(1, 110, 194, 1)',
    'rgba(0, 186, 245, 1)'
];

class ParticlePairs 
{
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
        for (let p of this.particles) p.update();

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

        for (let p of this.particles) {
            applyMotion(p);
            applyWallBounce(p, canvas);
        }
    }

    draw(ctx) {
        this.whiteP.drawTrail(ctx);
        for (let p of this.particles) {
            p.drawTrail(ctx);
        }
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height); // required for fresh trails

    for (let pair of pairs) {
        pair.update();
        pair.draw(ctx);
    }
}

function spawnParticlePair() {
    const w = new Particle(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        white,
        Math.max(canvas.width, canvas.height) / 800
    );

    const c = [new Particle(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        colors[Math.floor(Math.random() * colors.length)],
        Math.max(canvas.width, canvas.height) / 800
    )];

    pairs.push(new ParticlePairs(w, c));
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
