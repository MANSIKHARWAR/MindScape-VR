/* ============================================================
   MINDSCAPE VR — MAIN JAVASCRIPT
   All interactivity: navigation, AI chat, breathwork,
   fear genome, roleplay, insights, mood/scene engine
   ============================================================ */

'use strict';

/* ----------------------------------------------------------
   0. CONSTANTS & CONFIG
   ---------------------------------------------------------- */
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-sonnet-4-20250514';

const AFFIRMATIONS = [
  '"Your emotions are valid signals, not permanent states."',
  '"Courage is not the absence of fear — it is choosing to grow through it."',
  '"Every breath you take is a step toward understanding yourself."',
  '"You are the author of your own story."',
  '"Healing is not linear. Every moment of awareness matters."',
  '"The bravest thing you can do is feel what you feel, fully."',
  '"You do not have to face this alone."',
];

const SCENES = {
  neutral:   { name: 'Cosmic Void 🌌',    bg: 'radial-gradient(ellipse at 50% 50%, #0a0520 0%, #050510 80%)',  particle: '⭐' },
  calm:      { name: 'Ocean Sanctuary 🌊', bg: 'radial-gradient(ellipse at 50% 100%, #0c2340 0%, #050510 60%)', particle: '💧' },
  anxious:   { name: 'Mountain Clarity 🏔️',bg: 'radial-gradient(ellipse at 50% 0%, #1a0a2e 0%, #050510 70%)',  particle: '❄️' },
  confident: { name: 'Golden Aurora 🌅',   bg: 'radial-gradient(ellipse at 30% 50%, #2a1a00 0%, #050510 70%)', particle: '✨' },
  sad:       { name: 'Misty Forest 🌿',    bg: 'radial-gradient(ellipse at 50% 30%, #051a10 0%, #050510 70%)', particle: '🍃' },
};

const FEAR_DATA = [
  { id: 1, label: 'Public Speaking', intensity: 78, x: .28, y: .28, color: '#f43f5e' },
  { id: 2, label: 'Social Anxiety',  intensity: 62, x: .54, y: .22, color: '#a265ff' },
  { id: 3, label: 'Failure',         intensity: 85, x: .75, y: .36, color: '#f43f5e' },
  { id: 4, label: 'Rejection',       intensity: 55, x: .18, y: .58, color: '#f59e0b' },
  { id: 5, label: 'Change',          intensity: 40, x: .44, y: .52, color: '#0ea5e9' },
  { id: 6, label: 'Uncertainty',     intensity: 70, x: .68, y: .62, color: '#a265ff' },
  { id: 7, label: 'Judgment',        intensity: 60, x: .32, y: .76, color: '#f59e0b' },
  { id: 8, label: 'Loss',            intensity: 45, x: .60, y: .78, color: '#0ea5e9' },
];

const ROLEPLAY_SCENARIOS = [
  { id: 'lincoln', icon: '🎩', name: "Lincoln's Resolve",   desc: 'Channel Abraham Lincoln before the Gettysburg Address. Face public scrutiny with grace.', theme: 'Courage' },
  { id: 'curie',   icon: '⚗️', name: "Curie's Curiosity",   desc: 'Become Marie Curie in her lab — embracing uncertainty and the unknown with wonder.',      theme: 'Discovery' },
  { id: 'mandela', icon: '🕊️', name: "Mandela's Vision",    desc: 'Walk in Mandela\'s shoes — transforming fear of opposition into peaceful strength.',        theme: 'Resilience' },
  { id: 'tesla',   icon: '⚡', name: "Tesla's Obsession",   desc: 'Embody Tesla — turning social anxiety into focused, unstoppable creative genius.',          theme: 'Focus' },
];

/* ----------------------------------------------------------
   1. STATE
   ---------------------------------------------------------- */
const state = {
  currentPage: 'home',
  mood:       'neutral',
  messages:   [],          // current chat messages [{role, content}]
  isLoading:  false,
  sessionHistory: [],      // short text log
  selectedScenario: null,
  fearNodes:  JSON.parse(JSON.stringify(FEAR_DATA)),   // deep copy
  emotionScore: { calm: 0, energy: 0, clarity: 0 },
  breathPhase: 'idle',     // idle | inhale | hold | exhale | done
  breathCycle: 0,
  breathTimer: null,
  affIdx: 0,
  voiceActive: false,
  recognition: null,
  totalExchanges: 0,
};

