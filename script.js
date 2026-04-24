// Variabili globali iniziali (vuote)
let questions = [];
let userAnswers = [];
let currentQuestionIndex = 0;

// Array dei partiti (rimane invariato)
let parties = [];

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Funzione asincrona per caricare il JSON
async function initApp() {
  try {
    const partiesRes = await fetch("parties.json");
    if (!partiesRes.ok)
      throw new Error(`Errore HTTP! stato: ${partiesRes.status}`);
    parties = await partiesRes.json();

    // 1. Controllo se c'è un salvataggio in memoria
    const savedState = sessionStorage.getItem("politicalTestState");

    if (savedState) {
      const state = JSON.parse(savedState);
      questions = state.questions;
      userAnswers = state.userAnswers;
      currentQuestionIndex = state.currentQuestionIndex;

      // Se avevi già finito il test, vai direttamente ai risultati!
      if (state.isFinished) {
        calculateResults();
        return; // Interrompe qui
      }
      // Se eri a metà del quiz, ti riporta alla domanda esatta
      else if (Object.keys(userAnswers).length > 0) {
        document.getElementById("start-screen").classList.remove("active");
        document.getElementById("quiz-screen").classList.add("active");
        document.getElementById("total-q-num").innerText = questions.length;
        showQuestion();
        return; // Interrompe qui
      }
    }

    // 2. Comportamento standard se non c'è nessun salvataggio

    const response = await fetch("questions.json");
    if (!response.ok) throw new Error(`Errore HTTP! stato: ${response.status}`);
    questions = await response.json();

    shuffleArray(questions);
    userAnswers = {};

    const startBtn = document.getElementById("start-btn");
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerText = "Inizia il Test";
    }
  } catch (error) {
    console.error("Errore nel caricamento:", error);
  }
}

// Avvia il caricamento appena la pagina HTML è pronta
window.onload = initApp;

function startTest() {
  document.getElementById("start-screen").classList.remove("active");
  document.getElementById("quiz-screen").classList.add("active");
  document.getElementById("total-q-num").innerText = questions.length;
  showQuestion();
}

function showQuestion() {
  const q = questions[currentQuestionIndex];

  document.getElementById("question-text").innerText = q.text;
  document.getElementById("arg-pro-text").innerText = q.pro;
  document.getElementById("arg-con-text").innerText = q.con;
  document.getElementById("current-q-num").innerText = currentQuestionIndex + 1;

  document.getElementById("btn-prev").disabled = currentQuestionIndex === 0;

  if (currentQuestionIndex === questions.length - 1) {
    document.getElementById("btn-next").innerText = "Vedi Risultati";
  } else {
    document.getElementById("btn-next").innerText = "Avanti";
  }

  const buttons = document.querySelectorAll(".option-btn");
  buttons.forEach((btn) => btn.classList.remove("selected"));

  // Controlla se esiste già una risposta salvata per l'ID di questa domanda
  if (userAnswers[q.id] !== undefined) {
    const savedValue = userAnswers[q.id] / q.multiplier;
    const values = [2, 1, 0, -1, -2];
    const buttonIndex = values.indexOf(savedValue);
    if (buttonIndex !== -1) buttons[buttonIndex].classList.add("selected");
  }
}

function selectAnswer(value, btnElement) {
  const q = questions[currentQuestionIndex];
  // Salva usando l'ID della domanda come chiave
  userAnswers[q.id] = value * q.multiplier;

  document
    .querySelectorAll(".option-btn")
    .forEach((btn) => btn.classList.remove("selected"));
  btnElement.classList.add("selected");

  saveState();
}

function goNext() {
  const q = questions[currentQuestionIndex];

  // Controlla se la domanda corrente ha una risposta
  if (userAnswers[q.id] === undefined) {
    alert("Seleziona una risposta prima di procedere.");
    return;
  }

  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    saveState();
    showQuestion();
  } else {
    calculateResults();
  }
}

function goPrevious() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    saveState();
    showQuestion();
  }
}

// La funzione calculateResults() rimane invariata dal messaggio precedente!

