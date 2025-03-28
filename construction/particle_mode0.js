// -------------------------------
// Imports
// -------------------------------

import { Particle } from './particle.js';
import {
    applyMotion,
    applyWallBounce,
    giveInitialVelocity, // ✅ correct name
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
const pairSpawnRate = 10 * 1000;
const singlePairFrequency = 7 / 10;
const white = 'rgb(232, 232, 232)';
const colors = [
    'rgb(0, 186, 245)',
    'rgb(234, 0, 121)',
    'rgb(37, 37, 37)',
    'rgb(230, 161, 0)'
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
            giveInitialVelocity(this.whiteP, this.target);
            this.started = true;
        }

        if (this.started && !this.hasHit)
        {
            handleBallCollision(this.whiteP, this.target);
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
    return Math.random() * pairSpawnRate + 10;
}

function spawnParticlePair() 
{
    const whiteX = Math.random() * canvas.width;
    const whiteY = Math.random() * canvas.height;
    const w = new Particle(whiteX, whiteY, white);

    const c = [new Particle(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        GetRandomColor()
    )];

    if (Math.random() > singlePairFrequency) 
    {
        c.push(new Particle(
            Math.random() * canvas.width,
            Math.random() * canvas.height,
            GetRandomColor()
        ));
    }

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