/* ----------------------------------------------------------
   2. DOM SHORTCUTS
   ---------------------------------------------------------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ----------------------------------------------------------
   3. NAVIGATION
   ---------------------------------------------------------- */
function initNav() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
}

function navigateTo(page) {
  if (state.currentPage === page) return;
  state.currentPage = page;

  // toggle page visibility
  $$('.page').forEach(p => p.classList.remove('active'));
  $(`#${page}`)?.classList.add('active');

  // toggle nav button state
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));

  // page-specific hooks
  if (page === 'genome') renderFearCanvas();
  if (page === 'insights') refreshInsights();
}

/* ----------------------------------------------------------
   4. SCENE / MOOD ENGINE
   ---------------------------------------------------------- */
function setMood(mood) {
  if (!SCENES[mood]) return;
  state.mood = mood;
  const scene = SCENES[mood];

  // change background
  $('#scene-bg').style.background = scene.bg;

  // update badge
  $('#mood-badge').textContent = '● Scene: ' + scene.name;

  // change particles
  spawnParticles(scene.particle);
}

function detectMoodFromText(text) {
  const t = text.toLowerCase();
  if (/anxious|scared|worry|nervous|panic|fear|stress|overwhelm/.test(t)) return 'anxious';
  if (/sad|depress|hopeless|alone|lonely|cry|grief|loss/.test(t))         return 'sad';
  if (/confident|strong|ready|excit|great|amazing|proud|power/.test(t))   return 'confident';
  if (/calm|peace|relax|breath|okay|better|settle|still/.test(t))         return 'calm';
  return 'neutral';
}

/* ----------------------------------------------------------
   5. PARTICLES
   ---------------------------------------------------------- */
function spawnParticles(emoji) {
  const container = $('#particles');
  container.innerHTML = '';
  for (let i = 0; i < 22; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    el.textContent = emoji;
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      font-size: ${Math.random() * 14 + 8}px;
      animation-duration: ${Math.random() * 18 + 12}s;
      animation-delay: ${Math.random() * 12}s;
      opacity: ${Math.random() * .3 + .1};
    `;
    container.appendChild(el);
  }
}

/* ----------------------------------------------------------
   6. AFFIRMATION ROTATOR
   ---------------------------------------------------------- */
function initAffirmations() {
  const box = $('#affirmation-text');
  if (!box) return;
  box.textContent = AFFIRMATIONS[0];
  setInterval(() => {
    state.affIdx = (state.affIdx + 1) % AFFIRMATIONS.length;
    box.style.opacity = '0';
    setTimeout(() => {
      box.textContent = AFFIRMATIONS[state.affIdx];
      box.style.opacity = '1';
    }, 700);
  }, 5500);
}

/* ----------------------------------------------------------
   7. QUICK-CHIP BUTTONS (therapy / roleplay)
   ---------------------------------------------------------- */
function attachChips(container, sendFn) {
  $$('.chip', container).forEach(chip => {
    chip.addEventListener('click', () => sendFn(chip.textContent.trim()));
  });
}

/* ----------------------------------------------------------
   8. MOOD BAR (therapy page)
   ---------------------------------------------------------- */
function initMoodBar() {
  $$('.mood-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.mood-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setMood(btn.dataset.mood);
      updateChatHeader();
    });
  });
}

function updateChatHeader() {
  const h = $('#therapy-header');
  if (!h) return;
  h.innerHTML = `${SCENES[state.mood].name} &nbsp;·&nbsp; Mood: <strong>${state.mood}</strong>`;
}

/* ----------------------------------------------------------
   9. AI CHAT ENGINE
   ---------------------------------------------------------- */
function buildSystemPrompt(tab, scenarioId) {
  const histSummary = state.sessionHistory.slice(-4).join('; ') || 'No prior context.';
  const base = `You are MindScape — an empathetic AI therapy companion with deep emotional intelligence.
You speak with warmth, precision, and calm authority.
Never give generic platitudes. Tune into the user's exact words.
Current user mood: ${state.mood}
Recent session context: ${histSummary}

Rules:
- Respond in 2-3 short paragraphs maximum.
- Ask at most one powerful question per reply.
- Offer specific, actionable micro-techniques when appropriate.
- Never dismiss or minimize feelings.
- Celebrate small moments of insight.`;

  if (tab === 'roleplay' && scenarioId) {
    const s = ROLEPLAY_SCENARIOS.find(r => r.id === scenarioId);
    return base + `\n\nYou are facilitating an immersive historical roleplay. The user is embodying ${s?.name}.
Guide them into the mindset of this figure. Theme: "${s?.theme}". Reference historical context naturally. Help them feel the figure's inner strength as their own.`;
  }
  if (tab === 'breathwork') {
    return base + '\n\nYou are a breathwork guide. Use gentle, poetic language. Provide specific timed instructions when asked.';
  }
  // default therapy
  return base + '\n\nYou are running a personalized therapy session. Help the user explore emotions, identify patterns, and build coping strategies.';
}

