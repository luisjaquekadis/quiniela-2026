// Base de datos y API para la Copa Mundial de la FIFA 2026

async function fetchWorldCupData() {
  try {
    const response = await fetch(`/api/2026.json?t=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error("Error fetching World Cup data:", error);
    return [];
  }
}

const firebaseConfig = {
  apiKey: "AIzaSyDhff7KUaRRHXZ1naA6XhL21HQAQYOxgrE",
  authDomain: "quiniela-backup.firebaseapp.com",
  projectId: "quiniela-backup",
  storageBucket: "quiniela-backup.firebasestorage.app",
  messagingSenderId: "95031328885",
  appId: "1:95031328885:web:1c9c4f436173386450b83c"
};

const STAGES = [
  "Todos",
  "Fase de Grupos",
  "Dieciseisavos de Final",
  "Octavos de Final",
  "Cuartos de Final",
  "Semifinal",
  "Tercer Lugar",
  "Gran Final"
];

// --- INTEGRACIÓN ESPN PARA MARCADORES EN VIVO ---
const ESPNDictionary = {
  "Algeria": "Argelia", "Argentina": "Argentina", "Australia": "Australia", "Austria": "Austria",
  "Belgium": "Bélgica", "Bosnia-Herzegovina": "Bosnia y Herzegovina", "Brazil": "Brasil", "Canada": "Canadá",
  "Cape Verde": "Cabo Verde", "Colombia": "Colombia", "Congo DR": "RD Congo", "Croatia": "Croacia",
  "Curaçao": "Curazao", "Czechia": "República Checa", "Ecuador": "Ecuador", "Egypt": "Egipto",
  "England": "Inglaterra", "France": "Francia", "Germany": "Alemania", "Ghana": "Ghana",
  "Haiti": "Haití", "Iran": "Irán", "Iraq": "Irak", "Ivory Coast": "Costa de Marfil",
  "Japan": "Japón", "Jordan": "Jordania", "Mexico": "México", "Morocco": "Marruecos",
  "Netherlands": "Países Bajos", "New Zealand": "Nueva Zelanda", "Norway": "Noruega", "Panama": "Panamá",
  "Paraguay": "Paraguay", "Portugal": "Portugal", "Qatar": "Qatar", "Saudi Arabia": "Arabia Saudita",
  "Scotland": "Escocia", "Senegal": "Senegal", "South Africa": "Sudáfrica", "South Korea": "Corea del Sur",
  "Spain": "España", "Sweden": "Suecia", "Switzerland": "Suiza", "Tunisia": "Túnez",
  "Türkiye": "Turquía", "United States": "EE.UU.", "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistán"
};

const ISO_CODES = {
    "México": "mx", "Sudáfrica": "za", "Corea del Sur": "kr", "República Checa": "cz",
    "Canadá": "ca", "Suiza": "ch", "Qatar": "qa", "Bosnia y Herzegovina": "ba",
    "Brasil": "br", "Marruecos": "ma", "Haití": "ht", "Escocia": "gb-sct",
    "EE.UU.": "us", "Paraguay": "py", "Australia": "au", "Turquía": "tr",
    "Alemania": "de", "Ecuador": "ec", "Costa de Marfil": "ci", "Curazao": "cw",
    "Países Bajos": "nl", "Japón": "jp", "Túnez": "tn", "Suecia": "se",
    "Bélgica": "be", "Irán": "ir", "Egipto": "eg", "Nueva Zelanda": "nz",
    "España": "es", "Uruguay": "uy", "Arabia Saudita": "sa", "Cabo Verde": "cv",
    "Francia": "fr", "Senegal": "sn", "Noruega": "no", "Irak": "iq",
    "Argentina": "ar", "Argelia": "dz", "Austria": "at", "Jordania": "jo",
    "Portugal": "pt", "Colombia": "co", "Uzbekistán": "uz", "RD Congo": "cd",
    "Inglaterra": "gb-eng", "Croacia": "hr", "Ghana": "gh", "Panamá": "pa"
};


async function syncLiveScoresFromESPN() {
  try {
    const response = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719");
    const data = await response.json();
    if (!data.events) return;

    let changesMade = false;
    let newExactMatches = 0;

    data.events.forEach(event => {
      if (event.status && event.status.type) {
        const comp = event.competitions[0];
        if (!comp || !comp.competitors) return;

        const homeComp = comp.competitors.find(c => c.homeAway === "home");
        const awayComp = comp.competitors.find(c => c.homeAway === "away");
        
        if (!homeComp || !awayComp) return;

        const espnHome = homeComp.team.displayName;
        const espnAway = awayComp.team.displayName;
        const scoreHome = parseInt(homeComp.score) || 0;
        const scoreAway = parseInt(awayComp.score) || 0;

        const localHome = ESPNDictionary[espnHome] || espnHome;
        const localAway = ESPNDictionary[espnAway] || espnAway;

        // Buscar el ID del partido local (iterando los matches cargados)
        const localMatches = JSON.parse(localStorage.getItem(qStorage.STORAGE_KEYS.MATCHES)) || [];
        let match = localMatches.find(m => m.homeTeam === localHome && m.awayTeam === localAway);

        // Fallback por utcDate para fase final con equipos por definir
        if (!match && event.date) {
          match = localMatches.find(m => m.utcDate === event.date);
          
          if (match && espnHome !== "TBD" && espnAway !== "TBD" && espnHome && espnAway && !espnHome.includes("Winner") && !espnAway.includes("Winner")) {
             // Actualizar equipos y banderas en el array
             match.homeTeam = localHome;
             match.awayTeam = localAway;
             match.homeFlagCode = ISO_CODES[localHome] || "un";
             match.awayFlagCode = ISO_CODES[localAway] || "un";
             
             // Guardar el cambio inmediatamente
             if (typeof qStorage !== 'undefined') {
                qStorage.saveMatches(localMatches);
                qStorage.updateCloudKey("matches", localMatches);
                changesMade = true;
             }
          }
        }
        
        // Auto-corrección de Estadio y Horario (utcDate) si difieren de ESPN
        if (match && event.competitions && event.competitions.length > 0) {
           let updatedDetails = false;
           const compInfo = event.competitions[0];
           
           if (compInfo.venue && compInfo.venue.fullName && match.stadium !== compInfo.venue.fullName) {
              match.stadium = compInfo.venue.fullName;
              updatedDetails = true;
           }
           if (event.date && match.utcDate !== event.date) {
              match.utcDate = event.date;
              updatedDetails = true;
           }
           
           if (updatedDetails && typeof qStorage !== 'undefined') {
              qStorage.saveMatches(localMatches);
              qStorage.updateCloudKey("matches", localMatches);
              changesMade = true;
           }
        }

        if (match && (event.status.type.state === "post" || event.status.type.state === "in")) {
          // Revisar si ya lo teníamos registrado
          if (match.realHomeScore !== scoreHome || match.realAwayScore !== scoreAway) {
            // Guardar usando qStorage global de profiles.js
            if (typeof qStorage !== 'undefined') {
              
              // Revisar si esto genera un confeti para el usuario activo
              const activeId = qStorage.getActiveProfileId();
              if (activeId) {
                const activePreds = qStorage.getPredictions()[activeId] || {};
                const myPred = activePreds[match.id];
                if (myPred && myPred.home === scoreHome && myPred.away === scoreAway) {
                   newExactMatches++;
                }
              }

              qStorage.saveRealScore(match.id, scoreHome, scoreAway);
              changesMade = true;
            }
          }
        }
      }
    });

    if (changesMade && typeof app !== 'undefined' && app.refreshUI) {
      app.refreshUI();
      if (newExactMatches > 0 && typeof app.triggerConfetti === 'function') {
        app.triggerConfetti();
      }
    }

    // Indicador visual de Live
    if (typeof document !== 'undefined') {
      const header = document.querySelector(".app-header");
      if (header && !document.getElementById("espn-sync-indicator")) {
        const syncInd = document.createElement("div");
        syncInd.id = "espn-sync-indicator";
        syncInd.style = "font-size: 10px; color: #10B981; font-weight: 600; display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 20px; border: 1px solid rgba(16,185,129,0.3);";
        syncInd.innerHTML = `<span style="width: 6px; height: 6px; background: #10B981; border-radius: 50%; animation: pulse 2s infinite;"></span> <img src="https://upload.wikimedia.org/wikipedia/commons/2/2f/ESPN_wordmark.svg" alt="ESPN" style="height: 12px; margin-left: 2px;"> <span style="color: rgba(255,255,255,0.7); font-size: 9px; margin-left: 2px;">Live</span>`;
        const scoreboard = document.querySelector(".live-scoreboard");
        if (scoreboard) {
          scoreboard.appendChild(syncInd);
        } else {
          header.appendChild(syncInd);
        }
      }
    }
  } catch (error) {
    console.error("Error sincronizando resultados desde ESPN:", error);
  }
}
