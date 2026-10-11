const html = document.documentElement;

// the first-visit intro only plays when Home is the entry page: landing on
// any other page first counts as having "entered" the site for this session
try {
  if (!document.body.hasAttribute('data-intro')) sessionStorage.setItem('introSeen', '1');
} catch (e) {}
const themeToggle = document.getElementById('themeToggle');

if (themeToggle) {
  themeToggle.textContent = html.getAttribute('data-theme') === 'light' ? '[Dark Mode]' : '[Light Mode]';

  themeToggle.addEventListener('click', () => {
    const isDark = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.textContent = isDark ? '[Dark Mode]' : '[Light Mode]';
  });
}

const navToggle = document.getElementById('navToggle');
const navList = document.getElementById('navList');

if (navToggle && navList) {
  navToggle.addEventListener('click', () => {
    const isOpen = navList.classList.toggle('open');
    navToggle.textContent = isOpen ? '[Close]' : '[Menu]';
  });
}

const credits = document.querySelector('.credits');
const title = document.querySelector('.title');
const GAP = 10; // credits -> title distance

function positionTitle() {
  if (!credits || !title) return;
  if (getComputedStyle(title).position === 'sticky') return;
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  if (!isLandscape) {
    title.style.top = '';
    return;
  }
  const creditsBottom = credits.getBoundingClientRect().bottom;
  title.style.top = (creditsBottom + GAP) + 'px';
}

let pending = false;
function schedulePositionTitle() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    positionTitle();
  });
}

schedulePositionTitle();
window.addEventListener('resize', schedulePositionTitle);
window.addEventListener('orientationchange', schedulePositionTitle);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(schedulePositionTitle);
}

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
