let navMenuOpen = false;

function ControlNavBar() {
    const nav = document.querySelector('.nav-bar-container');
    if (!nav) return;

    // Smooth hide/show
    nav.style.transform = 'translateY(0)';
    nav.style.transition = 'transform 300ms ease';
    nav.style.willChange = 'transform';

    let lastY = window.scrollY || 0;
    let hidden = false;
    let ticking = false;
    const deltaThreshold = 4; // ignore tiny scrolls

    const show = () => {
        if (hidden) {
            nav.style.transform = 'translateY(0)';
            hidden = false;
        }
    };

    const hide = () => {
        if (!hidden) {
            nav.style.transform = 'translateY(-100%)';
            hidden = true;
        }
    };

    const onScroll = () => {
        const y = window.scrollY || 0;

        // Keep nav-bar visible while menu is open
        if (navMenuOpen) {
            if (hidden) {
                nav.style.transform = 'translateY(0)';
                hidden = false;
            }
            lastY = y;
            ticking = false;
            return;
        }

        const delta = y - lastY;

        if (Math.abs(delta) > deltaThreshold) {
            if (delta > 0 && y > nav.offsetHeight) {
                // scrolling down
                hide();
            } else {
                // scrolling up or near top
                show();
            }
            lastY = y;
        }

        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(onScroll);
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        if (hidden && !navMenuOpen) {
            nav.style.transform = 'translateY(-100%)';
        } else {
            nav.style.transform = 'translateY(0)';
            hidden = false;
        }
    });
}

const navObserver = new MutationObserver(() => {
    const nav = document.querySelector('.nav-bar-container');
    if (nav) {
        navObserver.disconnect();
        ControlNavBar();
    }
});
navObserver.observe(document.body, { childList: true, subtree: true });

function ControlNavMenu() {
    const btn = document.querySelector('#btn-nav-menu-toggle');
    const menu = document.querySelector('#nav-menu-container');
    if (!btn || !menu) return;

    // Smooth slide
    menu.style.transition = 'transform 250ms ease';
    menu.style.willChange = 'transform';

    // Start closed (off-screen to the left)
    let open = false;
    menu.style.transform = 'translateX(-105vw)';
    btn.setAttribute('aria-expanded', 'false');

    const openMenu = () => {
        menu.style.transform = 'translateX(0)';
        open = true;
        navMenuOpen = true;
        btn.setAttribute('aria-expanded', 'true');

        // Ensure nav-bar is visible immediately
        const nav = document.querySelector('.nav-bar-container');
        if (nav) nav.style.transform = 'translateY(0)';
    };

    const closeMenu = () => {
        menu.style.transform = 'translateX(-105vw)';
        open = false;
        navMenuOpen = false;
        btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', () => {
        open ? closeMenu() : openMenu();
    });

    // Keep position consistent on resize
    window.addEventListener('resize', () => {
        menu.style.transform = open ? 'translateX(0)' : 'translateX(-105vw)';
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && open) closeMenu();
    });
}

const menuObserver = new MutationObserver(() => {
    const btn = document.querySelector('#btn-nav-menu-toggle');
    const menu = document.querySelector('#nav-menu-container');
    if (btn && menu) {
        menuObserver.disconnect();
        ControlNavMenu();
    }
});
menuObserver.observe(document.body, { childList: true, subtree: true });


// Fade in menu rows each time the nav menu opens
(function () {
    function initRowFader() {
        const btn = document.querySelector('#btn-nav-menu-toggle');
        const table = document.querySelector('.menu-table');
        if (!btn || !table) return false;

        const rows = Array.from(table.querySelectorAll('tbody tr'));
        if (!rows.length) return false;

        rows.forEach(r => {
            r.style.opacity = '0';
            r.style.transition = 'opacity 220ms ease';
            r.style.willChange = 'opacity';
        });

        const reset = () => {
            rows.forEach(r => {
                r.style.transitionDelay = '0ms';
                r.style.opacity = '0';
            });
        };

        const fadeIn = () => {
            rows.forEach((r, i) => {
                r.style.transitionDelay = `${i * 60}ms`;
                r.style.opacity = '1';
            });
        };

        const handle = () => {
            const open = btn.getAttribute('aria-expanded') === 'true';
            if (open) {
                reset();
                requestAnimationFrame(fadeIn);
            } else {
                reset();
            }
        };

        // Observe aria-expanded to trigger animation on open/close
        const btnObserver = new MutationObserver(muts => {
            for (const m of muts) {
                if (m.type === 'attributes' && m.attributeName === 'aria-expanded') {
                    handle();
                    break;
                }
            }
        });
        btnObserver.observe(btn, { attributes: true, attributeFilter: ['aria-expanded'] });

        // Run once in case it's already open
        handle();
        return true;
    }

    // Wait for elements to exist
    if (!initRowFader()) {
        const waitObserver = new MutationObserver(() => {
            if (initRowFader()) waitObserver.disconnect();
        });
        waitObserver.observe(document.body, { childList: true, subtree: true });
    }
})();

(function () {
    function initRankedEventsToggle() {
        const toggle = document.getElementById('ranked-events-toggle');
        const submenuRow = document.getElementById('ranked-events-submenu');
        if (!toggle || !submenuRow) return false;

        const chevron = toggle.querySelector('.chevron');

        const setState = (expanded) => {
            toggle.setAttribute('aria-expanded', String(expanded));
            submenuRow.style.display = expanded ? 'table-row' : 'none';
            if (chevron) chevron.textContent = expanded ? '▾' : '▸';
        };

        setState(toggle.getAttribute('aria-expanded') === 'true');

        const onActivate = (e) => {
            if (e.type === 'click') e.preventDefault();
            if (e.type === 'keydown') {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
            }
            const next = toggle.getAttribute('aria-expanded') !== 'true';
            setState(next);
        };

        toggle.addEventListener('click', onActivate);
        toggle.addEventListener('keydown', onActivate);

        return true;
    }

    if (!initRankedEventsToggle()) {
        const observer = new MutationObserver(() => {
            if (initRankedEventsToggle()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();