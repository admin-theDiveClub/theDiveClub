const diver = document.getElementById('diver-box');
const logo  = document.getElementById('logo-box');

function updateMask() {
    const d  = diver.getBoundingClientRect();
    const l  = logo.getBoundingClientRect();
    const dx = l.left - d.left;
    const dy = l.top  - d.top;

    diver.style.maskPosition       = `${dx}px ${dy}px`;
    diver.style.webkitMaskPosition = `${dx}px ${dy}px`;

    // Force diver-box to match logo-box width
    diver.style.width = `${l.width}px`;

    if (l.bottom < d.top) {
        diver.style.display = 'none';
    } else {
        diver.style.display = '';
    }
}

(function rafLoop(){
   updateMask();
   requestAnimationFrame(rafLoop);
})();