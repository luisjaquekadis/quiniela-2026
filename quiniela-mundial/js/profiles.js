// Módulo de Gestión de Perfiles, Almacenamiento Local y Reglas de Puntaje

class QuinielaStorage {
  constructor() {
    this.STORAGE_KEYS = {
      PROFILES: "quiniela_profiles_v8",
      PREDICTIONS: "quiniela_predictions_v8",
      MATCHES: "quiniela_matches_v11",
      ACTIVE_PROFILE: "quiniela_active_profile_v8"
    };
    this.APP_KEY = "quiniela_shared_prod_NcQT3A99";
    this.API_URL = "https://keyvalue.immanuel.co/api/KeyVal";
  }

  // Helpers de codificación y decodificación seguros para Unicode y URL-safe (evitando / y + que bloquea IIS)
  base64Encode(str) {
    try {
      const bytes = new TextEncoder().encode(str);
      const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
      const b64 = btoa(binString);
      // Hacerlo URL-safe: reemplazar + por -, / por _ y quitar = de padding
      return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    } catch (e) {
      console.error("Error encoding base64:", e);
      return "";
    }
  }

  base64Decode(str) {
    try {
      if (!str) return "";
      // Limpiar comillas adicionales por si acaso el JSON traía comillas dobles literales
      let cleanStr = str.replace(/^"|"$/g, '').trim();
      
      // Restaurar URL-safe a standard Base64: reemplazar - por +, _ por /
      cleanStr = cleanStr.replace(/-/g, "+").replace(/_/g, "/");
      
      // Re-agregar padding de = si es necesario
      const pad = cleanStr.length % 4;
      if (pad === 2) {
        cleanStr += "==";
      } else if (pad === 3) {
        cleanStr += "=";
      }
      
      const binString = atob(cleanStr);
      const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
      return new TextDecoder().decode(bytes);
    } catch (e) {
      console.error("Error decoding base64:", e, str);
      return "";
    }
  }

  getCloudKeyString(key) {
    const groupId = localStorage.getItem("quiniela_group_id") || "default";
    if (groupId === "default") {
      return key; // Retrocompatibilidad
    }
    return `${groupId}_${key}`;
  }

