// ============================================================
// APP — AstroChance PWA
// ============================================================

let currentView = 'dashboard';
let todayScores = null;
let luckyHours  = [];
let notifTimer  = null;
const sentNotifs = new Set();
let lastNotifDay = null;

// ---- INIT ----
function initApp() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  document.querySelectorAll('#ob-birthdate, #pf-birthdate').forEach(el => {
    el.max = new Date().toISOString().split('T')[0];
  });
  window.addEventListener('beforeunload', () => { if (notifTimer) clearInterval(notifTimer); });
  if (!DB.isOnboarded()) {
    showOnboarding();
  } else {
    loadDashboard();
  }
  setupNav();
  setupInstallPrompt();
}

// ---- NAVIGATION ----
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      navigate(view);
    });
  });
}

function navigate(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('view-' + view);
  if (el) el.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (btn) btn.classList.add('active');

  if (view === 'dashboard') renderDashboard();
  else if (view === 'hours') renderHours();
  else if (view === 'history') renderHistory();
  else if (view === 'profile') renderProfile();
}

// ---- ONBOARDING ----
function showOnboarding() {
  document.getElementById('onboarding').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';

  document.getElementById('btn-save-profile').onclick = () => {
    const name      = document.getElementById('ob-name').value.trim();
    const birthDate = document.getElementById('ob-birthdate').value;
    const birthTime = document.getElementById('ob-birthtime').value;
    const city      = document.getElementById('ob-city').value.trim();

    if (!name || !birthDate) {
      showToast('Veuillez renseigner votre nom et date de naissance.', 'warn');
      return;
    }

    const coords = CITY_COORDS[city.toLowerCase()] || { lat: -18.91, lon: 47.53, tz: 'Indian/Antananarivo' };
    DB.saveProfile({ name, birthDate, birthTime, city, lat: coords.lat, lon: coords.lon, tz: coords.tz });
    DB.setOnboarded();
    document.getElementById('onboarding').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    loadDashboard();
  };
}

// ---- DONNÉES ----
function loadDashboard() {
  const profile = DB.getProfile();
  if (!profile) return;
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  let scores = DB.getDayScore(dateKey);
  if (!scores) {
    scores = AstroEngine.computeDayScores(profile, today);
    DB.saveDayScore(dateKey, scores);
  }
  todayScores = scores;
  luckyHours = AstroEngine.computeLuckyHours(profile, today);
  renderDashboard();
  setupNotifications();
}

