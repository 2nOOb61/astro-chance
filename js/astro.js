// ============================================================
// ASTRO ENGINE — Calculs astrologiques complets
// Heures planétaires, Lune, Transits, Score de chance
// ============================================================

const PLANETS = {
  SUN:     { name: 'Soleil',  sym: '☀', color: '#f0a030', activities: ['Décisions', 'Leadership', 'Signature', 'Présentation'] },
  MOON:    { name: 'Lune',    sym: '☽', color: '#b0c8e8', activities: ['Intuition', 'Famille', 'Méditation', 'Mémoire'] },
  MARS:    { name: 'Mars',    sym: '♂', color: '#e05040', activities: ['Action', 'Sport', 'Chirurgie', 'Compétition'] },
  MERCURY: { name: 'Mercure', sym: '☿', color: '#88aadd', activities: ['Communication', 'Contrats', 'Écriture', 'Voyages'] },
  JUPITER: { name: 'Jupiter', sym: '♃', color: '#d4af37', activities: ['Négociation', 'Expansion', 'Finance', 'Chance'] },
  VENUS:   { name: 'Vénus',   sym: '♀', color: '#cc6688', activities: ['Amour', 'Arts', 'Beauté', 'Relations'] },
  SATURN:  { name: 'Saturne', sym: '♄', color: '#667799', activities: ['Planification', 'Discipline', 'Structure', 'Immobilier'] }
};

// Ordre chaldéen des planètes
const CHALDEAN = ['SATURN', 'JUPITER', 'MARS', 'SUN', 'VENUS', 'MERCURY', 'MOON'];

// Planète dominante par jour (0=dim, 1=lun, 2=mar, 3=mer, 4=jeu, 5=ven, 6=sam)
const DAY_RULERS = ['SUN', 'MOON', 'MARS', 'MERCURY', 'JUPITER', 'VENUS', 'SATURN'];

// Heure planétaire index de départ par jour
const DAY_START_HOUR = [0, 3, 6, 2, 5, 1, 4]; // index dans CHALDEAN

