# Quiniela Mundial Compartida ⚽🏆

Una aplicación web interactiva, lúdica y de diseño premium especialmente concebida para jugar y competir en pareja prediciendo los resultados del Mundial de Fútbol. Es perfecta para compartir en familia y disfrutar la pasión deportiva juntos en un mismo dispositivo o computadoras separadas.

## 🚀 Características Principales

*   👥 **Multiperfil Local (Estilo Netflix)**: Permite registrar dos perfiles en el mismo dispositivo (por defecto *Luis* y *Esposa*). Cambiar entre perfiles toma un solo click desde el botón superior derecho.
*   📊 **Marcador en Vivo**: Una cabecera interactiva que rastrea en todo momento la puntuación acumulada de ambos y resalta con destellos dorados quién va liderando el campeonato.
*   ⚔️ **Comparación Cara a Cara**: Una tabla deportiva completa que compara en paralelo las predicciones de ambos y los marcadores reales, indicando los puntos de cada uno y quién ganó el duelo de cada partido.
*   🌟 **Reglas Oficiales de Puntuación**:
    *   **Marcador Exacto (+3 puntos)**: Si aciertan el marcador real de goles (ej. predice 2-1 y termina 2-1). ¡Esta hazaña lanza confeti de celebración en la pantalla!
    *   **Acierto de Resultado (+1 punto)**: Si aciertan al ganador o empate, pero con goles distintos (ej. predice 2-1 y termina 1-0).
    *   **Sin Aciertos (+0 puntos)**: Si no aciertan el resultado.
*   🛠️ **Panel del Administrador**: Un tablero exclusivo donde pueden ingresar los marcadores finales de los partidos jugados y ver cómo se recalculan todos los puntos y rankings de forma instantánea.
*   🔄 **Sincronización por Archivo**: Exporta tus predicciones con un botón o importa las de tu pareja para jugar en computadoras separadas y competir a distancia.

## 📂 Estructura del Proyecto

```
quiniela-mundial/
├── index.html          # Marcado semántico y estructura de las secciones
├── css/
│   └── styles.css      # Sistema de diseño de Estadio Mundialista y animaciones
├── js/
│   ├── app.js          # Lógica principal, animaciones de confeti y renders de tablas
│   ├── database.js     # Calendario de partidos oficiales del Mundial y banderas
│   └── profiles.js     # Gestor de perfiles de usuario y localStorage
├── package.json        # Configuración de Node.js y scripts de ejecución
├── .gitignore          # Archivo de exclusiones de control de versiones Git
└── README.md           # Este manual de usuario
```

## 🛠️ Ejecución Local

Dado que la aplicación es 100% estática (HTML/JS/CSS), se ejecuta instantáneamente. Para disfrutar de la experiencia al completo (guardados automáticos y cargas JSON seguras), se recomienda abrirla a través de un servidor local.

### Opción 1: Con Python (Incorporado en tu Mac)
Abre la terminal en la carpeta del proyecto y ejecuta:
```bash
python3 -m http.server 8080
```
Luego entra en tu navegador a: `http://localhost:8080`

### Opción 2: Con Node.js / npm
Abre la terminal en la carpeta del proyecto, instala las herramientas locales e inicializa el script rápido:
```bash
npm install
npm start
```
Luego entra en tu navegador a: `http://localhost:8080`
