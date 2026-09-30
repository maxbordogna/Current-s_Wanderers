const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');

if (themeToggle) {
  if (html.getAttribute('data-theme') === 'light') {
    themeToggle.textContent = '[Dark Mode]';
  }

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
const GAP = 20;

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
      const cursorStyle = getComputedStyle(el).cursor;
      const isClickable = !!el.closest('a, button, input, label, [role="button"]') ||
        (cursorStyle !== 'auto' && cursorStyle !== 'default' && cursorStyle !== 'text' && cursorStyle !== 'none');
      cursorDot.classList.toggle('is-hover', isClickable);
    });
  });
}
