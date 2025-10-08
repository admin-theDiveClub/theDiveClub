var userProfile = null;

let navMenuOpen = false;

const navbarObserver = new MutationObserver(() => 
{
    var allElementsLoaded = true;   

    const e_icon = document.getElementById('icon-profile-menu');
    const e_profileCard = document.getElementById('profile-card');
    const e_navbar = document.querySelector('.nav-bar-container');
    const e_navMenu = document.querySelector('#nav-menu-container');

    if (!e_icon){allElementsLoaded = false;}
    else if (!e_profileCard){allElementsLoaded = false;}
    else if (!e_navbar){allElementsLoaded = false;}
    else if (!e_navMenu){allElementsLoaded = false;}

    if (allElementsLoaded) 
    {
        navbarObserver.disconnect();

        ControlNavBar();
        ControlNavMenu();
        Initialize_NavBar();
        
        const btn_profile = document.querySelector('#btn-profile-menu-toggle');
        btn_profile.addEventListener('click', ControlProfileMenu);        

        if (window.location.hash == '#login')
        {
            document.getElementById('login-container').dataset.open = 'false';
            ControlProfileMenu();
        }
    }
});
navbarObserver.observe(document.body, { childList: true, subtree: true });

export function Initialize_NavBar ()
{
    const s_userProfile = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
    if (!s_userProfile)
    {
        return;
    }
    userProfile = JSON.parse(s_userProfile);
    if (userProfile)
    {
        UpdateMiniProfile(userProfile);
        if (userProfile.pp)
        {            
            const e_icon = document.getElementById('icon-profile-menu');
            if (e_icon) 
            {
                e_icon.src = userProfile.pp;
            }
        }
    }
}

function UpdateMiniProfile(userProfile)
{
    const imgElement = document.getElementById('user-m-profile-pic');
    const nicknameEl = document.getElementById('profile-m-nickname');
    const fullnameEl = document.getElementById('profile-m-fullname');
    const usernameEl = document.getElementById('profile-m-username');

    const pp = userProfile.pp || '../resources/icons/icon_player.svg';
    const nickname = userProfile.nickname || userProfile.name || '';
    const fullname = [userProfile.name, userProfile.surname].filter(Boolean).join(' ');
    const username = userProfile.username || '';

    if (imgElement)
    {
        imgElement.src = pp;
    }
    if (nicknameEl) 
    {
        nicknameEl.textContent = nickname;
    }
    if (fullnameEl) 
    {
        fullnameEl.textContent = fullname || '';
    }
    if (usernameEl) 
    {
        usernameEl.textContent = username;
    }
}

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
    const deltaThreshold = 0; // ignore tiny scrolls

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
    menu.style.display = 'block'; // Ensure it's in the layout for measurements
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

async function ControlProfileMenu() 
{         
    const login = document.getElementById('login-container');
    const login_card = document.getElementById('login-card');
    const profile_card = document.getElementById('profile-card');

    if (userProfile)
    {
        if (login_card) login_card.style.display = 'none';
        if (profile_card) profile_card.style.display = 'block';
    } else 
    {
        if (login_card) login_card.style.display = 'block';
        if (profile_card) profile_card.style.display = 'none';
    }

    
    // Ensure transition and hinting are set
    login.style.transition = 'top 300ms ease';
    login.style.willChange = 'top';

    const isOpen = login.dataset.open === 'true';

    if (!isOpen) {
        // Open: make visible and slide in from above
        login.style.display = 'block';
        // Ensure it starts off-screen above
        login.style.top = '-100%';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                login.style.top = '0%';
                login.dataset.open = 'true';
            });
        });
    } else {
        // Close: slide back up and then hide
        const onTransitionEnd = (e) => {
            if (e.propertyName === 'top') {
                login.style.display = 'none';
                login.removeEventListener('transitionend', onTransitionEnd);
            }
        };
        login.addEventListener('transitionend', onTransitionEnd);
        // Trigger close
        login.style.top = '-100%';
        login.dataset.open = 'false';
        // Fallback in case transitionend doesn't fire
        setTimeout(() => {
            if (login.dataset.open !== 'true') {
                login.style.display = 'none';
                login.removeEventListener('transitionend', onTransitionEnd);
            }
        }, 400);
    }
}