// Calcolo finale
function calculateResults() {
  // 1. Inizializza i punteggi
  let rawScores = {
    economia: 0,
    autorita: 0,
    identita: 0,
    nazione: 0,
    giustizia: 0,
    ambiente: 0,
  };

  // 2. Somma i punteggi dalle risposte dell'utente
  questions.forEach((q) => {
    if (userAnswers[q.id] !== undefined) {
      rawScores[q.axis] += userAnswers[q.id];
    }
  });

  // 3. Normalizza i punteggi su una scala da -10 a +10
  let normalizedScores = {};
  for (let axis in rawScores) {
    // Supponendo 5 domande per asse, il max è 10.
    // Se il numero di domande varia, la formula si adatta.
    normalizedScores[axis] = Math.max(-10, Math.min(10, rawScores[axis]));
  }

  // 4. CALCOLO AFFINITÀ PESATA
  let bestMatch = null;
  let minDistance = Infinity;

  // Configurazione Pesi: Economia e Autorità dominano la scelta
  const weights = {
    economia: 2.5,
    autorita: 2.5,
    identita: 2.5,
    nazione: 1.0,
    giustizia: 0.8,
    ambiente: 0.8,
  };

  // Creiamo un array di oggetti che contiene partito e distanza calcolata
  let partyDistances = parties.map((party) => {
    let weightedSumOfSquares = 0;
    for (let axis in normalizedScores) {
      let diff = normalizedScores[axis] - party.axes[axis];
      weightedSumOfSquares += diff * diff * (weights[axis] || 1.0);
    }
    return {
      ...party,
      distance: Math.sqrt(weightedSumOfSquares),
    };
  });

  // Ordiniamo i partiti dal più vicino (distanza minore) al più lontano
  partyDistances.sort((a, b) => a.distance - b.distance);

  // Prendiamo i primi 3 e gli ultimi 3
  const top3 = partyDistances.slice(0, 3);
  const bottom3 = partyDistances.slice(-3).reverse(); // Invertiamo per avere il più lontano per primo

  showResults(normalizedScores, top3, bottom3);
}

function showResults(scores, top3, bottom3) {
  document.getElementById("start-screen").classList.remove("active");
  document.getElementById("quiz-screen").classList.remove("active");
  document.getElementById("results-screen").classList.add("active");

  drawCompass(scores.economia, scores.autorita);
  drawExtraAxes(scores);

  // Genera l'HTML per i Top 3
  const topContainer = document.getElementById("closest-party-container");
  topContainer.innerHTML = top3
    .map(
      (party, index) => `
        <div class="party-card ${index === 0 ? "winner" : ""}">
            <img src="${party.logo}" alt="${party.name}" class="result-logo">
            <div class="party-name">${party.name}</div>
            <div class="match-percent">${Math.round(100 - party.distance)}% affinità</div>
        </div>
    `,
    )
    .join("");

  // Genera l'HTML per i Bottom 3
  const bottomContainer = document.getElementById("farthest-party-container");
  bottomContainer.innerHTML = bottom3
    .map(
      (party) => `
        <div class="party-card opposition">
            <img src="${party.logo}" alt="${party.name}" class="result-logo">
            <div class="party-name">${party.name}</div>
        </div>
    `,
    )
    .join("");

  // Popola i punteggi numerici
  const numContainer = document.getElementById("numeric-scores-container");
  numContainer.innerHTML = Object.entries(scores)
    .map(
      ([key, val]) => `
    <div class="score-row">
        <span>${key.charAt(0).toUpperCase() + key.slice(1)}:</span>
        <span class="score-val">${val.toFixed(1)}</span>
    </div>
`,
    )
    .join("");

  saveState(true);
}

