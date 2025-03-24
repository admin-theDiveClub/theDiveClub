let target = Math.random() * 60 + 60; // Random value between 60 and 120
let current = target;
const lerpSpeed = 1 / 60 / 3; // 1/24 seconds

let targetX = Math.random() * 100 - 100; // Random value between -50 and 50
let currentX = targetX;
let targetY = Math.random() * 100 - 50; // Random value between -50 and 50
let currentY = targetY;

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function updateBackground() {
    document.body.style.background = `radial-gradient(circle at ${currentX}% ${currentY}%, var(--color-secondary-lighter) 0%, var(--color-base-darkest) ${current}%, var(--color-primary) 200%)`;
}

function animate() {
    current = lerp(current, target, lerpSpeed);
    currentX = lerp(currentX, targetX, lerpSpeed);
    currentY = lerp(currentY, targetY, lerpSpeed);
    updateBackground();

    if (Math.abs(current - target) < 0.1) {
        target = Math.random() * 60 + 60; // Generate new target
    }
    if (Math.abs(currentX - targetX) < 0.1) {
        targetX = Math.random() * 200 - 100; // Generate new targetX
    }
    if (Math.abs(currentY - targetY) < 0.1) {
        targetY = Math.random() * 50 - 100; // Generate new targetY
    }

    requestAnimationFrame(animate);
}

animate();