// ---- SOLEIL ----
function sunriseSunset(date, lat, lon) {
  const rad = Math.PI / 180;
  const n = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const L = 280.460 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const eps = 23.439 * rad;
  const sinDec = Math.sin(eps) * Math.sin(lambda);
  const dec = Math.asin(sinDec);
  const cosH = (Math.sin(-0.0145) - Math.sin(lat * rad) * sinDec) / (Math.cos(lat * rad) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return { rise: 6 * 3600, set: 18 * 3600 };
  const H = Math.acos(cosH) / rad;
  const eqTime = (-7.655 * Math.sin(g) + 9.873 * Math.sin(2 * lambda + 3.588) + 0.439 * Math.sin(4 * lambda)) / 60;
  const rise = 12 - H / 15 - lon / 15 + eqTime;
  const set  = 12 + H / 15 - lon / 15 + eqTime;
  return { rise: rise * 3600, set: set * 3600 };
}

// ---- HEURES PLANÉTAIRES ----
function computePlanetaryHours(date, lat, lon) {
  const { rise, set } = sunriseSunset(date, lat, lon);
  const dayLen  = set - rise;
  const nightLen = 86400 - dayLen;
  const dayHour  = dayLen / 12;
  const nightHour = nightLen / 12;
  const dow = date.getDay();
  const startIdx = DAY_START_HOUR[dow];
  const hours = [];

  for (let i = 0; i < 12; i++) {
    const pIdx = (startIdx + i) % 7;
    const start = rise + i * dayHour;
    hours.push({ start, end: start + dayHour, planet: CHALDEAN[pIdx], day: true, index: i });
  }
  for (let i = 0; i < 12; i++) {
    const pIdx = (startIdx + 12 + i) % 7;
    const start = set + i * nightHour;
    hours.push({ start: start % 86400, end: (start + nightHour) % 86400, planet: CHALDEAN[pIdx], day: false, index: i });
  }
  return hours;
}

function secondsToHHMM(s) {
  s = ((s % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// ---- PHASE LUNAIRE ----
function moonPhase(date) {
  const known = new Date(2000, 0, 6, 18, 14, 0);
  const CYCLE = 29.530588853;
  const diff = (date - known) / 86400000;
  let phase = ((diff % CYCLE) + CYCLE) % CYCLE;
  const pct = phase / CYCLE;
  const names = [
    'Nouvelle Lune','Croissant Naissant','Premier Quartier','Gibbeuse Croissante',
    'Pleine Lune','Gibbeuse Décroissante','Dernier Quartier','Croissant Décroissant'
  ];
  const emojis = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
  const idx = Math.floor(pct * 8) % 8;
  return {
    phase, pct,
    name: names[idx],
    emoji: emojis[idx],
    illumination: Math.round(50 * (1 - Math.cos(pct * 2 * Math.PI))),
    dayInCycle: Math.round(phase),
    isVoidOfCourse: (phase > 12 && phase < 12.5) || (phase > 26 && phase < 27)
  };
}

// ---- SIGNE SOLAIRE ----
function sunSign(date) {
  const signs = [
    { name:'Capricorne', sym:'♑', start:[12,22] }, { name:'Verseau', sym:'♒', start:[1,20] },
    { name:'Poissons',   sym:'♓', start:[2,19] },  { name:'Bélier',  sym:'♈', start:[3,21] },
    { name:'Taureau',    sym:'♉', start:[4,20] },  { name:'Gémeaux', sym:'♊', start:[5,21] },
    { name:'Cancer',     sym:'♋', start:[6,21] },  { name:'Lion',    sym:'♌', start:[7,23] },
    { name:'Vierge',     sym:'♍', start:[8,23] },  { name:'Balance', sym:'♎', start:[9,23] },
    { name:'Scorpion',   sym:'♏', start:[10,23] }, { name:'Sagittaire',sym:'♐',start:[11,22] }
  ];
  const m = date.getMonth() + 1, d = date.getDate();
  for (let i = signs.length - 1; i >= 0; i--) {
    const [sm, sd] = signs[i].start;
    if (m > sm || (m === sm && d >= sd)) return signs[i];
  }
  return signs[0];
}

// ---- THÈME NATAL (approximatif) ----
function natalPlanets(birthDate) {
  const d = new Date(birthDate);
  const jd = (d - new Date(2000, 0, 1, 12)) / 86400000;
  return {
    sun:     { lon: ((280.46 + 0.9856 * jd) % 360 + 360) % 360 },
    moon:    { lon: ((218.32 + 13.176 * jd) % 360 + 360) % 360 },
    mercury: { lon: ((252.25 + 4.092 * jd) % 360 + 360) % 360 },
    venus:   { lon: ((181.98 + 1.602 * jd) % 360 + 360) % 360 },
    mars:    { lon: ((355.45 + 0.524 * jd) % 360 + 360) % 360 },
    jupiter: { lon: ((34.33  + 0.083 * jd) % 360 + 360) % 360 },
    saturn:  { lon: ((50.08  + 0.034 * jd) % 360 + 360) % 360 }
  };
}

// ---- TRANSITS DU JOUR ----
function dailyPlanetPositions(date) {
  const jd = (date - new Date(2000, 0, 1, 12)) / 86400000;
  return {
    sun:     ((280.46 + 0.9856 * jd) % 360 + 360) % 360,
    moon:    ((218.32 + 13.176 * jd) % 360 + 360) % 360,
    mercury: ((252.25 + 4.092 * jd) % 360 + 360) % 360,
    venus:   ((181.98 + 1.602 * jd) % 360 + 360) % 360,
    mars:    ((355.45 + 0.524 * jd) % 360 + 360) % 360,
    jupiter: ((34.33  + 0.083 * jd) % 360 + 360) % 360,
    saturn:  ((50.08  + 0.034 * jd) % 360 + 360) % 360
  };
}

function aspectScore(a, b) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  const aspects = [
    { angle: 0,   orb: 8, score: 20, name: 'Conjonction' },
    { angle: 60,  orb: 6, score: 15, name: 'Sextile' },
    { angle: 90,  orb: 8, score: -10,name: 'Carré' },
    { angle: 120, orb: 8, score: 18, name: 'Trigone' },
    { angle: 180, orb: 8, score: -8, name: 'Opposition' }
  ];
  for (const asp of aspects) {
    if (Math.abs(diff - asp.angle) <= asp.orb) return { score: asp.score, name: asp.name };
  }
  return { score: 0, name: null };
}

function transitScore(natal, transits) {
  const keys = Object.keys(natal);
  let total = 0, count = 0;
  const aspects = [];
  for (const tk of keys) {
    for (const nk of keys) {
      const asp = aspectScore(transits[tk], natal[nk]);
      if (asp.name) {
        total += asp.score;
        count++;
        aspects.push({ transit: tk, natal: nk, ...asp });
      }
    }
  }
  const raw = count > 0 ? total / count : 0;
  return { score: Math.min(100, Math.max(0, 50 + raw * 2)), aspects: aspects.slice(0, 4) };
}

// ---- SCORE PLANÉTAIRE D'UNE HEURE ----
function planetHourScore(planet, dayRuler, moonData) {
  const LUCKY = { JUPITER: 25, SUN: 20, VENUS: 15, MERCURY: 10, MOON: 8, SATURN: -5, MARS: 0 };
  let score = 50 + (LUCKY[planet] || 0);
  if (planet === dayRuler) score += 10;
  if (planet === 'MOON') score += (moonData.illumination / 100) * 10;
  if (moonData.isVoidOfCourse) score -= 15;
  return Math.min(100, Math.max(0, Math.round(score)));
}

// ---- SCORE GLOBAL DU JOUR ----
function computeDayScores(userProfile, date) {
  const natal = natalPlanets(userProfile.birthDate);
  const transits = dailyPlanetPositions(date);
  const moon = moonPhase(date);
  const dow = date.getDay();
  const dayRuler = DAY_RULERS[dow];
  const { score: tScore, aspects } = transitScore(natal, transits);
  const moonScore = moon.illumination + (moon.isVoidOfCourse ? -20 : 0);
  const dayScore  = CHALDEAN.indexOf(dayRuler) < 3 ? 70 : 50;

  // Récupérer historique personnel
  const history = DB.getHistory();
  const histScore = history.length > 0
    ? history.slice(-10).reduce((s, e) => s + (e.score || 50), 0) / Math.min(history.length, 10)
    : 60;

  const overall = Math.round(
    tScore    * 0.30 +
    moonScore * 0.20 +
    dayScore  * 0.10 +
    histScore * 0.10 +
    (50 + (PLANETS[dayRuler] ? 10 : 0)) * 0.30
  );

  return {
    overall: Math.min(99, Math.max(1, overall)),
    money:   Math.min(99, Math.max(1, Math.round(overall + (dayRuler === 'JUPITER' ? 12 : dayRuler === 'SUN' ? 8 : 0)))),
    love:    Math.min(99, Math.max(1, Math.round(overall + (dayRuler === 'VENUS' ? 15 : dayRuler === 'MOON' ? 10 : -5)))),
    work:    Math.min(99, Math.max(1, Math.round(overall + (dayRuler === 'MERCURY' ? 12 : dayRuler === 'MARS' ? 8 : 0)))),
    spirit:  Math.min(99, Math.max(1, Math.round(overall + (dayRuler === 'SATURN' ? 10 : dayRuler === 'MOON' ? 12 : -3)))),
    dayRuler, moonData: moon, aspects, tScore: Math.round(tScore)
  };
}

// ---- HEURES FAVORABLES ENRICHIES ----
function computeLuckyHours(userProfile, date) {
  const lat = userProfile.lat || -18.91;
  const lon = userProfile.lon || 47.53;
  const hours = computePlanetaryHours(date, lat, lon);
  const moon = moonPhase(date);
  const dow = date.getDay();
  const dayRuler = DAY_RULERS[dow];
  const natal = natalPlanets(userProfile.birthDate);
  const transits = dailyPlanetPositions(date);
  const { score: tBase } = transitScore(natal, transits);

  return hours.map(h => {
    const pScore = planetHourScore(h.planet, dayRuler, moon);
    const combined = Math.round(pScore * 0.4 + tBase * 0.35 + (moon.illumination) * 0.15 + (h.day ? 10 : 0));
    const score = Math.min(99, Math.max(1, combined));
    const planet = PLANETS[h.planet];
    const activity = planet.activities[Math.floor(Math.random() * planet.activities.length)];
    return {
      start: secondsToHHMM(h.start),
      end:   secondsToHHMM(h.end),
      startSec: h.start,
      endSec: h.end,
      planet: h.planet,
      planetName: planet.name,
      planetSym:  planet.sym,
      planetColor: planet.color,
      score,
      activity,
      day: h.day
    };
  }).sort((a, b) => b.score - a.score);
}

// ---- CONSEIL DU JOUR ----
const CONSEILS = {
  SUN:     ['La clarté solaire illumine vos décisions. Osez prendre position.', 'Votre rayonnement naturel attire les opportunités. Soyez visible.'],
  MOON:    ['Écoutez votre intuition — elle vous guide mieux que la logique.', 'Les émotions sont des messages. Accueillez-les sans jugement.'],
  MARS:    ['L\'énergie de Mars favorise l\'action directe. Avancez sans hésiter.', 'Canalisez votre énergie dans un projet concret aujourd\'hui.'],
  MERCURY: ['Mercure aiguise votre esprit. Idéal pour négocier et communiquer.', 'Les mots ont un pouvoir particulier aujourd\'hui. Choisissez-les avec soin.'],
  JUPITER: ['Jupiter ouvre les portes de la fortune. Pensez grand.', 'L\'abondance circule librement — permettez-vous de la recevoir.'],
  VENUS:   ['Vénus embrase les cœurs et les sens. Cultivez la beauté autour de vous.', 'Les relations s\'épanouissent naturellement sous l\'influence de Vénus.'],
  SATURN:  ['Saturne récompense la discipline. Un effort soutenu produit des résultats durables.', 'Structurez vos projets avec méthode — les bases solides résistent au temps.']
};

function getDayAdvice(dayRuler, scores) {
  const list = CONSEILS[dayRuler];
  return list[Math.floor(Math.random() * list.length)];
}

// ---- SIGNE LUNAIRE APPROXIMATIF ----
const MOON_SIGNS = ['Bélier','Taureau','Gémeaux','Cancer','Lion','Vierge','Balance','Scorpion','Sagittaire','Capricorne','Verseau','Poissons'];
const MOON_SYMS  = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
function moonSign(date) {
  const jd = (date - new Date(2000, 0, 1, 12)) / 86400000;
  const lon = ((218.32 + 13.176 * jd) % 360 + 360) % 360;
  const idx = Math.floor(lon / 30) % 12;
  return { name: MOON_SIGNS[idx], sym: MOON_SYMS[idx], degrees: Math.round(lon % 30) };
}

// ---- ASPECTS LUNE DU JOUR ----
function moonAspects(date) {
  const transits = dailyPlanetPositions(date);
  const moonLon = transits.moon;
  const result = [];
  const aspNames = { 0:'☌', 60:'✶', 90:'□', 120:'△', 180:'☍' };
  const aspFull  = { 0:'Conjonction', 60:'Sextile', 90:'Carré', 120:'Trigone', 180:'Opposition' };
  for (const [key, lon] of Object.entries(transits)) {
    if (key === 'moon') continue;
    let diff = Math.abs(moonLon - lon) % 360;
    if (diff > 180) diff = 360 - diff;
    for (const [angle, sym] of Object.entries(aspNames)) {
      if (Math.abs(diff - Number(angle)) <= 7) {
        const sym2 = PLANETS[key.toUpperCase()]?.sym || '●';
        result.push({ sym, full: aspFull[angle], planet: PLANETS[key.toUpperCase()]?.name || key, sym2, orb: Math.round(Math.abs(diff - Number(angle))) });
      }
    }
  }
  return result.slice(0, 4);
}

window.AstroEngine = {
  PLANETS, DAY_RULERS, CHALDEAN,
  sunriseSunset, computePlanetaryHours, secondsToHHMM,
  moonPhase, moonSign, moonAspects,
  sunSign, natalPlanets, dailyPlanetPositions,
  transitScore, computeDayScores, computeLuckyHours,
  getDayAdvice
};
