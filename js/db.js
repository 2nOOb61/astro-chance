// ============================================================
// DB — Stockage local (localStorage + IndexedDB)
// ============================================================

const DB = (() => {
  const LS = localStorage;
  const KEY = {
    PROFILE:   'ac_profile',
    HISTORY:   'ac_history',
    SCORES:    'ac_scores',
    NOTIFS:    'ac_notif_prefs',
    RATINGS:   'ac_ratings',
    ONBOARDED: 'ac_onboarded'
  };

  function get(k) {
    try { return JSON.parse(LS.getItem(k)); } catch { return null; }
  }
  function set(k, v) {
    try { LS.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
  }

  // ---- PROFIL ----
  function getProfile() { return get(KEY.PROFILE); }
  function saveProfile(p) { return set(KEY.PROFILE, { ...getProfile(), ...p, updatedAt: Date.now() }); }
  function isOnboarded() { return !!LS.getItem(KEY.ONBOARDED); }
  function setOnboarded() { LS.setItem(KEY.ONBOARDED, '1'); }

  // ---- SCORES QUOTIDIENS ----
  function saveDayScore(date, scores) {
    const all = get(KEY.SCORES) || {};
    all[date] = { ...scores, savedAt: Date.now() };
    set(KEY.SCORES, all);
  }
  function getDayScore(date) {
    const all = get(KEY.SCORES) || {};
    return all[date] || null;
  }

  // ---- HISTORIQUE ACTIVITÉS ----
  function getHistory() { return get(KEY.HISTORY) || []; }
  function addActivity(entry) {
    const h = getHistory();
    h.unshift({ id: Date.now(), ...entry, date: new Date().toISOString() });
    set(KEY.HISTORY, h.slice(0, 100));
  }
  function deleteActivity(id) {
    set(KEY.HISTORY, getHistory().filter(e => e.id !== id));
  }

  // ---- NOTATIONS ----
  function getRatings() { return get(KEY.RATINGS) || []; }
  function addRating(hourKey, rating, note) {
    const r = getRatings();
    r.unshift({ id: Date.now(), hourKey, rating, note, date: new Date().toISOString() });
    set(KEY.RATINGS, r.slice(0, 200));
  }
  function getPersonalWeight() {
    const r = getRatings();
    if (r.length < 3) return 60;
    const avg = r.slice(0, 20).reduce((s, e) => s + (e.rating || 3), 0) / Math.min(r.length, 20);
    return Math.round(avg * 20);
  }

  // ---- PRÉFS NOTIFS ----
  function getNotifPrefs() { return get(KEY.NOTIFS) || { enabled: false, morning: true, before15: true, onStart: true }; }
  function saveNotifPrefs(p) { return set(KEY.NOTIFS, p); }

  return {
    getProfile, saveProfile, isOnboarded, setOnboarded,
    saveDayScore, getDayScore,
    getHistory, addActivity, deleteActivity,
    getRatings, addRating, getPersonalWeight,
    getNotifPrefs, saveNotifPrefs
  };
})();

window.DB = DB;