async function sendMessage(text, tab = 'therapy') {
  text = (text || '').trim();
  if (!text || state.isLoading) return;

  // detect mood
  const detectedMood = detectMoodFromText(text);
  setMood(detectedMood);
  updateChatHeader();

  // add user bubble
  state.messages.push({ role: 'user', content: text });
  renderMessages(tab);
  clearInput(tab);
  state.isLoading = true;
  toggleSendBtn(tab, true);

  // log
  state.sessionHistory.push(`User: ${text.slice(0, 60)}`);

  // pattern detection
  if (/avoid|can't|impossible|never|pointless|useless/.test(text.toLowerCase()) && state.sessionHistory.length > 1) {
    showPatternAlert();
  }

  // show typing bubble
  showTyping(tab);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: buildSystemPrompt(tab, state.selectedScenario),
        messages: state.messages,
      }),
    });

    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const reply = data.content?.map(c => c.text || '').join('') || "I'm here with you. Take a breath and continue.";

    removeTyping(tab);
    state.messages.push({ role: 'assistant', content: reply });
    state.sessionHistory.push(`AI: ${reply.slice(0, 60)}`);
    state.totalExchanges++;

    // update emotion scores
    const calm    = (reply.match(/breath|calm|peace|gentle|safe|still|ground/gi) || []).length;
    const energy  = (reply.match(/strength|power|courage|bold|rise|thrive|capable/gi) || []).length;
    const clarity = (reply.match(/clear|understand|realize|see|insight|aware|pattern/gi) || []).length;
    state.emotionScore.calm    = Math.min(100, state.emotionScore.calm    + calm    * 8);
    state.emotionScore.energy  = Math.min(100, state.emotionScore.energy  + energy  * 8);
    state.emotionScore.clarity = Math.min(100, state.emotionScore.clarity + clarity * 8);

    // slightly reduce fear intensities
    state.fearNodes = state.fearNodes.map(n => ({
      ...n,
      intensity: Math.max(8, n.intensity - (Math.random() > .65 ? Math.floor(Math.random() * 4) + 1 : 0)),
    }));

    renderMessages(tab);
  } catch (err) {
    removeTyping(tab);
    state.messages.push({ role: 'assistant', content: "I'm still here. Sometimes the connection flickers — but we continue. What were you saying?" });
    renderMessages(tab);
    console.error('API error:', err);
  }

  state.isLoading = false;
  toggleSendBtn(tab, false);
}

/* ----------------------------------------------------------
   10. RENDER CHAT MESSAGES
   ---------------------------------------------------------- */
function getMessageContainer(tab) {
  return $(`#${tab}-messages`);
}

function renderMessages(tab) {
  const container = getMessageContainer(tab);
  if (!container) return;

  // only show empty state if no messages
  if (state.messages.length === 0) {
    container.innerHTML = getEmptyHTML(tab);
    return;
  }

  container.innerHTML = state.messages.map(m => `
    <div class="bubble-row ${m.role === 'user' ? 'user' : 'ai'}">
      <div class="bubble">${escapeHtml(m.content)}</div>
    </div>
  `).join('');

  container.scrollTop = container.scrollHeight;
}

