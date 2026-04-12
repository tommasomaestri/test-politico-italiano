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

        const partiesRes = await fetch('parties.json');
        if (!partiesRes.ok) throw new Error(`Errore HTTP! stato: ${partiesRes.status}`);
        parties = await partiesRes.json();

        // 1. Controllo se c'è un salvataggio in memoria
        const savedState = sessionStorage.getItem('politicalTestState');
        
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
                document.getElementById('start-screen').classList.remove('active');
                document.getElementById('quiz-screen').classList.add('active');
                document.getElementById('total-q-num').innerText = questions.length;
                showQuestion();
                return; // Interrompe qui
            }
        }

        // 2. Comportamento standard se non c'è nessun salvataggio

        const response = await fetch('questions.json');
        if (!response.ok) throw new Error(`Errore HTTP! stato: ${response.status}`);
        questions = await response.json();

        shuffleArray(questions); 
        userAnswers = {};
        
        const startBtn = document.getElementById('start-btn');
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
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('quiz-screen').classList.add('active');
    document.getElementById('total-q-num').innerText = questions.length;
    showQuestion();
}

function showQuestion() {
    const q = questions[currentQuestionIndex];
    
    document.getElementById('question-text').innerText = q.text;
    document.getElementById('arg-pro-text').innerText = q.pro;
    document.getElementById('arg-con-text').innerText = q.con;
    document.getElementById('current-q-num').innerText = currentQuestionIndex + 1;

    document.getElementById('btn-prev').disabled = currentQuestionIndex === 0;
    
    if (currentQuestionIndex === questions.length - 1) {
        document.getElementById('btn-next').innerText = "Vedi Risultati";
    } else {
        document.getElementById('btn-next').innerText = "Avanti";
    }

    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    // Controlla se esiste già una risposta salvata per l'ID di questa domanda
    if (userAnswers[q.id] !== undefined) {
        const savedValue = userAnswers[q.id] / q.multiplier; 
        const values = [2, 1, 0, -1, -2];
        const buttonIndex = values.indexOf(savedValue);
        if (buttonIndex !== -1) buttons[buttonIndex].classList.add('selected');
    }
}

function selectAnswer(value, btnElement) {
    const q = questions[currentQuestionIndex];
    // Salva usando l'ID della domanda come chiave
    userAnswers[q.id] = value * q.multiplier; 
    
    document.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');

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
    let rawScores = { economia: 0, autorita: 0, identita: 0, nazione: 0, giustizia: 0, ambiente: 0 };
    questions.forEach(q => { rawScores[q.axis] += userAnswers[q.id]; });

    let normalizedScores = {};
    for (let axis in rawScores) { normalizedScores[axis] = (rawScores[axis] / 10) * 10; }

    let bestMatch = null;
    let minDistance = Infinity;

    parties.forEach(party => {
        let sumOfSquares = 0;
        for (let axis in normalizedScores) {
            let diff = normalizedScores[axis] - party.axes[axis];
            sumOfSquares += diff * diff;
        }
        let distance = Math.sqrt(sumOfSquares);
        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = party; // <--- ORA SALVIAMO L'INTERO OGGETTO PARTITO
        }
    });

    showResults(normalizedScores, bestMatch);
}

// Sostituisci la vecchia funzione showResults con questa
function showResults(scores, matchedParty) {
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('quiz-screen').classList.remove('active');
    document.getElementById('results-screen').classList.add('active');
    
    drawCompass(scores.economia, scores.autorita);
    drawExtraAxes(scores);
    
    // MOSTRA IL PARTITO VINCENTE
    document.getElementById('closest-party').innerText = matchedParty.name;
    const logoImg = document.getElementById('closest-party-logo');
    logoImg.src = matchedParty.logo;
    logoImg.style.display = 'block';
    
    saveState(true);
}

