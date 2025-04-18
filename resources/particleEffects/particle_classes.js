// particle_classes.js

// Basic particle used in mode0 (no trail)
export class BasicParticle {
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
    }
  
    update() {
      if (this.opacity < 1) this.opacity += 0.005;
    }
  
    draw(ctx) {
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      ctx.strokeStyle = this.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  
  // Particle with a glow trail (used in the glowtrail mode)
  export class GlowTrailParticle {
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
      this.maxTrailLength = 400;
    }
  
    update() {
      if (this.opacity < 1) this.opacity += 0.01;
      const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      this.history.push({ x: this.x, y: this.y, speed });
      if (this.history.length > this.maxTrailLength) {
        this.history.shift();
      }
    }
  
    drawTrail(ctx) {
      if (this.history.length < 8) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);
      for (let i = 1; i < this.history.length; i++) {
        const p = this.history[i];
        const glowAlpha = Math.max(0.4, 1 - p.speed / 10);
        ctx.lineTo(p.x, p.y);
        ctx.lineCap = 'butt'; // Prevent end caps from building into star shapes
        ctx.strokeStyle = this.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = this.color;
        ctx.lineWidth = this.radius;
        ctx.globalAlpha = this.opacity * glowAlpha;
      }
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  
    // draw() is intentionally left blank since we use drawTrail for visual output.
    draw(ctx) {}
}

  