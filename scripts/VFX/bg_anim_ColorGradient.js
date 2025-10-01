function animateBackground() {
    const body = document.body;
    const interpolationFactor = 0.005; // Interpolation factor for smooth animation

    let circleAtX = 0; // Initial value for circle-at x
    let firstStop = -50; // Initial value for first stop
    let secondStop = 40; // Initial value for second stop

    let targetCircleAtX = 50; // Target value for circle-at x
    let targetFirstStop = 0; // Target value for first stop
    let targetSecondStop = 50; // Target value for second stop
    const lastStop = 250; // Fixed value for last stop

    function getRandomTarget(min, max) {
        return Math.random() * (max - min) + min;
    }

    function updateGradient() {
        // Smoothly interpolate values towards their targets
        circleAtX = parseFloat((circleAtX + (targetCircleAtX - circleAtX) * interpolationFactor).toFixed(3));
        firstStop = parseFloat((firstStop + (targetFirstStop - firstStop) * interpolationFactor).toFixed(3));
        secondStop = parseFloat((secondStop + (targetSecondStop - secondStop) * interpolationFactor).toFixed(3));

        // If close to the target, pick new random targets
        if (Math.abs(circleAtX - targetCircleAtX) < 0.5) {
            targetCircleAtX = getRandomTarget(-50, 150);
        }
        if (Math.abs(firstStop - targetFirstStop) < 0.5) {
            targetFirstStop = getRandomTarget(-100, 0);
        }
        if (Math.abs(secondStop - targetSecondStop) < 0.5) {
            targetSecondStop = getRandomTarget(20, 80);
        }

        // Apply the updated gradient
        body.style.background = `radial-gradient(circle at ${circleAtX}% ${firstStop}%, var(--color-base-02) 0%, var(--color-base-03) ${secondStop}%, var(--color-primary-02) ${lastStop}%)`;

        requestAnimationFrame(updateGradient); // Smooth animation
    }

    updateGradient(); // Start the animation loop
}

// Call the function to start the animation
//animateBackground();