function drawCompass(userX, userY) {
    const canvas = document.getElementById('compass-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Disegna solo lo sfondo (i punti li facciamo in HTML)
    ctx.fillStyle = "#ffcccc"; ctx.fillRect(0, 0, w/2, h/2);
    ctx.fillStyle = "#cce5ff"; ctx.fillRect(w/2, 0, w/2, h/2);
    ctx.fillStyle = "#ccffcc"; ctx.fillRect(0, h/2, w/2, h/2);
    ctx.fillStyle = "#ffffcc"; ctx.fillRect(w/2, h/2, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
    ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.stroke();

    const overlay = document.getElementById('compass-overlay');
    overlay.innerHTML = ""; // Pulisci

    // POSIZIONA I LOGHI DEI PARTITI SULLA BUSSOLA
    parties.forEach(party => {
        let px = ((party.axes.economia + 10) / 20) * 100;
        let py = (1 - ((party.axes.autorita + 10) / 20)) * 100; // Y invertito
        overlay.innerHTML += `<img src="${party.logo}" class="party-logo-compass" title="${party.name}" style="left: ${px}%; top: ${py}%;">`;
    });

    // POSIZIONA L'UTENTE (Viene disegnato DOPO, quindi starà SOPRA)
    let uX = ((userX + 10) / 20) * 100;
    let uY = (1 - ((userY + 10) / 20)) * 100;
    overlay.innerHTML += `<div class="user-dot-compass" style="left: ${uX}%; top: ${uY}%;"></div>`;
}

function drawExtraAxes(scores) {
    const container = document.getElementById('extra-axes-container');
    container.innerHTML = "<h3>Assi Aggiuntivi</h3>";

    // Aggiunto "title" per l'intestazione e "gradient" per i colori a tema
    const axesDef = [
        { 
            key: 'identita', 
            title: 'Identità e Cultura',
            leftLabel: 'Progressismo', rightLabel: 'Tradizionalismo',
            leftIcon: '<i class="fa-solid fa-rainbow" style="color: #e6235aff;"></i>&nbsp;<i class="fa-solid fa-peace" style="color: #e6235aff;"></i>', 
            rightIcon: '<i class="fa-solid fa-building-columns" style="color: #440098ff;"></i>&nbsp;<i class="fa-solid fa-people-roof" style="color: #440098ff;"></i>',
            gradient: 'linear-gradient(90deg, #e6235aff 0%, #440098ff 100%)' // Magenta chiaro -> Viola scuro
        },
        { 
            key: 'nazione', 
            title: 'Nazione e Mondo',
            leftLabel: 'Internazionalismo', rightLabel: 'Nazionalismo',
            leftIcon: '<span class="fi fi-eu" style="border-radius: 4px; border: 2px solid #40e0b5ff;"></span>&nbsp;<span class="fi fi-un" style="border-radius: 4px; border: 2px solid #40e0b5ff;"></span>', 
            rightIcon: '<span class="fi fi-it" style="border-radius: 4px; border: 2px solid #07008eff;"></span>&nbsp;<i class="fa-solid fa-shield-halved" style="color: #07008eff;"></i>',
            gradient: 'linear-gradient(90deg, #40e0b5ff 0%, #07008eff 100%)' // Verde acqua (Turchese) -> Blu scuro
        },
        { 
            key: 'giustizia', 
            title: 'Giustizia',
            leftLabel: 'Riabilitativa', rightLabel: 'Punitiva',
            leftIcon: '<i class="fa-solid fa-hand-holding-heart" style="color: #a6cd32ff;"></i>&nbsp;<i class="fa-solid fa-book-open" style="color: #a6cd32ff;"></i>', 
            rightIcon: '<i class="fa-solid fa-handcuffs" style="color: #a20000ff;"></i></i>&nbsp;<i class="fa-solid fa-gavel" style="color: #a20000ff;"></i>',
            gradient: 'linear-gradient(90deg, #a6cd32ff 0%, #a20000ff 100%)' // Verde-giallo -> Rosso scuro
        },
        { 
            key: 'ambiente', 
            title: 'Ambiente e Produzione',
            leftLabel: 'Ecologismo', rightLabel: 'Produttivismo',
            leftIcon: '<i class="fa-solid fa-leaf" style="color: #32cd32;"></i>&nbsp;<i class="fa-solid fa-recycle" style="color: #32cd32;"></i>', 
            rightIcon: '<i class="fa-solid fa-industry" style="color: #614d3aff;"></i>&nbsp;<i class="fa-solid fa-gear" style="color: #614d3aff;"></i>',
            gradient: 'linear-gradient(90deg, #32cd32 0%, #614d3aff 100%)' // Verde brillante -> Grigio industriale
        }
    ];

    axesDef.forEach(axis => {
        let score = scores[axis.key];
        let percentPos = ((score + 10) / 20) * 100;

        // GENERA I LOGHI DEI PARTITI PER QUESTO ASSE
        let partyLogosHTML = "";
        parties.forEach(party => {
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

function restartTest() {
    sessionStorage.removeItem('politicalTestState');
    location.reload();
}

// Funzione per salvare lo stato nella memoria del browser
function saveState(isFinished = false) {
    const state = {
        questions: questions,
        userAnswers: userAnswers,
        currentQuestionIndex: currentQuestionIndex,
        isFinished: isFinished
    };
    sessionStorage.setItem('politicalTestState', JSON.stringify(state));
}