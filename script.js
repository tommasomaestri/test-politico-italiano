let questions = [];
let userAnswers = [];
let currentQuestionIndex = 0;

let parties = [];
let ideologies = [];

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

    const idRes = await fetch("ideologies.json");
    if (idRes.ok) {
        ideologies = await idRes.json();
    }

    // Controllo se c'è un salvataggio in memoria
    const savedState = sessionStorage.getItem("politicalTestState");

    if (savedState) {
      const state = JSON.parse(savedState);
      questions = state.questions;
      userAnswers = state.userAnswers;
      currentQuestionIndex = state.currentQuestionIndex;

      if (state.isFinished) {
        calculateResults();
        return;
      }
      else if (Object.keys(userAnswers).length > 0) {
        document.getElementById("start-screen").classList.remove("active");
        document.getElementById("quiz-screen").classList.add("active");
        document.getElementById("total-q-num").innerText = questions.length;
        showQuestion();
        return;
      }
    }

    // Comportamento standard se non c'è nessun salvataggio
    const btnQuick = document.getElementById("start-quick-btn");
    const btnAdvanced = document.getElementById("start-advanced-btn");

    if (btnQuick && btnAdvanced) {
      btnQuick.disabled = false;
      btnQuick.innerText = "Test Rapido (30 domande)";
      btnAdvanced.disabled = false;
      btnAdvanced.innerText = "Test Preciso (Completo)";
    }
  } catch (error) {
    console.error("Errore nel caricamento:", error);
  }
}

window.onload = initApp;

async function startTest(isAdvanced = false) {
  const btnQuick = document.getElementById("start-quick-btn");
  const btnAdvanced = document.getElementById("start-advanced-btn");

  if (btnQuick && btnAdvanced) {
    btnQuick.disabled = true;
    btnAdvanced.disabled = true;
    if (isAdvanced) {
      btnAdvanced.innerText = "Caricamento...";
    } else {
      btnQuick.innerText = "Caricamento...";
    }
  }

  try {
    const response = await fetch("questions.json");
    if (!response.ok) throw new Error(`Errore HTTP! stato: ${response.status}`);
    let baseQuestions = await response.json();

    let advancedQuestions = [];
    if (isAdvanced) {
      const advResponse = await fetch("questions_advanced.json");
      if (advResponse.ok) {
        advancedQuestions = await advResponse.json();
      } else {
        console.warn("Impossibile caricare le domande avanzate.");
      }
    }

    questions = [...baseQuestions, ...advancedQuestions];
    shuffleArray(questions);
    userAnswers = {};

    document.getElementById("start-screen").classList.remove("active");
    document.getElementById("quiz-screen").classList.add("active");
    document.getElementById("total-q-num").innerText = questions.length;
    showQuestion();
  } catch (error) {
    console.error("Errore nel caricamento delle domande:", error);
    alert("Errore nel caricamento delle domande. Riprova.");
    if (btnQuick && btnAdvanced) {
      btnQuick.disabled = false;
      btnQuick.innerText = "Test Rapido (30 domande)";
      btnAdvanced.disabled = false;
      btnAdvanced.innerText = "Test Preciso (Completo)";
    }
  }
}

function showQuestion() {
  const q = questions[currentQuestionIndex];

  document.getElementById("question-text").innerText = q.text;
  document.getElementById("arg-pro-text").innerText = q.pro;
  document.getElementById("arg-con-text").innerText = q.con;
  document.getElementById("current-q-num").innerText = currentQuestionIndex + 1;

  if (currentQuestionIndex === 0) {
    document.getElementById("btn-prev").innerText = "Torna al Menu";
    document.getElementById("btn-prev").disabled = false;
  } else {
    document.getElementById("btn-prev").innerText = "Indietro";
    document.getElementById("btn-prev").disabled = false;
  }

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
  } else if (currentQuestionIndex === 0) {
    if (confirm("Sei sicuro di voler tornare al menu principale? I tuoi progressi andranno persi.")) {
      sessionStorage.removeItem("politicalTestState");
      questions = [];
      userAnswers = {};
      currentQuestionIndex = 0;

      document.getElementById("quiz-screen").classList.remove("active");
      document.getElementById("start-screen").classList.add("active");

      const btnQuick = document.getElementById("start-quick-btn");
      const btnAdvanced = document.getElementById("start-advanced-btn");
      if (btnQuick && btnAdvanced) {
        btnQuick.disabled = false;
        btnQuick.innerText = "Test Rapido (30 domande)";
        btnAdvanced.disabled = false;
        btnAdvanced.innerText = "Test Preciso (Completo)";
      }
    }
  }
}

