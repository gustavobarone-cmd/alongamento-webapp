// Alongamentos Web App (GitHub Pages friendly)
// - Carrega stretches_bank_v1.json
// - Usuário escolhe tempo (min) + modo (pre/post)
// - Monta sequência aleatória que cabe no tempo
// - Cada alongamento: 30s + 5s intervalo (sem intervalo no último)
// - Fala nome ao iniciar (Web Speech API) e mostra vídeo do YouTube

const STRETCH_SECONDS = 30;
const REST_SECONDS = 5;

const $ = (id) => document.getElementById(id);

const screenSetup = $("screenSetup");
const screenSession = $("screenSession");

const modeEl = $("mode");
const minutesEl = $("minutes");
const minutesValue = $("minutesValue");
const estimatedCountEl = $("estimatedCount");
const setupStatus = $("setupStatus");

const voicePrefEl = $("voicePref");
const voiceSelectEl = $("voiceSelect");
const btnTestVoice = $("btnTestVoice");

const btnStart = $("btnStart");

const chipPhase = $("chipPhase");
const stretchName = $("stretchName");
const stretchMeta = $("stretchMeta");
const timerBig = $("timerBig");
const timerSub = $("timerSub");

const youtubeFrame = $("youtubeFrame");
const videoFallback = $("videoFallback");
const btnOpenSearch = $("btnOpenSearch");

const progressIndex = $("progressIndex");
const progressTotal = $("progressTotal");
const nextName = $("nextName");
const barFill = $("barFill");

const btnPause = $("btnPause");
const btnSkip = $("btnSkip");
const btnStop = $("btnStop");

const sessionStatus = $("sessionStatus");

// Help dialog
const helpDialog = $("helpDialog");
$("btnHelp").addEventListener("click", () => helpDialog.showModal());
$("btnCloseHelp").addEventListener("click", () => helpDialog.close());

// State
let bank = null;          // loaded JSON
let voices = [];          // browser voices
let selectedVoiceName = ""; // explicit selection
let session = null;       // session state object
let tickHandle = null;

function estimateCount(totalMinutes) {
  const T = totalMinutes * 60;
  // total(n) = 35*n - 5  => n = floor((T + 5)/35)
  return Math.max(0, Math.floor((T + 5) / (STRETCH_SECONDS + REST_SECONDS)));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${pad2(r)}` : `${r}`;
}

function getPreferredVoice() {
  // 1) Explicit voice selection wins
  if (selectedVoiceName) {
    const v = voices.find(v => v.name === selectedVoiceName);
    if (v) return v;
  }

  // 2) If preference OFF, no voice
  if (voicePrefEl.value === "off") return null;

  // 3) Prefer pt-BR if available
  const ptVoices = voices.filter(v => (v.lang || "").toLowerCase().startsWith("pt"));
  const base = ptVoices.length ? ptVoices : voices;

  const pref = voicePrefEl.value;
  if (pref === "female") {
    const v = base.find(v => /female|mulher|femin/i.test(v.name));
    if (v) return v;
  }
  if (pref === "male") {
    const v = base.find(v => /male|homem|mascul/i.test(v.name));
    if (v) return v;
  }

  // 4) Fall back to first sensible voice
  return base[0] || null;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const v = getPreferredVoice();
  if (!v) return;

  // cancel ongoing
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang || "pt-BR";
  u.rate = 1.0;
  u.pitch = 1.0;
  window.speechSynthesis.speak(u);
}

function setYoutubeById(youtubeId) {
  if (!youtubeId) {
    youtubeFrame.src = "";
    youtubeFrame.classList.add("hidden");
    videoFallback.classList.remove("hidden");
    return;
  }
  // NOTE: autoplay may be blocked; mute helps allow autoplay in some browsers.
  const url = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`;
  youtubeFrame.src = url;
  youtubeFrame.classList.remove("hidden");
  videoFallback.classList.add("hidden");
}

function updateEstimateUI() {
  const mins = Number(minutesEl.value);
  minutesValue.textContent = String(mins);
  estimatedCountEl.textContent = String(estimateCount(mins));
}

minutesEl.addEventListener("input", updateEstimateUI);
updateEstimateUI();

// Load JSON bank
async function loadBank() {
  setupStatus.textContent = "Carregando banco de alongamentos...";
  const res = await fetch("./stretches_bank_v1.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Não consegui carregar stretches_bank_v1.json");
  const data = await res.json();
  bank = data.items || data; // allow plain array too
  setupStatus.textContent = `OK: ${bank.length} alongamentos carregados.`;
}

function refreshVoices() {
  voices = window.speechSynthesis?.getVoices?.() || [];
  // Populate select
  voiceSelectEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Automática (recomendado)";
  voiceSelectEl.appendChild(opt0);

  // Prefer pt voices first
  const sorted = voices.slice().sort((a,b) => {
    const ap = (a.lang||"").toLowerCase().startsWith("pt") ? 0 : 1;
    const bp = (b.lang||"").toLowerCase().startsWith("pt") ? 0 : 1;
    return ap - bp || a.name.localeCompare(b.name);
  });

  for (const v of sorted) {
    const o = document.createElement("option");
    o.value = v.name;
    o.textContent = `${v.name} — ${v.lang || "?"}`;
    voiceSelectEl.appendChild(o);
  }
}

voiceSelectEl.addEventListener("change", () => {
  selectedVoiceName = voiceSelectEl.value;
});

btnTestVoice.addEventListener("click", () => {
  speak("Teste de voz. Começando alongamento agora.");
});

