const $ = id => document.getElementById(id);
let mins = 5, secs = 0, total = 0, remain = 0;
let running = false, iv = null, drift = 1.0, secret = false, dark = false;

function pad(n) { return String(n).padStart(2, '0'); }

// Card inner frame arc
let ARC_PERIM = 1000;

function initArc() {
  const card = $('card');
  const svg = $('arcSvg');
  // SVG fills inset:10px of card, so its size = card minus 20px each side
  const W = card.offsetWidth - 20;
  const H = card.offsetHeight - 20;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);

  // Match card border-radius (40px rest, 56px run) minus the 10px inset
  const cardR = running ? 46 : 30;
  const r = cardR;
  const sw = 2.5; // half stroke inset
  const x = sw, y = sw, w = W - sw * 2, h = H - sw * 2;

  const d = `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;

  $('arcTrack').setAttribute('d', d);
  $('arcFill').setAttribute('d', d);

  ARC_PERIM = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
  $('arcFill').style.strokeDasharray = ARC_PERIM.toFixed(1);
}


let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTick(isLast) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = isLast ? 1100 : 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(isLast ? 0.14 : 0.09, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isLast ? 0.35 : 0.22));
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) { }
}

let lastTickSec = -1;

function updateTitle() {
  const s = remain / 1000;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  document.title = running ? `${pad(m)}:${pad(ss)} — Timer` : 'Timer';
}

function updD() {
  const s = remain / 1000;
  const m = Math.floor(s / 60);
  const ss = s % 60;
  const w = Math.floor(ss);
  const f = Math.round((ss - w) * 100);
  $('tn').textContent = pad(m) + ':' + pad(w);
  $('tf').textContent = '.' + pad(f);

  const pct = total > 0 ? remain / total : 1;

  const arcFill = $('arcFill');
  arcFill.style.strokeDasharray = ARC_PERIM.toFixed(1);
  const offset = ARC_PERIM * (1 - Math.max(0, Math.min(1, pct)));
  arcFill.style.strokeDashoffset = offset.toFixed(1);

  const tn = $('tn');
  if (remain <= 0 && total > 0) tn.className = 'time-num fin';
  else if (running) tn.className = 'time-num acc';
  else tn.className = 'time-num';

  // countdown ticks on last 5 seconds
  if (running && remain > 0 && remain <= 5000) {
    const secLeft = Math.ceil(remain / 1000);
    if (secLeft !== lastTickSec) {
      lastTickSec = secLeft;
      playTick(secLeft === 1);
    }
  } else {
    lastTickSec = -1;
  }
  updateTitle();
}

function sync() {
  total = (mins * 60 + secs) * 1000;
  remain = total;
  $('laps').innerHTML = '';
  updD(); updDrift();
}

function chM(d) {
  if (running) return;
  mins = Math.max(0, Math.min(99, mins + d));
  $('mV').textContent = pad(mins);
  clearActive();
  sync();
}

function chS(d) {
  if (running) return;
  secs = Math.max(0, Math.min(55, secs + d));
  $('sV').textContent = pad(secs);
  clearActive();
  sync();
}

function clearActive() {
  document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
}

function setPreset(m, e) {
  if (running) return;
  mins = m; secs = 0;
  $('mV').textContent = pad(mins);
  $('sV').textContent = '00';
  clearActive();
  if (e && e.target) e.target.classList.add('active');
  sync();
}

let arcShowTimer = null;

function showArc() {
  clearTimeout(arcShowTimer);
  arcShowTimer = setTimeout(() => {
    initArc();
    $('arcSvg').classList.add('visible');
  }, 450);
}

function hideArc() {
  clearTimeout(arcShowTimer);
  $('arcSvg').classList.remove('visible');
}

function setMainBtn(icon, label, cls) {
  $('mb-lbl').textContent = label;
  const ic = $('mb-icon');
  if (icon === 'play') {
    ic.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    ic.setAttribute('fill', 'currentColor');
    ic.setAttribute('stroke', 'none');
  } else if (icon === 'pause') {
    ic.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
    ic.setAttribute('fill', 'currentColor');
    ic.setAttribute('stroke', 'none');
  } else if (icon === 'replay') {
    ic.innerHTML = '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>';
    ic.setAttribute('fill', 'none');
    ic.setAttribute('stroke', 'currentColor');
    ic.setAttribute('stroke-width', '2.2');
    ic.setAttribute('stroke-linecap', 'round');
  }
}

function handleMain() {
  if (total === 0) return;
  if (!running) {
    if (remain <= 0) remain = total;
    running = true;
    getAudioCtx().resume().catch(() => {});
    document.body.classList.add('run');
    showArc();
    setMainBtn('pause', 'Pause', 'bpp');
    let last = Date.now();
    iv = setInterval(() => {
      const now = Date.now();
      const delta = now - last; last = now;
      remain -= delta * drift;
      if (remain <= 0) {
        remain = 0; clearInterval(iv);
        running = false; onDone();
      }
      updD();
    }, 50);
  } else {
    clearInterval(iv); running = false;
    hideArc();
    setTimeout(() => document.body.classList.remove('run'), 100);
    const el = total - remain;
    const es = el / 1000;
    const em = Math.floor(es / 60);
    const ess = Math.floor(es % 60);
    const c = document.createElement('div');
    c.className = 'lc';
    c.textContent = pad(em) + ':' + pad(ess);
    $('laps').appendChild(c);
    setMainBtn('play', 'Continue', 'bps');
  }
}

function onDone() {
  hideArc();
  setTimeout(() => {
    document.body.classList.remove('run');
    // reset color immediately when card collapses — no flash
    $('tn').className = 'time-num';
  }, 100);
  setMainBtn('replay', 'Replay', 'bps');
  const card = $('card');
  card.classList.add('done-anim');
  card.addEventListener('animationend', () => card.classList.remove('done-anim'), { once: true });

  // completion bell
  try {
    const ctx = getAudioCtx();
    [0, 0.18, 0.36].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = [880, 1100, 1320][i];
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 1.2);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 1.3);
    });
  } catch (e) { }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  // auto-reset to initial state after 2s
  setTimeout(() => {
    drift = 1.0;
    updDrift();
    if (secret) {
      secret = false;
      $('sp').classList.remove('open');
    }
    $('laps').innerHTML = '';
    remain = total;
    setMainBtn('play', 'Start', 'bps');
    updateTitle();
    updD();
  }, 2000);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
  } else {
    document.exitFullscreen();
  }
}

function toggleHints() {
  $('modal').classList.toggle('open');
}

function handleReset() {
  clearInterval(iv); running = false;
  hideArc();
  setTimeout(() => document.body.classList.remove('run'), 100);
  remain = total; $('laps').innerHTML = '';
  $('tn').className = 'time-num';
  setMainBtn('play', 'Start', 'bps');
  document.title = 'Timer';
  updD();
}

function chD(d) {
  drift = Math.round((drift + d * 0.05) * 100) / 100;
  drift = Math.max(0.75, Math.min(1.25, drift));
  updDrift();
}

function updDrift() {
  $('dv').textContent = drift.toFixed(2) + '×';
  const b = mins * 60 + secs;
  if (b > 0) {
    const r = b / drift;
    const rm = Math.floor(r / 60);
    const rs = Math.round(r % 60);
    const diff = Math.round(b - r);
    $('dh').textContent = 'At ' + pad(mins) + ':' + pad(secs) + ' → actual ' + pad(rm) + ':' + pad(rs) +
      (diff !== 0 ? ' (' + (diff > 0 ? '+' : '') + diff + 's)' : '');
  } else {
    $('dh').textContent = 'Set time for calculation';
  }
}

function setTheme(isDark, save = false) {
  dark = isDark;
  document.documentElement.toggleAttribute('data-dark', dark);
  const fav = $('favicon');
  if (fav) fav.href = dark ? 'timer-logo-dark.svg' : 'timer-logo-light.svg';
  if (save) localStorage.setItem('theme', dark ? 'dark' : 'light');
}

function toggleTheme() {
  setTheme(!dark, true);
}

// Initial theme setup
(function () {
  const saved = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const initialDark = saved ? saved === 'dark' : systemDark.matches;

  setTheme(initialDark);

  // Listen for system theme changes
  systemDark.addEventListener('change', e => {
    // Only auto-switch if user hasn't set a preference manually
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches);
    }
  });
})();

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); handleMain(); }
  if (e.code === 'KeyR' && !running) handleReset();
  if (e.code === 'KeyT') toggleTheme();
  if (e.code === 'KeyF') toggleFullscreen();
  if (e.code === 'KeyH') toggleHints();
  if (e.code === 'KeyS' && !running) {
    secret = !secret;
    $('sp').classList.toggle('open', secret);
  }
});

sync();
requestAnimationFrame(() => requestAnimationFrame(initArc));
window.addEventListener('resize', initArc);
$('timeWrap').addEventListener('transitionend', initArc);
