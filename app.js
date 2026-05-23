/* ============================================
   Spot It! Tracker - Main Application Logic
   ============================================ */

// --- Firebase Config (hardcoded — no user paste needed) ---
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBcWjyOHJIkSamNchEvuEL_t7wOcqEuo6w",
  authDomain: "spot-it-tracker.firebaseapp.com",
  projectId: "spot-it-tracker",
  storageBucket: "spot-it-tracker.firebasestorage.app",
  messagingSenderId: "644827496849",
  appId: "1:644827496849:web:b7b80713f499a7fbcb5a30"
};

// --- State ---
let db = null;
let timerRunning = false;
let timerStartTime = 0;
let timerElapsed = 0;
let rafId = null;
let progressChart = null;
let allSessions = [];
let currentFilter = 'all';
let playerColors = {};

const COLOR_PALETTE = [
  { bg: '#FF6B6B', text: '#fff' },
  { bg: '#4ECDC4', text: '#1B1B3A' },
  { bg: '#FFE66D', text: '#1B1B3A' },
  { bg: '#A78BFA', text: '#fff' },
  { bg: '#F472B6', text: '#fff' },
  { bg: '#34D399', text: '#1B1B3A' },
];

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  registerSW();
  initFirebase(FIREBASE_CONFIG);

  const name = localStorage.getItem('spotit_player');
  if (!name) {
    showSetupModal();
  } else {
    signInAndStart(name);
  }
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// --- Setup ---
function showSetupModal() {
  document.getElementById('setup-modal').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  const name = localStorage.getItem('spotit_player');
  if (name) {
    document.getElementById('setup-name').value = name;
  }
}

function setupNext() {
  const name = document.getElementById('setup-name').value.trim();
  if (!name) {
    showToast('Please enter your name');
    return;
  }
  localStorage.setItem('spotit_player', name);
  document.getElementById('setup-next-btn').disabled = true;
  document.getElementById('setup-next-btn').textContent = 'Connecting...';
  signInAndStart(name);
}

async function signInAndStart(name) {
  try {
    await firebase.auth().signInAnonymously();
    initApp(name);
  } catch (e) {
    console.error('Auth failed:', e);
    showToast('Connection failed — try again');
    document.getElementById('setup-next-btn').disabled = false;
    document.getElementById('setup-next-btn').textContent = '🎯 Start Playing';
  }
}

// --- Firebase ---
function initFirebase(config) {
  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }
  db = firebase.firestore();
}

// --- App Init ---
function initApp(name) {
  document.getElementById('setup-modal').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('current-player-name').textContent = name;
  document.getElementById('app-version').textContent = APP_VERSION;
  loadSessions();
}

// --- Timer ---
function toggleTimer() {
  if (timerRunning) {
    stopTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  timerRunning = true;
  timerStartTime = performance.now() - timerElapsed;
  tick();

  document.getElementById('btn-start-stop-icon').textContent = '⏹';
  document.getElementById('btn-start-stop-text').textContent = 'STOP';
  document.getElementById('btn-start-stop').classList.add('running');
  document.getElementById('btn-save').classList.add('hidden');
  document.getElementById('timer-status').textContent = 'Go go go! 🔥';
  document.getElementById('timer-display').classList.add('running');
}

function stopTimer() {
  timerRunning = false;
  timerElapsed = performance.now() - timerStartTime;
  if (rafId) cancelAnimationFrame(rafId);

  document.getElementById('btn-start-stop-icon').textContent = '▶';
  document.getElementById('btn-start-stop-text').textContent = 'START';
  document.getElementById('btn-start-stop').classList.remove('running');
  document.getElementById('btn-save').classList.remove('hidden');
  document.getElementById('timer-status').textContent = 'Tap save to record this time!';
  document.getElementById('timer-display').classList.remove('running');
}

function resetTimer() {
  timerRunning = false;
  timerElapsed = 0;
  if (rafId) cancelAnimationFrame(rafId);
  updateDisplay(0);

  document.getElementById('btn-start-stop-icon').textContent = '▶';
  document.getElementById('btn-start-stop-text').textContent = 'START';
  document.getElementById('btn-start-stop').classList.remove('running');
  document.getElementById('btn-save').classList.add('hidden');
  document.getElementById('timer-status').textContent = 'Ready to go!';
  document.getElementById('timer-display').classList.remove('running');
}

function tick() {
  if (!timerRunning) return;
  timerElapsed = performance.now() - timerStartTime;
  updateDisplay(timerElapsed);
  rafId = requestAnimationFrame(tick);
}

function updateDisplay(ms) {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const cs = Math.floor((totalSec * 100) % 100);
  document.getElementById('timer-display').innerHTML =
    `${pad(min)}:${pad(sec)}<span class="timer-centis">.${pad(cs)}</span>`;
}

// Handle page visibility — keep timer accurate when app is backgrounded
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && timerRunning) {
    if (rafId) cancelAnimationFrame(rafId);
    tick();
  }
});