// Some browsers load voices async
if ("speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function buildSequence(items, totalMinutes) {
  const totalSeconds = totalMinutes * 60;
  const n = estimateCount(totalMinutes);
  if (n <= 0) return [];

  const shuffled = shuffle(items);
  const seq = [];
  for (let i = 0; i < n; i++) {
    seq.push(shuffled[i % shuffled.length]); // repeats if needed
  }

  // if user chose very small bank, duplicates can happen; that's ok for MVP
  return seq;
}

function renderSessionUI() {
  const current = session.sequence[session.index];
  const isRest = session.phase === "rest";

  chipPhase.textContent = isRest ? "INTERVALO" : "ALONGAMENTO";
  chipPhase.style.borderColor = isRest ? "rgba(255,255,255,.22)" : "rgba(110,231,255,.30)";
  chipPhase.style.background = isRest ? "rgba(255,255,255,.08)" : "rgba(110,231,255,.12)";

  stretchName.textContent = isRest ? "Respire" : (current?.name_pt || current?.name_en || "Alongamento");
  stretchMeta.textContent = isRest
    ? `Próximo: ${(session.sequence[session.index]?.name_pt || session.sequence[session.index]?.name_en || "—")}`
    : `${current?.phase === "pre" ? "Pré-treino" : "Pós-treino"} • ${current?.region || "—"} • ${current?.level || "—"}`;

  timerBig.textContent = formatTime(session.remaining);
  timerSub.textContent = isRest ? "intervalo" : "restante";

  // progress
  progressIndex.textContent = String(session.index + (isRest ? 0 : 1));
  progressTotal.textContent = String(session.sequence.length);
  const next = isRest ? session.sequence[session.index] : session.sequence[session.index + 1];
  nextName.textContent = next ? (next.name_pt || next.name_en) : "Fim 🎉";

  const done = session.index + (isRest ? 0 : 1);
  const pct = Math.min(100, Math.round((done / session.sequence.length) * 100));
  barFill.style.width = pct + "%";

  // video
  if (!isRest) {
    setYoutubeById(current?.video?.youtubeId || null);
    btnOpenSearch.onclick = () => {
      const q = encodeURIComponent(current?.video?.searchQuery || current?.name_en || current?.name_pt || "stretch");
      window.open(`https://www.youtube.com/results?search_query=${q}`, "_blank", "noreferrer");
    };
  } else {
    // during rest, hide video to reduce distraction
    setYoutubeById(null);
  }

  btnPause.textContent = session.running ? "Pausar" : "Continuar";
}

function startTick() {
  stopTick();
  tickHandle = setInterval(() => {
    if (!session || !session.running) return;

    session.remaining -= 1;
    if (session.remaining <= 0) {
      advancePhase();
    }
    renderSessionUI();
  }, 1000);
}

function stopTick() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}

function advancePhase() {
  const lastIndex = session.sequence.length - 1;

  if (session.phase === "stretch") {
    // after stretch, rest unless it's last
    if (session.index >= lastIndex) {
      finishSession();
      return;
    }
    session.phase = "rest";
    session.remaining = REST_SECONDS;
    return;
  }

  // rest -> next stretch
  session.phase = "stretch";
  session.index += 1;
  session.remaining = STRETCH_SECONDS;

  const current = session.sequence[session.index];
  if (current) speak(current.name_pt || current.name_en || "Próximo alongamento");
}

function finishSession() {
  stopTick();
  session.running = false;
  sessionStatus.textContent = "Sessão finalizada. Bom treino! 🎉";
  // show final UI state
  setYoutubeById(null);
  btnPause.disabled = true;
  btnSkip.disabled = true;
  chipPhase.textContent = "FIM";
}

function resetButtons() {
  btnPause.disabled = false;
  btnSkip.disabled = false;
}

btnPause.addEventListener("click", () => {
  if (!session) return;
  session.running = !session.running;
  renderSessionUI();
});

btnSkip.addEventListener("click", () => {
  if (!session) return;
  if (session.phase === "rest") {
    // skip rest: go to stretch immediately
    session.remaining = 0;
    advancePhase();
  } else {
    // skip current stretch: if last -> finish
    session.remaining = 0;
    advancePhase();
  }
  renderSessionUI();
});

btnStop.addEventListener("click", () => {
  stopTick();
  session = null;
  screenSession.classList.add("hidden");
  screenSetup.classList.remove("hidden");
  sessionStatus.textContent = "";
  resetButtons();
  setupStatus.textContent = "Sessão encerrada.";
});

btnStart.addEventListener("click", () => {
  if (!bank) return;

  const mode = modeEl.value;              // pre or post
  const mins = Number(minutesEl.value);   // total time
  const candidates = bank.filter(x => (x.phase || x.style) ? (x.phase === mode) : true);

  if (!candidates.length) {
    setupStatus.textContent = "Não achei alongamentos para esse modo. Confira o JSON.";
    return;
  }

  const seq = buildSequence(candidates, mins);
  if (!seq.length) {
    setupStatus.textContent = "Tempo muito curto. Aumente os minutos.";
    return;
  }

  // init session
  session = {
    mode,
    totalMinutes: mins,
    sequence: seq,
    index: 0,
    phase: "stretch",
    remaining: STRETCH_SECONDS,
    running: true
  };

  // show session screen
  screenSetup.classList.add("hidden");
  screenSession.classList.remove("hidden");
  sessionStatus.textContent = "";

  resetButtons();
  const first = session.sequence[0];
  if (first) speak(first.name_pt || first.name_en || "Começando");
  renderSessionUI();
  startTick();
});

// Bootstrap
(async function init(){
  try{
    await loadBank();
    // put a nicer default in voice select
    refreshVoices();
  }catch(e){
    console.error(e);
    setupStatus.textContent = "Erro ao carregar o banco. Rode em um servidor (GitHub Pages ou http-server).";
  }
})();
