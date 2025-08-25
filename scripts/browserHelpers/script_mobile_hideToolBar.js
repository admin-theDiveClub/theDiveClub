// Mobile-only helper (keeps desktop unaffected) — now for all mobile browsers
(function () {
    let timer;

    const isMobile = () =>
        (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) &&
        window.matchMedia && matchMedia('(pointer: coarse)').matches;

    function nudgeToHideToolbar() {
        if (!isMobile()) return;

        // avoid breaking anchor jumps or when keyboard is up
        if (location.hash) return;
        const el = document.activeElement;
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;

        clearTimeout(timer);
        timer = setTimeout(() => {
            if (window.scrollY < 2) {
                requestAnimationFrame(() => window.scrollTo(0, 1));
                // retry shortly in case layout wasn't finished
                setTimeout(() => {
                    if (window.scrollY < 2) window.scrollTo(0, 1);
                }, 150);
            }
        }, 0);
    }

    // call once the DOM is ready, and on viewport changes
    window.addEventListener('load', nudgeToHideToolbar, { once: true });
    window.addEventListener('orientationchange', nudgeToHideToolbar);
    window.addEventListener('resize', nudgeToHideToolbar);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') nudgeToHideToolbar();
    });
})();