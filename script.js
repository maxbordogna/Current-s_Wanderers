const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');

themeToggle.addEventListener('click', () => {
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  themeToggle.textContent = isDark ? '[Dark Mode]' : '[Light Mode]';
});

const navToggle = document.getElementById('navToggle');
const navList = document.getElementById('navList');

navToggle.addEventListener('click', () => {
  const isOpen = navList.classList.toggle('open');
  navToggle.textContent = isOpen ? '[Close]' : '[Menu]';
});

const credits = document.querySelector('.credits');
const title = document.querySelector('.title');
const GAP = 20;

function positionTitle() {
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