function pad(n) {
  return n.toString().padStart(2, '0');
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  const cs = Math.floor((seconds * 100) % 100);
  if (min > 0) {
    return `${min}:${pad(sec)}.${pad(cs)}`;
  }
  return `${sec}.${pad(cs)}`;
}

function formatTimeShort(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

// --- Save ---
async function saveTime() {
  const seconds = +(timerElapsed / 1000).toFixed(2);
  const player = localStorage.getItem('spotit_player');
  const now = new Date();

  // Use local time (Pacific) for date and time-of-day
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localDate = `${year}-${month}-${day}`;
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'night';

  document.getElementById('btn-save').disabled = true;
  document.getElementById('btn-save').textContent = 'Saving...';

  try {
    await db.collection('spotit_sessions').add({
      player: player,
      seconds: seconds,
      date: localDate,
      hour: hour,
      timeOfDay: timeOfDay,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    resetTimer();
    showToast(`Saved: ${formatTime(seconds)} 🎉`);
    // Refresh in case the real-time listener isn't active
    loadSessionsOnce();
  } catch (e) {
    console.error('Save failed:', e);
    showToast('Save failed — check connection');
  } finally {
    document.getElementById('btn-save').disabled = false;
    document.getElementById('btn-save').textContent = '💾 Save Time';
  }
}

// --- Load Sessions (real-time listener) ---
let unsubscribe = null;

const APP_VERSION = 'v9';

function loadSessions() {
  if (unsubscribe) return;

  unsubscribe = db.collection('spotit_sessions')
    .limit(500)
    .onSnapshot((snapshot) => {
      allSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort client-side (newest first)
      allSessions.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      assignPlayerColors();
      buildFilterTabs();
      renderHistory();
      renderProgress();
    }, (error) => {
      console.error('Realtime listener error:', error);
      unsubscribe = null;
      showToast('Live sync failed: ' + error.code);
      loadSessionsOnce();
    });
}

async function loadSessionsOnce() {
  try {
    const snapshot = await db.collection('spotit_sessions')
      .limit(500)
      .get();

    allSessions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    // Sort client-side (newest first)
    allSessions.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    assignPlayerColors();
    buildFilterTabs();
    renderHistory();
    renderProgress();
  } catch (e) {
    console.error('Load failed:', e);
    showToast('Load failed: ' + (e.code || e.message));
  }
}

function assignPlayerColors() {
  const players = [...new Set(allSessions.map(s => s.player))];
  playerColors = {};
  players.forEach((p, i) => {
    playerColors[p] = COLOR_PALETTE[i % COLOR_PALETTE.length];
  });
}

// --- Filter Tabs ---
function buildFilterTabs() {
  const players = [...new Set(allSessions.map(s => s.player))];
  const container = document.querySelector('.filter-tabs');

  container.innerHTML = `<button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all" onclick="filterHistory('all')">All</button>`;

  players.forEach(p => {
    const active = currentFilter === p ? 'active' : '';
    container.innerHTML += `<button class="filter-btn ${active}" data-filter="${escHtml(p)}" onclick="filterHistory('${escJs(p)}')">${escHtml(p)}</button>`;
  });
}

function filterHistory(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderHistory();
}

// --- Render History ---
function renderHistory() {
  const container = document.getElementById('history-list');
  const filtered = currentFilter === 'all'
    ? allSessions
    : allSessions.filter(s => s.player === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No sessions yet — go play! 🎯</div>';
    return;
  }

  container.innerHTML = filtered.map(s => {
    const color = playerColors[s.player] || COLOR_PALETTE[0];
    const initial = s.player.charAt(0).toUpperCase();
    const dateStr = formatDate(s.date);
    const todLabel = s.timeOfDay ? ` · ${s.timeOfDay}` : '';

    return `
      <div class="history-item">
        <div class="history-player" style="background:${color.bg};color:${color.text}">${initial}</div>
        <div class="history-details">
          <div class="history-name">${escHtml(s.player)}</div>
          <div class="history-date">${dateStr}${todLabel}</div>
        </div>
        <div class="history-time">${formatTime(s.seconds)}</div>
        <button class="history-delete" onclick="deleteSession('${s.id}')" title="Delete">🗑️</button>
      </div>`;
  }).join('');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

// --- Delete ---
async function deleteSession(id) {
  if (!confirm('Delete this session?')) return;
  try {
    await db.collection('spotit_sessions').doc(id).delete();
    showToast('Deleted');
  } catch (e) {
    showToast('Delete failed');
  }
}

// --- Progress Chart ---
function renderProgress() {
  const statsContainer = document.getElementById('stats-cards');
  const chartEmpty = document.getElementById('chart-empty');
  const chartContainer = document.querySelector('.chart-container');

  if (allSessions.length === 0) {
    statsContainer.innerHTML = '';
    chartContainer.classList.add('hidden');
    chartEmpty.classList.remove('hidden');
    return;
  }

  chartContainer.classList.remove('hidden');
  chartEmpty.classList.add('hidden');

  // Stats
  const players = [...new Set(allSessions.map(s => s.player))];
  let statsHtml = '';

  players.forEach(player => {
    const times = allSessions.filter(s => s.player === player).map(s => s.seconds);
    const best = Math.min(...times);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const color = playerColors[player] || COLOR_PALETTE[0];

    statsHtml += `
      <div class="stat-card">
        <div class="stat-label">🏆 Best</div>
        <div class="stat-value" style="color:${color.bg}">${formatTime(best)}</div>
        <div class="stat-player">${escHtml(player)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📊 Average</div>
        <div class="stat-value" style="color:${color.bg}">${formatTime(avg)}</div>
        <div class="stat-player">${escHtml(player)}</div>
      </div>`;
  });

  // Time-of-day stats (only if we have timeOfDay data)
  const sessionsWithTod = allSessions.filter(s => s.timeOfDay);
  if (sessionsWithTod.length > 0) {
    const periods = ['morning', 'afternoon', 'night'];
    const periodEmoji = { morning: '🌅', afternoon: '☀️', night: '🌙' };
    let todHtml = '';

    periods.forEach(period => {
      const times = sessionsWithTod.filter(s => s.timeOfDay === period).map(s => s.seconds);
      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        todHtml += `
          <div class="stat-card">
            <div class="stat-label">${periodEmoji[period]} ${period}</div>
            <div class="stat-value">${formatTime(avg)}</div>
            <div class="stat-player">${times.length} sessions</div>
          </div>`;
      }
    });

    if (todHtml) {
      statsHtml += `
        <div class="stat-card" style="grid-column: 1 / -1">
          <div class="stat-label">⏰ Average by Time of Day</div>
        </div>` + todHtml;
    }
  }

  // Total sessions
  statsHtml += `
    <div class="stat-card" style="grid-column: 1 / -1">
      <div class="stat-label">🎯 Total Sessions</div>
      <div class="stat-value">${allSessions.length}</div>
    </div>`;

  statsContainer.innerHTML = statsHtml;

  // Chart - group by date per player, use earliest-to-latest order
  const byPlayerDate = {};
  players.forEach(p => { byPlayerDate[p] = {}; });

  // Use chronological order (oldest first)
  const chronological = [...allSessions].reverse();
  chronological.forEach(s => {
    if (!byPlayerDate[s.player][s.date]) {
      byPlayerDate[s.player][s.date] = [];
    }
    byPlayerDate[s.player][s.date].push(s.seconds);
  });

  // Get all unique dates, sorted
  const allDates = [...new Set(chronological.map(s => s.date))].sort();

  // Build datasets
  const datasets = players.map(player => {
    const color = playerColors[player] || COLOR_PALETTE[0];
    const data = allDates.map(date => {
      const times = byPlayerDate[player][date];
      if (!times) return null;
      // Use the best time of the day
      return Math.min(...times);
    });

    return {
      label: player,
      data: data,
      borderColor: color.bg,
      backgroundColor: color.bg + '33',
      tension: 0.3,
      spanGaps: true,
      pointRadius: 5,
      pointHoverRadius: 8,
      borderWidth: 3,
    };
  });

  const labels = allDates.map(d => {
    const [, m, day] = d.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${parseInt(day)}`;
  });

  // Destroy old chart
  if (progressChart) {
    progressChart.destroy();
  }

  const ctx = document.getElementById('progress-chart').getContext('2d');
  progressChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          labels: { color: '#A0A0B8', font: { weight: 'bold' } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatTime(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#A0A0B8', maxRotation: 45 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: {
            color: '#A0A0B8',
            callback: (v) => formatTimeShort(v)
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
          title: {
            display: true,
            text: '↑ Faster is better',
            color: '#A0A0B8',
            font: { size: 12 }
          }
        }
      }
    }
  });
}

// --- View Switching ---
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelector(`.nav-btn[data-view="${name}"]`).classList.add('active');
}

// --- Settings ---
function showSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');
  document.getElementById('settings-name').value = localStorage.getItem('spotit_player') || '';
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function updatePlayerName() {
  const name = document.getElementById('settings-name').value.trim();
  if (!name) {
    showToast('Name cannot be empty');
    return;
  }
  localStorage.setItem('spotit_player', name);
  document.getElementById('current-player-name').textContent = name;
  closeSettings();
  showToast('Name updated!');
}

function confirmResetApp() {
  if (!confirm('Reset local settings? You\'ll need to re-enter your name. Shared data is NOT deleted.')) return;
  localStorage.removeItem('spotit_player');
  location.reload();
}

// --- Toast ---
let toastTimeout = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.add('hidden'), 2500);
}

// --- Helpers ---
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escJs(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// --- Keyboard shortcut (spacebar to start/stop) ---
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.querySelector('#view-timer.active') && !e.target.matches('input, textarea')) {
    e.preventDefault();
    toggleTimer();
  }
});