function getEmptyHTML(tab) {
  const chips = tab === 'roleplay'
    ? ["I'm about to face a crowd", "I'm doubting myself", "I feel like giving up"]
    : ["I'm feeling anxious today", "I fear failure", "I struggle with confidence"];

  const emoji = tab === 'roleplay' ? '🎭' : '🌿';
  const msg   = tab === 'roleplay'
    ? 'Step into the mindset. What moment are you facing?'
    : 'Share what\'s on your mind. I\'m here, without judgment.';

  return `<div class="chat-empty">
    <span class="big-emoji">${emoji}</span>
    <p>${msg}</p>
    <div class="quick-chips">
      ${chips.map(c => `<button class="chip">${c}</button>`).join('')}
    </div>
  </div>`;
}

function showTyping(tab) {
  const container = getMessageContainer(tab);
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'bubble-row ai';
  el.id = `${tab}-typing`;
  el.innerHTML = '<div class="bubble typing">Listening and thinking…</div>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function removeTyping(tab) {
  $(`#${tab}-typing`)?.remove();
}

function clearInput(tab) {
  const inp = $(`#${tab}-input`);
  if (inp) inp.value = '';
}

function toggleSendBtn(tab, disabled) {
  const btn = $(`#${tab}-send`);
  if (btn) btn.disabled = disabled;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

/* ----------------------------------------------------------
   11. VOICE INPUT
   ---------------------------------------------------------- */
function initVoice(tab) {
  const btn = $(`#${tab}-voice`);
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (state.voiceActive) {
      state.recognition?.stop();
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice recognition is not supported in this browser. Try Chrome.'); return; }

    state.recognition = new SR();
    state.recognition.lang = 'en-US';
    state.recognition.continuous = false;

    state.recognition.onstart = () => {
      state.voiceActive = true;
      btn.classList.add('listening');
      btn.textContent = '🔴';
    };
    state.recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const inp = $(`#${tab}-input`);
      if (inp) inp.value = transcript;
    };
    state.recognition.onend = () => {
      state.voiceActive = false;
      btn.classList.remove('listening');
      btn.textContent = '🎙️';
    };
    state.recognition.onerror = () => {
      state.voiceActive = false;
      btn.classList.remove('listening');
      btn.textContent = '🎙️';
    };

    state.recognition.start();
  });
}

/* ----------------------------------------------------------
   12. PATTERN ALERT
   ---------------------------------------------------------- */
function showPatternAlert() {
  const el = $('#pattern-alert');
  if (!el) return;
  el.style.display = 'block';
  clearTimeout(showPatternAlert._t);
  showPatternAlert._t = setTimeout(() => el.style.display = 'none', 6500);
}

/* ----------------------------------------------------------
   13. THERAPY PAGE INIT
   ---------------------------------------------------------- */
function initTherapy() {
  // send button
  $('#therapy-send')?.addEventListener('click', () => {
    sendMessage($('#therapy-input').value, 'therapy');
  });
  // enter key
  $('#therapy-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage($('#therapy-input').value, 'therapy');
  });

  initVoice('therapy');
  initMoodBar();

  // chips (delegated)
  $('#therapy-messages')?.addEventListener('click', e => {
    if (e.target.classList.contains('chip')) sendMessage(e.target.textContent, 'therapy');
  });

  updateChatHeader();
  renderMessages('therapy');
}

/* ----------------------------------------------------------
   14. ROLEPLAY PAGE INIT
   ---------------------------------------------------------- */
function initRoleplay() {
  // build scenario cards
  const grid = $('#scenario-grid');
  if (!grid) return;
  grid.innerHTML = ROLEPLAY_SCENARIOS.map(s => `
    <div class="scenario-card" data-id="${s.id}">
      <div class="scenario-icon">${s.icon}</div>
      <div class="scenario-name">${s.name}</div>
      <div class="scenario-desc">${s.desc}</div>
      <div class="theme-badge">Theme: ${s.theme}</div>
    </div>
  `).join('');

  grid.addEventListener('click', e => {
    const card = e.target.closest('.scenario-card');
    if (!card) return;
    selectScenario(card.dataset.id);
  });

  // send button / enter
  $('#roleplay-send')?.addEventListener('click', () => {
    sendMessage($('#roleplay-input').value, 'roleplay');
  });
  $('#roleplay-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage($('#roleplay-input').value, 'roleplay');
  });

  initVoice('roleplay');

  $('#roleplay-messages')?.addEventListener('click', e => {
    if (e.target.classList.contains('chip')) sendMessage(e.target.textContent, 'roleplay');
  });

  $('#back-to-scenarios')?.addEventListener('click', () => {
    selectScenario(null);
  });
}

