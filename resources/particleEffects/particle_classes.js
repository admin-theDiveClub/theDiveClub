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
      this.maxTrailLength = 20;
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
      if (this.history.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);
      for (let i = 1; i < this.history.length; i++) {
        const p = this.history[i];
        const glowAlpha = Math.max(0.2, 1 - p.speed / 10);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.lineWidth = this.radius * 1.5;
        ctx.globalAlpha = this.opacity * glowAlpha;
      }
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  
    // draw() is intentionally left blank since we use drawTrail for visual output.
    draw(ctx) {}
  }
  
  // Particle with a trail (used in mode1)
  export class TrailParticle {
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
  
    update() {
      if (this.opacity < 1) this.opacity += 0.01;
      const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      this.history.push({ x: this.x, y: this.y, speed });
      if (this.history.length > this.maxTrailLength) {
        this.history.shift();
      }
    }
  
    drawTrail(ctx) {
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
        const glowAlpha = Math.max(0.2, 1 - p2.speed / 10);
        ctx.globalAlpha = this.opacity * glowAlpha;
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  
    // draw() is intentionally left blank since we use drawTrail for visual output.
    draw(ctx) {}
  }
  