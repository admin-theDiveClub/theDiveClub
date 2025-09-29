const signOutObserver = new MutationObserver(() => {
    const btn = document.getElementById('btn-signOut');
    if (btn) 
    {
        signOutObserver.disconnect();
        document.getElementById('btn-signOut').addEventListener('click', () => 
        {
            localStorage.removeItem("session");
            sessionStorage.removeItem("session");
            localStorage.removeItem("userProfile");
            sessionStorage.removeItem("userProfile");
            window.location.href = "../index.html";
        });
    }
});
signOutObserver.observe(document.body, { childList: true, subtree: true });