function calculateResults() {
  let rawScores = { economia: 0, autorita: 0, identita: 0, nazione: 0, giustizia: 0, ambiente: 0 };
  let maxScores = { economia: 0, autorita: 0, identita: 0, nazione: 0, giustizia: 0, ambiente: 0 };

  // Somma i punteggi dell'utente e calcola il massimo possibile (2 punti a domanda)
  questions.forEach(q => {
    if (userAnswers[q.id] !== undefined) {
      rawScores[q.axis] += userAnswers[q.id];
    }
    maxScores[q.axis] += 2; // "Fortemente d'accordo" = 2
  });

  // Normalizza i punteggi su una scala da -100 a +100
  let normalizedScores = {};
  for (let axis in rawScores) {
    let max = maxScores[axis] || 1;
    normalizedScores[axis] = (rawScores[axis] / max) * 100;
  }

  // CALCOLO AFFINITÀ (i pesi rimangono invariati)
  const weights = { economia: 2.5, autorita: 2.5, identita: 1.0, nazione: 1.0, giustizia: 1.0, ambiente: 1.0 };

  let partyDistances = parties.map(party => {
    let weightedSumOfSquares = 0;
    for (let axis in normalizedScores) {
      let diff = normalizedScores[axis] - party.axes[axis];
      weightedSumOfSquares += (diff * diff) * (weights[axis] || 1.0);
    }
    return {
      ...party,
      distance: Math.sqrt(weightedSumOfSquares)
    };
  });

  partyDistances.sort((a, b) => a.distance - b.distance);

  const top3 = partyDistances.slice(0, 3);
  const bottom3 = partyDistances.slice(-3).reverse();

  // Calcolo Ideologia (Aree)
  let closestIdeology = null;
  if (ideologies && ideologies.length > 0) {
      ideologies.forEach(ideo => {
          if (ideo.area) {
              if (normalizedScores.economia >= ideo.area.eMin && normalizedScores.economia <= ideo.area.eMax &&
                  normalizedScores.autorita >= ideo.area.aMin && normalizedScores.autorita <= ideo.area.aMax) {
                  closestIdeology = ideo;
              }
          }
      });
  }

  showResults(normalizedScores, top3, bottom3, closestIdeology);
}

