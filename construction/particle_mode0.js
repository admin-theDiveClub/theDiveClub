// ------------------------------- 
// Imports
// -------------------------------

import { Particle } from './particle.js';
import {
    applyMotion,
    applyWallBounce,
    giveInitialVelocity,
    handleBallCollision
} from './particle_physics.js';

// -------------------------------
// Elements
// -------------------------------

const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

// -------------------------------
// Variables
// -------------------------------

var pairs = [];
const pairSpawnRate = 5 * 1000;
const singlePairFrequency = 7 / 10;
const white = 'rgb(232, 232, 232)';
const colors = [
    'rgb(37, 37, 37)',
    'rgba(234, 0, 121, 1)',
    'rgba(0, 53, 97, 1)',
    'rgba(230, 161, 0, 1)',
    'rgba(1, 110, 194, 1)',
    'rgba(0, 186, 245, 1)'
];

// -------------------------------
// Classes
// -------------------------------

class ParticlePairs 
{
    constructor(_whiteP, _particles) 
    {
        this.whiteP = _whiteP;
        this.particles = _particles;

        const index = Math.floor(Math.random() * this.particles.length);
        this.target = this.particles[index];

        this.started = false;
        this.hasHit = false;
    }

    update()
    {
        this.whiteP.update();
        for (let p of this.particles) p.update();

        if (!this.started && this.whiteP.opacity >= 1)
        {
            giveInitialVelocity(this.whiteP, this.target, canvas);
            this.started = true;
        }

        if (this.started && !this.hasHit)
        {
            handleBallCollision(this.whiteP, this.target, canvas);
            if (this.whiteP.hasCollided)
            {
                this.hasHit = true;
            }
        }

        if (this.started)
        {
            applyMotion(this.whiteP);
            applyWallBounce(this.whiteP, canvas);
        }

        for (let p of this.particles)
        {
            applyMotion(p);
            applyWallBounce(p, canvas);
        }
    }

    draw(ctx) 
    {
        this.whiteP.draw(ctx);
        for (let p of this.particles) 
        {
            p.draw(ctx);
        }
    }
}

// -------------------------------
// Functions
// -------------------------------

function resizeCanvas() 
{
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function animate() 
{
    requestAnimationFrame(animate);

    for (let i = 0; i < pairs.length; i++) 
    {
        pairs[i].update();
        pairs[i].draw(ctx);
    }
}

function startSpawningParticles() 
{
    const randomDelay = getRandomDelay();
    setTimeout(() => 
    {
        spawnParticlePair();
        startSpawningParticles();
    }, randomDelay);
}

function getRandomDelay() 
{
    return Math.random() * pairSpawnRate + 10 * 1000;
}

function spawnParticlePair() 
{
    const whiteX = Math.random() * canvas.width;
    const whiteY = Math.random() * canvas.height;
    var longestSide = Math.max(canvas.width, canvas.height);
    const w = new Particle(whiteX, whiteY, white, longestSide / 800);

    const c = [new Particle(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        GetRandomColor(),
        longestSide / 800
    )];

    const newPair = new ParticlePairs(w, c);
    pairs.push(newPair);
}

function GetRandomColor() 
{
    return colors[Math.floor(Math.random() * colors.length)];
}

// -------------------------------
// Start
// -------------------------------

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

startSpawningParticles();
animate();