function drawCompass(userX, userY) {
  const canvas = document.getElementById("compass-canvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  // Disegna solo lo sfondo (i punti li facciamo in HTML)
  ctx.fillStyle = "#ffcccc";
  ctx.fillRect(0, 0, w / 2, h / 2);
  ctx.fillStyle = "#cce5ff";
  ctx.fillRect(w / 2, 0, w / 2, h / 2);
  ctx.fillStyle = "#ccffcc";
  ctx.fillRect(0, h / 2, w / 2, h / 2);
  ctx.fillStyle = "#ffffcc";
  ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.stroke();

  const overlay = document.getElementById("compass-overlay");
  overlay.innerHTML = ""; // Pulisci

  // POSIZIONA I LOGHI DEI PARTITI SULLA BUSSOLA
  parties.forEach((party) => {
    let px = ((party.axes.economia + 10) / 20) * 100;
    let py = (1 - (party.axes.autorita + 10) / 20) * 100; // Y invertito
    overlay.innerHTML += `<img src="${party.logo}" class="party-logo-compass" title="${party.name}" style="left: ${px}%; top: ${py}%;">`;
  });

  // POSIZIONA L'UTENTE (Viene disegnato DOPO, quindi starà SOPRA)
  let uX = ((userX + 10) / 20) * 100;
  let uY = (1 - (userY + 10) / 20) * 100;
  overlay.innerHTML += `<div class="user-dot-compass" style="left: ${uX}%; top: ${uY}%;"></div>`;
}

function drawExtraAxes(scores) {
  const container = document.getElementById("extra-axes-container");
  container.innerHTML = "<h3>Assi Aggiuntivi</h3>";

  // Aggiunto "title" per l'intestazione e "gradient" per i colori a tema
  const axesDef = [
    {
      key: "identita",
      title: "Identità e Cultura",
      leftLabel: "Progressismo",
      rightLabel: "Tradizionalismo",
      leftIcon:
        '<i class="fa-solid fa-rainbow" style="color: #e6235aff;"></i>&nbsp;<i class="fa-solid fa-peace" style="color: #e6235aff;"></i>',
      rightIcon:
        '<i class="fa-solid fa-building-columns" style="color: #440098ff;"></i>&nbsp;<i class="fa-solid fa-people-roof" style="color: #440098ff;"></i>',
      gradient: "linear-gradient(90deg, #e6235aff 0%, #440098ff 100%)", // Magenta chiaro -> Viola scuro
    },
    { 
        key: 'nazione', 
        title: 'Nazione e Mondo',
        leftLabel: 'Internazionalismo', rightLabel: 'Nazionalismo',
        leftIcon: '<img src="img/eu.png" style="width: 26px; border-radius: 4px; box-shadow: 0 0 0 2px #40e0b5ff; vertical-align: middle;">&nbsp;<img src="img/un.png" style="width: 26px; border-radius: 4px; box-shadow: 0 0 0 2px #40e0b5ff; vertical-align: middle;">', 
        rightIcon: '<img src="img/it.png" style="width: 26px; border-radius: 4px; box-shadow: 0 0 0 2px #07008eff; vertical-align: middle;">&nbsp;<i class="fa-solid fa-shield-halved" style="color: #07008eff; vertical-align: middle;"></i>', 
        gradient: 'linear-gradient(90deg, #40e0b5ff 0%, #07008eff 100%)' 
    },
    {
      key: "giustizia",
      title: "Giustizia",
      leftLabel: "Riabilitativa",
      rightLabel: "Punitiva",
      leftIcon:
        '<i class="fa-solid fa-hand-holding-heart" style="color: #a6cd32ff;"></i>&nbsp;<i class="fa-solid fa-book-open" style="color: #a6cd32ff;"></i>',
      rightIcon:
        '<i class="fa-solid fa-handcuffs" style="color: #a20000ff;"></i></i>&nbsp;<i class="fa-solid fa-gavel" style="color: #a20000ff;"></i>',
      gradient: "linear-gradient(90deg, #a6cd32ff 0%, #a20000ff 100%)", // Verde-giallo -> Rosso scuro
    },
    {
      key: "ambiente",
      title: "Ambiente e Produzione",
      leftLabel: "Ecologismo",
      rightLabel: "Produttivismo",
      leftIcon:
        '<i class="fa-solid fa-leaf" style="color: #32cd32;"></i>&nbsp;<i class="fa-solid fa-recycle" style="color: #32cd32;"></i>',
      rightIcon:
        '<i class="fa-solid fa-industry" style="color: #614d3aff;"></i>&nbsp;<i class="fa-solid fa-gear" style="color: #614d3aff;"></i>',
      gradient: "linear-gradient(90deg, #32cd32 0%, #614d3aff 100%)", // Verde brillante -> Grigio industriale
    },
  ];

  axesDef.forEach((axis) => {
    let score = scores[axis.key];
    let percentPos = ((score + 10) / 20) * 100;

    // GENERA I LOGHI DEI PARTITI PER QUESTO ASSE
    let partyLogosHTML = "";
    parties.forEach((party) => {
      let pScore = party.axes[axis.key];
      let pPercent = ((pScore + 10) / 20) * 100;
      partyLogosHTML += `<img src="${party.logo}" class="party-logo-axis" title="${party.name}" style="left: ${pPercent}%;">`;
    });

    let html = `
            <div class="axis-row">
                <h4 style="margin: 15px 0 5px 0; color: #444; border-bottom: 1px solid #eee; padding-bottom: 5px;">${axis.title}</h4>
                <div class="axis-labels">
                    <span>${axis.leftLabel}</span>
                    <span>${axis.rightLabel}</span>
                </div>
                <div class="axis-bar-container">
                    <span class="axis-icon">${axis.leftIcon}</span>
                    <div class="bar-background" style="background: ${axis.gradient};">
                        
                        ${partyLogosHTML} <div class="bar-indicator" style="left: ${percentPos}%;"></div> </div>
                    <span class="axis-icon">${axis.rightIcon}</span>
                </div>
            </div>
        `;
    container.innerHTML += html;
  });
}

function downloadResults() {
    const resultsScreen = document.getElementById('results-screen');
    const buttons = document.querySelectorAll('button, .numeric-scores-details');
    const iconsAndFlags = resultsScreen.querySelectorAll('img, svg, .fi');
    
    // 1. Nascondiamo i bottoni e mostriamo una notifica se vuoi
    buttons.forEach(b => b.style.opacity = '0');
    
    // TRUCCO PRO: Forziamo il browser a considerare le icone come cariche e CORS
    const imageLoadPromises = Array.from(iconsAndFlags).map(el => {
        if (el.tagName === 'IMG') {
            return new Promise(resolve => {
                if (el.complete) resolve();
                el.onload = resolve;
                el.onerror = resolve; // Procediamo anche se fallisce
                el.crossOrigin = "Anonymous"; // Fondamentale per le bandiere esterne
            });
        }
        // Per SVG e FontAwesome .fi non serve aspettare onload, sono parte del DOM
        return Promise.resolve();
    });

    // Aspettiamo che tutte le immagini siano cariche prima di scattare
    Promise.all(imageLoadPromises).then(() => {
        // Aggiungiamo un leggerissimo ritardo extra per sicurezza (100ms)
        setTimeout(() => {
            html2canvas(resultsScreen, {
                scale: 2, // Alta qualità
                backgroundColor: "#f4f4f9", 
                logging: false,
                useCORS: true, // Cruciale per Flag Icons CDN
                allowTaint: false
            }).then(originalCanvas => {
                // ... (Magia delle proporzioni 9:16 come avevamo già fatto) ...
                const targetAspectRatio = 9 / 16;
                let targetWidth, targetHeight;
                const originalRatio = originalCanvas.width / originalCanvas.height;

                if (originalRatio > targetAspectRatio) {
                    targetWidth = originalCanvas.width;
                    targetHeight = targetWidth / targetAspectRatio;
                } else {
                    targetHeight = originalCanvas.height;
                    targetWidth = targetHeight * targetAspectRatio;
                }

                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = targetWidth;
                finalCanvas.height = targetHeight;
                const ctx = finalCanvas.getContext('2d');
                ctx.fillStyle = "#f4f4f9";
                ctx.fillRect(0, 0, targetWidth, targetHeight);
                const offsetX = (targetWidth - originalCanvas.width) / 2;
                const offsetY = (targetHeight - originalCanvas.height) / 2;
                ctx.drawImage(originalCanvas, offsetX, offsetY);

                // Scarichiamo l'immagine finale
                const link = document.createElement('a');
                link.download = 'Mio_Test_Politico_Italia.png';
                link.href = finalCanvas.toDataURL("image/png");
                link.click();
                
                // 4. Ripristiniamo i bottoni
                buttons.forEach(b => b.style.opacity = '1');
            });
        }, 100); // 100ms di attesa extra sono sufficienti
    });
}

function restartTest() {
  sessionStorage.removeItem("politicalTestState");
  location.reload();
}

// Funzione per salvare lo stato nella memoria del browser
function saveState(isFinished = false) {
  const state = {
    questions: questions,
    userAnswers: userAnswers,
    currentQuestionIndex: currentQuestionIndex,
    isFinished: isFinished,
  };
  sessionStorage.setItem("politicalTestState", JSON.stringify(state));
}