function selectScenario(id) {
  state.selectedScenario = id;
  state.messages = [];  // fresh chat per scenario

  const s = ROLEPLAY_SCENARIOS.find(r => r.id === id);
  const grid     = $('#scenario-grid');
  const chat     = $('#roleplay-chat-section');
  const header   = $('#roleplay-active-header');
  const backWrap = $('#back-btn-wrap');

  if (id && s) {
    grid.style.display    = 'none';
    chat.style.display    = 'block';
    header.style.display  = 'flex';
    backWrap.style.display= 'block';
    $('#roleplay-header-icon').textContent = s.icon + ' ' + s.name;
    $('#roleplay-header-sub').textContent  = 'Immersive roleplay — theme: ' + s.theme;
  } else {
    grid.style.display    = 'grid';
    chat.style.display    = 'none';
    header.style.display  = 'none';
    backWrap.style.display= 'none';
  }

  renderMessages('roleplay');
}

/* ----------------------------------------------------------
   15. FEAR GENOME PAGE
   ---------------------------------------------------------- */
function renderFearCanvas() {
  const wrap   = $('#fear-canvas-wrap');
  if (!wrap) return;
  const W = wrap.clientWidth  || 700;
  const H = wrap.clientHeight || 380;

  // Remove old canvas
  $('canvas', wrap)?.remove();
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  wrap.insertBefore(canvas, $('.canvas-hint', wrap));

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const nodes = state.fearNodes;

  // draw connection lines
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      ctx.beginPath();
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.strokeStyle = 'rgba(124,58,237,.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // draw nodes
  nodes.forEach(n => {
    const x = n.x * W, y = n.y * H;
    const r = n.intensity * 0.38 + 20;

    // glow
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, n.color + '55');
    grad.addColorStop(1, n.color + '00');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // border circle
    ctx.beginPath();
    ctx.arc(x, y, r * .72, 0, Math.PI * 2);
    ctx.strokeStyle = n.color + '80';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // label
    ctx.fillStyle = n.color;
    ctx.font = 'bold 11px Lato, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, x, y - 7);

    // intensity %
    ctx.fillStyle = n.color + 'aa';
    ctx.font = '10px Lato, sans-serif';
    ctx.fillText(n.intensity + '%', x, y + 9);
  });

  // make clickable
  canvas.style.cursor = 'pointer';
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top)  * (H / rect.height);
    nodes.forEach(n => {
      const dx = mx - n.x * W, dy = my - n.y * H;
      const r = n.intensity * .38 + 20;
      if (Math.sqrt(dx*dx + dy*dy) < r) {
        // jump to therapy with context
        state.messages = [];
        navigateTo('therapy');
        setTimeout(() => sendMessage(`Let's work on my fear of ${n.label}`, 'therapy'), 300);
      }
    });
  };

  // render fear bars below canvas
  const barWrap = $('#fear-bars');
  if (!barWrap) return;
  barWrap.innerHTML = nodes.map(n => `
    <div class="fear-bar-item">
      <div class="fear-bar-label">
        <strong>${n.label}</strong>
        <span style="color:${n.color}">${n.intensity}%</span>
      </div>
      <div class="fear-bar-track">
        <div class="fear-bar-fill" style="width:${n.intensity}%;background:${n.color}"></div>
      </div>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   16. BREATHWORK PAGE
   ---------------------------------------------------------- */
function initBreathwork() {
  $('#start-breath')?.addEventListener('click', startBreathwork);

  // technique cards
  $$('.technique-card').forEach(card => {
    card.addEventListener('click', () => {
      const t = card.dataset.technique;
      const inp = $('#breathwork-input');
      if (inp) inp.value = `Guide me through a ${t} breathing session.`;
    });
  });

  // AI breathwork chat
  $('#breathwork-send')?.addEventListener('click', () => {
    sendBreathworkMsg($('#breathwork-input').value);
  });
  $('#breathwork-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendBreathworkMsg($('#breathwork-input').value);
  });
}

async function sendBreathworkMsg(text) {
  text = (text || '').trim();
  if (!text) return;

  const out = $('#breathwork-reply');
  if (!out) return;
  out.textContent = 'Listening…';
  $('#breathwork-input').value = '';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: buildSystemPrompt('breathwork', null),
        messages: [{ role: 'user', content: text }],
      }),
    });
    const data = await res.json();
    const reply = data.content?.map(c => c.text || '').join('') || 'Take a gentle breath in…';
    out.textContent = reply;
  } catch {
    out.textContent = 'Breathe in… hold… breathe out. You are safe.';
  }
}

function startBreathwork() {
  clearTimeout(state.breathTimer);
  state.breathCycle = 0;
  runBreathCycle();
}

function runBreathCycle() {
  if (state.breathCycle >= 5) {
    setBreathPhase('done', 'Complete ✓', '5/5 cycles');
    return;
  }

  setBreathPhase('inhale', 'Inhale', `Cycle ${state.breathCycle + 1}/5`);
  state.breathTimer = setTimeout(() => {
    setBreathPhase('hold', 'Hold', `Cycle ${state.breathCycle + 1}/5`);
    state.breathTimer = setTimeout(() => {
      setBreathPhase('exhale', 'Exhale', `Cycle ${state.breathCycle + 1}/5`);
      state.breathTimer = setTimeout(() => {
        state.breathCycle++;
        runBreathCycle();
      }, 4000);
    }, 4000);
  }, 4000);
}

function setBreathPhase(phase, label, subLabel) {
  state.breathPhase = phase;
  const ring = $('#breath-ring');
  if (!ring) return;
  ring.className = 'breath-ring ' + phase;
  ring.querySelector('.phase').textContent = label;
  ring.querySelector('.count').textContent = subLabel;
}

/* ----------------------------------------------------------
   17. INSIGHTS PAGE
   ---------------------------------------------------------- */
function refreshInsights() {
  // stat numbers
  $('#stat-calm').textContent    = state.emotionScore.calm + '%';
  $('#stat-energy').textContent  = state.emotionScore.energy + '%';
  $('#stat-clarity').textContent = state.emotionScore.clarity + '%';
  $('#stat-sessions').textContent= state.totalExchanges;

  // progress bars (animate on render)
  const bars = {
    '#prog-calm':    { val: state.emotionScore.calm,    color: '#0ea5e9' },
    '#prog-energy':  { val: state.emotionScore.energy,  color: '#f59e0b' },
    '#prog-clarity': { val: state.emotionScore.clarity, color: '#a265ff' },
  };
  Object.entries(bars).forEach(([sel, cfg]) => {
    const el = $(sel);
    if (!el) return;
    requestAnimationFrame(() => {
      el.style.width = cfg.val + '%';
      el.style.background = cfg.color;
    });
  });

  // badges
  const badges = [
    { id: 'badge-first',    earned: state.totalExchanges > 0 },
    { id: 'badge-heart',    earned: state.totalExchanges >= 4 },
    { id: 'badge-ocean',    earned: state.emotionScore.calm > 20 },
    { id: 'badge-power',    earned: state.emotionScore.energy > 20 },
    { id: 'badge-clarity',  earned: state.emotionScore.clarity > 20 },
    { id: 'badge-roleplay', earned: !!state.selectedScenario },
  ];
  badges.forEach(b => {
    const el = $(`#${b.id}`);
    if (!el) return;
    el.classList.toggle('earned', b.earned);
  });

  // session log
  const logEl = $('#session-log');
  if (!logEl) return;
  if (state.sessionHistory.length === 0) {
    logEl.innerHTML = '<div class="no-sessions">Start a therapy session to see your log here.</div>';
  } else {
    logEl.innerHTML = state.sessionHistory.slice(-8).map(h =>
      `<div class="log-entry">${escapeHtml(h)}</div>`
    ).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }
}

/* ----------------------------------------------------------
   18. BOOT
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Initial scene
  spawnParticles(SCENES.neutral.particle);

  // Nav
  initNav();

  // Show home by default
  navigateTo('home');

  // Home CTA buttons
  $('#cta-therapy')?.addEventListener('click', () => navigateTo('therapy'));
  $('#cta-genome')?.addEventListener('click',  () => navigateTo('genome'));

  // Affirmations
  initAffirmations();

  // Therapy
  initTherapy();

  // Roleplay
  initRoleplay();

  // Breathwork
  initBreathwork();
  setBreathPhase('idle', 'Ready', 'Press Start');

  console.log('🧠 MindScape VR loaded');
});