function showResults(scores, top3, bottom3, closestIdeology) {
  document.getElementById("start-screen").classList.remove("active");
  document.getElementById("quiz-screen").classList.remove("active");
  document.getElementById("results-screen").classList.add("active");

  if (closestIdeology) {
      document.getElementById("user-ideology").innerText = closestIdeology.name;
  } else {
      document.getElementById("user-ideology-container").style.display = "none";
  }

  drawCompass(scores.economia, scores.autorita);
  drawExtraAxes(scores);

  // html partiti più vicini
  const topContainer = document.getElementById("closest-party-container");
  topContainer.innerHTML = top3
    .map(
      (party, index) => `
        <div class="party-card ${index === 0 ? "winner" : ""}">
            <img src="${party.logo}" alt="${party.name}" class="result-logo">
            <div class="party-name">${party.name}</div>
            <div class="match-percent">${Math.max(0, Math.round(100 - (party.distance / 10)))}% affinità</div>
        </div>
    `,
    )
    .join("");

  // html partiti più distanti
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

function toggleIdeologies() {
  const isChecked = document.getElementById("toggle-ideologies").checked;
  const labels = document.querySelectorAll(".ideology-area-compass");
  const partiesOnCompass = document.querySelectorAll(".party-logo-compass");
  
  labels.forEach(l => {
      if (isChecked) {
          l.classList.add("active");
      } else {
          l.classList.remove("active");
      }
  });

  partiesOnCompass.forEach(p => {
      if (isChecked) {
          p.style.opacity = "0.2";
          p.style.zIndex = "1";
      } else {
          p.style.opacity = "";
          p.style.zIndex = "";
      }
  });
}

function drawCompass(userX, userY) {
  const canvas = document.getElementById("compass-canvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  // disegna lo sfondo
  ctx.fillStyle = "#ffcccc";
  ctx.fillRect(0, 0, w / 2, h / 2);
  ctx.fillStyle = "#cce5ff";
  ctx.fillRect(w / 2, 0, w / 2, h / 2);
  ctx.fillStyle = "#ccffcc";
  ctx.fillRect(0, h / 2, w / 2, h / 2);
  ctx.fillStyle = "#ffffcc";
  ctx.fillRect(w / 2, h / 2, w / 2, h / 2);

  // Disegna la griglia interna (10x10)
  const stepX = w / 20;
  const stepY = h / 20;

  ctx.beginPath();
  for (let i = 1; i < 20; i++) {
    if (i === 20) continue; // Salta la linea centrale che sarà nera e più spessa
    // Linee verticali
    ctx.moveTo(i * stepX, 0);
    ctx.lineTo(i * stepX, h);
    // Linee orizzontali
    ctx.moveTo(0, i * stepY);
    ctx.lineTo(w, i * stepY);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; // Griglia chiara
  ctx.lineWidth = 1;
  ctx.stroke();

  // Disegna gli assi centrali
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.stroke();

  const overlay = document.getElementById("compass-overlay");
  overlay.innerHTML = "";

  parties.forEach(party => {
    // scala centesimale: (valore + 100) / 200
    let px = ((party.axes.economia + 100) / 200) * 100;
    let py = (1 - ((party.axes.autorita + 100) / 200)) * 100;
    overlay.innerHTML += `<img src="${party.logo}" class="party-logo-compass" title="${party.name}" style="left: ${px}%; top: ${py}%;">`;
  });

  if (ideologies && ideologies.length > 0) {
      ideologies.forEach(ideo => {
          if (ideo.area) {
              let left = ((ideo.area.eMin + 100) / 200) * 100;
              let width = ((ideo.area.eMax - ideo.area.eMin) / 200) * 100;
              // Per l'asse Y, aMax corrisponde al 'top' (perché l'asse è invertito)
              let top = (1 - ((ideo.area.aMax + 100) / 200)) * 100;
              let height = ((ideo.area.aMax - ideo.area.aMin) / 200) * 100;
              
              overlay.innerHTML += `<div class="ideology-area-compass" style="left: ${left}%; top: ${top}%; width: ${width}%; height: ${height}%; background-color: ${ideo.color};">
                  <span class="ideology-area-label">${ideo.name}</span>
              </div>`;
          }
      });
  }

  let uX = ((userX + 100) / 200) * 100;
  let uY = (1 - ((userY + 100) / 200)) * 100;
  overlay.innerHTML += `<div class="user-dot-compass" style="left: ${uX}%; top: ${uY}%;"></div>`;
}

function drawExtraAxes(scores) {
  const container = document.getElementById("extra-axes-container");
  container.innerHTML = "<h3>Assi Aggiuntivi</h3>";

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
    let percentPos = ((score + 100) / 200) * 100;

    // genera i loghi dei partiti sull'asse
    let partyGroups = {};
    parties.forEach((party) => {
      let pScore = party.axes[axis.key];
      let pPercent = ((pScore + 100) / 200) * 100;
      if (!partyGroups[pPercent]) {
          partyGroups[pPercent] = [];
      }
      partyGroups[pPercent].push(party);
    });

    let partyLogosHTML = "";
    for (let pPercent in partyGroups) {
      let group = partyGroups[pPercent];
      let combinedTitle = group.map(p => p.name).join(", ");
      
      let tooltipContent = "";
      if (group.length > 1) {
          // Se ci sono più partiti, mostriamo tutti i loro loghi nel tooltip
          tooltipContent = group.map(p => `<img src="${p.logo}" class="tooltip-logo" title="${p.name}">`).join("");
      } else {
          // Se c'è un solo partito, mostriamo semplicemente il nome
          tooltipContent = `<span class="tooltip-text">${group[0].name}</span>`;
      }
      
      let coverParty = group[group.length - 1]; // Usiamo l'ultimo aggiunto come cover, o il primo, è uguale. Scegliamo il primo:
      coverParty = group[0];

      partyLogosHTML += `
        <div class="party-axis-group" style="left: ${pPercent}%;">
            <img src="${coverParty.logo}" class="party-logo-axis" title="${combinedTitle}">
            <div class="custom-tooltip">${tooltipContent}</div>
        </div>
      `;
    }

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

  buttons.forEach(b => b.style.display = 'none');

  const imageLoadPromises = Array.from(iconsAndFlags).map(el => {
    if (el.tagName === 'IMG') {
      return new Promise(resolve => {
        if (el.complete) resolve();
        el.onload = resolve;
        el.onerror = resolve;
        el.crossOrigin = "Anonymous";
      });
    }
    return Promise.resolve();
  });

  Promise.all(imageLoadPromises).then(() => {
    setTimeout(() => {
      html2canvas(resultsScreen, {
        scale: 2,
        backgroundColor: "#f4f4f9",
        logging: false,
        useCORS: true,
        allowTaint: false
      }).then(originalCanvas => {
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

        // download immagine
        const link = document.createElement('a');
        link.download = 'Mio_Test_Politico_Italia.png';
        link.href = finalCanvas.toDataURL("image/png");
        link.click();

        // ripristino bottoni
        buttons.forEach(b => b.style.display = '');
      });
    }, 100);
  });
}

function restartTest() {
  sessionStorage.removeItem("politicalTestState");
  location.reload();
}

function saveState(isFinished = false) {
  const state = {
    questions: questions,
    userAnswers: userAnswers,
    currentQuestionIndex: currentQuestionIndex,
    isFinished: isFinished,
  };
  sessionStorage.setItem("politicalTestState", JSON.stringify(state));
}
