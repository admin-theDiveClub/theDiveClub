// Animate the fill overlay from 0% to 100% and repeat, picking a random color each loop
(function animateLogoFill() {
    const fill = document.getElementById('logo-fill');
    const colors = [
        'rgba(234, 0, 103, 1)',      // --color-primary
        'rgba(0, 53, 97, 1)',        // --color-secondary
        'rgba(230, 161, 0, 1)',      // --color-highlight
        'rgba(1, 110, 194, 1)',      // --color-secondary-light
        'rgba(0, 186, 245, 1)'       // --color-secondary-lighter
    ];
    let percent = 0, direction = 1;
    let currentColor = colors[Math.floor(Math.random() * colors.length)];

    function pickRandomColor() {
        let newColor;
        do {
            newColor = colors[Math.floor(Math.random() * colors.length)];
        } while (newColor === currentColor && colors.length > 1);
        currentColor = newColor;
    }

    function loop() {
        percent += direction * 2;
        if (percent >= 120) {
            percent = 120;
            direction = -1;
            fill.style.background = `linear-gradient(to top, ${currentColor} 80%, transparent 100%)`;
        } else if (percent <= -20) {
            percent = -20;
            direction = 1;
            pickRandomColor();
            fill.style.background = `linear-gradient(to top, ${currentColor} 80%, transparent 100%)`;
        }
        fill.style.height = percent + '%';
        requestAnimationFrame(loop);
    }
    fill.style.background = `linear-gradient(to top, ${currentColor} 80%, transparent 100%)`;
    loop();
})();