async function inject(selector, url) 
{
    const host = document.querySelector(selector);
    if (!host) return;
    const res = await fetch(url, { cache: "no-store" });
    host.innerHTML = await res.text();
}

addEventListener("DOMContentLoaded", () => 
{
    const components = 
    [
        "nav-bar",
        "nav-menu",
        "siteMap",
        "footer",
        "profile-menu",
        "login"
    ]

    for (const component of components) 
    {
        inject(`#component-${component}`, `../components/${component}.html`);
    }
});