// ---- DASHBOARD ----
function renderDashboard() {
  if (!todayScores) { loadDashboard(); return; }
  const profile = DB.getProfile();
  const today = new Date();
  const moon = todayScores.moonData;
  const moonS = AstroEngine.moonSign(today);
  const dayRuler = AstroEngine.PLANETS[todayScores.dayRuler];
  const advice = AstroEngine.getDayAdvice(todayScores.dayRuler, todayScores);
  const sign = AstroEngine.sunSign(new Date(profile.birthDate));
  const now = today.getHours() * 3600 + today.getMinutes() * 60;
  const nextHour = luckyHours.filter(h => h.startSec > now).sort((a,b) => a.startSec - b.startSec)[0];
  const bestDay = luckyHours[0];

  const scoreLabel = s => s >= 85 ? 'Excellent' : s >= 70 ? 'Très bon' : s >= 55 ? 'Favorable' : s >= 40 ? 'Modéré' : 'Difficile';
  const scoreColor = s => s >= 85 ? '#d4af37' : s >= 70 ? '#88cc88' : s >= 55 ? '#88aadd' : s >= 40 ? '#cc9944' : '#cc6655';

  const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const dateStr = `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

  document.getElementById('db-date').textContent = dateStr;
  document.getElementById('db-day-ruler').textContent = `${dayRuler.sym} Jour de ${dayRuler.name}`;
  document.getElementById('db-user-name').textContent = `Bonjour, ${profile.name} ${sign.sym}`;
  document.getElementById('db-score-val').textContent = todayScores.overall;
  document.getElementById('db-score-label').textContent = scoreLabel(todayScores.overall);
  document.getElementById('db-score-label').style.color = scoreColor(todayScores.overall);

  // Arc SVG
  const arc = document.getElementById('score-arc');
  const pct = todayScores.overall / 100;
  const circumference = 2 * Math.PI * 54;
  arc.style.strokeDasharray = `${circumference * pct} ${circumference}`;
  arc.style.stroke = scoreColor(todayScores.overall);

  // Cartes domaines
  document.getElementById('db-money').textContent = todayScores.money;
  document.getElementById('db-love').textContent = todayScores.love;
  document.getElementById('db-work').textContent = todayScores.work;
  document.getElementById('db-spirit').textContent = todayScores.spirit;
  ['money','love','work','spirit'].forEach(k => {
    const bar = document.getElementById(`bar-${k}`);
    if (bar) { bar.style.width = todayScores[k] + '%'; bar.style.background = scoreColor(todayScores[k]); }
  });

  // Prochaine heure
  if (nextHour) {
    document.getElementById('db-next-hour').textContent = `${nextHour.startSec > now ? nextHour.start : 'En cours'} — ${nextHour.planetSym} ${nextHour.planetName}`;
    document.getElementById('db-next-score').textContent = `Score ${nextHour.score} · ${nextHour.activity}`;
  }

  // Lune
  document.getElementById('db-moon').textContent = `${moon.emoji} ${moon.name} · ${moonS.sym} ${moonS.name} ${moonS.degrees}° · ${moon.illumination}% illuminée${moon.isVoidOfCourse ? ' · ⚠ Vide de course' : ''}`;

  // Conseil
  document.getElementById('db-advice').textContent = `"${advice}"`;
  document.getElementById('db-planet-badge').textContent = `${dayRuler.sym} ${dayRuler.name} dominant · Meilleure activité: ${dayRuler.activities[0]}`;

  // Best hour highlight
  if (bestDay) {
    document.getElementById('db-best-hour').textContent = `${bestDay.start} → ${bestDay.end}`;
    document.getElementById('db-best-planet').textContent = `${bestDay.planetSym} ${bestDay.planetName} · Score ${bestDay.score}`;
    document.getElementById('db-best-activity').textContent = bestDay.activity;
  }
}

// ---- HEURES FAVORABLES ----
function renderHours(filter) {
  const today = new Date();
  const now = today.getHours() * 3600 + today.getMinutes() * 60;
  let hours = [...luckyHours];
  if (filter === 'day') hours = hours.filter(h => h.day);
  if (filter === 'top') hours = hours.filter(h => h.score >= 70);

  const scoreColor = s => s >= 85 ? '#d4af37' : s >= 70 ? '#88cc88' : s >= 55 ? '#88aadd' : s >= 40 ? '#cc9944' : '#cc6655';

  const container = document.getElementById('hours-list');
  if (!container) return;
  container.innerHTML = hours.map(h => {
    const isWrap = h.endSec < h.startSec;
    const isCurrent = isWrap ? (now >= h.startSec || now < h.endSec) : (now >= h.startSec && now < h.endSec);
    const isPast = isWrap ? (now >= h.endSec && now < h.startSec) : now >= h.endSec;
    return `
    <div class="hour-card ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}" onclick="openRating('${h.start}','${h.planetName}',${h.score})">
      <div class="hc-left">
        <div class="hc-time">${h.start} <span class="hc-sep">–</span> ${h.end}</div>
        <div class="hc-planet" style="color:${h.planetColor}">${h.planetSym} ${h.planetName}</div>
        <div class="hc-activity">${h.activity}</div>
        ${isCurrent ? '<div class="hc-badge current-badge">● En cours</div>' : ''}
      </div>
      <div class="hc-right">
        <div class="hc-score" style="color:${scoreColor(h.score)}">${h.score}</div>
        <div class="hc-score-lbl">/ 100</div>
        <div class="hc-type">${h.day ? '☀ Jour' : '☽ Nuit'}</div>
      </div>
    </div>`;
  }).join('');
}

// ---- NOTATION ----
function openRating(hourKey, planet, score) {
  const modal = document.getElementById('rating-modal');
  modal.querySelector('.rm-title').textContent = `${planet} · ${hourKey}`;
  modal.style.display = 'flex';
  modal.dataset.hourKey = hourKey;
  let selected = 3;
  modal.querySelectorAll('.rm-star').forEach((s, i) => {
    s.onclick = () => { selected = i + 1; updateStars(modal, selected); };
  });
  updateStars(modal, selected);
  modal.querySelector('.rm-btn-save').onclick = () => {
    const note = modal.querySelector('.rm-note').value;
    DB.addRating(hourKey, selected, note);
    DB.addActivity({ title: `${planet} · ${hourKey}`, score, rating: selected, note });
    modal.style.display = 'none';
    modal.querySelector('.rm-note').value = '';
    showToast('Expérience enregistrée ✦', 'success');
  };
  modal.querySelector('.rm-btn-close').onclick = () => { modal.style.display = 'none'; };
}

function updateStars(modal, val) {
  modal.querySelectorAll('.rm-star').forEach((s, i) => {
    s.textContent = i < val ? '★' : '☆';
    s.style.color = i < val ? '#d4af37' : '#445566';
  });
}

// ---- HISTORIQUE ----
function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderHistory() {
  const history = DB.getHistory();
  const container = document.getElementById('history-list');
  if (!container) return;
  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state">✦ Aucune activité enregistrée.<br>Notez vos heures pour affiner vos prédictions.</div>';
    return;
  }
  const ratings = ['', '★ Très mauvais', '★★ Mauvais', '★★★ Moyen', '★★★★ Bon', '★★★★★ Excellent'];
  const rColors = ['', '#cc4444', '#cc7744', '#aa9944', '#66aa66', '#d4af37'];
  container.innerHTML = history.map(e => `
    <div class="history-card">
      <div class="hh-left">
        <div class="hh-title">${escapeHtml(e.title || 'Activité')}</div>
        <div class="hh-date">${new Date(e.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
        ${e.note ? `<div class="hh-note">${escapeHtml(e.note)}</div>` : ''}
      </div>
      <div class="hh-right">
        ${e.rating ? `<div class="hh-rating" style="color:${rColors[e.rating]}">${ratings[e.rating]}</div>` : ''}
        <div class="hh-score">${e.score || '—'}</div>
        <button class="hh-del" onclick="deleteEntry(${e.id})">✕</button>
      </div>
    </div>
  `).join('');
}

function deleteEntry(id) {
  DB.deleteActivity(id);
  renderHistory();
}

// ---- PROFIL ----
function renderProfile() {
  const p = DB.getProfile() || {};
  const ratings = DB.getRatings();
  const avgRating = ratings.length > 0 ? (ratings.slice(0,20).reduce((s,r) => s + r.rating, 0) / Math.min(ratings.length,20)).toFixed(1) : '—';
  const history = DB.getHistory();

  document.getElementById('pf-name').value = p.name || '';
  document.getElementById('pf-birthdate').value = p.birthDate || '';
  document.getElementById('pf-birthtime').value = p.birthTime || '';
  document.getElementById('pf-city').value = p.city || '';
  document.getElementById('pf-stats').innerHTML = `
    <div class="stat-row"><span>Activités enregistrées</span><span>${history.length}</span></div>
    <div class="stat-row"><span>Notations</span><span>${ratings.length}</span></div>
    <div class="stat-row"><span>Note moyenne</span><span>${avgRating} ★</span></div>
    <div class="stat-row"><span>Précision IA</span><span>${DB.getPersonalWeight()}%</span></div>
  `;

  const sign = p.birthDate ? AstroEngine.sunSign(new Date(p.birthDate)) : null;
  if (sign) document.getElementById('pf-sign').textContent = `${sign.sym} ${sign.name}`;
}

function saveProfile() {
  const name      = document.getElementById('pf-name').value.trim();
  const birthDate = document.getElementById('pf-birthdate').value;
  const birthTime = document.getElementById('pf-birthtime').value;
  const city      = document.getElementById('pf-city').value.trim();
  if (!name || !birthDate) { showToast('Nom et date requis', 'warn'); return; }
  const coords = CITY_COORDS[city.toLowerCase()] || { lat: -18.91, lon: 47.53, tz: 'Indian/Antananarivo' };
  DB.saveProfile({ name, birthDate, birthTime, city, lat: coords.lat, lon: coords.lon, tz: coords.tz });
  loadDashboard();
  showToast('Profil sauvegardé ✦', 'success');
}

// ---- NOTIFICATIONS ----
function setupNotifications() {
  const prefs = DB.getNotifPrefs();
  if (!prefs.enabled) return;
  if (notifTimer) clearInterval(notifTimer);
  notifTimer = setInterval(checkNotifications, 60000);
  checkNotifications();
}

function checkNotifications() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const today = now.toDateString();
  if (today !== lastNotifDay) { sentNotifs.clear(); lastNotifDay = today; }
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60;
  const prefs = DB.getNotifPrefs();
  luckyHours.forEach(h => {
    if (h.score < 70) return;
    const diff = h.startSec - nowSec;
    const key15 = `15m-${h.startSec}`;
    const keyStart = `start-${h.startSec}`;
    if (prefs.before15 && diff > 840 && diff <= 900 && !sentNotifs.has(key15)) {
      sentNotifs.add(key15);
      try { new Notification('⏰ AstroChance', { body: `Dans 15 min : heure ${h.planetName} (score ${h.score}). Activité conseillée : ${h.activity}`, icon: 'icons/icon-192.png' }); } catch(e) {}
    }
    if (prefs.onStart && diff > -60 && diff <= 0 && !sentNotifs.has(keyStart)) {
      sentNotifs.add(keyStart);
      try { new Notification(`${h.planetSym} Heure favorable!`, { body: `${h.planetName} commence — ${h.activity}. Score : ${h.score}/100`, icon: 'icons/icon-192.png' }); } catch(e) {}
    }
  });
}

async function requestNotifications() {
  if (!('Notification' in window)) { showToast('Notifications non supportées', 'warn'); return; }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    const prefs = DB.getNotifPrefs();
    DB.saveNotifPrefs({ ...prefs, enabled: true });
    setupNotifications();
    showToast('Notifications activées ✦', 'success');
    document.getElementById('notif-btn').textContent = '🔔 Notifications activées';
  } else {
    showToast('Permission refusée', 'warn');
  }
}

// ---- INSTALL PROMPT ----
let deferredPrompt = null;
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-banner').style.display = 'flex';
  });
  window.addEventListener('appinstalled', () => {
    document.getElementById('install-banner').style.display = 'none';
  });
}

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => { deferredPrompt = null; document.getElementById('install-banner').style.display = 'none'; });
}

// ---- TOAST ----
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  setTimeout(() => t.className = 'toast', 2800);
}

// ---- CITIES DB ----
const CITY_COORDS = {
  'antananarivo': { lat: -18.91, lon: 47.53, tz: 'Indian/Antananarivo' },
  'toamasina':    { lat: -18.15, lon: 49.40, tz: 'Indian/Antananarivo' },
  'mahajanga':    { lat: -15.72, lon: 46.32, tz: 'Indian/Antananarivo' },
  'fianarantsoa': { lat: -21.45, lon: 47.09, tz: 'Indian/Antananarivo' },
  'paris':        { lat: 48.85, lon: 2.35,  tz: 'Europe/Paris' },
  'lyon':         { lat: 45.75, lon: 4.85,  tz: 'Europe/Paris' },
  'marseille':    { lat: 43.30, lon: 5.37,  tz: 'Europe/Paris' },
  'london':       { lat: 51.51, lon: -0.13, tz: 'Europe/London' },
  'new york':     { lat: 40.71, lon: -74.01, tz: 'America/New_York' },
  'dubai':        { lat: 25.20, lon: 55.27, tz: 'Asia/Dubai' },
  'nairobi':      { lat: -1.29, lon: 36.82, tz: 'Africa/Nairobi' },
  'dakar':        { lat: 14.69, lon: -17.44, tz: 'Africa/Dakar' }
};

// ---- HOURS FILTER ----
function filterHours(f, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHours(f);
}

// ---- START ----
document.addEventListener('DOMContentLoaded', initApp);
