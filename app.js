(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const storeKey = "cahoots-flat-quizzes-v1";
  let quizzes = [];
  let battery = 20;
  let position = 0;
  const trackLength = 8;
  let toastTimer;

  try { quizzes = JSON.parse(localStorage.getItem(storeKey) || "[]"); } catch (_) { quizzes = []; }
  const toast = (message) => {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  };
  const save = () => { try { localStorage.setItem(storeKey, JSON.stringify(quizzes)); } catch (_) {} };
  function go(page) {
    if (!$(page)) page = "home";
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === page));
    document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (page === "discover") renderQuizzes();
    if (page === "home") renderRecent();
    if (page === "parkour") renderTrack();
  }
  document.addEventListener("click", e => {
    const pageBtn = e.target.closest("[data-page]");
    const goBtn = e.target.closest("[data-go]");
    if (pageBtn) go(pageBtn.dataset.page);
    if (goBtn) go(goBtn.dataset.go);
  });
  function renderRecent() {
    const el = $("recent-list");
    if (!quizzes.length) {
      el.innerHTML = '<div class="recent-item"><strong>Your first big idea goes here.</strong><small>Create a quiz and it will show up here.</small></div><div class="recent-item"><strong>pArKoUr? practice</strong><small>Try the arcade mode and charge your battery.</small></div><div class="recent-item"><strong>More adventures soon</strong><small>Multiplayer features need a connected backend.</small></div>';
      return;
    }
    el.innerHTML = quizzes.slice(-3).reverse().map(q => `<div class="recent-item"><strong>${escapeHtml(q.title)}</strong><small>${escapeHtml(q.description || "A CaHoOtS quiz")} · ${q.questions.length} question(s)</small></div>`).join("");
  }
  function renderQuizzes() {
    const el = $("quiz-grid"), term = ($("search-input").value || "").toLowerCase();
    const list = quizzes.filter(q => (q.title + " " + q.description).toLowerCase().includes(term));
    if (!list.length) {
      el.innerHTML = `<div class="empty-state">${quizzes.length ? "No quizzes match that search." : "No quizzes yet. Be the first quiz-maker in your crew!"}</div>`;
      return;
    }
    el.innerHTML = list.map(q => `<article class="quiz-card"><span class="quiz-symbol">✦</span><strong>${escapeHtml(q.title)}</strong><p>${escapeHtml(q.description || "Ready for a brain quest?")}</p><small>${q.questions.length} question(s) · saved on this device</small><button class="btn btn-primary" data-practice="${q.id}">Practice →</button></article>`).join("");
  }
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }
  $("search-input").addEventListener("input", renderQuizzes);
  $("quiz-grid").addEventListener("click", e => {
    const btn = e.target.closest("[data-practice]"); if (!btn) return;
    const q = quizzes.find(x => x.id === btn.dataset.practice); if (q) startPractice(q);
  });
  $("quiz-form").addEventListener("submit", e => {
    e.preventDefault();
    const title = $("quiz-title").value.trim();
    const question = $("question-text").value.trim();
    const answers = [$("answer-a").value.trim(), $("answer-b").value.trim(), $("answer-c").value.trim(), $("answer-d").value.trim()];
    if (!title || !question || answers.some(a => !a)) { toast("Fill in the title, question, and all four answers."); return; }
    const quiz = { id: (Date.now().toString(36) + Math.random().toString(36).slice(2,7)), title, description: $("quiz-description").value.trim(), questions: [{ text: question, answers, correct: Number($("correct-answer").value) }], createdAt: new Date().toISOString() };
    quizzes.push(quiz); save(); e.target.reset(); renderQuizzes(); renderRecent(); toast("Quiz saved on this device ✦"); go("discover");
  });
  $("join-form").addEventListener("submit", e => {
    e.preventDefault();
    const pin = $("pin-input").value.trim().toUpperCase();
    if (pin.length < 4) { toast("Enter the game PIN your host shared."); return; }
    toast("Room joining needs the multiplayer backend. PIN: " + pin);
  });
  $("signin-btn").addEventListener("click", () => go("signin"));
  $("google-btn").addEventListener("click", () => {
    const cfg = window.CAHOOTS_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      toast("Google sign-in isn't connected yet. The setup guide explains the optional connection.");
      return;
    }
    toast("Auth needs the Supabase client integration before sign-in can work.");
  });
  function startPractice(quiz) {
    const q = quiz.questions[0];
    const answerText = `${q.text}\n\n` + q.answers.map((a,i) => `${String.fromCharCode(65+i)}. ${a}`).join("\n") + "\n\nEnter A, B, C, or D:";
    const answer = window.prompt(answerText);
    if (answer === null) return;
    const picked = answer.trim().toUpperCase().charCodeAt(0) - 65;
    if (picked === q.correct) { toast("Correct! Big brain energy ✦"); battery = Math.min(100, battery + 20); updateBattery(); }
    else toast("Not quite — try another round!");
  }
  function updateBattery() {
    $("battery-value").textContent = battery;
    $("battery-fill").style.width = battery + "%";
  }
  function renderTrack() {
    $("parkour-track").innerHTML = Array.from({length: trackLength}, (_,i) => `<div class="platform ${i === position ? "current" : ""} ${i === trackLength-1 ? "finish" : ""}"></div>`).join("");
    updateBattery();
  }
  $("recharge-btn").addEventListener("click", () => {
    const answer = window.prompt("Quick recharge!\nWhat is 6 × 7?");
    if (answer === null) return;
    if (answer.trim() === "42") { battery = Math.min(100, battery + 20); $("game-message").textContent = "Correct! +20 battery. Time to jump."; toast("Battery charged +20 ⚡"); }
    else { $("game-message").textContent = "Not quite! Try again — 6 × 7 = ?"; toast("No charge this time!"); }
    renderTrack();
  });
  $("move-btn").addEventListener("click", () => {
    if (position >= trackLength - 1) { toast("You already reached the finish! Restart for another run."); return; }
    if (battery < 5) { toast("Not enough battery! Answer correctly to recharge."); return; }
    battery -= 5; position++;
    renderTrack();
    if (position >= trackLength - 1) $("game-message").textContent = "FINISH! You made it! ✦ Restart to run again.";
    else $("game-message").textContent = `Nice jump! ${trackLength - 1 - position} platform(s) to go.`;
  });
  $("restart-game").addEventListener("click", () => { battery = 20; position = 0; $("game-message").textContent = "Fresh run! Answer correctly to recharge, then jump."; renderTrack(); });

  // ----------------------------------------------------------
  // ARCADE MODES: local playable prototypes
  // ----------------------------------------------------------
  const arcadeBank = [
    { q:"Which planet is known as the Red Planet?", a:["Venus","Mars","Jupiter","Mercury"], c:1 },
    { q:"What is 9 × 8?", a:["64","72","81","98"], c:1 },
    { q:"Which ocean is the largest?", a:["Atlantic","Indian","Pacific","Arctic"], c:2 },
    { q:"What gas do plants absorb?", a:["Oxygen","Nitrogen","Carbon dioxide","Hydrogen"], c:2 },
    { q:"How many sides does a hexagon have?", a:["5","6","7","8"], c:1 },
    { q:"Which animal is the largest mammal?", a:["Elephant","Blue whale","Giraffe","Orca"], c:1 },
    { q:"What is the closest star to Earth?", a:["Sirius","The Sun","Proxima Centauri","Polaris"], c:1 },
    { q:"Which language runs in a web browser?", a:["Python","Java","JavaScript","C"], c:2 },
    { q:"What is the square root of 144?", a:["10","11","12","14"], c:2 },
    { q:"Which shape has three sides?", a:["Square","Triangle","Pentagon","Circle"], c:1 }
  ];
  const arcadeModes = {
    blitz: { title:"BLITZ!", desc:"A quick-fire brain sprint. Beat the clock and collect points.", rounds:5 },
    survival: { title:"LAST BRAIN STANDING", desc:"You have 3 lives. One wrong answer costs a life. How long can you last?", rounds:10 },
    boss: { title:"QUIZ RAID", desc:"A knowledge monster has 5 HP. Each correct answer deals 1 damage.", rounds:5 },
    streak: { title:"STREAK MACHINE", desc:"Build a combo. Every correct answer increases your streak score.", rounds:8 },
    memory: { title:"MEMORY FLIP", desc:"Study a short sequence, then choose the matching pattern.", rounds:5 }
  };
  let arcadeMode = "blitz", arcadeRound = 0, arcadeScore = 0, arcadeLives = 3, arcadeCombo = 0, arcadeBossHp = 5, arcadeLocked = false, arcadeQuestion = null;
  function shuffledBank() { return [...arcadeBank].sort(() => Math.random() - .5); }
  let arcadeDeck = shuffledBank();
  function startArcade(mode) {
    arcadeMode = mode; arcadeRound = 0; arcadeScore = 0; arcadeLives = 3; arcadeCombo = 0; arcadeBossHp = 5; arcadeLocked = false; arcadeDeck = shuffledBank();
    const info = arcadeModes[mode]; if (!info) return;
    $("arcade-title").textContent = info.title;
    $("arcade-description").textContent = info.desc;
    $("arcade-eyebrow").textContent = "ARCADE / " + mode.toUpperCase();
    go("arcade"); loadArcadeQuestion();
  }
  function loadArcadeQuestion() {
    const info = arcadeModes[arcadeMode];
    if (arcadeRound >= info.rounds || (arcadeMode === "survival" && arcadeLives <= 0) || (arcadeMode === "boss" && arcadeBossHp <= 0)) { finishArcade(); return; }
    arcadeLocked = false;
    arcadeQuestion = arcadeDeck[arcadeRound % arcadeDeck.length];
    $("arcade-next").disabled = true;
    $("arcade-next").textContent = arcadeRound === info.rounds - 1 ? "See results ✦" : "Next challenge →";
    $("arcade-feedback").textContent = arcadeMode === "memory" ? "Memory Flip: memorize the correct answer letter, then answer the question." : "Lock in your answer!";
    $("arcade-question").textContent = arcadeQuestion.q;
    $("arcade-answers").innerHTML = arcadeQuestion.a.map((a,i) => `<button class="arcade-answer" data-answer="${i}">${String.fromCharCode(65+i)} · ${escapeHtml(a)}</button>`).join("");
    updateArcadeStats();
  }
  function updateArcadeStats() {
    const parts = [`ROUND ${Math.min(arcadeRound+1, arcadeModes[arcadeMode].rounds)}`, `SCORE ${arcadeScore}`];
    if (arcadeMode === "survival") parts.push(`LIVES ${"♥".repeat(arcadeLives)}${"♡".repeat(3-arcadeLives)}`);
    if (arcadeMode === "streak") parts.push(`COMBO ×${arcadeCombo}`);
    if (arcadeMode === "boss") parts.push(`BOSS HP ${arcadeBossHp}`);
    $("arcade-stat-one").textContent = parts[0] + "  ·  " + (parts[2] || "");
    $("arcade-stat-two").textContent = parts[1];
  }
  $("arcade-answers").addEventListener("click", e => {
    const btn = e.target.closest("[data-answer]"); if (!btn || arcadeLocked) return;
    arcadeLocked = true;
    const chosen = Number(btn.dataset.answer), correct = chosen === arcadeQuestion.c;
    [...$("arcade-answers").querySelectorAll("button")].forEach((b,i) => {
      b.disabled = true;
      if (i === arcadeQuestion.c) b.classList.add("correct");
      else if (i === chosen) b.classList.add("wrong");
    });
    if (correct) {
      const bonus = arcadeMode === "streak" ? 100 * (arcadeCombo + 1) : arcadeMode === "blitz" ? 150 : 100;
      arcadeScore += bonus; arcadeCombo++;
      if (arcadeMode === "boss") arcadeBossHp--;
      $("arcade-feedback").textContent = `CORRECT! +${bonus} points${arcadeMode === "streak" ? " · combo ×" + arcadeCombo : ""}`;
    } else {
      arcadeCombo = 0;
      if (arcadeMode === "survival") arcadeLives--;
      $("arcade-feedback").textContent = arcadeMode === "survival" ? `Oof! One life lost. ${arcadeLives} left.` : "Not quite! The correct answer is highlighted.";
    }
    arcadeRound++;
    updateArcadeStats();
    $("arcade-next").disabled = false;
  });
  $("arcade-next").addEventListener("click", () => { if (!arcadeLocked) return; loadArcadeQuestion(); });
  function finishArcade() {
    $("arcade-question").textContent = arcadeMode === "boss" && arcadeBossHp <= 0 ? "BOSS DEFEATED! 🐉" : arcadeMode === "survival" && arcadeLives <= 0 ? "GAME OVER — RUN ENDED" : "CHALLENGE COMPLETE! ✦";
    $("arcade-answers").innerHTML = "";
    $("arcade-feedback").textContent = `Final score: ${arcadeScore}. ${arcadeMode === "streak" ? "Best combo: " + arcadeCombo + "." : "Nice run, player!"}`;
    $("arcade-next").disabled = false; $("arcade-next").textContent = "Play again ↻";
    $("arcade-next").onclick = () => startArcade(arcadeMode);
  }
  document.querySelectorAll("[data-mode]").forEach(card => card.addEventListener("click", () => {
    if (card.dataset.mode === "parkour") { go("parkour"); return; }
    startArcade(card.dataset.mode);
  }));

  renderRecent(); renderQuizzes(); renderTrack();
})();