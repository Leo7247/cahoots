(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const storeKey = "cahoots-flat-quizzes-v1";
  let quizzes = [];
  let battery = 20;
  let position = 0;
  const trackLength = 8;
  let toastTimer;
  let supabaseClient = null;
  let currentSession = null;

  try { quizzes = JSON.parse(localStorage.getItem(storeKey) || "[]"); } catch (_) { quizzes = []; }
  const toast = (message) => {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  };
  const save = () => { try { localStorage.setItem(storeKey, JSON.stringify(quizzes)); } catch (_) {} if(window.CAHOOTS_API) window.CAHOOTS_API.quizzes=quizzes; };
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
  // Multi-question quiz studio. Every question stores its own point value.
  let draftQuestionCount = 0;
  function addQuestionCard() {
    if (draftQuestionCount >= 40) { toast("A quiz can have up to 40 questions."); return; }
    const n = ++draftQuestionCount;
    const wrap = document.createElement("section");
    wrap.className = "question-editor"; wrap.dataset.question = String(n);
    wrap.innerHTML = `<div class="question-head"><h2>Question ${n}</h2><button type="button" class="text-button" data-remove-question="${n}">Remove</button></div>
      <label>Question text<input data-qtext maxlength="240" placeholder="Write question ${n}…" required></label>
      <div class="answer-grid">${[0,1,2,3].map(i=>`<label class="answer-option"><span>${"ABCD"[i]}</span><input data-answer="${i}" placeholder="Answer ${"ABCD"[i]}" required></label>`).join("")}</div>
      <div class="question-settings"><label>Correct answer<select data-correct><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label><label>Points for this question<select data-points><option value="100">100 points</option><option value="200">200 points</option><option value="300">300 points</option><option value="500">500 points</option><option value="750">750 points</option><option value="1000">1,000 points</option><option value="1500">1,500 points</option><option value="2000">2,000 points</option></select></label></div>`;
    $("question-builder").appendChild(wrap);
  }
  function renumberQuestionCards() {
    [...document.querySelectorAll(".question-editor")].forEach((card,i)=>{
      card.querySelector(".question-head h2").textContent = `Question ${i+1}`;
    });
  }
  $("add-question").addEventListener("click", addQuestionCard);
  $("question-builder").addEventListener("click", e=>{
    const b=e.target.closest("[data-remove-question]"); if(!b) return;
    const cards=document.querySelectorAll(".question-editor");
    if(cards.length<=1){toast("Keep at least one question in your quiz.");return;}
    b.closest(".question-editor").remove(); renumberQuestionCards();
  });
  $("quiz-form").addEventListener("submit", e => {
    e.preventDefault();
    const title = $("quiz-title").value.trim();
    const cards = [...document.querySelectorAll(".question-editor")];
    const questions = cards.map(card=>({
      text:card.querySelector("[data-qtext]").value.trim(),
      answers:[...card.querySelectorAll("[data-answer]")].map(x=>x.value.trim()),
      correct:Number(card.querySelector("[data-correct]").value),
      points:Number(card.querySelector("[data-points]").value)||100
    }));
    if(!title || !questions.length || questions.some(q=>!q.text || q.answers.length!==4 || q.answers.some(a=>!a))){toast("Fill in every question and all four answers.");return;}
    const quiz={id:(Date.now().toString(36)+Math.random().toString(36).slice(2,7)),title,description:$("quiz-description").value.trim(),questions,createdAt:new Date().toISOString()};
    quizzes.push(quiz); save(); e.target.reset(); $("question-builder").innerHTML=""; draftQuestionCount=0; addQuestionCard();
    renderQuizzes();renderRecent();toast(`Quiz saved: ${questions.length} questions ✦`);go("discover");
  });
  addQuestionCard();
  $("signin-btn").addEventListener("click", async () => {
    if (currentSession && supabaseClient) {
      const { error } = await supabaseClient.auth.signOut();
      if (error) toast("Sign-out failed: " + error.message);
      else toast("Signed out. See you next round!");
      return;
    }
    go("signin");
  });
  $("google-btn").addEventListener("click", async () => {
    if (!supabaseClient) {
      toast("Supabase client isn't ready. Check your connection and config.js.");
      return;
    }
    const button = $("google-btn");
    button.disabled = true;
    button.textContent = "Opening Google…";
    const cfg = window.CAHOOTS_CONFIG || {};
    const redirectTo = cfg.siteUrl || (window.location.origin + window.location.pathname);
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    if (error) {
      toast("Google sign-in error: " + error.message);
      button.disabled = false;
      button.textContent = "Continue with Google";
    }
  });

  async function initSupabaseAuth() {
    const cfg = window.CAHOOTS_CONFIG || {};
    const note = $("auth-note");
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase || !window.supabase.createClient) {
      note.textContent = "Supabase couldn't load. Check your internet connection and public config values.";
      return;
    }
    try {
      supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      currentSession = data.session;
      updateAuthUI();
      supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentSession = session;
        updateAuthUI();
      });
      note.textContent = "Use Google to sign in. Your session will stay on this device until you sign out.";
    } catch (error) {
      note.textContent = "Supabase setup issue: " + error.message;
      toast("Couldn't initialize Supabase authentication.");
    }
  }
  function updateAuthUI() {
    window.CAHOOTS_API = { client: supabaseClient, session: currentSession, quizzes };
    window.dispatchEvent(new Event("cahoots-auth-ready"));
    const user = currentSession && currentSession.user;
    $("user-label").textContent = user ? (user.user_metadata?.full_name || user.email || "CaHoOtS player") : "Guest player";
    $("signin-btn").textContent = user ? "Sign out" : "Sign in";
    $("google-btn").textContent = user ? "You're signed in ✓" : "Continue with Google";
    $("google-btn").disabled = !!user;
    $("signin-description").textContent = user ? "Welcome to the crew! Your Google account is connected." : "Sign in with Google to start building your CaHoOtS identity.";
    $("auth-note").textContent = user ? "Signed in as " + (user.email || "your Google account") + "." : "Your local practice quizzes remain saved on this device.";
  }
  function startPractice(quiz) {
    let score=0, index=0;
    function askNext(){
      if(index>=quiz.questions.length){toast(`Practice complete! ${score} points from ${quiz.questions.length} questions.`);return;}
      const q=quiz.questions[index];
      const answerText=`${quiz.title} · Question ${index+1}/${quiz.questions.length} · ${q.points||100} pts\n\n${q.text}\n\n`+q.answers.map((a,i)=>`${String.fromCharCode(65+i)}. ${a}`).join("\n")+"\n\nEnter A, B, C, or D:";
      const answer=window.prompt(answerText); if(answer===null)return;
      const picked=answer.trim().toUpperCase().charCodeAt(0)-65;
      if(picked===q.correct){score+=Number(q.points)||100;battery=Math.min(100,battery+20);updateBattery();toast(`Correct! +${q.points||100} points ✦`);}else toast("Not quite — next question!");
      index++; if(index<quiz.questions.length) askNext(); else toast(`Finished! Score: ${score} points.`);
    } askNext();
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
    { q:"A spacecraft is travelling from Earth toward Mars. Why can the journey take months even at very high speed?", a:["Mars is extremely far away and both planets move in orbit","Mars has a thick atmosphere that slows spacecraft","Spacecraft must stop at every planet","The Sun pulls spacecraft to a complete stop"], c:0, cat:"SPACE", why:"Earth and Mars are separated by vast distances, and both planets continue moving around the Sun while the spacecraft travels." },
    { q:"A café bill is $36. You leave a 20% tip. What is the total?", a:["$40.20","$42.20","$43.20","$46.00"], c:2, cat:"MATH", why:"20% of $36 is $7.20. Add the tip to the bill: $36 + $7.20 = $43.20." },
    { q:"Which change would help a sealed bottle of cold water warm up fastest?", a:["Wrap it in a thick towel","Place it in a warm-water bath","Put it in a cooler","Cover it with ice"], c:1, cat:"SCIENCE", why:"Warm water transfers thermal energy to the bottle much faster than insulating it or surrounding it with ice." },
    { q:"A map uses a scale of 1 cm = 5 km. Two towns are 7.4 cm apart on the map. What is the real distance?", a:["12.4 km","25 km","35 km","37 km"], c:3, cat:"MATH", why:"Multiply the map distance by the scale: 7.4 × 5 = 37 km." },
    { q:"Why do we see lightning before hearing thunder?", a:["Light travels much faster than sound","Thunder happens after lightning","Clouds block sound for a moment","Lightning is closer than the storm"], c:0, cat:"SCIENCE", why:"Light reaches your eyes almost instantly over storm distances, while sound travels much more slowly through air." },
    { q:"Which sentence uses the word 'reluctant' correctly?", a:["She was reluctant, so she eagerly volunteered first","He felt reluctant and hesitated before speaking","The reluctant cake tasted sweet","They reluctanted across the field"], c:1, cat:"LANGUAGE", why:"Reluctant means unwilling or hesitant. Pausing before speaking fits that meaning." },
    { q:"A game gives 80 points, then applies a 25% bonus. What is the new score?", a:["85","90","100","105"], c:2, cat:"MATH", why:"25% of 80 is 20, so the bonus raises the score to 100." },
    { q:"Which part of a plant mainly absorbs water from the soil?", a:["Petals","Leaves","Roots","Fruit"], c:2, cat:"BIOLOGY", why:"Roots, especially their tiny root hairs, absorb water and dissolved minerals from the soil." },
    { q:"A rectangle has a perimeter of 30 cm and a length of 9 cm. What is its width?", a:["5 cm","6 cm","11 cm","12 cm"], c:1, cat:"MATH", why:"Perimeter is 2 × (length + width). So 15 = 9 + width, giving 6 cm." },
    { q:"Which event is the clearest example of a physical change?", a:["Iron rusting","Wood burning","Ice melting","An egg cooking"], c:2, cat:"SCIENCE", why:"Melting changes water's state from solid to liquid but does not create a new substance." },
    { q:"In a food chain, what is the main role of a producer?", a:["Hunt other animals","Make food using an energy source","Break down rocks","Eat only dead organisms"], c:1, cat:"ECOLOGY", why:"Producers such as plants capture energy, usually from sunlight, and make organic food." },
    { q:"A train travels 150 km in 2.5 hours. What is its average speed?", a:["50 km/h","55 km/h","60 km/h","75 km/h"], c:2, cat:"MATH", why:"Average speed equals distance divided by time: 150 ÷ 2.5 = 60 km/h." },
    { q:"Which planet has the most prominent ring system in our solar system?", a:["Jupiter","Saturn","Neptune","Earth"], c:1, cat:"SPACE", why:"All four giant planets have rings, but Saturn's are by far the brightest and most visually prominent." },
    { q:"What is the best first step when evaluating a surprising online claim?", a:["Share it quickly","Check the original source and supporting evidence","Trust the number of likes","Assume a confident headline is accurate"], c:1, cat:"MEDIA LITERACY", why:"Tracing a claim to its original source and checking evidence helps separate reliable reporting from repetition or hype." },
    { q:"A number is multiplied by 3, then 4 is added. The result is 25. What was the original number?", a:["5","6","7","9"], c:2, cat:"MATH", why:"Work backward: 25 − 4 = 21, then 21 ÷ 3 = 7." },
    { q:"Which process moves water from plant leaves into the air?", a:["Condensation","Transpiration","Precipitation","Infiltration"], c:1, cat:"BIOLOGY", why:"Transpiration is the release of water vapor from plant tissues, mainly through tiny openings in leaves." },
    { q:"Why are coastal areas often milder in temperature than inland areas?", a:["Ocean water heats and cools more slowly than land","The ocean blocks all sunlight","Coastal air contains no moisture","Land receives less gravity"], c:0, cat:"EARTH SCIENCE", why:"Water has a high heat capacity, so the ocean changes temperature more slowly and moderates nearby air." },
    { q:"Which value is greatest?", a:["0.62","5/8","61%","0.605"], c:1, cat:"MATH", why:"5/8 = 0.625, which is greater than 0.62, 0.61, and 0.605." },
    { q:"A student repeats an experiment several times and gets similar results. What does this most directly improve?", a:["Reliability","The hypothesis being true","The sample size of the universe","The experiment's popularity"], c:0, cat:"SCIENCE", why:"Repeatedly obtaining similar results makes the measurements more consistent and improves reliability." },
    { q:"Which sentence is the strongest evidence-based conclusion?", a:["This method always works for everyone","The results suggest the method helped in this small test","I like this method, so it must be best","One result proves the rule forever"], c:1, cat:"CRITICAL THINKING", why:"It reports what the limited evidence supports without claiming more certainty or generality than the test allows." }
  ];
  const arcadeModes = {
    blitz: { title:"BLITZ!", desc:"A quick-fire brain sprint. Beat the clock and collect points.", rounds:5 },
    survival: { title:"LAST BRAIN STANDING", desc:"You have 3 lives. One wrong answer costs a life. How long can you last?", rounds:10 },
    boss: { title:"QUIZ RAID", desc:"A knowledge monster has 5 HP. Each correct answer deals 1 damage.", rounds:5 },
    streak: { title:"STREAK MACHINE", desc:"Build a combo. Every correct answer increases your streak score.", rounds:8 },
    memory: { title:"MEMORY FLIP", desc:"Study a short sequence, then choose the matching pattern.", rounds:5 }
  };
  let arcadeMode = "blitz", arcadeRound = 0, arcadeScore = 0, arcadeLives = 3, arcadeCombo = 0, arcadeBossHp = 5, arcadeLocked = false, arcadeQuestion = null, arcadeTimer = null, arcadeSeconds = 15;
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
    clearInterval(arcadeTimer);
    arcadeQuestion = arcadeDeck[arcadeRound % arcadeDeck.length];
    arcadeSeconds = arcadeMode === "blitz" ? 10 : 15;
    $("arcade-timer").textContent = arcadeSeconds + "s";
    $("arcade-timer").classList.remove("urgent");
    $("arcade-category").textContent = arcadeQuestion.cat || "BRAIN QUEST";
    $("arcade-progress-fill").style.width = (arcadeRound / info.rounds * 100) + "%";
    $("arcade-next").disabled = true;
    $("arcade-next").textContent = arcadeRound === info.rounds - 1 ? "See results ✦" : "Next challenge →";
    $("arcade-feedback").textContent = "Choose carefully. You'll get an explanation after you answer.";
    $("arcade-question").textContent = arcadeQuestion.q;
    $("arcade-answers").innerHTML = arcadeQuestion.a.map((a,i) => `<button class="arcade-answer" data-answer="${i}"><span class="answer-letter">${String.fromCharCode(65+i)}</span><span>${escapeHtml(a)}</span></button>`).join("");
    updateArcadeStats();
    arcadeTimer = setInterval(() => {
      if (arcadeLocked) return;
      arcadeSeconds--;
      $("arcade-timer").textContent = arcadeSeconds + "s";
      if (arcadeSeconds <= 5) $("arcade-timer").classList.add("urgent");
      if (arcadeSeconds <= 0) submitArcadeAnswer(-1, true);
    }, 1000);
  }
  function updateArcadeStats() {
    const parts = [`ROUND ${Math.min(arcadeRound+1, arcadeModes[arcadeMode].rounds)}`, `SCORE ${arcadeScore}`];
    if (arcadeMode === "survival") parts.push(`LIVES ${"♥".repeat(arcadeLives)}${"♡".repeat(3-arcadeLives)}`);
    if (arcadeMode === "streak") parts.push(`COMBO ×${arcadeCombo}`);
    if (arcadeMode === "boss") parts.push(`BOSS HP ${arcadeBossHp}`);
    $("arcade-stat-one").textContent = parts[0] + "  ·  " + (parts[2] || "");
    $("arcade-stat-two").textContent = parts[1];
  }
  function submitArcadeAnswer(chosen, timedOut = false) {
    if (arcadeLocked) return;
    arcadeLocked = true; clearInterval(arcadeTimer);
    const correct = chosen === arcadeQuestion.c;
    [...$("arcade-answers").querySelectorAll("button")].forEach((b,i) => {
      b.disabled = true;
      if (i === arcadeQuestion.c) b.classList.add("correct");
      else if (i === chosen) b.classList.add("wrong");
    });
    if (correct) {
      const speedBonus = Math.max(0, arcadeSeconds) * 5;
      const bonus = (arcadeMode === "streak" ? 100 * (arcadeCombo + 1) : arcadeMode === "blitz" ? 100 : 100) + speedBonus;
      arcadeScore += bonus; arcadeCombo++;
      if (arcadeMode === "boss") arcadeBossHp--;
      $("arcade-feedback").innerHTML = `<strong class="feedback-good">NICE! +${bonus} POINTS</strong><span>${escapeHtml(arcadeQuestion.why || "You selected the correct answer.")}</span>`;
    } else {
      arcadeCombo = 0;
      if (arcadeMode === "survival") arcadeLives--;
      const intro = timedOut ? "TIME'S UP." : "NOT QUITE.";
      $("arcade-feedback").innerHTML = `<strong class="feedback-bad">${intro}</strong><span>${escapeHtml(arcadeQuestion.why || "Review the highlighted correct answer and try another round.")}</span>`;
    }
    arcadeRound++;
    $("arcade-progress-fill").style.width = (arcadeRound / arcadeModes[arcadeMode].rounds * 100) + "%";
    updateArcadeStats();
    $("arcade-next").disabled = false;
  }
  $("arcade-answers").addEventListener("click", e => {
    const btn = e.target.closest("[data-answer]"); if (!btn || arcadeLocked) return;
    submitArcadeAnswer(Number(btn.dataset.answer));
  });
  $("arcade-next").addEventListener("click", () => { if (!arcadeLocked) return; loadArcadeQuestion(); });
  function finishArcade() {
    clearInterval(arcadeTimer);
    $("arcade-progress-fill").style.width = "100%";
    $("arcade-timer").textContent = "DONE";
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

  renderRecent(); renderQuizzes(); renderTrack(); initSupabaseAuth();
})();