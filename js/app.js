// Controlador Principal de la Quiniela Mundial Compartida
const STAGES = ["Todos", "Fase de Grupos", "16avos de Final", "Octavos de Final", "Cuartos de Final", "Semifinal", "Tercer Lugar", "Final"];

class QuinielaApp {
  constructor() {
    this.activeProfileId = "user1";
    this.selectedStage = "Todos";
    this.activeView = "predictions";
    this.liveScores = {};
    
    // Configuración de Confeti
    this.confettiActive = false;
    this.confettiParticles = [];
    this.canvas = document.getElementById("confetti-canvas");
    this.ctx = this.canvas?.getContext("2d");

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", async () => await this.init());
    } else {
      (async () => await this.init())();
    }
  }

  getFlagUrl(flagCode) {
    const code = flagCode || 'un';
    // Bypass adblockers para códigos que suelen ser bloqueados (ar = augmented reality/advertising, at = ad tracking)
    if (code === 'ar') return 'img/flags/ar.png';
    if (code === 'at') return 'img/flags/at.png';
    return `https://flagcdn.com/w40/${code}.png`;
  }

  getScoreOptionsHtml(selectedValue) {
    let html = `<option value="" ${selectedValue === "" || selectedValue === undefined || selectedValue === null ? 'selected' : ''}>-</option>`;
    for (let i = 0; i <= 9; i++) {
      html += `<option value="${i}" ${selectedValue !== "" && selectedValue !== undefined && selectedValue !== null && parseInt(selectedValue) === i ? 'selected' : ''}>${i}</option>`;
    }
    for (let i = 10; i <= 15; i++) {
      html += `<option value="${i}" ${selectedValue !== "" && selectedValue !== undefined && selectedValue !== null && parseInt(selectedValue) === i ? 'selected' : ''}>${i}</option>`;
    }
    return html;
  }

  async init() {
    // Purga forzada del perfil duplicado de justvilo para evitar que los navegadores lo revivan
    try {
      const pKey = "quiniela_profiles_v8";
      const localProfiles = JSON.parse(localStorage.getItem(pKey)) || {};
      if (localProfiles["user_1780362444285"]) {
        delete localProfiles["user_1780362444285"];
        localStorage.setItem(pKey, JSON.stringify(localProfiles));
      }
    } catch(e) {}

    // 1. Capturar grupo de la URL inmediatamente al arrancar
    const urlParams = new URLSearchParams(window.location.search);
    const groupParam = urlParams.get('group');
    if (groupParam) {
      localStorage.setItem("quiniela_group_id", groupParam);
    }

    await qStorage.initData();
    
    // Iniciar sincronización de marcadores en vivo de fondo (sin bloquear UI)
    if (typeof syncLiveScoresFromESPN === 'function') {
      syncLiveScoresFromESPN();
    }

    this.setupConfetti();
    this.loadState();
    this.initViews();
    this.setupEventListeners();
    this.initDuels();
    this.renderStageFilters();
    qStorage.recalculateAllPoints();
    this.refreshUI();
    this.setupGoogleSheetsPanel();

    // Sincronización inicial de marcadores reales oficiales
    // NO bloqueamos con await para que si falla, el flujo siga
    this.syncOfficialResults().catch(e => console.error("Error syncing official results:", e));

    // Forzar descarga de perfiles de forma NO bloqueante para la UI principal
    // (si Firebase se queda colgado por cuota, la UI sigue funcionando)
    qStorage.syncFromCloud().then(changed => {
        if (changed) this.refreshUI();
    }).catch(e => console.error("Error in initial cloud sync:", e));

    // Iniciar onboarding si es la primera vez
    setTimeout(() => {
      this.startOnboarding();
    }, 1500);

    // Conectar listeners de Firebase (onSnapshot) para actualizaciones en tiempo real
    qStorage.listenToCloudChanges(() => {
      this.refreshUI();
    });

    // Polling ligero (cada 30 seg) SÓLO para el archivo estático de resultados en vivo (sin costo de cuota)
    setInterval(async () => {
      try {
        await this.syncOfficialResults();
      } catch (e) {
        console.error("Error in live score polling:", e);
      }
    }, 30000);
  }

  // Sincroniza de forma automática y transparente los marcadores reales desde el servidor
  async syncOfficialResults() {
    try {
      // Get today's date in YYYYMMDD format
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}${mm}${dd}`;

      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}`;
      const response = await fetch(url);
      if (!response.ok) return;
      const data = await response.json();
      
      let changed = false;
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

      if (data.events) {
        data.events.forEach(event => {
          const comp = event.competitions[0];
          const status = event.status.type.description;
          const detail = event.status.type.detail || "";
          let h = "", a = "", hScore = 0, aScore = 0;
          comp.competitors.forEach(c => {
            if (c.homeAway === "home") {
              h = ESPNDictionary[c.team.displayName] || c.team.displayName;
              hScore = c.score || "0";
            } else {
              a = ESPNDictionary[c.team.displayName] || c.team.displayName;
              aScore = c.score || "0";
            }
          });
          const key = `${h} vs ${a}`;
          
          if (!this.liveScores[key] || this.liveScores[key].hScore !== hScore || this.liveScores[key].aScore !== aScore || this.liveScores[key].status !== status || this.liveScores[key].detail !== detail) {
            this.liveScores[key] = { hScore, aScore, status, detail };
            changed = true;
          }
        });
      }
      
      if (changed) {
        console.log("⚽ Live scores updated from ESPN!");
        this.renderPredictions(); // Re-render to show live scores
      }
    } catch (e) {
      console.error("Error fetching live ESPN scores:", e);
    }
  }

  // Configura el panel interactivo de Google Sheets, poblando el código y el botón de copiado
  setupGoogleSheetsPanel() {
    const codeArea = document.getElementById("apps-script-code");
    if (codeArea) {
      codeArea.value = `function doPost(e) {
  try {
    var json;
    if (e && e.postData && e.postData.contents) {
      json = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      json = e.parameter;
    } else {
      throw new Error("No se recibieron datos en la petición POST.");
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error("No se pudo encontrar la hoja de cálculo activa. Asegúrate de que el script esté vinculado a una hoja (Extensiones -> Apps Script).");
    }
    
    var sheet = ss.getSheets()[0];
    if (!sheet) {
      throw new Error("La hoja de cálculo no contiene ninguna pestaña.");
    }
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Fecha y Hora", 
        "Grupo ID", 
        "Usuario", 
        "Partido ID", 
        "Equipos", 
        "Pronóstico Local", 
        "Pronóstico Visita", 
        "Etapa"
      ]);
      
      var headerRange = sheet.getRange(1, 1, 1, 8);
      headerRange.setBackground("#10B981");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
    
    var date = new Date();
    var groupId = json.groupId || "default";
    var userName = json.userName || "Anónimo";
    var matchId = json.matchId || "";
    var matchName = json.matchName || "";
    var homeScore = (json.homeScore !== undefined && json.homeScore !== null && json.homeScore !== "") ? parseInt(json.homeScore) : "-";
    var awayScore = (json.awayScore !== undefined && json.awayScore !== null && json.awayScore !== "") ? parseInt(json.awayScore) : "-";
    var stage = json.stage || "";
    
    // Buscar si ya existe una fila para este Grupo ID, Usuario y Partido ID
    var lastRow = sheet.getLastRow();
    var foundRow = -1;
    
    if (lastRow > 1) {
      // Obtener los datos de las columnas relevantes: Grupo ID (Col 2), Usuario (Col 3), Partido ID (Col 4)
      var range = sheet.getRange(2, 2, lastRow - 1, 3);
      var values = range.getValues();
      
      for (var i = 0; i < values.length; i++) {
        if (String(values[i][0]).toLowerCase() === groupId.toLowerCase() &&
            String(values[i][1]).toLowerCase() === userName.toLowerCase() &&
            String(values[i][2]).toLowerCase() === matchId.toLowerCase()) {
          foundRow = i + 2; // +2 porque el índice empieza en 0 y la fila de datos en 2
          break;
        }
      }
    }
    
    if (foundRow !== -1) {
      // Actualizar la fila existente
      sheet.getRange(foundRow, 1).setValue(date);
      sheet.getRange(foundRow, 5).setValue(matchName);
      sheet.getRange(foundRow, 6).setValue(homeScore);
      sheet.getRange(foundRow, 7).setValue(awayScore);
      sheet.getRange(foundRow, 8).setValue(stage);
    } else {
      // Insertar nueva fila
      sheet.appendRow([
        date,
        groupId,
        userName,
        matchId,
        matchName,
        homeScore,
        awayScore,
        stage
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "Datos registrados correctamente"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error("Error en doPost: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
    }

    const btnCopyScript = document.getElementById("btn-copy-script");
    if (btnCopyScript && codeArea) {
      btnCopyScript.addEventListener("click", () => {
        codeArea.select();
        document.execCommand("copy");
        btnCopyScript.textContent = "✅ ¡Copiado!";
        btnCopyScript.style.background = "#059669";
        setTimeout(() => {
          btnCopyScript.textContent = "📋 Copiar Código";
          btnCopyScript.style.background = "rgba(16, 185, 129, 0.85)";
        }, 2000);
      });
    }
  }

  // --- CONTROL DE ESTADO ---
  loadState() {
    this.activeProfileId = qStorage.getActiveProfileId();
  }

  refreshUI() {
    const profiles = qStorage.getProfiles();
    if (!profiles || Object.keys(profiles).length === 0) return;

    let activeUser = profiles[this.activeProfileId];
    if (!activeUser) {
      // Si el perfil activo no existe en la base de datos (ej. cambió de grupo), forzamos inicio de sesión
      localStorage.removeItem("quiniela_active_profile_v8");
      this.activeProfileId = null;
      
      const overlay = document.getElementById("profile-overlay");
      if (overlay) {
        overlay.style.display = "flex";
        overlay.style.opacity = "1";
      }
      return; // Detener el renderizado de la UI si no hay usuario
    }

    // Control de permisos de Administrador en el Tab
    const tabAdmin = document.getElementById("tab-admin");
    if (tabAdmin) {
      if (activeUser.isAdmin) {
        tabAdmin.style.display = "flex";
      } else {
        tabAdmin.style.display = "none";
        // Si el usuario actual no es administrador y estaba en la pestaña de administración, expulsarlo a predictions
        if (this.activeView === "admin") {
          this.activeView = "predictions";
          const tabPreds = document.getElementById("tab-predictions");
          if (tabPreds) {
            document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
            tabPreds.classList.add("active");
          }
          document.querySelectorAll(".view-section").forEach(view => {
            view.classList.remove("active");
          });
          document.getElementById("view-predictions").classList.add("active");
        }
      }
    }

    // 1. Cabecera - Marcador activo
    document.getElementById("header-name-active").textContent = activeUser.name;
    document.getElementById("header-avatar-active").textContent = activeUser.avatar;
    document.getElementById("header-val-active").textContent = activeUser.points;

    // Pill de Perfil Activo
    document.getElementById("active-name-pill").textContent = activeUser.name;
    document.getElementById("active-avatar-pill").textContent = activeUser.avatar;
    document.getElementById("current-user-editing-msg").textContent = `✍️ Editando pronósticos de ${activeUser.name}`;

    // Llenar inputs de Ajustes
    const inputName = document.getElementById("input-name-active");
    if (inputName) inputName.value = activeUser.name;

    // Cargar ID de Grupo en los Ajustes
    const currentGroupId = localStorage.getItem("quiniela_group_id") || "default";
    const inputGroupId = document.getElementById("input-group-id");
    if (inputGroupId && !inputGroupId.dataset.userInteracted) {
      inputGroupId.value = currentGroupId === "default" ? "" : currentGroupId;
    }
    const labelGroup = document.getElementById("current-group-id-label");
    if (labelGroup) {
      labelGroup.textContent = currentGroupId === "default" ? "Grupo por Defecto (Local)" : `Grupo Activo: "${currentGroupId}"`;
    }

    // Cargar URL de Google Sheets en los Ajustes
    const sheetsUrl = localStorage.getItem("quiniela_google_sheets_url") || "";
    const inputSheetsUrl = document.getElementById("input-sheets-url");
    if (inputSheetsUrl && !inputSheetsUrl.dataset.userInteracted) {
      inputSheetsUrl.value = sheetsUrl;
    }
    const labelSheets = document.getElementById("current-sheets-status-label");
    if (labelSheets) {
      labelSheets.textContent = sheetsUrl ? "VINCULADO (Grabando pronósticos)" : "Desconectado";
      labelSheets.style.color = sheetsUrl ? "var(--accent-green)" : "var(--accent-red)";
    }

    // Ocultar/Mostrar la tarjeta de Google Sheets según si el usuario es administrador
    const sheetsCard = document.getElementById("sheets-config-card");
    if (sheetsCard) {
      sheetsCard.style.display = activeUser.isAdmin ? "block" : "none";
    }

    // Garantizar que si no hay sesión activa, forcemos la visibilidad de la pantalla de autenticación
    const overlay = document.getElementById("profile-overlay");
    if (!this.activeProfileId && overlay) {
      overlay.style.display = "flex";
      overlay.style.opacity = "1";
    }

    // 2. Renderizar Vistas Activas
    // Evitar re-renderizar la cuadrícula si el usuario está introduciendo una predicción
    const isTypingPrediction = document.activeElement && document.activeElement.classList.contains("prediction-input");
    if (!isTypingPrediction) {
      this.renderPredictions();
    }
    this.renderComparison();
    this.renderAdminMatches();
  }

  // --- NAVEGACIÓN Y EVENTOS ---
  initViews() {
    const overlay = document.getElementById("profile-overlay");
    const activeProfile = qStorage.getActiveProfileId();
    const profiles = qStorage.getProfiles();
    
    if (activeProfile && profiles && profiles[activeProfile]) {
      overlay.style.opacity = "0";
      setTimeout(() => overlay.style.display = "none", 300);
    } else {
      overlay.style.display = "flex";
      overlay.style.opacity = "1";
    }
  }

  // Cierra la sesión del usuario actual volviendo al login
  logout() {
    localStorage.removeItem("quiniela_active_profile_v8");
    this.activeProfileId = null;
    
    // Finalizar onboarding si estaba activo
    this.endOnboarding();
    
    // Mostrar overlay de autenticación
    const overlay = document.getElementById("profile-overlay");
    if (overlay) {
      overlay.style.display = "flex";
      setTimeout(() => overlay.style.opacity = "1", 50);
    }
    
    // Limpiar entradas
    const loginUser = document.getElementById("login-username");
    const loginPass = document.getElementById("login-password");
    if (loginUser) loginUser.value = "";
    if (loginPass) loginPass.value = "";
    
    this.refreshUI();
  }

  setupEventListeners() {
    // 0. Filtros Avanzados
    const searchTeamInput = document.getElementById("filter-search-team");
    const selectGroupInput = document.getElementById("filter-select-group");
    const selectStatusInput = document.getElementById("filter-select-status");

    if (searchTeamInput) {
      searchTeamInput.addEventListener("input", () => this.renderPredictions());
    }
    if (selectGroupInput) {
      selectGroupInput.addEventListener("change", () => this.renderPredictions());
    }
    if (selectStatusInput) {
      selectStatusInput.addEventListener("change", () => this.renderPredictions());
    }

    // 1. Manejo de Pestañas de Autenticación (Login / Registro)
    const tabLogin = document.getElementById("tab-auth-login");
    const tabSignup = document.getElementById("tab-auth-signup");
    const formLogin = document.getElementById("form-auth-login");
    const formSignup = document.getElementById("form-auth-signup");

    if (tabLogin && tabSignup) {
      tabLogin.addEventListener("click", () => {
        tabLogin.classList.add("active");
        tabSignup.classList.remove("active");
        formLogin.style.display = "flex";
        formSignup.style.display = "none";
      });

      tabSignup.addEventListener("click", () => {
        tabSignup.classList.add("active");
        tabLogin.classList.remove("active");
        formLogin.style.display = "none";
        formSignup.style.display = "flex";
      });
    }

    // 1b. Selector de Avatar en el Registro
    const avatarOptions = document.querySelectorAll("#signup-avatar-selector .avatar-option");
    avatarOptions.forEach(opt => {
      opt.addEventListener("click", () => {
        avatarOptions.forEach(o => {
          o.classList.remove("active");
          o.style.borderColor = "transparent";
        });
        opt.classList.add("active");
        opt.style.borderColor = "var(--primary)";
      });
    });

    // 1c. Submit de Formulario de Iniciar Sesión (Login)
    if (formLogin) {
      formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById("login-username");
        const passwordInput = document.getElementById("login-password");
        const groupInput = document.getElementById("login-group-id");
        const submitBtn = formLogin.querySelector("button[type='submit']");

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const groupVal = groupInput ? groupInput.value.trim() : "";

        if (!username || !password) return;

        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ Validando...";

        try {
          if (groupVal && groupVal.toLowerCase() !== (localStorage.getItem("quiniela_group_id") || "default").toLowerCase()) {
            submitBtn.textContent = "⏳ Conectando al Grupo...";
            await qStorage.joinGroup(groupVal);
          }

          const profileId = await qStorage.loginUser(username, password);
          if (profileId) {
            qStorage.setActiveProfileId(profileId);
            this.activeProfileId = profileId;

            // Ocultar overlay
            const overlay = document.getElementById("profile-overlay");
            overlay.style.opacity = "0";
            setTimeout(() => {
              overlay.style.display = "none";
              this.refreshUI();
              // Iniciar onboarding
              this.startOnboarding();
            }, 300);
            
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            alert(`👋 ¡Hola de nuevo, ${username}!`);
          } else {
            submitBtn.textContent = "❌ Datos incorrectos";
            setTimeout(() => { submitBtn.textContent = originalText; submitBtn.disabled = false; }, 2500);
          }
        } catch (err) {
          console.error("Error al iniciar sesión:", err);
          submitBtn.textContent = "❌ Error al conectar";
          setTimeout(() => { submitBtn.textContent = originalText; submitBtn.disabled = false; }, 2500);
        }
      });
    }

    // 1d. Submit de Formulario de Registro (Sign Up)
    if (formSignup) {
      formSignup.addEventListener("submit", async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById("signup-username");
        const passwordInput = document.getElementById("signup-password");
        const groupInput = document.getElementById("signup-group-id");
        const activeAvatarOpt = document.querySelector("#signup-avatar-selector .avatar-option.active");
        const selectedAvatar = activeAvatarOpt ? activeAvatarOpt.textContent : "⚽";
        const submitBtn = formSignup.querySelector("button[type='submit']");

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const groupVal = groupInput ? groupInput.value.trim() : "";

        if (!username || !password) return;

        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ Creando Perfil...";

        try {
          if (groupVal && groupVal.toLowerCase() !== (localStorage.getItem("quiniela_group_id") || "default").toLowerCase()) {
            submitBtn.textContent = "⏳ Conectando al Grupo...";
            await qStorage.joinGroup(groupVal);
          }

          const newId = await qStorage.registerUser(username, password, selectedAvatar);
          qStorage.setActiveProfileId(newId);
          this.activeProfileId = newId;

          localStorage.removeItem("quiniela_onboarding_completed");
          // Ocultar overlay
          const overlay = document.getElementById("profile-overlay");
          overlay.style.opacity = "0";
          setTimeout(() => {
            overlay.style.display = "none";
            this.refreshUI();
            // Iniciar onboarding
            this.startOnboarding();
          }, 300);
          
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          alert(`✨ ¡Cuenta creada exitosamente! Bienvenido, ${username}.`);
        } catch (err) {
          console.error("Error al registrar:", err);
          submitBtn.textContent = `❌ ${err.message || "Error al registrar"}`;
          setTimeout(() => { submitBtn.textContent = originalText; submitBtn.disabled = false; }, 3000);
        }
      });
    }

    // 2. Click en la píldora de perfil para Cerrar Sesión
    document.getElementById("active-profile-pill").addEventListener("click", () => {
      if (confirm("🚪 ¿Deseas cerrar la sesión activa? Volverás a la pantalla de ingreso.")) {
        this.logout();
      }
    });

    // 3. Navegación de pestañas (Tabs)
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(tab => {
      tab.addEventListener("click", (e) => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        
        const viewName = tab.getAttribute("data-view");
        this.activeView = viewName;
        
        document.querySelectorAll(".view-section").forEach(view => {
          view.classList.remove("active");
        });
        
        document.getElementById(`view-${viewName}`).classList.add("active");
        this.refreshUI();
      });
    });

    // 4. Formulario de Ajustes (Guardar nombres)
    document.getElementById("profiles-config-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const newName = document.getElementById("input-name-active").value;
      qStorage.updateProfileName(this.activeProfileId, newName);
      this.refreshUI();
      alert("🏆 ¡Perfil guardado exitosamente!");
    });

    // 4.b Formulario de Ajustes (Unirse / Conectarse a Grupo de Quiniela)
    const inputGroupId = document.getElementById("input-group-id");
    if (inputGroupId) {
      inputGroupId.addEventListener("input", () => {
        inputGroupId.dataset.userInteracted = "true";
      });
    }

    const groupForm = document.getElementById("group-config-form");
    if (groupForm) {
      groupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inputGroupVal = document.getElementById("input-group-id").value;
        const submitBtn = groupForm.querySelector("button[type='submit']");
        
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "⏳ Conectando y Sincronizando...";
        
        try {
          await qStorage.joinGroup(inputGroupVal);
          
          alert(inputGroupVal.trim() ? `¡Te has conectado exitosamente al grupo "${inputGroupVal.trim().toLowerCase()}"!` : "Has vuelto al grupo local por defecto.");
          
          window.location.reload();
        } catch (err) {
          console.error("Error joining group:", err);
          alert("Hubo un error al intentar conectarse al grupo. Por favor reintenta.");
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    }

    // 4.c Formulario de Ajustes (Vincular Hoja de Cálculo Google Sheets)
    const inputSheetsUrl = document.getElementById("input-sheets-url");
    if (inputSheetsUrl) {
      inputSheetsUrl.addEventListener("input", () => {
        inputSheetsUrl.dataset.userInteracted = "true";
      });
    }

    const sheetsForm = document.getElementById("sheets-config-form");
    if (sheetsForm) {
      sheetsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const inputUrlVal = document.getElementById("input-sheets-url").value.trim();
        
        if (inputUrlVal) {
          // 1. Validar si el usuario pegó la URL de la Hoja de Cálculo en lugar del Apps Script
          if (inputUrlVal.includes("docs.google.com/spreadsheets")) {
            alert("⚠️ ¡Atención! Has ingresado la URL de la Hoja de Cálculo (Google Sheets) en lugar del enlace de ejecución de Google Apps Script.\n\nPara que la base de datos funcione:\n1. Ve a tu hoja de Google Sheets.\n2. Haz clic en Extensiones ➡️ Apps Script.\n3. Copia el código que te mostramos abajo, pégalo allí y haz clic en Guardar.\n4. Haz clic en 'Implementar' ➡️ 'Nueva implementación'.\n5. Elige 'Aplicación web', configúrala para que sea ejecutada por 'Yo' y que 'Cualquier persona' tenga acceso.\n6. Copia la URL generada (que termina en '/exec') y pégala aquí.");
            return;
          }
          
          // 2. Validar que la URL pertenezca al dominio de Google Script y contenga /exec
          if (!inputUrlVal.startsWith("https://script.google.com/") || !inputUrlVal.includes("/exec")) {
            if (!confirm("⚠️ La URL ingresada no parece una URL de Google Apps Script Web App válida (generalmente empieza con 'https://script.google.com/macros/s/...' y termina en '/exec').\n\n¿Estás seguro de que deseas vincularla de todas formas?")) {
              return;
            }
          }

          localStorage.setItem("quiniela_google_sheets_url", inputUrlVal);
          // Guardar en la nube para sincronizar con todo el grupo automáticamente
          qStorage.updateCloudKey("sheets_url", inputUrlVal);
          alert("📊 ¡Google Sheets vinculado exitosamente! Las futuras predicciones se registrarán en tu hoja de cálculo.");
        } else {
          localStorage.removeItem("quiniela_google_sheets_url");
          // Remover de la nube
          qStorage.updateCloudKey("sheets_url", "");
          alert("🔌 Google Sheets desvinculado.");
        }
        
        if (inputSheetsUrl) {
          delete inputSheetsUrl.dataset.userInteracted;
        }
        
        this.refreshUI();
      });
    }

    // 5. Reiniciar Todo el Sistema
    document.getElementById("btn-reset-system").addEventListener("click", async () => {
      const profiles = qStorage.getProfiles();
      const activeUser = profiles[this.activeProfileId];
      if (!activeUser || !activeUser.isAdmin) {
        alert("Acceso denegado: No tienes permisos de administrador.");
        return;
      }
      if (confirm("⚠️ ¿Estás seguro de reiniciar la Quiniela? Se borrarán todas las predicciones y los resultados reales.")) {
        await qStorage.resetAllData();
        this.refreshUI();
        alert("🔄 Aplicación restablecida a cero.");
      }
    });

    // 6. Exportar Pronósticos
    document.getElementById("btn-export-predictions").addEventListener("click", () => {
      const allPreds = qStorage.getPredictions();
      const myPreds = allPreds[this.activeProfileId] || {};
      const profiles = qStorage.getProfiles();
      
      const fileData = {
        owner: profiles[this.activeProfileId].name,
        profileId: this.activeProfileId,
        predictions: myPreds,
        exportedAt: new Date().toISOString()
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fileData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `quiniela_pronosticos_${fileData.owner.toLowerCase()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // 7. Importar Pronósticos de Amigos
    const dropZone = document.getElementById("drop-zone-predictions");
    const fileInput = document.getElementById("import-predictions-file");
    
    if (dropZone && fileInput) {
      dropZone.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.handleImportedPredictions(file);
      });
    }

    // 8. Eventos de Onboarding
    const btnOnboardingNext = document.getElementById("btn-onboarding-next");
    const btnOnboardingSkip = document.getElementById("btn-onboarding-skip");
    if (btnOnboardingNext) {
      btnOnboardingNext.addEventListener("click", () => {
        this.showOnboardingStep(this.currentOnboardingStep + 1);
      });
    }
    if (btnOnboardingSkip) {
      btnOnboardingSkip.addEventListener("click", () => {
        this.endOnboarding();
      });
    }

    // 9. Botón Volver al Inicio (Back to Top)
    const btnBackToTop = document.getElementById("btn-back-to-top");
    if (btnBackToTop) {
      btnBackToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 10. Minimizar Menú Superior (Scroll Header)
    window.addEventListener("scroll", () => {
      const header = document.querySelector(".app-header");
      if (header) {
        if (window.scrollY > 50) {
          header.classList.add("minimized");
        } else {
          header.classList.remove("minimized");
        }
      }
    });
  }

  // --- FILTROS DE FASE ---
  renderStageFilters() {
    const container = document.getElementById("stage-filters-container");
    container.innerHTML = "";

    STAGES.forEach(stage => {
      const btn = document.createElement("button");
      btn.className = `filter-pill ${this.selectedStage === stage ? 'active' : ''}`;
      btn.textContent = stage;
      
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        this.selectedStage = stage;
        this.renderPredictions();
      });

      container.appendChild(btn);
    });
  }

  // --- UTILIDAD PARA BLOQUEO DE PARTIDOS ---
  isMatchLocked(dateStr, timeStr) {
    const monthMap = {
      "Junio": 5, // JS months are 0-indexed
      "Julio": 6
    };
    try {
      const parts = dateStr.split(" ");
      const day = parseInt(parts[0]);
      const month = monthMap[parts[2]];
      const year = parseInt(parts[3]);
      
      const timeParts = (timeStr || "18:00").split(":");
      const hour = parseInt(timeParts[0]);
      const min = parseInt(timeParts[1]);
      
      const matchDate = new Date(year, month, day, hour, min, 0);
      const now = new Date();
      
      return now >= matchDate;
    } catch (e) {
      return false;
    }
  }

  // --- RENDER DE PARTIDOS (PREDICCIONES) ---
  renderPredictions() {
    const grid = document.getElementById("predictions-matches-grid");
    grid.innerHTML = "";

    const matches = qStorage.getMatches();
    const predictions = qStorage.getPredictions();
    const myPredictions = predictions[this.activeProfileId] || {};

    // Valores de filtros avanzados
    const searchTeamVal = (document.getElementById("filter-search-team")?.value || "").toLowerCase().trim();
    const groupVal = document.getElementById("filter-select-group")?.value || "";
    const statusVal = document.getElementById("filter-select-status")?.value || "";

    // Filtrado por etapa, avanzado y ordenado cronológicamente
    const filteredMatches = matches.filter(match => {
      // 1. Filtro de Etapa Principal
      if (this.selectedStage !== "Todos") {
        if (this.selectedStage === "Finales") {
          if (match.stage !== "Tercer Lugar" && match.stage !== "Gran Final") return false;
        } else if (match.stage !== this.selectedStage) {
          return false;
        }
      }
      
      // 2. Filtro Buscador Predictivo (Equipos)
      if (searchTeamVal) {
        const hTeam = (match.homeTeam || "").toLowerCase();
        const aTeam = (match.awayTeam || "").toLowerCase();
        if (!hTeam.includes(searchTeamVal) && !aTeam.includes(searchTeamVal)) {
          return false;
        }
      }
      
      // 3. Filtro de Grupo
      if (groupVal && match.group !== groupVal) {
        return false;
      }
      
      // 4. Filtro de Estado
      if (statusVal) {
        const isLocked = this.isMatchLocked(match.date, match.time) || (match.realHomeScore !== null);
        if (statusVal === "pending" && isLocked) return false;
        if (statusVal === "locked" && !isLocked) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.utcDate && b.utcDate) {
        return new Date(a.utcDate) - new Date(b.utcDate);
      }
      // Fallback a ID numérico
      return parseInt(a.id.replace('m', '')) - parseInt(b.id.replace('m', ''));
    });

    // Guardar referencia al primer partido pendiente para auto-scroll
    let firstPendingMatchElement = null;

    // Determinar el corte entre partidos "viejos" y "actuales"
    // Encontrar el índice del último partido jugado (con resultado oficial)
    let lastPlayedIndex = -1;
    const isUserFiltering = searchTeamVal || groupVal || statusVal;
    
    filteredMatches.forEach((match, idx) => {
      if (match.realHomeScore !== null && match.realHomeScore !== undefined) {
        lastPlayedIndex = idx;
      }
    });

    // Si hay partidos jugados y el usuario no está filtrando, colapsar los viejos
    // Mostramos los últimos 3 partidos jugados + todos los pendientes
    const collapseThreshold = Math.max(0, lastPlayedIndex - 2); // Mostrar los 3 últimos jugados
    const shouldCollapse = !isUserFiltering && collapseThreshold > 0;

    // Crear contenedor colapsable para partidos viejos
    let collapsedContainer = null;
    let toggleBtn = null;

    if (shouldCollapse) {
      toggleBtn = document.createElement("button");
      toggleBtn.className = "collapse-toggle-btn";
      toggleBtn.innerHTML = `📂 Ver ${collapseThreshold} partidos anteriores`;
      toggleBtn.style.cssText = `
        grid-column: 1 / -1;
        width: 100%; padding: 14px; margin-bottom: 16px; 
        background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06));
        border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px;
        color: var(--text-muted); font-size: 14px; font-weight: 600;
        cursor: pointer; transition: all 0.3s ease;
        display: flex; align-items: center; justify-content: center; gap: 8px;
      `;
      toggleBtn.addEventListener("mouseenter", () => {
        toggleBtn.style.background = "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.15))";
        toggleBtn.style.borderColor = "rgba(16,185,129,0.4)";
        toggleBtn.style.color = "var(--accent-green)";
      });
      toggleBtn.addEventListener("mouseleave", () => {
        if (!collapsedContainer.classList.contains("expanded")) {
          toggleBtn.style.background = "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06))";
          toggleBtn.style.borderColor = "rgba(255,255,255,0.15)";
          toggleBtn.style.color = "var(--text-muted)";
        }
      });
      
      collapsedContainer = document.createElement("div");
      collapsedContainer.className = "collapsed-matches";
      collapsedContainer.style.cssText = `
        grid-column: 1 / -1;
        display: none; 
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px; margin-bottom: 16px;
      `;

      toggleBtn.addEventListener("click", () => {
        const isExpanded = collapsedContainer.classList.toggle("expanded");
        if (isExpanded) {
          collapsedContainer.style.display = "grid";
          toggleBtn.innerHTML = `📁 Ocultar partidos anteriores`;
          toggleBtn.style.background = "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.15))";
          toggleBtn.style.borderColor = "rgba(16,185,129,0.4)";
          toggleBtn.style.color = "var(--accent-green)";
        } else {
          collapsedContainer.style.display = "none";
          toggleBtn.innerHTML = `📂 Ver ${collapseThreshold} partidos anteriores`;
          toggleBtn.style.background = "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06))";
          toggleBtn.style.borderColor = "rgba(255,255,255,0.15)";
          toggleBtn.style.color = "var(--text-muted)";
        }
      });

      grid.appendChild(toggleBtn);
      grid.appendChild(collapsedContainer);
    }

    filteredMatches.forEach((match, matchIndex) => {
      const pred = myPredictions[match.id] || { home: "", away: "" };
      const isLocked = this.isMatchLocked(match.date, match.time) || (match.realHomeScore !== null);
      
      const card = document.createElement("div");
      card.className = "match-card" + (isLocked ? " locked-compact" : "");

      const disabledAttr = isLocked ? 'disabled="true"' : '';

      // Formatear footer según si ya se jugó el partido
      let footerHtml = "";
      if (match.realHomeScore !== null && match.realHomeScore !== undefined && match.realAwayScore !== null && match.realAwayScore !== undefined) {
        // El partido ya se jugó
        const points = qStorage.calculateMatchPoints(
          pred.home,
          pred.away,
          match.realHomeScore,
          match.realAwayScore
        );

        let badgeClass = "none";
        let badgeIcon = "❌";
        let badgeText = "Sin Aciertos (+0 pts)";

        if (points === 3) {
          badgeClass = "gold";
          badgeIcon = "🌟";
          badgeText = "Marcador Exacto (+3 pts)";
        } else if (points === 1) {
          badgeClass = "green";
          badgeIcon = "🎯";
          badgeText = "Acierto de Tendencia (+1 pt)";
        }

        footerHtml = `
          <div class="match-card-footer">
            <div class="real-score-indicator">
              ⚽ Resultado Oficial: ${match.realHomeScore} - ${match.realAwayScore}
            </div>
            <div class="points-result-badge ${badgeClass}" style="margin-top: 10px;">
              ${badgeIcon} ${badgeText}
            </div>
          </div>
        `;
      } else {
        // El partido no se ha jugado o no tiene score oficial aún
        let statusText = (pred.home !== "" && pred.home !== null && pred.home !== undefined) ? "🔒 Guardado" : "⏳ Pendiente";
        if (isLocked) {
           statusText = "🔒 Partido Cerrado";
        }
        
        let liveScoreHtml = "";
        const key = `${match.homeTeam} vs ${match.awayTeam}`;
        if (this.liveScores && this.liveScores[key]) {
           const live = this.liveScores[key];
           let displayStatus = live.status.toUpperCase();
           if (live.status === "First Half") displayStatus = "1ER TIEMPO";
           else if (live.status === "Second Half") displayStatus = "2DO TIEMPO";
           else if (live.status === "Halftime") displayStatus = "ENTRETIEMPO";
           else if (live.status === "Full Time") displayStatus = "FINALIZADO";
           else if (live.status === "Extra Time" || live.status === "Overtime") displayStatus = "ALARGUE";
           else if (live.status === "Penalties") displayStatus = "PENALES";
           else if (live.status === "In Progress") displayStatus = "EN JUEGO";
           
           if (live.detail && !["TBD", "FT", "HT"].includes(live.detail) && !live.detail.includes("EDT") && !live.detail.includes("PDT")) {
              displayStatus = `${displayStatus} - ${live.detail}`;
           }
           const isLive = live.status !== "Scheduled" && live.status !== "Postponed";
           if (isLive) {
             const livePts = qStorage.calculateMatchPoints(
               pred.home,
               pred.away,
               live.hScore,
               live.aScore
             );

             let badgeClass = "none";
             let badgeIcon = "❌";
             let badgeText = "Sin Aciertos (+0 pts)";

             if (livePts === 3) {
               badgeClass = "gold";
               badgeIcon = "🌟";
               badgeText = "Marcador Exacto (+3 pts)";
             } else if (livePts === 1) {
               badgeClass = "green";
               badgeIcon = "🎯";
               badgeText = "Acierto de Tendencia (+1 pt)";
             }

             liveScoreHtml = `
               <div class="real-score-indicator" style="background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.2);">
                 🔴 EN VIVO (${displayStatus}): ${live.hScore} - ${live.aScore}
               </div>
               <div class="points-result-badge ${badgeClass}" style="margin-top: 10px; opacity: 0.9;">
                 ${badgeIcon} ${badgeText} (Proyectado)
               </div>
             `;
           }
        }
        
        let duelHtml = "";
        let mNum = parseInt(match.id.replace("m", ""));
        // Solo permitir duelos si el partido es desde octavos (m89) y NO está bloqueado (no ha empezado)
        if (mNum >= 89 && !isLocked) {
          duelHtml = `
            <button class="btn-duel-trigger" style="margin-top: 12px; width: 100%; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05)); border: 1px solid var(--accent-green); color: var(--accent-green); padding: 8px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;" onclick="window.app.openDuelModal('${match.id}')">
              ⚔️ Retar a Duelo 1vs1
            </button>
          `;
        }
        
        footerHtml = `
          <div class="match-card-footer">
            ${liveScoreHtml}
            <div class="partner-prediction-row" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); ${liveScoreHtml ? 'margin-top:8px;' : ''}">
              <span>Estado de tu Pronóstico:</span>
              <strong>${statusText}</strong>
            </div>
            ${duelHtml}
          </div>
        `;
      }

      let recommendationHtml = "";
      if (match.recommendation) {
        let probHtml = "";
        if (match.recommendation.probability) {
          const prob = match.recommendation.probability;
          probHtml = `
            <div class="prob-container" style="margin-top: 10px; display: flex; flex-direction: column; gap: 4px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 2px;">
                <span>PROBABILIDADES (POISSON)</span>
                <span>Moda Matemática</span>
              </div>
              <div style="display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: rgba(255,255,255,0.05);">
                <div style="width: ${prob.home}%; background: linear-gradient(90deg, #3b82f6, #60a5fa);" title="Victoria Local: ${prob.home}%"></div>
                <div style="width: ${prob.draw}%; background: linear-gradient(90deg, #64748b, #94a3b8);" title="Empate: ${prob.draw}%"></div>
                <div style="width: ${prob.away}%; background: linear-gradient(90deg, #ef4444, #f87171);" title="Victoria Visitante: ${prob.away}%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 2px;">
                <span style="color: #60a5fa; font-weight: 500;">🔵 Local: ${prob.home}%</span>
                <span style="color: #94a3b8; font-weight: 500;">⚪ Empate: ${prob.draw}%</span>
                <span style="color: #f87171; font-weight: 500;">🔴 Visita: ${prob.away}%</span>
              </div>
            </div>
          `;
        }

        recommendationHtml = `
          <div class="recommendation-box" style="margin-top: 12px; padding: 12px; background: rgba(16, 185, 129, 0.06); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2); font-size: 12px; line-height: 1.4;">
            <div style="font-weight: 600; color: var(--accent-green); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span>🤖 Modelo Predictivo:</span>
              <strong style="background: rgba(16, 185, 129, 0.15); padding: 2px 8px; border-radius: 4px; font-size: 13px; border: 1px solid rgba(16, 185, 129, 0.4);">${match.recommendation.homeScore} - ${match.recommendation.awayScore}</strong>
            </div>
            <div style="color: var(--text-muted); font-style: italic; margin-bottom: 4px;">"${match.recommendation.rationale}"</div>
            ${probHtml}
          </div>
        `;
      }

      let localDateStr = match.date;
      let localTimeStr = match.time || '18:00';
      if (match.utcDate) {
        try {
          const dt = new Date(match.utcDate);
          localDateStr = dt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
          localTimeStr = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch(e) {}
      }

      card.innerHTML = `
        <div class="match-header-info">
          <span class="match-stage-badge">${match.stage}${match.group ? ` • ${match.group}` : ''}</span>
          <span style="font-weight: 500;">📅 ${localDateStr}</span>
        </div>
        
        <div class="match-meta-details" style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); padding: 4px 0 8px 0; border-bottom: 1px dashed var(--border-light); margin-bottom: 10px;">
          <span>🕒 ${localTimeStr} hrs</span>
          <span style="text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px;" title="${match.stadium || 'Estadio Mundialista'}">🏟️ ${match.stadium || 'Estadio Mundialista'}</span>
        </div>
        
        <div class="match-teams-layout">
          <!-- Equipo Local -->
          <div class="team-block">
            <img src="${this.getFlagUrl(match.homeFlagCode)}" class="team-flag-img" alt="${match.homeTeam}">
            <span class="team-name">${match.homeTeam}</span>
          </div>
          
          <!-- Inputs de Predicción -->
          <div class="score-inputs-wrapper">
            <select class="prediction-input" 
                    ${disabledAttr}
                    data-match-id="${match.id}" 
                    data-team="home" 
                    aria-label="Predicción goles ${match.homeTeam}">
              ${this.getScoreOptionsHtml(pred.home)}
            </select>
            <span class="score-divider">-</span>
            <select class="prediction-input" 
                    ${disabledAttr}
                    data-match-id="${match.id}" 
                    data-team="away" 
                    aria-label="Predicción goles ${match.awayTeam}">
              ${this.getScoreOptionsHtml(pred.away)}
            </select>
          </div>
          
          <!-- Equipo Visita -->
          <div class="team-block">
            <img src="${this.getFlagUrl(match.awayFlagCode)}" class="team-flag-img" alt="${match.awayTeam}">
            <span class="team-name">${match.awayTeam}</span>
          </div>
        </div>

        ${recommendationHtml}
        ${footerHtml}
      `;

      // Eventos de entrada en los inputs para guardado automático
      const inputs = card.querySelectorAll(".prediction-input");
      inputs.forEach(input => {
        input.addEventListener("change", (e) => {
          const mId = e.target.getAttribute("data-match-id");
          const team = e.target.getAttribute("data-team");
          
          const homeInput = card.querySelector(`[data-match-id="${mId}"][data-team="home"]`);
          const awayInput = card.querySelector(`[data-match-id="${mId}"][data-team="away"]`);
          
          const homeVal = homeInput.value === "" ? null : parseInt(homeInput.value);
          const awayVal = awayInput.value === "" ? null : parseInt(awayInput.value);
          
          // Guardar predicción en localStorage
          qStorage.savePrediction(this.activeProfileId, mId, homeVal, awayVal);
          
          // Actualizar marcador superior dinámicamente
          const profiles = qStorage.getProfiles();
          document.getElementById("header-val-active").textContent = profiles[this.activeProfileId].points;

          // ACTUALIZAR ETIQUETA VISUAL inmediatamente
          const footerRow = card.querySelector(".partner-prediction-row strong");
          if (footerRow) {
            if (homeVal !== null && awayVal !== null) {
              footerRow.innerHTML = `<span style="color: var(--accent-green);">💾 Guardando...</span>`;
              setTimeout(() => {
                footerRow.innerHTML = "🔒 Guardado";
              }, 1000);
            } else {
              footerRow.innerHTML = "⏳ Pendiente";
            }
          }
        });
      });

      // Decidir si este partido va en la sección colapsada o en la principal
      if (shouldCollapse && matchIndex < collapseThreshold) {
        collapsedContainer.appendChild(card);
      } else {
        grid.appendChild(card);
      }
      
      // Auto-scroll logic: Capturar el primer partido pendiente
      if (!isLocked && !firstPendingMatchElement) {
        firstPendingMatchElement = card;
      }
    });

    // Ejecutar scroll automático si hay un partido pendiente y no se han usado filtros específicos
    // (no queremos auto-scroll si el usuario está buscando explícitamente algo)
    if (firstPendingMatchElement && !searchTeamVal && !groupVal && !statusVal) {
      setTimeout(() => {
        // Obtenemos el navbar height (aprox 60px) más filtros
        const yOffset = -180; 
        const y = firstPendingMatchElement.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({top: y, behavior: 'smooth'});
      }, 500); // Pequeño delay para asegurar que el DOM pintó
    }
  }

  // --- RENDER DE RANKING GLOBAL ---
  renderComparison() {
    const tbody = document.getElementById("leaderboard-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const profilesObj = qStorage.getProfiles();
    
    // Transformar objeto en array y ordenar por puntos (de mayor a menor)
    const profiles = Object.values(profilesObj).sort((a, b) => b.points - a.points);

    profiles.forEach((p, index) => {
      const row = document.createElement("tr");
      
      let posTpl = `<strong>${index + 1}</strong>`;
      if (index === 0) posTpl = `<span style="font-size:20px;">🥇</span>`;
      else if (index === 1) posTpl = `<span style="font-size:20px;">🥈</span>`;
      else if (index === 2) posTpl = `<span style="font-size:20px;">🥉</span>`;

      // Resaltar tu propio perfil
      const isMe = p.id === this.activeProfileId ? `style="background: rgba(16, 185, 129, 0.1);"` : "";

      row.innerHTML = `
        <td style="text-align: center; vertical-align: middle;">${posTpl}</td>
        <td ${isMe}>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; font-size: 16px;">
              ${p.avatar}
            </div>
            <strong style="color: var(--primary);">${p.name}</strong> ${p.id === this.activeProfileId ? "(Tú)" : ""}
          </div>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <span style="font-size: 20px; font-weight: 700; color: var(--accent-green);">${p.points}</span>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  // --- RENDER DE ADMINISTRADOR (INGRESAR MARCADOR REAL) ---
  renderAdminMatches() {
    const list = document.getElementById("admin-matches-list");
    list.innerHTML = "";

    const matches = qStorage.getMatches();

    matches.forEach(match => {
      const row = document.createElement("div");
      row.className = "admin-match-row";

      const hVal = match.realHomeScore !== null ? match.realHomeScore : "";
      const aVal = match.realAwayScore !== null ? match.realAwayScore : "";

      row.innerHTML = `
        <div class="team-block" style="text-align: left;">
          <img src="${this.getFlagUrl(match.homeFlagCode)}" class="team-flag-img" style="width: 24px; border-radius: 2px;" alt="${match.homeTeam}">
          <span style="font-weight: 600; font-size: 13px;">${match.homeTeam}</span>
        </div>
        
        <div class="score-inputs-wrapper">
          <select class="admin-input" 
                  data-admin-match-id="${match.id}" 
                  data-admin-team="home" 
                  aria-label="Marcador real ${match.homeTeam}">
            ${this.getScoreOptionsHtml(hVal)}
          </select>
          <span class="score-divider">:</span>
          <select class="admin-input" 
                  data-admin-match-id="${match.id}" 
                  data-admin-team="away" 
                  aria-label="Marcador real ${match.awayTeam}">
            ${this.getScoreOptionsHtml(aVal)}
          </select>
        </div>

        <div class="team-block visita" style="text-align: right;">
          <span style="font-weight: 600; font-size: 13px; margin-right: 12px;">${match.awayTeam}</span>
          <img src="${this.getFlagUrl(match.awayFlagCode)}" class="team-flag-img" style="width: 24px; border-radius: 2px;" alt="${match.awayTeam}">
        </div>
      `;

      // Registrar cambios en el marcador real
      const inputs = row.querySelectorAll(".admin-input");
      inputs.forEach(input => {
        input.addEventListener("change", (e) => {
          const profiles = qStorage.getProfiles();
          const activeUser = profiles[this.activeProfileId];
          if (!activeUser || !activeUser.isAdmin) {
            alert("Acceso denegado: No tienes permisos de administrador.");
            this.refreshUI();
            return;
          }
          const mId = e.target.getAttribute("data-admin-match-id");
          
          const homeInput = row.querySelector(`[data-admin-match-id="${mId}"][data-admin-team="home"]`);
          const awayInput = row.querySelector(`[data-admin-match-id="${mId}"][data-admin-team="away"]`);
          
          const homeVal = homeInput.value === "" ? null : parseInt(homeInput.value);
          const awayVal = awayInput.value === "" ? null : parseInt(awayInput.value);
          
          // Comprobar si al ingresar esto genera un marcador exacto de 3 puntos del usuario activo
          const activePreds = qStorage.getPredictions()[this.activeProfileId] || {};
          const myPred = activePreds[mId];
          const matchesList = qStorage.getMatches();
          const activeMatch = matchesList.find(m => m.id === mId);
          
          const hadRealScore = activeMatch.realHomeScore !== null;
          
          // Guardar resultado
          qStorage.saveRealScore(mId, homeVal, awayVal);

          // Si antes no tenía marcador real, ahora sí, y acertó exacto: lanzamos CONFETI
          if (!hadRealScore && homeVal !== null && awayVal !== null && myPred) {
            if (myPred.home === homeVal && myPred.away === awayVal) {
              this.triggerConfetti();
            }
          }
          
          // Actualizar marcadores generales
          const updatedProfiles = qStorage.getProfiles();
          document.getElementById("header-val-active").textContent = updatedProfiles[this.activeProfileId].points;
        });
      });

      list.appendChild(row);
    });
  }

  // --- IMPORTACIÓN DE PRONÓSTICOS DE AMIGOS ---
  handleImportedPredictions(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.predictions || !data.profileId) {
          throw new Error("El archivo no contiene un formato de quiniela válido.");
        }

        const allPredictions = qStorage.getPredictions();
        // Guardamos las predicciones cargadas como un nuevo perfil si no existe, o reemplazamos
        allPredictions[data.profileId] = data.predictions;
        localStorage.setItem(qStorage.STORAGE_KEYS.PREDICTIONS, JSON.stringify(allPredictions));

        // Asegurarnos de que el perfil exista en la base de datos de perfiles
        const profiles = qStorage.getProfiles();
        if (!profiles[data.profileId]) {
          profiles[data.profileId] = {
            id: data.profileId,
            name: data.owner || "Jugador Externo",
            avatar: "🌍",
            points: 0
          };
          localStorage.setItem(qStorage.STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
        }

        // Recalcular puntos
        qStorage.recalculateAllPoints();
        this.refreshUI();

        alert(`🎉 ¡Éxito! Se han importado las predicciones de ${data.owner || "tu amigo"}.`);
      } catch (err) {
        alert("Error al importar el archivo JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  // --- MOTOR DE CONFETI DE CANVAS ---
  setupConfetti() {
    if (!this.canvas) return;
    
    const resizeCanvas = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    };
    
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
  }

  triggerConfetti() {
    if (this.confettiActive) return;
    this.confettiActive = true;
    this.confettiParticles = [];

    // Crear 120 partículas de papel de colores
    const colors = ["#D4AF37", "#10B981", "#3B82F6", "#EF4444", "#F59E0B", "#FFF"];
    for (let i = 0; i < 120; i++) {
      this.confettiParticles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * -this.canvas.height - 20,
        r: Math.random() * 6 + 4,
        d: Math.random() * this.canvas.height,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: 0
      });
    }

    const startTime = Date.now();
    const animate = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      let particlesFalling = false;
      
      this.confettiParticles.forEach((p) => {
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
        p.x += Math.sin(p.tiltAngle);
        p.tilt = Math.sin(p.tiltAngle - p.r/2) * 5;

        if (p.y < this.canvas.height) {
          particlesFalling = true;
        }

        this.ctx.beginPath();
        this.ctx.lineWidth = p.r;
        this.ctx.strokeStyle = p.color;
        this.ctx.moveTo(p.x + p.tilt + p.r/2, p.y);
        this.ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r/2);
        this.ctx.stroke();
      });

      // Detener el loop tras 4 segundos o si todos caen
      if (particlesFalling && Date.now() - startTime < 4000) {
        requestAnimationFrame(animate);
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.confettiActive = false;
      }
    };

    animate();
  }

  // --- MOTOR DE ONBOARDING TOUR ---
  startOnboarding() {
    if (localStorage.getItem("quiniela_onboarding_completed") === "true") {
      return;
    }
    
    // Si la pantalla de inicio de sesión está visible, no iniciar el onboarding
    const overlay = document.getElementById("profile-overlay");
    if (overlay && (overlay.offsetHeight > 0 || window.getComputedStyle(overlay).display !== "none")) {
      return;
    }
    
    if (!this.activeProfileId) {
      return;
    }

    // Agregar clase de onboarding activo al body
    document.body.classList.add("onboarding-active");

    this.onboardingSteps = [
      {
        emoji: "👋",
        title: "¡Bienvenido a la Quiniela!",
        text: "Esta aplicación te permite jugar la quiniela de fútbol con amigos, con puntuaciones en tiempo real y sincronización en la nube.",
        targetSelector: null
      },
      {
        emoji: "⚽",
        title: "Tus Pronósticos",
        text: "Aquí verás los próximos partidos. Ingresa tus marcadores de forma interactiva y se guardarán automáticamente en la nube.",
        targetSelector: "#tab-predictions",
        view: "predictions"
      },
      {
        emoji: "🏆",
        title: "Ranking Global",
        text: "En esta sección podrás comparar tus puntos acumulados con los de todos los participantes del grupo en tiempo real.",
        targetSelector: "#tab-comparison",
        view: "comparison"
      },
      {
        emoji: "👤",
        title: "Tu Perfil Activo",
        text: "Haz clic aquí para ver tus detalles, cerrar la sesión o cambiar de cuenta en este dispositivo.",
        targetSelector: "#active-profile-pill"
      },
      {
        emoji: "⚙️",
        title: "Configuración y Grupos",
        text: "¡Lo más divertido es jugar en grupo! Ve a ajustes para cambiar tu nombre, unirte al ID del grupo de tus amigos o sincronizar con Google Sheets.",
        targetSelector: "#tab-settings",
        view: "settings"
      }
    ];

    this.currentOnboardingStep = 0;
    this.showOnboardingStep(0);
  }

  showOnboardingStep(index) {
    document.querySelectorAll(".onboarding-highlight").forEach(el => {
      el.classList.remove("onboarding-highlight");
    });

    if (index < 0 || index >= this.onboardingSteps.length) {
      this.endOnboarding();
      return;
    }

    this.currentOnboardingStep = index;
    const step = this.onboardingSteps[index];

    const emojiEl = document.getElementById("onboarding-emoji");
    const titleEl = document.getElementById("onboarding-title");
    const textEl = document.getElementById("onboarding-text");
    const stepsEl = document.getElementById("onboarding-steps");
    const btnNext = document.getElementById("btn-onboarding-next");
    const tooltipEl = document.getElementById("onboarding-tooltip");

    if (emojiEl) emojiEl.textContent = step.emoji;
    if (titleEl) titleEl.textContent = step.title;
    if (textEl) textEl.textContent = step.text;
    if (stepsEl) stepsEl.textContent = `${index + 1} / ${this.onboardingSteps.length}`;
    if (btnNext) {
      if (index === this.onboardingSteps.length - 1) {
        btnNext.textContent = "¡Entendido! 🎉";
      } else {
        btnNext.textContent = "Siguiente ➡️";
      }
    }

    if (!tooltipEl) return;

    if (step.view) {
      const tabBtn = document.getElementById(`tab-${step.view}`);
      if (tabBtn) {
        tabBtn.click();
      }
    }

    if (step.targetSelector) {
      const targetEl = document.querySelector(step.targetSelector);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        
        setTimeout(() => {
          targetEl.classList.add("onboarding-highlight");
          tooltipEl.style.display = "block";
          
          const rect = targetEl.getBoundingClientRect();
          let top = rect.bottom + 12;
          let left = rect.left + (rect.width / 2) - 160;

          if (left < 10) left = 10;
          if (left > window.innerWidth - 330) left = window.innerWidth - 330;

          tooltipEl.style.transform = "";
          tooltipEl.className = "onboarding-tooltip active";

          if (top + 220 > window.innerHeight) {
            top = rect.top - tooltipEl.offsetHeight - 12;
            tooltipEl.classList.add("arrow-bottom");
          } else {
            tooltipEl.classList.add("arrow-top");
          }

          tooltipEl.style.top = `${top}px`;
          tooltipEl.style.left = `${left}px`;
        }, 300);
      } else {
        this.centerOnboardingTooltip(tooltipEl);
      }
    } else {
      this.centerOnboardingTooltip(tooltipEl);
    }
  }

  centerOnboardingTooltip(tooltipEl) {
    tooltipEl.style.display = "block";
    tooltipEl.className = "onboarding-tooltip active";
    tooltipEl.style.top = "50%";
    tooltipEl.style.left = "50%";
    tooltipEl.style.transform = "translate(-50%, -50%) scale(1)";
  }

  endOnboarding() {
    document.body.classList.remove("onboarding-active");
    
    document.querySelectorAll(".onboarding-highlight").forEach(el => {
      el.classList.remove("onboarding-highlight");
    });
    const tooltipEl = document.getElementById("onboarding-tooltip");
    if (tooltipEl) {
      tooltipEl.classList.remove("active");
      setTimeout(() => {
        tooltipEl.style.display = "none";
      }, 300);
    }
    localStorage.setItem("quiniela_onboarding_completed", "true");
    
    const tabPreds = document.getElementById("tab-predictions");
    if (tabPreds) {
      tabPreds.click();
    }
  }

  // --- LOGICA DE DUELOS PvP ---
  initDuels() {
    document.getElementById("tab-duels").addEventListener("click", () => this.openMyDuelsModal());
    document.getElementById("btn-close-duel").addEventListener("click", () => {
      document.getElementById("duel-modal").style.display = "none";
    });
    document.getElementById("btn-close-my-duels").addEventListener("click", () => {
      document.getElementById("my-duels-modal").style.display = "none";
    });

    document.getElementById("btn-submit-duel").addEventListener("click", async () => {
      const oppId = document.getElementById("duel-opponent-select").value;
      if (!oppId) return alert("Selecciona a un oponente.");
      
      const btn = document.getElementById("btn-submit-duel");
      btn.textContent = "⏳ Enviando Reto...";
      btn.disabled = true;
      
      const success = await qStorage.sendDuel(this.currentDuelMatchId, this.activeProfileId, oppId);
      
      btn.textContent = "Envíar Reto ⚔️";
      btn.disabled = false;
      
      if (success) {
        alert("¡Reto enviado exitosamente! Espera a que el oponente lo acepte.");
        document.getElementById("duel-modal").style.display = "none";
      } else {
        alert("Hubo un error al enviar el reto. Revisa tu conexión a Firebase.");
      }
    });
  }

  openDuelModal(matchId) {
    if (!this.activeProfileId) return alert("Inicia sesión primero");
    
    // Verificar si el partido ya empezó
    const match = qStorage.getMatches().find(m => m.id === matchId);
    if (!match) return;
    const isStarted = this.liveScores && this.liveScores[`${match.homeTeam} vs ${match.awayTeam}`] && this.liveScores[`${match.homeTeam} vs ${match.awayTeam}`].status !== "Scheduled" && this.liveScores[`${match.homeTeam} vs ${match.awayTeam}`].status !== "Postponed";
    if (isStarted || match.isCompleted) return alert("El partido ya empezó o terminó. ¡Demasiado tarde!");

    this.currentDuelMatchId = matchId;
    
    const select = document.getElementById("duel-opponent-select");
    select.innerHTML = '<option value="">Selecciona un oponente...</option>';
    const profiles = qStorage.getProfiles();
    Object.keys(profiles).forEach(pId => {
      if (pId !== this.activeProfileId && profiles[pId].name) {
        select.innerHTML += `<option value="${pId}">${profiles[pId].avatar} ${profiles[pId].name}</option>`;
      }
    });

    // Mostrar mi predicción si existe
    const predDiv = document.getElementById("duel-my-prediction");
    const allPreds = qStorage.getPredictions();
    const predVal = (allPreds[this.activeProfileId] && allPreds[this.activeProfileId][matchId]) ? allPreds[this.activeProfileId][matchId] : null;
    if (predVal && predVal.home !== null && predVal.away !== null) {
      predDiv.textContent = `${predVal.home} - ${predVal.away}`;
    } else {
      predDiv.textContent = "¡Aún no has predicho este partido!";
      predDiv.style.color = "var(--accent-red)";
    }

    document.getElementById("duel-modal").style.display = "flex";
  }

  async openMyDuelsModal() {
    if (!this.activeProfileId) return alert("Inicia sesión primero");
    
    document.getElementById("my-duels-modal").style.display = "flex";
    
    const divReceived = document.getElementById("duels-pending-received-list");
    const divSent = document.getElementById("duels-pending-sent-list");
    const divActive = document.getElementById("duels-active-list");
    
    divReceived.innerHTML = "Cargando...";
    divSent.innerHTML = "Cargando...";
    divActive.innerHTML = "Cargando...";
    
    const duels = await qStorage.getDuels();
    const profiles = qStorage.getProfiles();
    
    divReceived.innerHTML = "";
    divSent.innerHTML = "";
    divActive.innerHTML = "";
    
    let cReceived = 0, cSent = 0, cActive = 0;
    
    duels.forEach(d => {
      const match = qStorage.getMatches().find(m => m.id === d.matchId);
      if (!match) return;
      
      const isMeChallenger = d.challengerId === this.activeProfileId;
      const isMeDefender = d.defenderId === this.activeProfileId;
      
      if (!isMeChallenger && !isMeDefender) return; // No es mi duelo
      
      const oppId = isMeChallenger ? d.defenderId : d.challengerId;
      const opp = profiles[oppId] || { name: oppId, avatar: "👤" };
      
      // Determine if match started
      const isStarted = this.liveScores && this.liveScores[`${match.homeTeam} vs ${match.awayTeam}`] && this.liveScores[`${match.homeTeam} vs ${match.awayTeam}`].status !== "Scheduled" && this.liveScores[`${match.homeTeam} vs ${match.awayTeam}`].status !== "Postponed";
      
      const card = document.createElement("div");
      card.className = "duel-card" + (d.status === "accepted" ? " active" : "");
      
      let actionsHtml = "";
      
      if (d.status === "pending") {
        if (isStarted || match.isCompleted) {
          actionsHtml = `<div style="color:var(--text-muted); font-size:11px;">El partido empezó. Reto expirado.</div>`;
        } else {
          if (isMeDefender) {
            cReceived++;
            actionsHtml = `
              <div class="duel-actions">
                <button class="btn-duel" onclick="window.app.respondDuel('${d.id}', 'accepted', this)">✅ Aceptar Reto</button>
                <button class="btn-duel btn-duel-reject" onclick="window.app.respondDuel('${d.id}', 'rejected', this)">❌ Rechazar</button>
              </div>
            `;
            card.innerHTML = `
              <div class="duel-header">
                <span class="duel-match-info">${match.homeTeam} vs ${match.awayTeam}</span>
                <span style="color:var(--accent-red);">NUEVO RETO</span>
              </div>
              <div style="font-size: 13px; margin: 4px 0;"><strong>${opp.avatar} ${opp.name}</strong> te ha retado. ¿Aceptas?</div>
              ${actionsHtml}
            `;
            divReceived.appendChild(card);
            return;
          } else {
            cSent++;
            actionsHtml = `<div style="color:var(--accent-blue); font-size:11px;">Esperando que acepte...</div>`;
            card.innerHTML = `
              <div class="duel-header">
                <span class="duel-match-info">${match.homeTeam} vs ${match.awayTeam}</span>
                <span>PENDIENTE</span>
              </div>
              <div style="font-size: 13px; margin: 4px 0;">Retaste a <strong>${opp.avatar} ${opp.name}</strong>.</div>
              ${actionsHtml}
            `;
            divSent.appendChild(card);
            return;
          }
        }
      } else if (d.status === "accepted") {
        cActive++;
        
        let resultHtml = "";
        // If finished, calculate points stolen
        if (match.isCompleted) {
            // Evaluated by cron, but we can show it here if we want, or just say 'Finalizado'
            resultHtml = `<div style="margin-top:8px; font-size:11px; font-weight:bold; color:var(--accent-green); text-align:center;">El cron procesará los resultados (Puntos robados +3/-3 si hay exacto).</div>`;
        }
        
        card.innerHTML = `
          <div class="duel-header">
            <span class="duel-match-info">${match.homeTeam} vs ${match.awayTeam}</span>
            <span style="color:var(--accent-green);">ACEPTADO</span>
          </div>
          <div class="duel-players">
            <div class="duel-player">
              <div class="duel-player-name">${isMeChallenger ? 'Tú' : opp.avatar + ' ' + opp.name}</div>
            </div>
            <div class="duel-vs">VS</div>
            <div class="duel-player">
              <div class="duel-player-name">${!isMeChallenger ? 'Tú' : opp.avatar + ' ' + opp.name}</div>
            </div>
          </div>
          ${resultHtml}
        `;
        divActive.appendChild(card);
        return;
      }
    });
    
    if (cReceived === 0) divReceived.innerHTML = "<div style='color:var(--text-muted); font-size:12px;'>No tienes retos nuevos.</div>";
    if (cSent === 0) divSent.innerHTML = "<div style='color:var(--text-muted); font-size:12px;'>No has enviado retos pendientes.</div>";
    if (cActive === 0) divActive.innerHTML = "<div style='color:var(--text-muted); font-size:12px;'>No tienes duelos activos.</div>";
  }

  async respondDuel(duelId, status, btn) {
    btn.textContent = "⏳";
    btn.disabled = true;
    const success = await qStorage.updateDuelStatus(duelId, status);
    if (success) {
      this.openMyDuelsModal(); // Refrescar
    } else {
      alert("Error al responder el duelo.");
      btn.textContent = "Intentar de nuevo";
      btn.disabled = false;
    }
  }
}

const qApp = new QuinielaApp();
window.app = qApp; // Ensure it's available globally if needed by onclick handlers
