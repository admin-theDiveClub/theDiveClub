export class Particle 
{
    constructor(x, y, color, radius) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.opacity = 0;
        this.radius = radius;

        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        this.spinForce = 0;
        this.forwardSpin = 0;

        this.hasCollided = false;

        this.history = [];
        this.maxTrailLength = 20;
    }

    update() 
    {
        if (this.opacity < 1) this.opacity += 0.01;

        const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);

        this.history.push({ x: this.x, y: this.y, speed });

        if (this.history.length > this.maxTrailLength) {
            this.history.shift();
        }
    }

    drawTrail(ctx)
    {
        if (this.history.length < 2) return;

        const p1 = this.history[0];

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.radius * 1.2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);

        for (let i = 1; i < this.history.length; i++) {
            const p2 = this.history[i];

            const speed = p2.speed;
            const glowAlpha = Math.max(0.2, 1 - speed / 10); // strong glow when slow

            ctx.globalAlpha = this.opacity * glowAlpha;
            ctx.lineTo(p2.x, p2.y);
        }

        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    draw(ctx) {
        // Not drawing the ball — just the trail
    }
}
