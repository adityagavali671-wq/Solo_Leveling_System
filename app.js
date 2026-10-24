(() => {
  "use strict";
  const STORAGE_KEY = "realLifeSystem_v1";
  const DAY_MS = 86400000;
  const $ = (id) => document.getElementById(id);
  const ATTRS = {
    STR: { name: "Strength", icon: "STR", description: "Strength training and physical practice" },
    INT: { name: "Intelligence", icon: "INT", description: "Study, reading, chess and problem-solving" },
    AGI: { name: "Agility", icon: "AGI", description: "Coordination, movement and skill practice" },
    WIL: { name: "Willpower", icon: "WIL", description: "Showing up and following through" },
    VIT: { name: "Vitality", icon: "VIT", description: "Sleep, nutrition and recovery" }
  };
  const DEFAULT_QUESTS = [
    { id: "study", title: "Complete today's study target", attr: "INT", xp: 25, custom: false },
    { id: "movement", title: "Complete planned movement or workout", attr: "STR", xp: 20, custom: false },
    { id: "reading", title: "Read 10 pages of a book", attr: "INT", xp: 15, custom: false },
    { id: "coding", title: "Complete one coding lesson", attr: "WIL", xp: 20, custom: false },
    { id: "recovery", title: "Follow your sleep and recovery plan", attr: "VIT", xp: 20, custom: false }
  ];
  const ACHIEVEMENTS = [
    { id: "first", icon: "✦", name: "First Step", description: "Clear your first quest.", test: s => s.totalCleared >= 1 },
    { id: "five", icon: "◇", name: "Quest Beginner", description: "Clear 5 quests in total.", test: s => s.totalCleared >= 5 },
    { id: "twentyfive", icon: "⚔", name: "Quest Hunter", description: "Clear 25 quests in total.", test: s => s.totalCleared >= 25 },
    { id: "level5", icon: "⬆", name: "Rising Hunter", description: "Reach level 5.", test: s => s.level >= 5 },
    { id: "level10", icon: "✧", name: "A-Class Potential", description: "Reach level 10.", test: s => s.level >= 10 },
    { id: "streak3", icon: "🔥", name: "Finding Rhythm", description: "Build a 3-day streak.", test: s => s.bestStreak >= 3 },
    { id: "streak7", icon: "☼", name: "Seven-Day Resolve", description: "Build a 7-day streak.", test: s => s.bestStreak >= 7 },
    { id: "xp500", icon: "⚡", name: "Power Awakening", description: "Earn 500 total XP.", test: s => s.totalXp >= 500 },
    { id: "allattrs", icon: "◎", name: "Balanced Build", description: "Reach attribute level 3 in every attribute.", test: s => Object.values(s.attributes).every(a => a.level >= 3) }
  ];

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function dateFromKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  function daysBetween(a, b) {
    return Math.round((dateFromKey(b).getTime() - dateFromKey(a).getTime()) / DAY_MS);
  }
  function defaultState() {
    const attrs = {};
    Object.keys(ATTRS).forEach(k => attrs[k] = { xp: 0, level: 1 });
    return {
      version: 1,
      profile: { name: "PLAYER", className: "The Relentless Learner" },
      totalXp: 0, totalCleared: 0, level: 1,
      attributes: attrs,
      quests: DEFAULT_QUESTS.map(q => ({ ...q })),
      completions: {}, history: [], unlocked: [],
      streak: { current: 0, best: 0, lastActive: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  function safeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;
    const s = { ...base, ...raw };
    s.profile = { ...base.profile, ...(raw.profile || {}) };
    s.attributes = { ...base.attributes, ...(raw.attributes || {}) };
    for (const k of Object.keys(ATTRS)) {
      s.attributes[k] = { xp: Number(s.attributes[k]?.xp) || 0, level: Number(s.attributes[k]?.level) || 1 };
    }
    s.quests = Array.isArray(raw.quests) ? raw.quests.filter(q => q && typeof q.id === "string" && typeof q.title === "string").map(q => ({
      id: q.id, title: q.title.slice(0, 90), attr: ATTRS[q.attr] ? q.attr : "WIL",
      xp: [10,15,20,25,40,50].includes(Number(q.xp)) ? Number(q.xp) : 15, custom: Boolean(q.custom)
    })) : base.quests;
    s.completions = raw.completions && typeof raw.completions === "object" ? raw.completions : {};
    s.history = Array.isArray(raw.history) ? raw.history.filter(h => h && typeof h.title === "string").slice(0, 300) : [];
    s.unlocked = Array.isArray(raw.unlocked) ? raw.unlocked : [];
    s.streak = { ...base.streak, ...(raw.streak || {}) };
    s.totalXp = Math.max(0, Number(s.totalXp) || 0);
    s.totalCleared = Math.max(0, Number(s.totalCleared) || 0);
    s.level = Math.max(1, Number(s.level) || 1);
    return s;
  }
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return defaultState();
      return safeState(JSON.parse(saved));
    } catch (e) {
      console.error("Could not load saved System data:", e);
      return defaultState();
    }
  }
  let state = loadState();
  let activeFilter = "all";
  let confirmCallback = null;
  let toastTimer = null;

  function saveState() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error("Could not save System data:", e);
      showToast("Could not save. Export a backup and check browser storage.", false);
      return false;
    }
  }
  function xpForNextLevel(level) { return 100 + (level - 1) * 50; }
  function totalXpForLevel(level) {
    let total = 0;
    for (let l = 1; l < level; l++) total += xpForNextLevel(l);
    return total;
  }
  function calculateLevel(totalXp) {
    let level = 1, remaining = totalXp;
    while (remaining >= xpForNextLevel(level)) { remaining -= xpForNextLevel(level); level++; }
    return { level, into: remaining, needed: xpForNextLevel(level) };
  }
  function rankForLevel(level) {
    if (level >= 30) return "S";
    if (level >= 20) return "A";
    if (level >= 14) return "B";
    if (level >= 9) return "C";
    if (level >= 5) return "D";
    return "E";
  }
  function attributeLevel(xp) {
    let level = 1, remaining = xp;
    while (remaining >= level * 50) { remaining -= level * 50; level++; }
    return { level, into: remaining, needed: level * 50 };
  }
  function todayCompletions() { return state.completions[localDateKey()] || []; }
  function isDone(id) { return todayCompletions().includes(id); }
  function showToast(message, success = true) {
    const toast = $("toast");
    toast.textContent = message;
    toast.className = "toast show" + (success ? " success" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }
  function dateLabel(key) {
    const d = dateFromKey(key);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function render() {
    const lvl = calculateLevel(state.totalXp);
    state.level = lvl.level;
    $("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
    $("playerNameHeading").textContent = state.profile.name;
    $("playerNameCard").textContent = state.profile.name;
    $("playerClass").textContent = state.profile.className || "The Relentless Learner";
    $("avatarInitial").textContent = (state.profile.name.trim()[0] || "P").toUpperCase();
    $("rankChip").textContent = `${rankForLevel(lvl.level)}-RANK`;
    $("levelValue").textContent = lvl.level;
    $("xpText").textContent = `${lvl.into} / ${lvl.needed} XP`;
    $("levelProgress").style.width = `${Math.min(100, lvl.into / lvl.needed * 100)}%`;
    $("totalXp").textContent = state.totalXp.toLocaleString();
    $("questsCleared").textContent = state.totalCleared.toLocaleString();
    $("bestStreak").innerHTML = `${state.streak.best} <small>days</small>`;
    $("currentStreak").textContent = currentStreak();
    $("questCounter").textContent = `${todayCompletions().length} / ${state.quests.length}`;
    renderAttributes();
    renderQuests();
    renderWeek();
    renderAchievements();
    renderHistory();
    const messages = [
      "Your journey begins with one completed quest.",
      "Small actions, repeated consistently, become real progress.",
      "You don't need a perfect day. You need a next step.",
      "Train your skills. Protect your recovery. Keep moving forward.",
      "Your level reflects logged effort—not your value as a person."
    ];
    const index = Math.min(messages.length - 1, Math.floor(state.totalCleared / 5));
    $("systemMessage").textContent = state.totalCleared === 0 ? messages[0] : messages[index];
  }
  function renderAttributes() {
    $("attributesGrid").innerHTML = Object.entries(ATTRS).map(([key, info]) => {
      const a = state.attributes[key] || { xp: 0, level: 1 };
      const progress = attributeLevel(a.xp);
      return `<article class="attribute-card"><div class="attribute-top"><span class="attribute-icon">${info.icon}</span><span class="counter-pill">LV ${progress.level}</span></div><div class="attribute-level">${progress.level}</div><div class="attribute-name">${info.name}</div><div class="attribute-track"><span style="width:${progress.into / progress.needed * 100}%"></span></div><div class="attribute-xp">${progress.into} / ${progress.needed} attribute XP</div></article>`;
    }).join("");
  }
  function renderQuests() {
    const list = $("questList");
    let quests = state.quests;
    if (activeFilter === "open") quests = quests.filter(q => !isDone(q.id));
    if (activeFilter === "done") quests = quests.filter(q => isDone(q.id));
    if (!quests.length) {
      list.innerHTML = `<div class="empty-state">${activeFilter === "done" ? "No quests cleared today yet. Your next win is waiting." : activeFilter === "open" ? "All visible quests cleared. Nice work." : "No quests here yet. Create your first custom quest."}</div>`;
      return;
    }
    list.innerHTML = quests.map(q => {
      const done = isDone(q.id);
      return `<div class="quest-card ${done ? "completed" : ""}">
        <button class="quest-check" data-complete="${escapeHtml(q.id)}" aria-label="${done ? "Undo completion" : "Complete quest"}">${done ? "✓" : "✓"}</button>
        <div class="quest-info"><div class="quest-title">${escapeHtml(q.title)}</div><div class="quest-meta"><span class="tag">${ATTRS[q.attr].name}</span>${q.custom ? '<span class="tag">CUSTOM</span>' : ""}${done ? '<span class="tag">CLEARED TODAY</span>' : ""}</div></div>
        <span class="xp-tag">+${q.xp} XP</span>
        ${q.custom ? `<button class="quest-delete" data-delete="${escapeHtml(q.id)}" title="Delete custom quest" aria-label="Delete custom quest">×</button>` : ""}
      </div>`;
    }).join("");
  }
  function currentStreak() {
    if (!state.streak.lastActive) return 0;
    const diff = daysBetween(state.streak.lastActive, localDateKey());
    if (diff === 0) return state.streak.current;
    if (diff === 1) return state.streak.current;
    return 0;
  }
  function renderWeek() {
    const today = new Date();
    const day = today.getDay();
    const mondayOffset = (day + 6) % 7;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset, 12);
    const names = ["M", "T", "W", "T", "F", "S", "S"];
    $("weekStrip").innerHTML = names.map((name, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12);
      const key = localDateKey(d);
      const done = (state.completions[key] || []).length > 0;
      const isToday = key === localDateKey();
      return `<div class="day-cell ${done ? "active" : ""}"><span>${name}</span><span class="day-dot" title="${dateLabel(key)}">${done ? "✓" : (isToday ? "•" : "—")}</span></div>`;
    }).join("");
  }
  function renderAchievements() {
    const unlocked = ACHIEVEMENTS.filter(a => a.test(state));
    $("achievementCounter").textContent = `${unlocked.length} / ${ACHIEVEMENTS.length}`;
    $("achievementList").innerHTML = ACHIEVEMENTS.map(a => {
      const yes = a.test(state);
      return `<div class="achievement ${yes ? "unlocked" : ""}"><div class="achievement-icon">${a.icon}</div><div class="achievement-copy"><strong>${a.name}</strong><span>${a.description}</span></div><span class="achievement-status">${yes ? "UNLOCKED" : "LOCKED"}</span></div>`;
    }).join("");
  }
  function renderHistory() {
    const list = $("historyList");
    if (!state.history.length) {
      list.innerHTML = '<div class="empty-state">Your completed quests will appear here. Start with one small action.</div>';
      return;
    }
    list.innerHTML = state.history.slice(0, 12).map(h => `<div class="history-row"><div class="history-mark">✓</div><div class="history-copy"><strong>${escapeHtml(h.title)}</strong><span>${escapeHtml(dateLabel(h.date))} · ${escapeHtml(ATTRS[h.attr]?.name || "Quest")}</span></div><span class="history-xp">+${Number(h.xp)} XP</span></div>`).join("");
  }
  function confetti() {
    for (let i = 0; i < 34; i++) {
      const el = document.createElement("span");
      el.className = "confetti";
      el.style.left = `${Math.random() * 100}vw`;
      el.style.top = "-12px";
      el.style.animationDelay = `${Math.random() * .35}s`;
      el.style.background = ["#5ee7f5", "#60a5fa", "#a78bfa", "#68e0ad", "#f5c76b"][i % 5];
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1700);
    }
  }
  function updateStreakAfterCompletion(dateKey) {
    const last = state.streak.lastActive;
    if (last === dateKey) return;
    if (!last) state.streak.current = 1;
    else {
      const diff = daysBetween(last, dateKey);
      state.streak.current = diff === 1 ? state.streak.current + 1 : 1;
    }
    state.streak.lastActive = dateKey;
    state.streak.best = Math.max(state.streak.best, state.streak.current);
  }
  function completeQuest(id) {
    const q = state.quests.find(item => item.id === id);
    if (!q) return;
    const date = localDateKey();
    const completed = new Set(state.completions[date] || []);
    if (completed.has(id)) {
      completed.delete(id);
      state.completions[date] = [...completed];
      // Keep the historical record as a record of completed attempts; undo does not remove earned XP.
      showToast("Quest unchecked for today. Previously earned XP remains in your history.", false);
      saveState(); render(); return;
    }
    const oldLevel = calculateLevel(state.totalXp).level;
    completed.add(id);
    state.completions[date] = [...completed];
    state.totalXp += q.xp;
    state.totalCleared += 1;
    const attr = state.attributes[q.attr];
    attr.xp += q.xp;
    const nextLevel = calculateLevel(state.totalXp).level;
    updateStreakAfterCompletion(date);
    state.history.unshift({ title: q.title, xp: q.xp, attr: q.attr, date, at: new Date().toISOString() });
    state.history = state.history.slice(0, 300);
    const newUnlocks = ACHIEVEMENTS.filter(a => a.test(state) && !state.unlocked.includes(a.id));
    newUnlocks.forEach(a => state.unlocked.push(a.id));
    saveState(); render();
    if (nextLevel > oldLevel) {
      $("avatar").classList.remove("level-up"); void $("avatar").offsetWidth; $("avatar").classList.add("level-up");
      confetti(); showToast(`LEVEL UP! You reached level ${nextLevel}.`, true);
    } else if (newUnlocks.length) {
      confetti(); showToast(`Achievement unlocked: ${newUnlocks[0].name}`, true);
    } else {
      showToast(`Quest cleared. +${q.xp} XP earned.`, true);
    }
  }
  function openDialog(id) { const d = $(id); if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); }
  function closeDialog(id) { const d = $(id); if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); }
  function confirmAction(title, text, actionLabel, callback) {
    $("confirmTitle").textContent = title;
    $("confirmText").textContent = text;
    $("confirmActionBtn").textContent = actionLabel;
    confirmCallback = callback;
    openDialog("confirmDialog");
  }
  function downloadBackup() {
    const blob = new Blob([JSON.stringify({ app: "THE SYSTEM", version: 1, exportedAt: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `the-system-backup-${localDateKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast("Backup exported. Keep that JSON file somewhere safe.", true);
  }
  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = safeState(parsed.state || parsed);
        confirmAction("Import this backup?", "Importing replaces the progress currently saved in this browser. Export a backup first if you want to keep both.", "Import backup", () => {
          state = incoming;
          saveState(); render(); showToast("Backup imported successfully.", true);
        });
      } catch (e) {
        showToast("That file doesn't look like a valid System backup.", false);
      }
      $("importFile").value = "";
    };
    reader.onerror = () => showToast("Could not read that file.", false);
    reader.readAsText(file);
  }
  function wireEvents() {
    $("editProfileBtn").addEventListener("click", () => {
      $("nameInput").value = state.profile.name;
      $("classInput").value = state.profile.className;
      openDialog("profileDialog");
    });
    $("profileForm").addEventListener("submit", e => {
      e.preventDefault();
      const name = $("nameInput").value.trim();
      if (!name) return showToast("Please enter a player name.", false);
      state.profile.name = name.slice(0, 24);
      state.profile.className = $("classInput").value.trim().slice(0, 48) || "The Relentless Learner";
      saveState(); render(); closeDialog("profileDialog"); showToast("Player profile updated.", true);
    });
    $("addQuestBtn").addEventListener("click", () => { $("questForm").reset(); openDialog("questDialog"); });
    $("questForm").addEventListener("submit", e => {
      e.preventDefault();
      const title = $("questTitleInput").value.trim();
      if (!title) return;
      state.quests.push({ id: `custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, title: title.slice(0, 90), attr: $("questAttribute").value, xp: Number($("questXp").value), custom: true });
      saveState(); render(); closeDialog("questDialog"); showToast("Custom quest added.", true);
    });
    document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => closeDialog(btn.dataset.close)));
    document.querySelectorAll(".modal").forEach(dialog => dialog.addEventListener("click", e => {
      if (e.target === dialog) closeDialog(dialog.id);
    }));
    $("confirmForm").addEventListener("submit", e => {
      e.preventDefault(); closeDialog("confirmDialog");
      const cb = confirmCallback; confirmCallback = null; if (cb) cb();
    });
    $("questList").addEventListener("click", e => {
      const completeBtn = e.target.closest("[data-complete]");
      const deleteBtn = e.target.closest("[data-delete]");
      if (completeBtn) completeQuest(completeBtn.dataset.complete);
      if (deleteBtn) {
        const id = deleteBtn.dataset.delete;
        confirmAction("Delete custom quest?", "This removes the quest from your board. Past XP and history will remain.", "Delete quest", () => {
          state.quests = state.quests.filter(q => q.id !== id);
          saveState(); render(); showToast("Custom quest deleted.", true);
        });
      }
    });
    document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === btn));
      renderQuests();
    }));
    $("exportBtn").addEventListener("click", downloadBackup);
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", e => importBackup(e.target.files?.[0]));
    $("clearHistoryBtn").addEventListener("click", () => confirmAction("Clear quest history?", "This deletes the visible activity log only. Your XP, quests, achievements and streak data remain.", "Clear history", () => {
      state.history = []; saveState(); renderHistory(); showToast("History cleared.", true);
    }));
    $("resetBtn").addEventListener("click", () => confirmAction("Reset all progress?", "This permanently clears this browser's System data, including XP, quests, attributes, streaks and history. Export a backup first if you may want to restore it.", "Reset everything", () => {
      state = defaultState(); saveState(); render(); showToast("System reset. A new journey begins.", true);
    }));
    window.addEventListener("storage", e => {
      if (e.key === STORAGE_KEY) { state = loadState(); render(); }
    });
  }

  // Keep streak status accurate when a user returns after one or more inactive days.
  if (state.streak.lastActive && daysBetween(state.streak.lastActive, localDateKey()) > 1) {
    // We preserve best streak and history; current streak display naturally returns to zero.
  }
  wireEvents();
  render();
  saveState();
})();