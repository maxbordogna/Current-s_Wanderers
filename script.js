// the first-visit intro only plays when Home is the entry page: landing on
// any other page first counts as having "entered" the site for this session
try {
  if (!document.body.hasAttribute('data-intro')) sessionStorage.setItem('introSeen', '1');
} catch (e) {}

const navToggle = document.getElementById('navToggle');
const navList = document.getElementById('navList');

if (navToggle && navList) {
  navToggle.addEventListener('click', () => {
    const isOpen = navList.classList.toggle('open');
    navToggle.textContent = isOpen ? '[Close]' : '[Menu]';
  });
}

// credits drawer (horizontal layout): opens above the menu bar and pushes the
// page down by its own height (--drawer-h, measured here).
(function () {
  const toggle = document.getElementById('creditsToggle');
  const drawer = document.getElementById('credits');
  const inner = document.querySelector('.credits-inner');
  const backdrop = document.getElementById('creditsBackdrop');
  if (!toggle || !inner || !backdrop) return;

  const root = document.documentElement;
  const landscape = window.matchMedia('(orientation: landscape)');

  function measure() {
    root.style.setProperty('--drawer-h', inner.offsetHeight + 'px');
  }

  function setOpen(open) {
    if (open) measure();
    root.classList.toggle('credits-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  toggle.addEventListener('click', () => setOpen(!root.classList.contains('credits-open')));
  backdrop.addEventListener('click', () => setOpen(false));
  // a click anywhere inside the open drawer closes it
  if (drawer) drawer.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('credits-open')) setOpen(false);
  });
  // turning the device to portrait shows the credits as plain text again
  landscape.addEventListener('change', () => {
    if (!landscape.matches) setOpen(false);
    measure();
  });

  measure();
  window.addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();

// custom dot cursor, mouse/trackpad only
if (window.matchMedia('(pointer: fine)').matches) {
  const cursorDot = document.createElement('div');
  cursorDot.className = 'cursor-dot';
  document.body.appendChild(cursorDot);

  // Only the fullscreen element (and its contents) is drawn while something is
  // fullscreen, so the dot has to live inside it for the duration.
  const moveDotForFullscreen = () => {
    const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (cursorDot.parentNode !== host) host.appendChild(cursorDot);
  };
  document.addEventListener('fullscreenchange', moveDotForFullscreen);
  document.addEventListener('webkitfullscreenchange', moveDotForFullscreen);

  let hoverCheckPending = false;

  document.addEventListener('mousemove', (e) => {
    cursorDot.style.left = e.clientX + 'px';
    cursorDot.style.top = e.clientY + 'px';

    if (hoverCheckPending) return;
    hoverCheckPending = true;
    requestAnimationFrame(() => {
      hoverCheckPending = false;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      // (the native cursor is hidden on every element, so the computed cursor
      // can't tell us what's clickable: look at the element itself)
      const isClickable = !!el.closest('a, button, input, label, [role="button"]');
      cursorDot.classList.toggle('is-hover', isClickable);
    });
  });
}
