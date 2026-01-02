/* Alongamento WebApp • v6 completo
   - Usa stretches_bank_v1.json (146 itens)
   - Sessão Pré/Pós
   - Vídeo do YouTube (youtubeId) + fallback de busca (searchQuery)
   - Timer + regressiva SOMENTE quando faltar 5s
   - Beep + voz (opcional), voz preferida ou específica
   - Seleção de itens do banco + personalizados (localStorage)
   - Alternância E/D para itens com sides:"LR" (opcional)
   - Histórico + export/import + sessão salva
   - PWA (manifest + sw)
*/

const STORAGE = {
  CUSTOM:   "stretch_v6_custom_items",
  SELECTED: "stretch_v6_selected_ids",
  SETTINGS: "stretch_v6_settings",
  LASTSEQ:  "stretch_v6_last_sequence",
  SAVED:    "stretch_v6_saved_session",
  HISTORY:  "stretch_v6_history"
};

const $ = (id) => document.getElementById(id);

const els = {
  // tabs
  tabs: Array.from(document.querySelectorAll(".tab")),
  panels: Array.from(document.querySelectorAll(".tabPanel")),

  statusPill: $("statusPill"),
  installBtn: $("installBtn"),

  // config
  mode: $("mode"),
  totalMinutes: $("totalMinutes"),
  stretchSeconds: $("stretchSeconds"),
  restSeconds: $("restSeconds"),
  startSide: $("startSide"),
  unilateralMode: $("unilateralMode"),

  beepEnabled: $("beepEnabled"),
  speakEndEnabled: $("speakEndEnabled"),
  speakCountdownEnabled: $("speakCountdownEnabled"),
  announceStepEnabled: $("announceStepEnabled"),

  voicePref: $("voicePref"),
  voiceSelect: $("voiceSelect"),

  generateBtn: $("generateBtn"),
  startBtn: $("startBtn"),
  saveSessionBtn: $("saveSessionBtn"),

  summaryLine: $("summaryLine"),
  estimatedCount: $("estimatedCount"),

  // player
  stepCounter: $("stepCounter"),
  chipPhase: $("chipPhase"),
  nowTitle: $("nowTitle"),
  nowSub: $("nowSub"),
  timerBig: $("timerBig"),
  timerSub: $("timerSub"),

  youtubeFrame: $("youtubeFrame"),
  videoFallback: $("videoFallback"),
  btnOpenSearch: $("btnOpenSearch"),

  progressIndex: $("progressIndex"),
  progressTotal: $("progressTotal"),
  nextName: $("nextName"),
  barFill: $("barFill"),

  countdownLabel: $("countdownLabel"),
  countdownText: $("countdownText"),

  pauseBtn: $("pauseBtn"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  stopBtn: $("stopBtn"),
  copyBtn: $("copyBtn"),

  sessionStatus: $("sessionStatus"),

  // sequence list
  sequenceMeta: $("sequenceMeta"),
  sequenceList: $("sequenceList"),

  // bank tab
  bankMeta: $("bankMeta"),
  bankSearch: $("bankSearch"),
  bankPhaseFilter: $("bankPhaseFilter"),
  bankRegionFilter: $("bankRegionFilter"),
  bankLevelFilter: $("bankLevelFilter"),
  selectAllBtn: $("selectAllBtn"),
  selectNoneBtn: $("selectNoneBtn"),
  deleteCustomBtn: $("deleteCustomBtn"),
  bankList: $("bankList"),

  newNamePt: $("newNamePt"),
  newPhase: $("newPhase"),
  newRegion: $("newRegion"),
  newSides: $("newSides"),
  newYoutubeId: $("newYoutubeId"),
  newSearchQuery: $("newSearchQuery"),
  addCustomBtn: $("addCustomBtn"),
  resetCustomBtn: $("resetCustomBtn"),

  // history tab
  historyMeta: $("historyMeta"),
  historyList: $("historyList"),
  exportBtn: $("exportBtn"),
  importFile: $("importFile"),
  clearHistoryBtn: $("clearHistoryBtn"),
  loadSavedBtn: $("loadSavedBtn"),
  deleteSavedBtn: $("deleteSavedBtn"),
  savedHint: $("savedHint"),
};

// --------- State ---------
let bank = null;
let allItems = [];           // bank items + custom
let selectedIds = new Set(); // items used for generation

let sequence = [];           // steps [{type:'stretch'|'rest', item, side, duration}]
let currentIndex = 0;

let isRunning = false;
let isPaused = false;
let intervalId = null;
let remaining = 0;
let stepTotal = 0;

let deferredInstallPrompt = null;

// --------- Helpers ---------
function setStatus(text, kind="neutral"){
  els.statusPill.textContent = text;
  const bg = {
    neutral: "rgba(255,255,255,.06)",
    good: "rgba(34,197,94,.18)",
    warn: "rgba(245,158,11,.18)",
    bad: "rgba(239,68,68,.18)",
  }[kind] || "rgba(255,255,255,.06)";
  els.statusPill.style.background = bg;
}

function saveJson(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function loadJson(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}

function pad2(n){ return String(n).padStart(2,"0"); }
function formatTime(sec){
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s/60);
  const r = s % 60;
  return `${pad2(m)}:${pad2(r)}`;
}
function oppositeSide(side){ return side === "L" ? "R" : "L"; }
function sideText(side){
  if (side === "L") return "Esquerda";
  if (side === "R") return "Direita";
  if (side === "BOTH") return "Ambos";
  return "—";
}
function nowIso(){ return new Date().toISOString(); }

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// --------- Voices ---------
let voices = [];
function refreshVoices(){
  if (!("speechSynthesis" in window)) return;
  voices = window.speechSynthesis.getVoices() || [];
  els.voiceSelect.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— (automática)";
  els.voiceSelect.appendChild(opt0);
  voices.forEach((v, i)=>{
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    els.voiceSelect.appendChild(opt);
  });

  // restore selection if possible
  const s = loadJson(STORAGE.SETTINGS, null);
  if (s?.voiceName){
    els.voiceSelect.value = s.voiceName;
  }
}

function getPreferredVoice(){
  const pref = els.voicePref.value;
  if (pref === "off") return null;

  const chosenName = els.voiceSelect.value;
  if (chosenName){
    const v = voices.find(x => x.name === chosenName);
    if (v) return v;
  }

  // prefer pt-BR if possible
  const pt = voices.filter(v => (v.lang || "").toLowerCase().includes("pt"));
  const pool = pt.length ? pt : voices;

  const isFemale = (name) => /female|femin|mulher|brasil|luciana|let[ií]cia|maria/i.test(name);
  const isMale   = (name) => /male|masc|homem|brasil|felipe|jo[aã]o|pedro/i.test(name);

  if (pref === "female"){
    return pool.find(v => isFemale(v.name)) || pool[0] || null;
  }
  if (pref === "male"){
    return pool.find(v => isMale(v.name)) || pool[0] || null;
  }
  return pool[0] || null;
}

function speak(text){
  if (!("speechSynthesis" in window)) return;
  const v = getPreferredVoice();
  if (!v) return;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  u.voice = v || null;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function speakCountdown(n){
  if (!els.speakCountdownEnabled.checked) return;
  speak(String(n));
}

function speakIfEnabled(text){
  if (!els.speakEndEnabled.checked) return;
  speak(text);
}

function speakStep(step){
  if (!els.announceStepEnabled.checked) return;
  if (!step) return;
  if (step.type === "rest"){
    speak("Intervalo");
    return;
  }
  const name = step.item?.name_pt || step.item?.name_en || "Alongamento";
  const side = step.side === "L" ? "esquerda" : step.side === "R" ? "direita" : "";
  speak(side ? `${name}, ${side}` : name);
}

// --------- Beep ---------
let audioCtx = null;
function ensureAudio(){
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(()=>{});
  }catch{}
}
function beep(type="count"){
  if (!els.beepEnabled.checked) return;
  try{
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = type === "end" ? 660 : 880;
    g.gain.value = type === "end" ? 0.10 : 0.07;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    setTimeout(()=>{ o.stop(); }, type === "end" ? 160 : 110);
  }catch{}
}

// --------- Tabs ---------
function setActiveTab(name){
  els.tabs.forEach(btn=>{
    const active = btn.dataset.tab === name;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  els.panels.forEach(p=> p.classList.toggle("active", p.id === `tab-${name}`));
}

// --------- Data load / merge ---------
async function loadBank(){
  const resp = await fetch("./stretches_bank_v1.json", { cache: "no-store" });
  bank = await resp.json();
}

function loadAllItems(){
  const custom = loadJson(STORAGE.CUSTOM, []);
  // normalize custom
  const customNorm = Array.isArray(custom) ? custom.filter(x => x && x.id).map(x => ({
    ...x,
    custom: true,
    video: x.video || { provider:"youtube", youtubeId: x.youtubeId || null, searchQuery: x.searchQuery || (x.name_en || x.name_pt || "") },
  })) : [];

  const base = Array.isArray(bank?.items) ? bank.items : [];
  const merged = [...base, ...customNorm];

  // unique by id
  const seen = new Set();
  allItems = merged.filter(it=>{
    if (!it.id || seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });

  // selection
  const stored = loadJson(STORAGE.SELECTED, null);
  if (Array.isArray(stored) && stored.length){
    selectedIds = new Set(stored.filter(id => allItems.some(it => it.id === id)));
  } else {
    selectedIds = new Set(allItems.map(it => it.id));
  }
  saveSelected();
}

function saveSelected(){
  saveJson(STORAGE.SELECTED, Array.from(selectedIds));
}

function buildRegionOptions(){
  const regions = Array.from(new Set(allItems.map(i=>i.region).filter(Boolean))).sort();
  els.bankRegionFilter.innerHTML = `<option value="all" selected>Todas</option>`;
  regions.forEach(r=>{
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    els.bankRegionFilter.appendChild(opt);
  });
}

// --------- Settings ---------
function getSettings(){
  return {
    mode: els.mode.value === "post" ? "post" : "pre",
    totalMinutes: Math.max(1, Number(els.totalMinutes.value || 8)),
    stretchSeconds: Math.max(10, Number(els.stretchSeconds.value || 30)),
    restSeconds: Math.max(0, Number(els.restSeconds.value || 5)),
    startSide: els.startSide.value === "R" ? "R" : "L",
    unilateralMode: els.unilateralMode.value || "off",

    beepEnabled: els.beepEnabled.checked,
    speakEndEnabled: els.speakEndEnabled.checked,
    speakCountdownEnabled: els.speakCountdownEnabled.checked,
    announceStepEnabled: els.announceStepEnabled.checked,

    voicePref: els.voicePref.value || "auto",
    voiceName: els.voiceSelect.value || ""
  };
}

function saveSettings(){
  const s = getSettings();
  saveJson(STORAGE.SETTINGS, s);
}

function loadSettings(){
  const s = loadJson(STORAGE.SETTINGS, null);
  if (!s) return;

  if (s.mode) els.mode.value = s.mode;
  if (typeof s.totalMinutes === "number") els.totalMinutes.value = s.totalMinutes;
  if (typeof s.stretchSeconds === "number") els.stretchSeconds.value = String(s.stretchSeconds);
  if (typeof s.restSeconds === "number") els.restSeconds.value = String(s.restSeconds);
  if (s.startSide) els.startSide.value = s.startSide;
  if (s.unilateralMode) els.unilateralMode.value = s.unilateralMode;

  els.beepEnabled.checked = !!s.beepEnabled;
  els.speakEndEnabled.checked = !!s.speakEndEnabled;
  els.speakCountdownEnabled.checked = !!s.speakCountdownEnabled;
  els.announceStepEnabled.checked = !!s.announceStepEnabled;

  if (s.voicePref) els.voicePref.value = s.voicePref;
  // voiceName restored in refreshVoices
}

function updateSummary(){
  const s = getSettings();
  els.summaryLine.textContent = `${s.mode === "pre" ? "Pré" : "Pós"} • ${s.totalMinutes} min • ${s.stretchSeconds}s + ${s.restSeconds}s • lados: ${s.unilateralMode}`;
  els.estimatedCount.textContent = String(estimateCount(s.totalMinutes, s.stretchSeconds, s.restSeconds));
}

function estimateCount(totalMinutes, stretchSeconds, restSeconds){
  const total = totalMinutes * 60;
  const unit = stretchSeconds + restSeconds;
  if (unit <= 0) return 0;
  return Math.max(0, Math.floor((total + restSeconds) / unit)); // +rest to allow last without rest
}

// --------- Bank list UI ---------
function bankLabel(it){
  const phase = it.phase === "pre" ? "Pré" : (it.phase === "post" ? "Pós" : "—");
  const lvl = it.level || "—";
  const reg = it.region || "—";
  const sides = it.sides ? it.sides : "—";
  const yt = it.video?.youtubeId ? "YT" : "—";
  return `${phase} • ${reg} • ${lvl} • sides:${sides} • vídeo:${yt}`;
}

function renderBank(){
  const q = (els.bankSearch.value || "").trim().toLowerCase();
  const phase = els.bankPhaseFilter.value;
  const region = els.bankRegionFilter.value;
  const level = els.bankLevelFilter.value;

  const list = allItems.filter(it=>{
    const name = (it.name_pt || it.name_en || "").toLowerCase();
    const tags = Array.isArray(it.tags) ? it.tags.join(" ").toLowerCase() : "";
    const matchesQ = !q || name.includes(q) || tags.includes(q) || (it.region || "").toLowerCase().includes(q);

    const matchesPhase =
      phase === "all" ? true :
      phase === "custom" ? !!it.custom :
      it.phase === phase;

    const matchesRegion = region === "all" ? true : (it.region === region);
    const matchesLevel = level === "all" ? true : (it.level === level);

    return matchesQ && matchesPhase && matchesRegion && matchesLevel;
  });

  els.bankList.innerHTML = "";
  list.forEach(it=>{
    const row = document.createElement("div");
    row.className = "exerciseRow";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = selectedIds.has(it.id);
    chk.addEventListener("change", ()=>{
      if (chk.checked) selectedIds.add(it.id);
      else selectedIds.delete(it.id);
      saveSelected();
      updateBankMeta();
      updateSummary();
    });

    const colName = document.createElement("div");
    colName.innerHTML = `<div class="name">${escapeHtml(it.name_pt || it.name_en || it.id)}</div><div class="metaSmall">${escapeHtml(bankLabel(it))}</div>`;

    const colType = document.createElement("div");
    colType.className = "muted";
    colType.textContent = it.custom ? "Personalizado" : "Padrão";

    const colVideo = document.createElement("div");
    colVideo.className = "muted";
    colVideo.textContent = it.video?.youtubeId ? "Vídeo: sim" : "Vídeo: —";

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnCopy = document.createElement("button");
    btnCopy.className = "smallBtn";
    btnCopy.textContent = "Copiar nome";
    btnCopy.addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(it.name_pt || it.name_en || it.id);
        setStatus("Copiado", "good");
      }catch{
        setStatus("Não deu para copiar", "warn");
      }
    });
    actions.appendChild(btnCopy);

    if (it.video?.youtubeId || it.video?.searchQuery){
      const btnOpen = document.createElement("button");
      btnOpen.className = "smallBtn";
      btnOpen.textContent = "Abrir vídeo";
      btnOpen.addEventListener("click", ()=>{
        const id = it.video?.youtubeId;
        const q = it.video?.searchQuery || (it.name_en || it.name_pt || it.id);
        const url = id
          ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`
          : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      });
      actions.appendChild(btnOpen);
    }

    row.appendChild(chk);
    row.appendChild(colName);
    row.appendChild(colType);
    row.appendChild(colVideo);
    row.appendChild(actions);
    els.bankList.appendChild(row);
  });

  updateBankMeta(list.length);
}

function updateBankMeta(visibleCount=null){
  const total = allItems.length;
  const selected = selectedIds.size;
  const visible = visibleCount == null ? "" : ` • mostrando ${visibleCount}`;
  els.bankMeta.textContent = `${selected}/${total} selecionados${visible}`;
}

// --------- Custom items ---------
function addCustom(){
  const name_pt = (els.newNamePt.value || "").trim();
  const phase = els.newPhase.value === "post" ? "post" : "pre";
  const region = (els.newRegion.value || "").trim() || "custom";
  const sides = els.newSides.value || "N";
  const youtubeId = (els.newYoutubeId.value || "").trim() || null;
  const searchQuery = (els.newSearchQuery.value || "").trim() || (name_pt || "");

  if (!name_pt){
    setStatus("Escreva um nome", "warn");
    return;
  }

  const custom = loadJson(STORAGE.CUSTOM, []);
  const id = `custom_${Math.random().toString(36).slice(2,10)}_${Date.now().toString(36)}`;
  custom.push({
    id,
    name_pt,
    name_en: "",
    phase,
    style: phase === "pre" ? "dynamic" : "static",
    region,
    tags: ["custom"],
    level: "beginner",
    sides: sides === "LR" ? "LR" : (sides === "B" ? "B" : "N"),
    default_duration_s: 30,
    cue: "",
    video: { provider:"youtube", youtubeId, searchQuery }
  });
  saveJson(STORAGE.CUSTOM, custom);

  loadAllItems();
  buildRegionOptions();
  renderBank();

  setStatus("Adicionado", "good");

  els.newNamePt.value = "";
  els.newRegion.value = "";
  els.newYoutubeId.value = "";
  els.newSearchQuery.value = "";
}

function resetCustom(){
  localStorage.removeItem(STORAGE.CUSTOM);
  loadAllItems();
  buildRegionOptions();
  renderBank();
  setStatus("Personalizados apagados", "good");
}

function deleteSelectedCustom(){
  const custom = loadJson(STORAGE.CUSTOM, []);
  if (!Array.isArray(custom) || !custom.length){
    setStatus("Sem personalizados", "warn");
    return;
  }
  const keep = custom.filter(it => !selectedIds.has(it.id));
  const removed = custom.length - keep.length;
  if (removed <= 0){
    setStatus("Nenhum personalizado selecionado", "warn");
    return;
  }
  saveJson(STORAGE.CUSTOM, keep);
  // also remove from selection
  custom.forEach(it => { if (!keep.some(k=>k.id===it.id)) selectedIds.delete(it.id); });
  saveSelected();

  loadAllItems();
  buildRegionOptions();
  renderBank();
  setStatus("Apagados", "good");
}

// --------- Sequence generation ---------
function isUnilateral(item){
  // Accept either sides:"LR" or unilateral:true
  return item?.sides === "LR" || item?.unilateral === true;
}

function buildSequence(){
  saveSettings();
  updateSummary();

  const s = getSettings();

  const pool = allItems
    .filter(it => selectedIds.has(it.id))
    .filter(it => it.phase === s.mode);

  if (!pool.length){
    sequence = [];
    renderSequence();
    setStatus("Selecione itens do modo escolhido", "warn");
    els.startBtn.disabled = true;
    els.saveSessionBtn.disabled = true;
    return;
  }

  const totalSeconds = s.totalMinutes * 60;
  const steps = [];
  let elapsed = 0;

  let lastSide = null;

  const pushRest = () => {
    if (s.restSeconds <= 0) return;
    steps.push({ type:"rest", duration:s.restSeconds });
    elapsed += s.restSeconds;
  };

  while (elapsed + s.stretchSeconds <= totalSeconds){
    const item = pool[Math.floor(Math.random() * pool.length)];
    const uniMode = s.unilateralMode;

    if (uniMode !== "off" && isUnilateral(item)){
      // Determine side
      const sideA = lastSide ? oppositeSide(lastSide) : s.startSide;
      const sideB = oppositeSide(sideA);

      if (uniMode === "pairs"){
        // add A then B if fits
        steps.push({ type:"stretch", item, side: sideA, duration: s.stretchSeconds });
        elapsed += s.stretchSeconds;
        if (elapsed >= totalSeconds) break;
        pushRest();

        if (elapsed + s.stretchSeconds > totalSeconds) break;
        steps.push({ type:"stretch", item, side: sideB, duration: s.stretchSeconds });
        elapsed += s.stretchSeconds;

        lastSide = sideB;
        if (elapsed >= totalSeconds) break;
        pushRest();
      } else {
        // alternate
        steps.push({ type:"stretch", item, side: sideA, duration: s.stretchSeconds });
        elapsed += s.stretchSeconds;
        lastSide = sideA;
        if (elapsed >= totalSeconds) break;
        pushRest();
      }
    } else {
      // normal
      steps.push({ type:"stretch", item, side: "NONE", duration: s.stretchSeconds });
      elapsed += s.stretchSeconds;
      if (elapsed >= totalSeconds) break;
      pushRest();
    }
  }

  // remove trailing rest
  while (steps.length && steps[steps.length-1].type === "rest"){
    steps.pop();
  }

  sequence = steps;
  currentIndex = 0;

  saveJson(STORAGE.LASTSEQ, sequence);

  renderSequence();
  loadStep(0);

  setStatus("Sessão gerada", "good");
  els.startBtn.disabled = sequence.length === 0;
  els.saveSessionBtn.disabled = sequence.length === 0;
  els.copyBtn.disabled = sequence.length === 0;
}

function badge(step){
  if (step.type === "rest") return { text:"Intervalo", cls:"neutral" };
  if (step.side === "L") return { text:"Esquerda", cls:"warn" };
  if (step.side === "R") return { text:"Direita", cls:"warn" };
  if (step.side === "BOTH") return { text:"Ambos", cls:"neutral" };
  return { text:"—", cls:"neutral" };
}

function renderSequence(){
  els.sequenceList.innerHTML = "";
  if (!sequence.length){
    els.sequenceMeta.textContent = "Nenhuma sessão gerada.";
    els.progressIndex.textContent = "0";
    els.progressTotal.textContent = "0";
    els.nextName.textContent = "—";
    els.barFill.style.width = "0%";
    els.stepCounter.textContent = "—";
    return;
  }
  const total = sequence.reduce((sum, st)=> sum + st.duration, 0);
  els.sequenceMeta.textContent = `${sequence.length} passos • ${Math.round(total/60)} min (aprox.)`;

  sequence.forEach((st, idx)=>{
    const li = document.createElement("li");
    const left = document.createElement("div");

    if (st.type === "rest"){
      left.innerHTML = `<div class="itemTitle">${idx+1}. Intervalo</div><div class="itemMeta">${st.duration}s</div>`;
    } else {
      const name = st.item?.name_pt || st.item?.name_en || "Alongamento";
      const meta = `${st.item?.region || "—"} • ${st.item?.level || "—"} • ${st.duration}s`;
      left.innerHTML = `<div class="itemTitle">${idx+1}. ${escapeHtml(name)}</div><div class="itemMeta">${escapeHtml(meta)}</div>`;
    }

    const b = badge(st);
    const right = document.createElement("div");
    right.className = `badge ${b.cls}`;
    right.textContent = b.text;

    li.appendChild(left);
    li.appendChild(right);
    els.sequenceList.appendChild(li);
  });

  els.copyBtn.disabled = false;
}

// --------- Player UI + video ---------
function setYoutubeById(youtubeId, startSeconds = 0){
  if (!youtubeId){
    els.youtubeFrame.src = "";
    els.youtubeFrame.classList.add("hidden");
    els.videoFallback.classList.remove("hidden");
    return;
  }
  const start = startSeconds ? `&start=${Math.max(0, Math.floor(startSeconds))}` : "";
  const url = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1${start}`;
  els.youtubeFrame.src = url;
  els.youtubeFrame.classList.remove("hidden");
  els.videoFallback.classList.add("hidden");
}

function currentStep(){
  return sequence[currentIndex] || null;
}

function nextStepName(){
  const n = sequence[currentIndex + 1];
  if (!n) return "—";
  if (n.type === "rest") return "Intervalo";
  return n.item?.name_pt || n.item?.name_en || "Alongamento";
}

function loadStep(i){
  const st = sequence[i];
  if (!st) return;

  currentIndex = i;
  remaining = st.duration;
  stepTotal = st.duration;

  els.stepCounter.textContent = `${i+1}/${sequence.length}`;

  els.progressIndex.textContent = String(i+1);
  els.progressTotal.textContent = String(sequence.length);
  els.nextName.textContent = nextStepName();

  const phase = st.type === "rest" ? "INTERVALO" : "ALONGAMENTO";
  els.chipPhase.textContent = phase;
  els.chipPhase.style.borderColor = st.type === "rest" ? "rgba(255,255,255,.22)" : "rgba(110,231,255,.30)";
  els.chipPhase.style.background  = st.type === "rest" ? "rgba(255,255,255,.08)" : "rgba(110,231,255,.12)";

  if (st.type === "rest"){
    els.nowTitle.textContent = "Respire";
    els.nowSub.textContent = "Intervalo";
    els.timerSub.textContent = "intervalo";
    setYoutubeById(null);
  } else {
    const name = st.item?.name_pt || st.item?.name_en || "Alongamento";
    const sText = st.side && st.side !== "NONE" ? ` • ${sideText(st.side)}` : "";
    els.nowTitle.textContent = name;
    els.nowSub.textContent = `${st.item?.region || "—"} • ${st.item?.level || "—"}${sText}`;
    els.timerSub.textContent = "restante";

    const yt = st.item?.video?.youtubeId;
    setYoutubeById(yt);
  }

  els.timerBig.textContent = formatTime(remaining);
  els.barFill.style.width = `${Math.round(((i) / Math.max(1, sequence.length)) * 100)}%`;

  els.countdownLabel.textContent = "";
  els.countdownText.textContent = "";
  els.sessionStatus.textContent = "";
}

// --------- Playback ---------
function start(){
  if (!sequence.length) return;
  ensureAudio(); // unlock audio
  refreshVoices(); // best-effort
  if (!isRunning){
    isRunning = true;
    isPaused = false;
    els.pauseBtn.disabled = false;
    els.prevBtn.disabled = false;
    els.nextBtn.disabled = false;
    els.stopBtn.disabled = false;
    els.copyBtn.disabled = false;

    setStatus("Executando", "good");
    speakStep(currentStep());

    intervalId = setInterval(tick, 1000);
  }
  updateButtons();
}

function stop(){
  if (intervalId){
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
  isPaused = false;
  updateButtons();
}

function togglePause(){
  if (!isRunning) return;
  isPaused = !isPaused;
  setStatus(isPaused ? "Pausado" : "Executando", isPaused ? "warn" : "good");
  els.pauseBtn.textContent = isPaused ? "Continuar" : "Pausar";
}

function tick(){
  if (!isRunning || isPaused) return;
  remaining -= 1;

  els.timerBig.textContent = formatTime(remaining);
  const done = Math.min(1, (stepTotal - remaining) / stepTotal);
  const overall = (currentIndex + done) / Math.max(1, sequence.length);
  els.barFill.style.width = `${Math.round(overall * 100)}%`;

  // countdown only when it reaches 5s
  if (remaining === 5){
    els.countdownLabel.textContent = "Trocando em";
    els.countdownText.textContent = "5";
    beep("count");
    speakCountdown(5);
  } else if (remaining < 5 && remaining >= 1){
    els.countdownLabel.textContent = "Trocando em";
    els.countdownText.textContent = String(remaining);
    beep("count");
    speakCountdown(remaining);
  } else {
    els.countdownLabel.textContent = "";
    els.countdownText.textContent = "";
  }

  if (remaining <= 0){
    advance(1, true);
  }
}

function advance(delta, fromAuto=false){
  if (!sequence.length) return;
  let ni = currentIndex + delta;
  if (ni < 0) ni = 0;

  if (ni >= sequence.length){
    finish();
    return;
  }

  loadStep(ni);
  if (isRunning && (fromAuto || true)){
    speakStep(currentStep());
  }
}

function finish(){
  stop();
  setStatus("Concluído", "good");
  els.sessionStatus.textContent = "Alongamento concluído ✅";
  els.countdownLabel.textContent = "";
  els.countdownText.textContent = "";
  beep("end");
  speakIfEnabled("Alongamento concluído");
  addHistoryEntry();
  updateButtons();
}

function stopAll(){
  stop();
  setStatus("Parado", "neutral");
  els.sessionStatus.textContent = "Parado.";
  els.countdownLabel.textContent = "";
  els.countdownText.textContent = "";
  updateButtons();
}

function updateButtons(){
  const hasSeq = sequence.length > 0;
  els.startBtn.disabled = !hasSeq || isRunning;
  els.saveSessionBtn.disabled = !hasSeq;
  els.pauseBtn.disabled = !isRunning;
  els.prevBtn.disabled = !isRunning;
  els.nextBtn.disabled = !isRunning;
  els.stopBtn.disabled = !isRunning;
  els.copyBtn.disabled = !hasSeq;

  els.pauseBtn.textContent = isPaused ? "Continuar" : "Pausar";
}

// --------- Copy session ---------
async function copySession(){
  if (!sequence.length) return;
  const lines = sequence.map((st, idx)=>{
    if (st.type === "rest") return `${idx+1}. Intervalo - ${st.duration}s`;
    const name = st.item?.name_pt || st.item?.name_en || "Alongamento";
    const side = st.side && st.side !== "NONE" ? ` (${sideText(st.side)})` : "";
    return `${idx+1}. ${name}${side} - ${st.duration}s`;
  });
  try{
    await navigator.clipboard.writeText(lines.join("\n"));
    setStatus("Copiado", "good");
  }catch{
    setStatus("Não deu para copiar", "warn");
  }
}

// --------- YouTube search fallback ---------
function openSearch(){
  const st = currentStep();
  if (!st || st.type !== "stretch") return;
  const q = st.item?.video?.searchQuery || st.item?.name_en || st.item?.name_pt || "stretch";
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// --------- History / Saved session ---------
function getHistory(){ return loadJson(STORAGE.HISTORY, []); }
function setHistory(h){ saveJson(STORAGE.HISTORY, h); }

function addHistoryEntry(){
  const s = getSettings();
  const total = sequence.reduce((sum, st)=> sum + st.duration, 0);
  const stretchCount = sequence.filter(st => st.type === "stretch").length;
  const entry = {
    at: nowIso(),
    mode: s.mode,
    totalSeconds: total,
    stretches: stretchCount,
    settings: s
  };
  const hist = getHistory();
  hist.unshift(entry);
  setHistory(hist.slice(0, 60));
  renderHistory();
}

function renderHistory(){
  const hist = getHistory();
  els.historyList.innerHTML = "";
  els.historyMeta.textContent = hist.length ? `${hist.length} sessões salvas` : "Nenhuma sessão ainda.";

  if (!hist.length){
    els.historyList.innerHTML = `<div class="mini">Quando terminar uma sessão, ela aparece aqui.</div>`;
    return;
  }

  hist.forEach(h=>{
    const div = document.createElement("div");
    div.className = "historyItem";
    const dt = new Date(h.at);
    const when = dt.toLocaleString("pt-BR");
    const mins = Math.round((h.totalSeconds||0)/60);
    const label = h.mode === "pre" ? "Pré" : "Pós";
    div.innerHTML = `
      <div class="title">${escapeHtml(when)} • ${mins} min • ${label}</div>
      <div class="meta">${h.stretches} alongamentos • ${h.settings?.stretchSeconds}s + ${h.settings?.restSeconds}s • lados:${escapeHtml(h.settings?.unilateralMode || "off")}</div>
    `;
    els.historyList.appendChild(div);
  });
}

function clearHistory(){
  setHistory([]);
  renderHistory();
  setStatus("Histórico limpo", "good");
}

// Saved
function saveSession(){
  if (!sequence.length){
    setStatus("Gere uma sessão primeiro", "warn");
    return;
  }
  saveJson(STORAGE.SAVED, { at: nowIso(), sequence });
  setStatus("Sessão salva", "good");
  renderSavedHint();
}
function loadSaved(){
  const d = loadJson(STORAGE.SAVED, null);
  if (!d || !Array.isArray(d.sequence) || !d.sequence.length){
    setStatus("Não há sessão salva", "warn");
    renderSavedHint();
    return;
  }
  sequence = d.sequence;
  currentIndex = 0;
  saveJson(STORAGE.LASTSEQ, sequence);
  renderSequence();
  loadStep(0);
  setStatus("Sessão carregada", "good");
  updateButtons();
}
function deleteSaved(){
  localStorage.removeItem(STORAGE.SAVED);
  renderSavedHint();
  setStatus("Sessão salva apagada", "good");
}
function renderSavedHint(){
  const d = loadJson(STORAGE.SAVED, null);
  if (!d || !Array.isArray(d.sequence) || !d.sequence.length){
    els.savedHint.textContent = "Nenhuma sessão salva.";
    return;
  }
  const dt = new Date(d.at);
  const when = dt.toLocaleString("pt-BR");
  const mins = Math.round(d.sequence.reduce((a,b)=>a+(b.duration||0),0)/60);
  els.savedHint.textContent = `Salva em ${escapeHtml(when)} • ~${mins} min • ${d.sequence.length} passos`;
}

// Export / Import
function exportData(){
  const payload = {
    version: 6,
    exportedAt: nowIso(),
    customItems: loadJson(STORAGE.CUSTOM, []),
    selectedIds: Array.from(selectedIds),
    settings: getSettings(),
    savedSession: loadJson(STORAGE.SAVED, null),
    history: getHistory()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "alongamento-dados-v6.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus("Exportado", "good");
}

async function importData(file){
  try{
    const txt = await file.text();
    const data = JSON.parse(txt);

    if (Array.isArray(data.customItems)) saveJson(STORAGE.CUSTOM, data.customItems);
    if (Array.isArray(data.selectedIds)) {
      selectedIds = new Set(data.selectedIds);
      saveSelected();
    }
    if (data.settings) saveJson(STORAGE.SETTINGS, data.settings);
    if (data.savedSession) saveJson(STORAGE.SAVED, data.savedSession);
    if (Array.isArray(data.history)) saveJson(STORAGE.HISTORY, data.history);

    loadAllItems();
    buildRegionOptions();
    loadSettings();
    updateSummary();

    renderBank();
    renderHistory();
    renderSavedHint();

    // keep last sequence if saved
    const last = loadJson(STORAGE.LASTSEQ, []);
    if (Array.isArray(last) && last.length){
      sequence = last;
      renderSequence();
      loadStep(0);
    }

    setStatus("Importado", "good");
  }catch{
    setStatus("Falha ao importar", "bad");
  }
}

// --------- PWA ---------
function registerServiceWorker(){
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

function setupInstall(){
  els.installBtn.style.display = "none";
  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredInstallPrompt = e;
    els.installBtn.style.display = "grid";
  });
  els.installBtn.addEventListener("click", async ()=>{
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.style.display = "none";
  });
}

// --------- Wire events ---------
function wire(){
  els.tabs.forEach(btn=> btn.addEventListener("click", ()=> setActiveTab(btn.dataset.tab)));

  // settings
  ["input","change"].forEach(evt=>{
    els.mode.addEventListener(evt, ()=>{ saveSettings(); updateSummary(); });
    els.totalMinutes.addEventListener(evt, ()=>{ saveSettings(); updateSummary(); });
    els.stretchSeconds.addEventListener(evt, ()=>{ saveSettings(); updateSummary(); });
    els.restSeconds.addEventListener(evt, ()=>{ saveSettings(); updateSummary(); });
    els.startSide.addEventListener(evt, ()=>{ saveSettings(); updateSummary(); });
    els.unilateralMode.addEventListener(evt, ()=>{ saveSettings(); updateSummary(); });

    els.beepEnabled.addEventListener(evt, saveSettings);
    els.speakEndEnabled.addEventListener(evt, saveSettings);
    els.speakCountdownEnabled.addEventListener(evt, saveSettings);
    els.announceStepEnabled.addEventListener(evt, saveSettings);

    els.voicePref.addEventListener(evt, saveSettings);
    els.voiceSelect.addEventListener(evt, saveSettings);
  });

  els.generateBtn.addEventListener("click", buildSequence);
  els.startBtn.addEventListener("click", ()=>{
    if (!sequence.length) return;
    // restart if ended
    if (!isRunning && currentIndex >= sequence.length-1 && remaining <= 0){
      loadStep(0);
    }
    start();
  });
  els.saveSessionBtn.addEventListener("click", saveSession);

  els.pauseBtn.addEventListener("click", togglePause);
  els.prevBtn.addEventListener("click", ()=> advance(-1, false));
  els.nextBtn.addEventListener("click", ()=> advance(1, false));
  els.stopBtn.addEventListener("click", stopAll);
  els.copyBtn.addEventListener("click", copySession);

  els.btnOpenSearch.addEventListener("click", openSearch);

  // bank
  els.bankSearch.addEventListener("input", renderBank);
  els.bankPhaseFilter.addEventListener("change", renderBank);
  els.bankRegionFilter.addEventListener("change", renderBank);
  els.bankLevelFilter.addEventListener("change", renderBank);

  els.selectAllBtn.addEventListener("click", ()=>{
    allItems.forEach(it => selectedIds.add(it.id));
    saveSelected();
    renderBank();
    updateSummary();
    setStatus("Selecionou tudo", "good");
  });
  els.selectNoneBtn.addEventListener("click", ()=>{
    selectedIds.clear();
    saveSelected();
    renderBank();
    updateSummary();
    setStatus("Desmarcou tudo", "good");
  });
  els.deleteCustomBtn.addEventListener("click", deleteSelectedCustom);

  els.addCustomBtn.addEventListener("click", addCustom);
  els.resetCustomBtn.addEventListener("click", resetCustom);

  // history
  els.exportBtn.addEventListener("click", exportData);
  els.importFile.addEventListener("change", ()=>{
    const f = els.importFile.files && els.importFile.files[0];
    if (f) importData(f);
    els.importFile.value = "";
  });
  els.clearHistoryBtn.addEventListener("click", clearHistory);
  els.loadSavedBtn.addEventListener("click", loadSaved);
  els.deleteSavedBtn.addEventListener("click", deleteSaved);
}

// --------- Boot ---------
async function init(){
  registerServiceWorker();
  setupInstall();

  if ("speechSynthesis" in window){
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  await loadBank();
  loadAllItems();
  buildRegionOptions();

  loadSettings();
  updateSummary();

  renderBank();
  renderHistory();
  renderSavedHint();

  // restore last sequence
  const last = loadJson(STORAGE.LASTSEQ, []);
  if (Array.isArray(last) && last.length){
    sequence = last;
    renderSequence();
    loadStep(0);
    els.startBtn.disabled = false;
    els.saveSessionBtn.disabled = false;
    els.copyBtn.disabled = false;
  } else {
    buildSequence();
  }

  wire();
  updateButtons();
  setStatus("Pronto", "neutral");
}

init();
