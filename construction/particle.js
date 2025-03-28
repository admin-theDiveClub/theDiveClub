export class Particle 
{
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.opacity = 0;
        this.radius = 5;
    
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        this.spinForce = 0;
    
        this.hasCollided = false;
    }
    

    update() 
    {
        if (this.opacity < 1) this.opacity += 0.001;
    }

    draw(ctx) 
    {
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}