  async joinGroup(groupId) {
    const cleanId = groupId ? groupId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : "default";
    
    // Preservar el perfil activo actual y sus predicciones para que viajen al nuevo grupo
    const currentActiveId = this.getActiveProfileId();
    let currentProfile = null;
    let currentPredictions = null;
    
    if (currentActiveId) {
      const profiles = this.getProfiles() || {};
      currentProfile = profiles[currentActiveId];
      
      const preds = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.PREDICTIONS)) || {};
      currentPredictions = preds[currentActiveId];
    }
    
    localStorage.setItem("quiniela_group_id", cleanId || "default");
    
    // Limpiamos los datos locales del grupo anterior
    localStorage.removeItem(this.STORAGE_KEYS.PROFILES);
    localStorage.removeItem(this.STORAGE_KEYS.PREDICTIONS);
    localStorage.removeItem(this.STORAGE_KEYS.MATCHES);
    
    // Inyectamos el perfil y predicciones actuales en el nuevo grupo (localmente)
    if (currentProfile) {
      const newProfiles = { [currentProfile.id]: currentProfile };
      localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(newProfiles));
      
      if (currentPredictions) {
        const newPreds = { [currentActiveId]: currentPredictions };
        localStorage.setItem(this.STORAGE_KEYS.PREDICTIONS, JSON.stringify(newPreds));
      }
      
      // EXPLICITAMENTE SUBIRLOS A LA NUBE DEL NUEVO GRUPO
      await this.updateCloudKey(`profiles_${currentProfile.id}`, currentProfile);
      if (currentPredictions) {
        await this.updateCloudKey(`predictions_${currentActiveId}`, currentPredictions);
      }
    }
    
    await this.initData();
    await this.syncFromCloud();
  }

  // Convierte los resultados reales a una cadena compacta: "2-1,1-0,-,1-1,..."
  serializeRealScores(matches) {
    if (!Array.isArray(matches)) return "-";
    const arr = Array(104).fill("-");
    matches.forEach(m => {
      const matchNum = parseInt(m.id.replace("m", ""));
      if (!isNaN(matchNum) && matchNum >= 1 && matchNum <= 104) {
        if (m.realHomeScore !== null && m.realAwayScore !== null) {
          arr[matchNum - 1] = `${m.realHomeScore}-${m.realAwayScore}`;
        }
      }
    });
    return arr.join(",");
  }

  // Aplica la cadena compacta de resultados reales a los partidos locales
  deserializeRealScores(matches, scoresStr) {
    if (!scoresStr || typeof scoresStr !== "string") return matches;
    const parts = scoresStr.split(",");
    return matches.map(m => {
      const matchNum = parseInt(m.id.replace("m", ""));
      if (!isNaN(matchNum) && matchNum >= 1 && matchNum <= 104) {
        const score = parts[matchNum - 1];
        if (score && score !== "-") {
          const [h, a] = score.split("-").map(Number);
          return {
            ...m,
            realHomeScore: isNaN(h) ? null : h,
            realAwayScore: isNaN(a) ? null : a
          };
        }
      }
      return m;
    });
  }

  // Convierte los pronósticos de los perfiles a un formato ultra comprimido:
  // {"user1": "2-1,-,-,1-0,...", "user2": "1-1,2-0,-,-,..."}
  serializePredictions(predictions) {
    const serialized = {};
    Object.keys(predictions).forEach(profileId => {
      const userPreds = predictions[profileId] || {};
      const arr = Array(104).fill("-");
      for (let i = 1; i <= 104; i++) {
        const pred = userPreds[`m${i}`];
        if (pred && pred.home !== null && pred.away !== null && pred.home !== undefined && pred.away !== undefined) {
          arr[i - 1] = `${pred.home}-${pred.away}`;
        }
      }
      serialized[profileId] = arr.join(",");
    });
    return serialized;
  }

  // Descomprime el formato de predicciones ultra comprimido
  deserializePredictions(serialized) {
    if (!serialized) return {};
    const decompressed = {};
    Object.keys(serialized).forEach(profileId => {
      decompressed[profileId] = {};
      const str = serialized[profileId];
      if (typeof str === "string") {
        const parts = str.split(",");
        parts.forEach((score, idx) => {
          if (score && score !== "-") {
            const [h, a] = score.split("-").map(Number);
            decompressed[profileId][`m${idx + 1}`] = { home: h, away: a };
          }
        });
      } else {
        // Retrocompatibilidad total por si el canal en la nube trae el formato JSON extendido antiguo
        decompressed[profileId] = str || {};
      }
    });
    return decompressed;
  }

  // Serializa los pronósticos de UN SOLO usuario en formato compacto "2-1,-,-,1-0..."
  serializeSinglePrediction(userPredictions) {
    const userPreds = userPredictions || {};
    const arr = Array(104).fill("-");
    for (let i = 1; i <= 104; i++) {
      const pred = userPreds[`m${i}`];
      if (pred && pred.home !== null && pred.away !== null && pred.home !== undefined && pred.away !== undefined) {
        arr[i - 1] = `${pred.home}-${pred.away}`;
      }
    }
    return arr.join(",");
  }

  // Deserializa los pronósticos de UN SOLO usuario desde formato compacto
  deserializeSinglePrediction(serializedStr) {
    const userPreds = {};
    if (!serializedStr) return userPreds;
    if (typeof serializedStr === "string") {
      const parts = serializedStr.split(",");
      parts.forEach((score, idx) => {
        if (score && score !== "-") {
          const [h, a] = score.split("-").map(Number);
          userPreds[`m${idx + 1}`] = { home: h, away: a };
        }
      });
    } else {
      return serializedStr || {}; // Fallback por si en Firebase está como mapa nativo
    }
    return userPreds;
  }

  // === CONFIGURACIÓN DE FIREBASE (NUEVA ARQUITECTURA) ===
  initFirebase() {
    if (!window.firebase) {
      console.warn("Firebase SDK no está cargado aún.");
      return;
    }
    const firebaseConfig = {
      apiKey: "AIzaSyDhff7KUaRRHXZ1naA6XhL21HQAQYOxgrE",
      authDomain: "quiniela-backup.firebaseapp.com",
      projectId: "quiniela-backup",
      storageBucket: "quiniela-backup.firebasestorage.app",
      messagingSenderId: "95031328885",
      appId: "1:95031328885:web:1c9c4f436173386450b83c"
    };
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    this.db = firebase.firestore();
  }

  // === MIGRACIÓN Y LECTURA/ESCRITURA LEGACY (KeyVal API) ===
  async legacyFetchCloudKey(key) {
    try {
      const cloudKey = this.getCloudKeyString(key);
      const response = await fetch(`${this.API_URL}/GetValue/${this.APP_KEY}/${cloudKey}`);
      if (!response.ok) return null;
      
      let dataStr = await response.text();
      if (!dataStr) return null;
      
      dataStr = dataStr.replace(/^"|"$/g, '').trim();
      if (dataStr === "Not Found" || dataStr === "") return null;
      
      const decoded = this.base64Decode(dataStr);
      if (!decoded) return null;
      
      try {
        const parsed = JSON.parse(decoded);
        if (key === "matches") {
          const localMatches = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.MATCHES)) || [];
          return this.deserializeRealScores(localMatches, parsed);
        } else if (key === "predictions") {
          return this.deserializePredictions(parsed);
        }
        return parsed;
      } catch (jsonErr) {
        return null;
      }
    } catch (e) {
      return null;
    }
  }

  // === NUEVA LECTURA/ESCRITURA (FIREBASE FIRESTORE) ===
  async fetchCloudKey(key) {
    if (!this.db) this.initFirebase();
    if (!this.db) return this.legacyFetchCloudKey(key);

    const groupId = localStorage.getItem("quiniela_group_id") || "default";
    try {
      if (key.startsWith("prof_") && key !== "prof_index") {
        const pId = key.replace("prof_", "");
        const docSnap = await this.db.collection("groups").doc(groupId).collection("profiles").doc(pId).get();
        return docSnap.exists ? docSnap.data() : null;
      } else if (key.startsWith("preds_")) {
        const pId = key.replace("preds_", "");
        const docSnap = await this.db.collection("groups").doc(groupId).collection("predictions").doc(pId).get();
        return docSnap.exists ? docSnap.data().data : null;
      } else if (key === "prof_index") {
        const docSnap = await this.db.collection("groups").doc(groupId).get();
        return docSnap.exists ? docSnap.data().prof_index : null;
      } else if (key === "matches") {
        const docSnap = await this.db.collection("groups").doc(groupId).get();
        return docSnap.exists ? docSnap.data().matches : null;
      } else if (key === "sheets_url") {
        const docSnap = await this.db.collection("groups").doc(groupId).get();
        return docSnap.exists ? docSnap.data().sheets_url : null;
      } else {
        const docSnap = await this.db.collection("groups").doc(groupId).collection("misc").doc(key).get();
        return docSnap.exists ? docSnap.data().data : null;
      }
    } catch (e) {
      console.error("Firebase fetch error:", e);
      return null;
    }
  }

  async updateCloudKey(key, data) {
    if (!this.db) this.initFirebase();
    if (!this.db) return false;

    const groupId = localStorage.getItem("quiniela_group_id") || "default";
    try {
      if (key.startsWith("prof_") && key !== "prof_index") {
        const pId = key.replace("prof_", "");
        await this.db.collection("groups").doc(groupId).collection("profiles").doc(pId).set(data);
      } else if (key.startsWith("preds_")) {
        const pId = key.replace("preds_", "");
        await this.db.collection("groups").doc(groupId).collection("predictions").doc(pId).set({ data: data });
      } else if (key === "prof_index") {
        await this.db.collection("groups").doc(groupId).set({ prof_index: data }, { merge: true });
      } else if (key === "matches") {
        await this.db.collection("groups").doc(groupId).set({ matches: data }, { merge: true });
      } else if (key === "sheets_url") {
        await this.db.collection("groups").doc(groupId).set({ sheets_url: data }, { merge: true });
      } else {
        await this.db.collection("groups").doc(groupId).collection("misc").doc(key).set({ data: data });
      }
      return true;
    } catch (e) {
      console.error("Firebase update error:", e);
      return false;
    }
  }

  // Comprueba si este grupo necesita migración y la ejecuta una vez
  async runMigrationIfNeeded() {
    if (!this.db) this.initFirebase();
    if (!this.db) return;

    const groupId = localStorage.getItem("quiniela_group_id") || "default";
    try {
      // Verificamos si en Firebase ya existe prof_index para este grupo
      const groupDoc = await this.db.collection("groups").doc(groupId).get();
      if (groupDoc.exists && groupDoc.data().prof_index) {
        return; // Ya está migrado
      }
      
      console.log(`Iniciando migración de datos a Firebase para el grupo: ${groupId}...`);
      
      // Rescatar todos los datos del sistema antiguo
      const legacyProfIndex = await this.legacyFetchCloudKey("prof_index");
      if (!legacyProfIndex) return; // No hay nada que migrar
      
      let ids = [];
      if (typeof legacyProfIndex === "string") {
        ids = legacyProfIndex.split(",");
      } else if (Array.isArray(legacyProfIndex)) {
        ids = legacyProfIndex;
      } else {
        ids = Object.keys(legacyProfIndex);
      }
      
      await this.updateCloudKey("prof_index", ids.join(","));
      
      for (const pId of ids) {
        if (!pId || pId.trim() === "") continue;
        const legacyProf = await this.legacyFetchCloudKey(`prof_${pId}`);
        if (legacyProf) {
          await this.updateCloudKey(`prof_${pId}`, legacyProf);
        }
      }
      
      const legacyPreds = await this.legacyFetchCloudKey("predictions");
      if (legacyPreds && typeof legacyPreds === "object") {
        for (const [pId, serialized] of Object.entries(legacyPreds)) {
          await this.updateCloudKey(`preds_${pId}`, serialized);
        }
      }
      
      const legacyMatches = await this.legacyFetchCloudKey("matches");
      if (legacyMatches) {
        await this.updateCloudKey("matches", legacyMatches);
      }
      
      const legacySheets = await this.legacyFetchCloudKey("sheets_url");
      if (legacySheets) {
        await this.updateCloudKey("sheets_url", legacySheets);
      }
      
      console.log(`Migración completada exitosamente para el grupo: ${groupId} 🚀`);
    } catch (e) {
      console.error("Error durante la migración a Firebase:", e);
    }
  }

  async syncFromCloud() {
    try {
      await this.runMigrationIfNeeded();
      
      const cloudMatches = await this.fetchCloudKey("official_matches");
      const cloudSheetsUrl = await this.fetchCloudKey("sheets_url");

      let changed = false;

      // Sincronizar URL de Google Sheets
      if (cloudSheetsUrl !== null && cloudSheetsUrl !== undefined) {
        const localSheetsUrl = localStorage.getItem("quiniela_google_sheets_url");
        if (localSheetsUrl !== cloudSheetsUrl) {
          localStorage.setItem("quiniela_google_sheets_url", cloudSheetsUrl);
          changed = true;
        }
      }

      // Sincronizar Perfiles INDIVIDUALMENTE por usuario (Evita límites de URL)
      let cloudProfiles = await this.fetchCloudKey("profiles") || {}; // Legacy fallback
      
      const profIndexStr = await this.fetchCloudKey("prof_index");
      let cloudProfileIds = profIndexStr ? profIndexStr.split(",") : Object.keys(cloudProfiles);
      
      const localStr = localStorage.getItem(this.STORAGE_KEYS.PROFILES);
      const localProfiles = JSON.parse(localStr) || {};
      
      let needsIndexUpdate = false;
      Object.keys(localProfiles).forEach(pId => {
        if (!cloudProfileIds.includes(pId)) {
          cloudProfileIds.push(pId);
          needsIndexUpdate = true;
        }
      });
      
      if (needsIndexUpdate) {
        await this.updateCloudKey("prof_index", cloudProfileIds.join(","));
      }

      // Descargar cada perfil individual
      const profPromises = cloudProfileIds.map(async (pId) => {
        const profData = await this.fetchCloudKey(`prof_${pId}`);
        if (profData) {
          cloudProfiles[pId] = profData;
        } else if (localProfiles[pId]) {
          // Migrar a individual si no existe
          await this.updateCloudKey(`prof_${pId}`, localProfiles[pId]);
          cloudProfiles[pId] = localProfiles[pId];
        }
      });
      await Promise.all(profPromises);

      if (Object.keys(cloudProfiles).length > 0) {
        // Auto-curación en la nube
        let cloudUpdated = false;
        if (!cloudProfiles.Jaque) {
          const adminPassHash = await this.hashPassword("Kimi_1506");
          cloudProfiles.Jaque = { id: "Jaque", name: "Jaque", avatar: "👑", points: 0, isAdmin: true, passHash: adminPassHash };
          await this.updateCloudKey("prof_Jaque", cloudProfiles.Jaque);
          if (!cloudProfileIds.includes("Jaque")) {
            cloudProfileIds.push("Jaque");
            await this.updateCloudKey("prof_index", cloudProfileIds.join(","));
          }
        }
        
        let needsLocalUpdate = false;
        
        Object.keys(cloudProfiles).forEach(pId => {
          if (!localProfiles[pId] || JSON.stringify(localProfiles[pId]) !== JSON.stringify(cloudProfiles[pId])) {
            localProfiles[pId] = cloudProfiles[pId];
            needsLocalUpdate = true;
          }
        });
        
        // Si hay perfiles locales que no están en la nube, subirlos (evita pérdida al registrarse concurrente)
        Object.keys(localProfiles).forEach(pId => {
          if (!cloudProfiles[pId]) {
            const localUser = localProfiles[pId];
            
            // BUSCAR SI EN LA NUBE YA HAY ALGUIEN CON EL MISMO NOMBRE
            const existingCloudUser = Object.values(cloudProfiles).find(cp => cp && cp.name && localUser && localUser.name && cp.name.toLowerCase() === localUser.name.toLowerCase());
            
            if (existingCloudUser) {
              // Ya existe en la nube con otro ID. 
              // En lugar de subir este nuevo, eliminamos el local y cambiamos al de la nube.
              delete localProfiles[pId];
              needsLocalUpdate = true;
              
              if (this.getActiveProfileId() === pId) {
                // El usuario actual era este clon, lo cambiamos al original de la nube
                this.setActiveProfileId(existingCloudUser.id);
              }
            } else {
              cloudProfiles[pId] = localProfiles[pId];
              this.updateCloudKey(`prof_${pId}`, localProfiles[pId]);
            }
          }
        });

        if (needsLocalUpdate) {
          localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(localProfiles));
          changed = true;
        }
      }

      // Sincronizar predicciones INDIVIDUALMENTE por usuario (Evita límites de URL y overwrites)
      const profilesToSync = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.PROFILES)) || {};
      const localPredictions = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.PREDICTIONS)) || {};
      const activeProfileId = this.getActiveProfileId();
      
      let predsChanged = false;
      
      // Promesas concurrentes para descargar preds de todos los usuarios
      const predPromises = Object.keys(profilesToSync).map(async (pId) => {
        const cloudUserPreds = await this.fetchCloudKey(`preds_${pId}`);
        if (cloudUserPreds) {
          // Descomprimir
          const decompressed = this.deserializeSinglePrediction(cloudUserPreds);
          const localUserStr = JSON.stringify(localPredictions[pId] || {});
          const cloudUserStr = JSON.stringify(decompressed);
          
          if (localUserStr !== cloudUserStr) {
            const localLen = Object.keys(localPredictions[pId] || {}).length;
            const cloudLen = Object.keys(decompressed || {}).length;

            if (pId !== activeProfileId || localLen === 0) {
              // Si no es el usuario activo, o el usuario activo no tiene nada, aceptamos lo de la nube
              localPredictions[pId] = decompressed;
              predsChanged = true;
            } else {
              // Si es el usuario activo, NO sobrescribimos ciegamente la nube.
              // En su lugar, hacemos un merge: conservamos todo lo de la nube y le sumamos lo local.
              // Si hay conflicto, gana el que tenga más llaves en total (o gana local si son iguales).
              if (localLen > cloudLen) {
                // Si el dispositivo local tiene estrictamente más datos, subimos a la nube
                await this.updateCloudKey(`preds_${pId}`, this.serializeSinglePrediction(localPredictions[pId]));
              } else {
                // Si la nube tiene más datos o igual cantidad, la nube es la fuente de verdad
                // descargamos lo de la nube para no borrarle su progreso y aceptar correcciones.
                localPredictions[pId] = decompressed;
                predsChanged = true;
              }
            }
          }
        } else if (localPredictions[pId] && Object.keys(localPredictions[pId]).length > 0) {
          // Si no está en la nube, pero lo tenemos local (ej. usuario recién registrado), lo subimos
          await this.updateCloudKey(`preds_${pId}`, this.serializeSinglePrediction(localPredictions[pId]));
        }
      });
      
      await Promise.all(predPromises);
      
      if (predsChanged) {
        localStorage.setItem(this.STORAGE_KEYS.PREDICTIONS, JSON.stringify(localPredictions));
        changed = true;
      }

      if (cloudMatches && Array.isArray(cloudMatches)) {
        const localMatches = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.MATCHES)) || [];
        
        let mergedMatches = localMatches.map(lm => {
          const cm = cloudMatches.find(c => c.id === lm.id);
          // Si el partido existe en la nube, la nube es la fuente absoluta de la verdad (equipos, fechas y resultados)
          return cm ? cm : lm;
        });

        const mergedStr = JSON.stringify(mergedMatches);
        const localStr = JSON.stringify(localMatches);

        if (mergedStr !== localStr) {
          localStorage.setItem(this.STORAGE_KEYS.MATCHES, mergedStr);
          changed = true;
        }
        
        // Ya no sobrescribimos Firebase con los datos locales para evitar arruinar la base de datos
        // si el api/2026.json local está desactualizado por caché.
      } else {
        const localMatches = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.MATCHES));
        if (localMatches) await this.updateCloudKey("matches", localMatches);
      }

      // Recalcular puntos una vez que se hayan descargado todas las predicciones y marcadores reales de la nube
      this.recalculateAllPoints();

      return changed;
    } catch (e) {
      console.error("Error syncing with cloud:", e);
      return false;
    }
  }

  // Configura listeners en tiempo real (onSnapshot) para reaccionar a cambios en la base de datos
  listenToCloudChanges(onUpdateCallback) {
    if (!this.db) this.initFirebase();
    if (!this.db) return;

    // Cancelar listeners previos si existen (ej: al cambiar de grupo)
    if (this.unsubscribeProfiles) this.unsubscribeProfiles();
    if (this.unsubscribePredictions) this.unsubscribePredictions();
    if (this.unsubscribeGroup) this.unsubscribeGroup();

    const groupId = localStorage.getItem("quiniela_group_id") || "default";

    // 1. Escuchar Perfiles
    this.unsubscribeProfiles = this.db.collection("groups").doc(groupId).collection("profiles")
      .onSnapshot((snapshot) => {
        let changed = false;
        const localProfiles = this.getProfiles() || {};
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            const pId = change.doc.id;
            if (JSON.stringify(localProfiles[pId]) !== JSON.stringify(data)) {
              localProfiles[pId] = data;
              changed = true;
            }
          }
        });
        if (changed) {
          localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(localProfiles));
          this.recalculateAllPoints();
          if (onUpdateCallback) onUpdateCallback();
        }
      }, (e) => console.error("Error en snapshot profiles:", e));

    // 2. Escuchar Predicciones
    this.unsubscribePredictions = this.db.collection("groups").doc(groupId).collection("predictions")
      .onSnapshot((snapshot) => {
        let changed = false;
        const localPreds = this.getPredictions() || {};
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const docData = change.doc.data();
            const userPred = this.deserializeSinglePrediction(docData.data);
            const pId = change.doc.id;
            if (JSON.stringify(localPreds[pId]) !== JSON.stringify(userPred)) {
              localPreds[pId] = userPred;
              changed = true;
            }
          }
        });
        if (changed) {
          localStorage.setItem(this.STORAGE_KEYS.PREDICTIONS, JSON.stringify(localPreds));
          this.recalculateAllPoints();
          if (onUpdateCallback) onUpdateCallback();
        }
      }, (e) => console.error("Error en snapshot predictions:", e));

    // 3. Escuchar Grupo (Marcadores Oficiales)
    this.unsubscribeGroup = this.db.collection("groups").doc(groupId)
      .onSnapshot((doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        let changed = false;

        if (data.official_matches && Array.isArray(data.official_matches)) {
          const localMatches = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.MATCHES)) || [];
          const mergedMatches = localMatches.map(lm => {
            const cm = data.official_matches.find(m => m.id === lm.id);
            if (cm) {
              return {
                ...lm,
                realHomeScore: cm.realHomeScore !== undefined ? cm.realHomeScore : null,
                realAwayScore: cm.realAwayScore !== undefined ? cm.realAwayScore : null,
                ...(cm.homeTeam && { homeTeam: cm.homeTeam }),
                ...(cm.awayTeam && { awayTeam: cm.awayTeam }),
                ...(cm.homeFlagCode && { homeFlagCode: cm.homeFlagCode }),
                ...(cm.awayFlagCode && { awayFlagCode: cm.awayFlagCode }),
                ...(cm.recommendation && { recommendation: cm.recommendation })
              };
            }
            return lm;
          });

          if (JSON.stringify(localMatches) !== JSON.stringify(mergedMatches)) {
            localStorage.setItem(this.STORAGE_KEYS.MATCHES, JSON.stringify(mergedMatches));
            changed = true;
          }
        }

        if (changed) {
          this.recalculateAllPoints();
          if (onUpdateCallback) onUpdateCallback();
        }
      }, (e) => console.error("Error en snapshot group:", e));
  }

  // Helper asíncrono para cifrar la contraseña usando el estándar nativo SHA-256 (Web Crypto API)
  async hashPassword(password) {
    try {
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (e) {
      console.error("Error hashing password with Crypto API:", e);
      // Fallback simple determinista
      let hash = 0;
      for (let i = 0; i < password.length; i++) {
        hash = (hash << 5) - hash + password.charCodeAt(i);
        hash |= 0;
      }
      return "fallback_" + hash;
    }
  }

  // Registra un nuevo usuario en la app (local y nube) de manera case-insensitive
  async registerUser(name, password, avatar) {
    const profiles = this.getProfiles() || {};
    const cleanName = name.trim();
    const lowerName = cleanName.toLowerCase();

    if (!cleanName) {
      throw new Error("El nombre no puede estar vacío.");
    }

    if (!password || password.length < 4) {
      throw new Error("La contraseña debe tener al menos 4 caracteres.");
    }

    // Comprobar si ya existe el usuario
    const exists = Object.values(profiles).some(p => p && p.name && p.name.toLowerCase() === lowerName);
    if (exists) {
      throw new Error("Este nombre de usuario ya está registrado en tu grupo.");
    }

    // Impedir registrarse como Jaque para evitar usurpación del administrador
    if (lowerName === "jaque") {
      throw new Error("El nombre 'Jaque' está reservado para el Administrador del sistema.");
    }

    const newId = "user_" + Date.now();
    const passHash = await this.hashPassword(password);

    profiles[newId] = {
      id: newId,
      name: cleanName,
      avatar: avatar || "👤",
      points: 0,
      isAdmin: false,
      passHash: passHash
    };

    localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    await this.updateCloudKey(`prof_${newId}`, profiles[newId]);
    
    // Actualizar índice de forma segura
    let indexStr = await this.fetchCloudKey("prof_index");
    if (Array.isArray(indexStr)) indexStr = indexStr.join(",");
    if (typeof indexStr !== "string") indexStr = Object.keys(profiles).join(",");
    
    const ids = new Set(indexStr.split(",").filter(id => id.trim() !== ""));
    ids.add(newId);
    await this.updateCloudKey("prof_index", Array.from(ids).join(","));

    // Inicializar predicciones vacías para este perfil
    const allPreds = this.getPredictions();
    allPreds[newId] = {};
    localStorage.setItem(this.STORAGE_KEYS.PREDICTIONS, JSON.stringify(allPreds));
    await this.updateCloudKey(`preds_${newId}`, this.serializeSinglePrediction({}));

    return newId;
  }

  // Inicia sesión de usuario validando el hash de contraseña
  async loginUser(username, password) {
    const profiles = this.getProfiles() || {};
    const lowerName = username.trim().toLowerCase();

    // Encontrar perfil
    const profile = Object.values(profiles).find(p => p && p.name && p.name.toLowerCase() === lowerName);
    if (!profile) return null;

    const passHash = await this.hashPassword(password);
    if (profile.passHash === passHash) {
      return profile.id;
    }
    return null;
  }

  // Inicializa valores por defecto si no existen en localStorage
  async initData() {
    // 1. Perfiles por defecto (Creación segura del Admin Jaque con pass Kimi_1506)
    let profiles = this.getProfiles();
    if (!profiles || Object.keys(profiles).length === 0) {
      const adminPassHash = await this.hashPassword("Kimi_1506");
      const defaultProfiles = {
        "Jaque": { id: "Jaque", name: "Jaque", avatar: "👑", points: 0, isAdmin: true, passHash: adminPassHash }
      };
      localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(defaultProfiles));
      // No subimos a la nube aquí para no pisar el index de un grupo existente. syncFromCloud se encarga.
    } else {
      // Auto-curación local: garantizar que exista Jaque y remover antiguos de prueba como Luis
      try {
        let updated = false;
        if (!profiles.Jaque) {
          const adminPassHash = await this.hashPassword("Kimi_1506");
          profiles.Jaque = { id: "Jaque", name: "Jaque", avatar: "👑", points: 0, isAdmin: true, passHash: adminPassHash };
          updated = true;
        }
        if (profiles.user1 && profiles.user1.name === "Luis") {
          delete profiles.user1;
          updated = true;
        }
        if (updated) {
          localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
          // No subimos a la nube aquí para no pisar el index. syncFromCloud se encarga de subir perfiles locales faltantes.
        }
      } catch (e) {
        console.error("Error en auto-curación local de perfiles:", e);
      }
    }

    // 2. Predicciones vacías
    if (!localStorage.getItem(this.STORAGE_KEYS.PREDICTIONS)) {
      const defaultPredictions = {};
      localStorage.setItem(this.STORAGE_KEYS.PREDICTIONS, JSON.stringify(defaultPredictions));
    }

    // 3. Resultados de partidos: SIEMPRE tomar estructura de api/2026.json
    // Los scores reales NUNCA se guardan en localStorage como fuente de verdad.
    // Vienen exclusivamente de Firebase (official_matches) vía listenToCloudChanges.
    const matchesFromAPI = await fetchWorldCupData();
    if (matchesFromAPI && matchesFromAPI.length > 0) {
      const initializedMatches = matchesFromAPI.map(m => ({
        ...m,
        realHomeScore: m.realHomeScore ?? null,
        realAwayScore: m.realAwayScore ?? null
      }));
      localStorage.setItem(this.STORAGE_KEYS.MATCHES, JSON.stringify(initializedMatches));
    }

    // 4. Perfil activo por defecto (si no hay ninguno, forzar login obligando overlay)
    const activeProfile = localStorage.getItem(this.STORAGE_KEYS.ACTIVE_PROFILE);
    const updatedProfiles = this.getProfiles() || {};
    if (activeProfile === "user1" || !activeProfile || !updatedProfiles[activeProfile]) {
      localStorage.removeItem(this.STORAGE_KEYS.ACTIVE_PROFILE);
    }

    // --- SINCRO INICIAL DESDE LA NUBE ---
    // Al unirse a un grupo explícitamente, DEBEMOS bloquear y esperar la sincronización
    // para asegurar que los perfiles estén descargados antes de intentar el login.
    try {
      await this.syncFromCloud();
    } catch (e) {
      console.error("Error en sincronización al cambiar de grupo:", e);
    }
  }

  // --- GETTERS & SETTERS ---
  getProfiles() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.PROFILES);
      if (!data || data === "undefined" || data === "null") return null;
      return JSON.parse(data);
    } catch (e) {
      console.error("Error reading profiles from localStorage:", e);
      return null;
    }
  }

  updateProfileName(profileId, newName) {
    const profiles = this.getProfiles();
    if (profiles[profileId] && newName) {
      profiles[profileId].name = newName.trim();
      localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
      this.updateCloudKey(`prof_${profileId}`, profiles[profileId]);
    }
  }

  addProfile(name, avatar) {
    const profiles = this.getProfiles();
    const newId = "user_" + Date.now();
    profiles[newId] = { id: newId, name: name.trim(), avatar: avatar || "👤", points: 0, isAdmin: false };
    localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    this.updateCloudKey(`prof_${newId}`, profiles[newId]);
    this.fetchCloudKey("prof_index").then(str => {
      const ids = new Set((str || Object.keys(profiles).join(",")).split(","));
      ids.add(newId);
      this.updateCloudKey("prof_index", Array.from(ids).join(","));
    });
    
    // Preparar predicciones vacías
    const preds = this.getPredictions();
    preds[newId] = {};
    localStorage.setItem(this.STORAGE_KEYS.PREDICTIONS, JSON.stringify(preds));
    this.updateCloudKey(`preds_${newId}`, this.serializeSinglePrediction({}));
    
    return newId;
  }

  getActiveProfileId() {
    return localStorage.getItem(this.STORAGE_KEYS.ACTIVE_PROFILE);
  }

  setActiveProfileId(profileId) {
    const profiles = this.getProfiles();
    if (profiles[profileId]) {
      localStorage.setItem(this.STORAGE_KEYS.ACTIVE_PROFILE, profileId);
    }
  }

  // Correcciones forzadas que NINGÚN zombie puede sobrescribir. Se aplican siempre.
  static MATCH_CORRECTIONS = {
    "m55": { homeTeam: "Portugal", awayTeam: "Colombia", homeFlagCode: "pt", awayFlagCode: "co", homeFlag: "🇵🇹", awayFlag: "🇨🇴" }
  };

  getMatches() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.MATCHES);
      if (!data || data === "undefined" || data === "null") return [];
      const parsed = JSON.parse(data);

      // Aplicar correcciones forzadas SIEMPRE (anti-zombie nuclear)
      parsed.forEach(m => {
        const fix = QuinielaStorage.MATCH_CORRECTIONS[m.id];
        if (fix) {
          Object.assign(m, fix);
        }
      });
      
      // Forzar ordenamiento cronológico absoluto
      const monthMap = { "Junio": 5, "Julio": 6 };
      parsed.sort((a, b) => {
        try {
          const pA = a.date.split(" ");
          const tA = (a.time || "18:00").split(":");
          const timeA = new Date(parseInt(pA[3]), monthMap[pA[2]], parseInt(pA[0]), parseInt(tA[0]), parseInt(tA[1]), 0).getTime();
          
          const pB = b.date.split(" ");
          const tB = (b.time || "18:00").split(":");
          const timeB = new Date(parseInt(pB[3]), monthMap[pB[2]], parseInt(pB[0]), parseInt(tB[0]), parseInt(tB[1]), 0).getTime();
          
          return timeA - timeB;
        } catch (e) { return 0; }
      });
      
      return parsed;
    } catch (e) {
      console.error("Error reading matches from localStorage:", e);
      return [];
    }
  }

  saveMatches(matches) {
    localStorage.setItem(this.STORAGE_KEYS.MATCHES, JSON.stringify(matches));
  }

  getPredictions() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.PREDICTIONS);
      if (!data || data === "undefined" || data === "null") return {};
      return JSON.parse(data);
    } catch (e) {
      console.error("Error reading predictions from localStorage:", e);
      return {};
    }
  }

  async sendToGoogleSheets(profileId, matchId, homeScore, awayScore) {
    const sheetsUrl = localStorage.getItem("quiniela_google_sheets_url");
    if (!sheetsUrl) return; // No configurado
    
    try {
      const profiles = this.getProfiles();
      const activeUser = profiles[profileId];
      const matches = this.getMatches();
      const match = matches.find(m => m.id === matchId);
      
      const payload = {
        groupId: localStorage.getItem("quiniela_group_id") || "default",
        userName: activeUser ? activeUser.name : "Anónimo",
        matchId: matchId,
        matchName: match ? `${match.homeTeam} vs ${match.awayTeam}` : "Partido Desconocido",
        homeScore: homeScore !== "" && homeScore !== null ? parseInt(homeScore) : "",
        awayScore: awayScore !== "" && awayScore !== null ? parseInt(awayScore) : "",
        stage: match ? match.stage : ""
      };
      
      fetch(sheetsUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      }).catch(err => console.error("Error logging to Google Sheets silently:", err));
      
    } catch (e) {
      console.error("Error in sendToGoogleSheets:", e);
    }
  }

  // Guarda la predicción de un partido para un usuario específico
  savePrediction(profileId, matchId, homeScore, awayScore) {
    const allPredictions = this.getPredictions();
    
    // Asegurarse de que el objeto exista
    if (!allPredictions[profileId]) {
      allPredictions[profileId] = {};
    }

    if (homeScore === "" || awayScore === "" || homeScore === null || awayScore === null) {
      delete allPredictions[profileId][matchId];
    } else {
      allPredictions[profileId][matchId] = {
        home: parseInt(homeScore),
        away: parseInt(awayScore)
      };
    }

    localStorage.setItem(this.STORAGE_KEYS.PREDICTIONS, JSON.stringify(allPredictions));
    // Guardar solo los pronósticos de este usuario en la nube de forma individual
    this.updateCloudKey(`preds_${profileId}`, this.serializeSinglePrediction(allPredictions[profileId]));
    
    // Recalcular puntos totales para ambos
    this.recalculateAllPoints();

    // Enviar registro de auditoría a Google Sheets en segundo plano
    this.sendToGoogleSheets(profileId, matchId, homeScore, awayScore);
  }

  // Guarda el resultado real del partido
  saveRealScore(matchId, homeScore, awayScore) {
    const matches = this.getMatches();
    const match = matches.find(m => m.id === matchId);
    
    if (match) {
      if (homeScore === "" || awayScore === "" || homeScore === null || awayScore === null) {
        match.realHomeScore = null;
        match.realAwayScore = null;
      } else {
        match.realHomeScore = parseInt(homeScore);
        match.realAwayScore = parseInt(awayScore);
      }
      this.saveMatches(matches);
      this.updateCloudKey("matches", matches);
      
      // Recalcular puntos
      this.recalculateAllPoints();
    }
  }

  // --- LÓGICA DE REGLAS DE PUNTAJE ---
  /**
   * Recalcula los puntos para todos los perfiles y actualiza el almacenamiento.
   */
  recalculateAllPoints() {
    const profiles = this.getProfiles();
    const matches = this.getMatches();
    const allPredictions = this.getPredictions();

    Object.keys(profiles).forEach(pId => {
      const userPredictions = allPredictions[pId] || {};
      let totalPoints = 0;

      matches.forEach(match => {
        // Solo calcular si el partido ya se jugó (tiene marcador real)
        if (match.realHomeScore !== null && match.realAwayScore !== null) {
          const pred = userPredictions[match.id];
          if (pred) {
            totalPoints += this.calculateMatchPoints(
              pred.home,
              pred.away,
              match.realHomeScore,
              match.realAwayScore
            );
          }
        }
      });

      profiles[pId].points = totalPoints;
    });

    localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    Object.keys(profiles).forEach(pId => {
      this.updateCloudKey(`prof_${pId}`, profiles[pId]);
    });
  }

  /**
   * Calcula los puntos de una sola predicción frente al resultado real.
   * Reglas:
   *  - 3 puntos: Resultado exacto.
   *  - 1 punto: Acierta resultado (Ganador/Empate) pero marcador inexacto.
   *  - 0 puntos: Sin aciertos.
   */
  calculateMatchPoints(predHome, predAway, realHome, realAway) {
    // 1. Acierto Exacto (Marcador exacto)
    if (predHome === realHome && predAway === realAway) {
      return 3;
    }

    // 2. Acierto de Tendencia (Ganador o Empate)
    const predResult = Math.sign(predHome - predAway); // 1 = local gana, 0 = empate, -1 = visita gana
    const realResult = Math.sign(realHome - realAway);

    if (predResult === realResult) {
      return 1;
    }

    // 3. Fallado
    return 0;
  }

  // Restablece todas las predicciones y resultados a cero
  async resetAllData() {
    localStorage.removeItem(this.STORAGE_KEYS.PREDICTIONS);
    localStorage.removeItem(this.STORAGE_KEYS.MATCHES);
    
    const profiles = this.getProfiles();
    Object.keys(profiles).forEach(pId => {
      profiles[pId].points = 0;
    });
    localStorage.setItem(this.STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    
    await this.initData();

    // Sincronizar el reseteo con la nube
    Object.keys(profiles).forEach(pId => this.updateCloudKey(`prof_${pId}`, profiles[pId]));
    const allPreds = this.getPredictions();
    const predPromises = Object.keys(profiles).map(pId => this.updateCloudKey(`preds_${pId}`, this.serializeSinglePrediction({})));
    await Promise.all(predPromises);
    // NO subir matches a la nube: esto causaba que cachés zombies sobrescribieran datos correctos
    // Los datos oficiales se manejan exclusivamente vía official_matches en Firebase
  }
}

const qStorage = new QuinielaStorage();
