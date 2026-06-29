import json
import random
import math
import hashlib

# 1. Definición de grupos y selecciones del Mundial 2026 (48 equipos)
groups = {
    "A": ["México", "Sudáfrica", "Corea del Sur", "República Checa"],
    "B": ["Canadá", "Suiza", "Qatar", "Bosnia y Herzegovina"],
    "C": ["Brasil", "Marruecos", "Haití", "Escocia"],
    "D": ["EE.UU.", "Paraguay", "Australia", "Turquía"],
    "E": ["Alemania", "Ecuador", "Costa de Marfil", "Curazao"],
    "F": ["Países Bajos", "Japón", "Túnez", "Suecia"],
    "G": ["Bélgica", "Irán", "Egipto", "Nueva Zelanda"],
    "H": ["España", "Uruguay", "Arabia Saudita", "Cabo Verde"],
    "I": ["Francia", "Senegal", "Noruega", "Irak"],
    "J": ["Argentina", "Argelia", "Austria", "Jordania"],
    "K": ["Portugal", "Colombia", "Uzbekistán", "RD Congo"],
    "L": ["Inglaterra", "Croacia", "Ghana", "Panamá"]
}

# 2. Banderas de las 48 selecciones
flags = {
    "México": "🇲🇽", "Sudáfrica": "🇿🇦", "Corea del Sur": "🇰🇷", "República Checa": "🇨🇿",
    "Canadá": "🇨🇦", "Suiza": "🇨🇭", "Qatar": "🇶🇦", "Bosnia y Herzegovina": "🇧🇦",
    "Brasil": "🇧🇷", "Marruecos": "🇲🇦", "Haití": "🇭🇹", "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "EE.UU.": "🇺🇸", "Paraguay": "🇵🇾", "Australia": "🇦🇺", "Turquía": "🇹🇷",
    "Alemania": "🇩🇪", "Ecuador": "🇪🇨", "Costa de Marfil": "🇨🇮", "Curazao": "🇨🇼",
    "Países Bajos": "🇳🇱", "Japón": "🇯🇵", "Túnez": "🇹🇳", "Suecia": "🇸🇪",
    "Bélgica": "🇧🇪", "Irán": "🇮🇷", "Egipto": "🇪🇬", "Nueva Zelanda": "🇳🇿",
    "España": "🇪🇸", "Uruguay": "🇺🇾", "Arabia Saudita": "🇸🇦", "Cabo Verde": "🇨🇻",
    "Francia": "🇫🇷", "Senegal": "🇸🇳", "Noruega": "🇳🇴", "Irak": "🇮🇶",
    "Argentina": "🇦🇷", "Argelia": "🇩🇿", "Austria": "🇦🇹", "Jordania": "🇯🇴",
    "Portugal": "🇵🇹", "Colombia": "🇨🇴", "Uzbekistán": "🇺🇿", "RD Congo": "🇨🇩",
    "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Croacia": "🇭🇷", "Ghana": "🇬🇭", "Panamá": "🇵🇦"
}

# 3. Base de datos de Ratings FIFA oficiales
fifa_ratings = {
    "Argentina": 1860, "Francia": 1840, "Inglaterra": 1800, "Brasil": 1790,
    "España": 1770, "Bélgica": 1760, "Portugal": 1750, "Países Bajos": 1740,
    "Colombia": 1730, "Croacia": 1720, "Alemania": 1710, "Marruecos": 1680,
    "Uruguay": 1660, "Japón": 1640, "EE.UU.": 1630, "Suiza": 1620,
    "Senegal": 1620, "México": 1600, "Corea del Sur": 1580, "Austria": 1570,
    "Australia": 1560, "Irán": 1550, "Suecia": 1530, "Ecuador": 1530,
    "República Checa": 1520, "Turquía": 1510, "Costa de Marfil": 1500,
    "Egipto": 1500, "Qatar": 1480, "Escocia": 1480, "Canadá": 1470,
    "Noruega": 1470, "Argelia": 1460, "Arabia Saudita": 1440, "Túnez": 1430,
    "Paraguay": 1420, "Ghana": 1410, "Sudáfrica": 1410, "Panamá": 1400,
    "Cabo Verde": 1380, "Bosnia y Herzegovina": 1360, "Irak": 1360,
    "Uzbekistán": 1350, "Jordania": 1340, "RD Congo": 1330, "Haití": 1280,
    "Curazao": 1220, "Nueva Zelanda": 1180
}

# Apodos oficiales de las 48 selecciones
descriptors = {
    "México": "el Tri",
    "Sudáfrica": "los Bafana Bafana",
    "Corea del Sur": "los Tigres de Asia",
    "República Checa": "la Locomotora Checa",
    "Canadá": "les Rouges",
    "Suiza": "el equipo helvético",
    "Qatar": "los Marrones",
    "Bosnia y Herzegovina": "los Dragones",
    "Brasil": "la Canarinha",
    "Marruecos": "los Leones del Atlas",
    "Haití": "les Grenadiers",
    "Escocia": "el Ejército de Tartán",
    "EE.UU.": "el conjunto norteamericano",
    "Paraguay": "la Albirroja",
    "Australia": "los Socceroos",
    "Turquía": "las Estrellas Crecientes",
    "Alemania": "la Mannschaft",
    "Ecuador": "la Tri",
    "Costa de Marfil": "los Elefantes",
    "Curazao": "los Azules",
    "Países Bajos": "la Naranja Mecánica",
    "Japón": "los Samuráis Azules",
    "Túnez": "las Águilas de Cartago",
    "Suecia": "el cuadro escandinavo",
    "Bélgica": "los Diablos Rojos",
    "Irán": "el Team Melli",
    "Egipto": "los Faraones",
    "Nueva Zelanda": "los All Whites",
    "España": "la Roja",
    "Uruguay": "la Celeste",
    "Arabia Saudita": "los Hijos del Desierto",
    "Cabo Verde": "los Tiburones Azules",
    "Francia": "les Bleus",
    "Senegal": "los Leones de la Teranga",
    "Noruega": "los Vikingos",
    "Irak": "los Leones de Mesopotamia",
    "Argentina": "la Albiceste",
    "Argelia": "los Zorros del Desierto",
    "Austria": "el cuadro austríaco",
    "Jordania": "los Caballeros",
    "Portugal": "el equipo de las Quinas",
    "Colombia": "el cuadro cafetero",
    "Uzbekistán": "los Lobos Blancos",
    "RD Congo": "los Leopardos",
    "Inglaterra": "los Tres Leones",
    "Croacia": "los Vatreni",
    "Ghana": "las Estrellas Negras",
    "Panamá": "los Canaleros"
}

# 4. Estadios Oficiales y Horarios del Mundial 2026
stadiums = [
    "MetLife Stadium (New York/New Jersey)",
    "SoFi Stadium (Los Angeles)",
    "AT&T Stadium (Dallas)",
    "Mercedes-Benz Stadium (Atlanta)",
    "Hard Rock Stadium (Miami)",
    "Lincoln Financial Field (Philadelphia)",
    "Lumen Field (Seattle)",
    "Levi's Stadium (San Francisco)",
    "Gillette Stadium (Boston)",
    "Arrowhead Stadium (Kansas City)",
    "NRG Stadium (Houston)",
    "BC Place (Vancouver)",
    "BMO Field (Toronto)",
    "Estadio Azteca (Ciudad de México)",
    "Estadio BBVA (Monterrey)",
    "Estadio Akron (Guadalajara)"
]

kickoff_times = ["13:00", "16:00", "18:00", "20:00"]

def get_stadium(home, away, match_idx):
    """Asigna de forma premium e inteligente estadios mundialistas oficiales."""
    if home == "México" or away == "México":
        return "Estadio Azteca (Ciudad de México)"
    elif home == "Canadá" or away == "Canadá":
        return "BC Place (Vancouver)"
    elif home == "EE.UU." or away == "EE.UU.":
        return "SoFi Stadium (Los Angeles)"
    # Asignación circular estructurada
    return stadiums[match_idx % len(stadiums)]

def get_kickoff_time(match_idx):
    """Distribuye las horas de inicio de forma equilibrada."""
    return kickoff_times[match_idx % len(kickoff_times)]


# 5. Funciones del Motor Predictivo Matemático (Poisson)

def poisson_probability(lmbda, k):
    if lmbda <= 0:
        return 1.0 if k == 0 else 0.0
    return (lmbda**k * math.exp(-lmbda)) / math.factorial(k)

def predict_match(home, away, home_rating=None, away_rating=None):
    h_rating = home_rating if home_rating is not None else fifa_ratings.get(home, 1500)
    a_rating = away_rating if away_rating is not None else fifa_ratings.get(away, 1500)
    
    g_avg = 1.30
    k_scale = 0.0018
    
    rating_diff = h_rating - a_rating
    
    lambda_home = g_avg * math.exp(rating_diff * k_scale)
    lambda_away = g_avg * math.exp(-rating_diff * k_scale)
    
    lambda_home = max(0.2, min(4.5, lambda_home))
    lambda_away = max(0.2, min(4.5, lambda_away))
    
    max_goals = 6
    p_home_win = 0.0
    p_draw = 0.0
    p_away_win = 0.0
    
    p_home_list = [poisson_probability(lambda_home, x) for x in range(max_goals + 1)]
    p_away_list = [poisson_probability(lambda_away, y) for y in range(max_goals + 1)]
    
    best_prob = -1.0
    best_score = (0, 0)
    
    for h in range(max_goals + 1):
        for a in range(max_goals + 1):
            p = p_home_list[h] * p_away_list[a]
            
            if h > a:
                p_home_win += p
            elif h == a:
                p_draw += p
            else:
                p_away_win += p
                
            if p > best_prob:
                best_prob = p
                best_score = (h, a)
                
    total = p_home_win + p_draw + p_away_win
    if total > 0:
        pct_home = round((p_home_win / total) * 100)
        pct_away = round((p_away_win / total) * 100)
        pct_draw = max(0, 100 - pct_home - pct_away)
    else:
        pct_home, pct_draw, pct_away = 34, 32, 34
        
    return {
        "homeScore": best_score[0],
        "awayScore": best_score[1],
        "probability": {
            "home": pct_home,
            "draw": pct_draw,
            "away": pct_away
        }
    }

def generate_rationale(home, away, home_score, away_score, p_home, p_draw, p_away):
    h_desc = descriptors.get(home, home)
    a_desc = descriptors.get(away, away)
    
    h_rating = fifa_ratings.get(home, 1500)
    a_rating = fifa_ratings.get(away, 1500)
    rating_diff = abs(h_rating - a_rating)
    
    is_very_unequal = rating_diff >= 250
    is_slightly_unequal = 100 <= rating_diff < 250
    is_balanced = rating_diff < 100
    
    if home_score > away_score:
        if is_very_unequal:
            rationales = [
                f"El abismo técnico y físico favorece plenamente a {h_desc}. El modelo prevé que impondrán su ritmo ante un {a_desc} superado.",
                f"La Cancha hablará claro: el poderío táctico de {h_desc} debe asfixiar la salida de {a_desc} logrando una ventaja contundente.",
                f"Duelo sumamente desigual donde la jerarquía ofensiva de {h_desc} doblegará con holgura el bloque bajo de {a_desc}."
            ]
        elif is_slightly_unequal:
            rationales = [
                f"El momento y calidad colectiva favorecen a {h_desc}. Su superioridad en la media les permitirá controlar y batir a {a_desc}.",
                f"Un cotejo donde {h_desc} capitalizará los espacios en la transición defensiva de {a_desc} para asegurar la victoria.",
                f"El análisis proyecta un control estratégico de {home}. {h_desc} luce más sólido para romper la resistencia de {a_desc}."
            ]
        else:
            rationales = [
                f"Duelo directo sumamente parejo. La localía y un pequeño margen táctico le darán a {h_desc} una victoria por la mínima.",
                f"Fuerzas equilibradas donde la contundencia individual de las individualidades de {home} marcará la delgada diferencia.",
                f"Un choque vibrante resuelto por detalles. {h_desc} sabrá replegarse para cuidar un triunfo muy trabajado sobre {a_desc}."
            ]
    elif away_score > home_score:
        if is_very_unequal:
            rationales = [
                f"Contundencia absoluta de {a_desc}. Se espera que explote a placer las falencias de posicionamiento de {h_desc}.",
                f"Duelo marcado por la abrumadora jerarquía de {a_desc}. Su velocidad y dinámica no darán tregua al cuadro de {home}.",
                f"El poderío del plantel de {a_desc} marcará un ritmo de partido insostenible para el planteamiento defensivo de {h_desc}."
            ]
        elif is_slightly_unequal:
            rationales = [
                f"{away} llega en un momento físico formidable. Su disciplina táctica neutralizará la generación de juego de {h_desc}.",
                f"Se proyecta un dominio de balón controlado por parte de {a_desc}, forzando errores en la zaga de {home}.",
                f"La efectividad de {a_desc} en el contraataque será letal ante un {h_desc} que regalará espacios al ir al frente."
            ]
        else:
            rationales = [
                f"Encuentro cerrado en el medio campo. La madurez táctica de {a_desc} le permitirá llevarse los tres puntos por la mínima.",
                f"Choque simétrico de fuerzas. Un error puntual o el balón parado decantará el triunfo a favor de {a_desc}.",
                f"Propuestas muy afines, pero la velocidad en las bandas de {a_desc} superará en transiciones rápidas a la zaga de {h_desc}."
            ]
    else:
        if is_balanced:
            rationales = [
                f"Fuerzas idénticas y esquemas sumamente emparejados. Tanto {h_desc} como {a_desc} firmarán tablas en un duelo muy físico.",
                f"El análisis estratégico prevé una anulación mutua en la media cancha. El reparto de puntos es el escenario más coherente.",
                f"Un choque de estilos simétricos donde ambos priorizarán mantener el arco en cero antes de tomar riesgos excesivos."
            ]
        else:
            rationales = [
                f"El planteamiento ultra-defensivo de {a_desc} logrará neutralizar las embestidas y la mayor calidad técnica de {h_desc}.",
                f"A pesar de la superioridad teórica sobre el papel, se proyecta un partido trabado y con alta fricción que terminará en igualdad.",
                f"Historial de resiliencia táctica. {a_desc} sabrá replegarse con éxito y rasguñar un meritorio empate ante {h_desc}."
            ]
            
    return random.choice(rationales)


# 6. Construcción y Generación de Partidos

# Oficial FIFA World Cup 2026 Date Distributions
group_dates = (
    ["11 de Junio 2026"] * 2 +
    ["12 de Junio 2026"] * 2 +
    ["13 de Junio 2026"] * 4 +
    ["14 de Junio 2026"] * 4 +
    ["15 de Junio 2026"] * 4 +
    ["16 de Junio 2026"] * 4 +
    ["17 de Junio 2026"] * 4 +
    ["18 de Junio 2026"] * 4 +
    ["19 de Junio 2026"] * 4 +
    ["20 de Junio 2026"] * 4 +
    ["21 de Junio 2026"] * 4 +
    ["22 de Junio 2026"] * 4 +
    ["23 de Junio 2026"] * 4 +
    ["24 de Junio 2026"] * 6 +
    ["25 de Junio 2026"] * 6 +
    ["26 de Junio 2026"] * 6 +
    ["27 de Junio 2026"] * 6
)

d16_dates = ["28 de Junio 2026"] + ["29 de Junio 2026"]*3 + ["30 de Junio 2026"]*3 + \
            ["1 de Julio 2026"]*3 + ["2 de Julio 2026"]*3 + ["3 de Julio 2026"]*3

d8_dates = ["4 de Julio 2026"]*2 + ["5 de Julio 2026"]*2 + ["6 de Julio 2026"]*2 + ["7 de Julio 2026"]*2
d4_dates = ["9 de Julio 2026", "10 de Julio 2026", "10 de Julio 2026", "11 de Julio 2026"]
d2_dates = ["14 de Julio 2026", "15 de Julio 2026"]

matches = []
group_matches_temp = []

# FASE DE GRUPOS (6 partidos por grupo * 12 grupos = 72 partidos)
for group_name, teams in groups.items():
    pairs = [(0,1), (2,3), (0,2), (1,3), (0,3), (1,2)]
    day_offset = list(groups.keys()).index(group_name)
    
    for i, (t1, t2) in enumerate(pairs):
        home = teams[t1]
        away = teams[t2]
        
        pred = predict_match(home, away)
        h_score = pred["homeScore"]
        a_score = pred["awayScore"]
        probs = pred["probability"]
        
        rationale = generate_rationale(home, away, h_score, a_score, probs["home"], probs["draw"], probs["away"])
        
        jornada = i // 2
        
        group_matches_temp.append({
            "jornada": jornada,
            "group_idx": day_offset,
            "match_data": {
                "id": f"temp_g_{group_name}_{i}",
                "homeTeam": home,
                "awayTeam": away,
                "homeFlag": flags.get(home, "⚽"),
                "awayFlag": flags.get(away, "⚽"),
                "stage": "Fase de Grupos",
                "group": f"Grupo {group_name}",
                "recommendation": {
                    "homeScore": h_score,
                    "awayScore": a_score,
                    "probability": probs,
                    "rationale": rationale
                }
            }
        })

# Sort group matches by Jornada, then by Group to assign dates chronologically
group_matches_temp.sort(key=lambda x: (x["jornada"], x["group_idx"]))

for idx, gm in enumerate(group_matches_temp):
    m = gm["match_data"]
    m["date"] = group_dates[idx]
    m["time"] = get_kickoff_time(idx)
    m["stadium"] = get_stadium(m["homeTeam"], m["awayTeam"], idx)
    matches.append(m)

def get_deterministic_knockout_prediction(m_id, home_placeholder, away_placeholder):
    h = hashlib.md5(m_id.encode('utf-8')).hexdigest()
    mock_home_rating = 1550 + (int(h[0:4], 16) % 200)
    mock_away_rating = 1550 + (int(h[4:8], 16) % 200)
    
    pred = predict_match(None, None, home_rating=mock_home_rating, away_rating=mock_away_rating)
    
    h_score = pred["homeScore"]
    a_score = pred["awayScore"]
    
    if h_score > a_score:
        rat = f"El análisis táctico proyecta que {home_placeholder} impondrá condiciones gracias a un mayor equilibrio en sus líneas."
    elif a_score > h_score:
        rat = f"Se prevé que {away_placeholder} aproveche las transiciones rápidas para romper el cerrojo defensivo y llevarse el boleto."
    else:
        rat = f"Duelo de alta tensión. Se anticipa una igualdad sumamente estratégica que podría forzar la prórroga o los penaltis."
        
    pred["rationale"] = rat
    return pred

# DIECISEISAVOS DE FINAL (16 partidos)
for i in range(16):
    m_id = f"temp_16_m{i+1}"
    home_name = f"1º o 2º Clasificado {i+1}"
    away_name = f"Rival Clasificado {i+1}"
    pred = get_deterministic_knockout_prediction(m_id, home_name, away_name)
    match_idx = len(matches)
    
    matches.append({
        "id": m_id,
        "homeTeam": home_name,
        "awayTeam": away_name,
        "homeFlag": "🏆",
        "awayFlag": "⚽",
        "stage": "Dieciseisavos de Final",
        "group": None,
        "date": d16_dates[i],
        "time": get_kickoff_time(match_idx),
        "stadium": get_stadium(home_name, away_name, match_idx),
        "recommendation": pred
    })

# OCTAVOS DE FINAL (8 partidos)
for i in range(8):
    m_id = f"temp_8_m{i+1}"
    home_name = f"Ganador 16vos {i*2 + 1}"
    away_name = f"Ganador 16vos {i*2 + 2}"
    pred = get_deterministic_knockout_prediction(m_id, home_name, away_name)
    match_idx = len(matches)
    matches.append({
        "id": m_id,
        "homeTeam": home_name,
        "awayTeam": away_name,
        "homeFlag": "⚔️",
        "awayFlag": "⚔️",
        "stage": "Octavos de Final",
        "group": None,
        "date": d8_dates[i],
        "time": get_kickoff_time(match_idx),
        "stadium": get_stadium(home_name, away_name, match_idx),
        "recommendation": pred
    })

# CUARTOS DE FINAL (4 partidos)
for i in range(4):
    m_id = f"temp_4_m{i+1}"
    home_name = f"Ganador Octavos {i*2 + 1}"
    away_name = f"Ganador Octavos {i*2 + 2}"
    pred = get_deterministic_knockout_prediction(m_id, home_name, away_name)
    match_idx = len(matches)
    matches.append({
        "id": m_id,
        "homeTeam": home_name,
        "awayTeam": away_name,
        "homeFlag": "⭐",
        "awayFlag": "⭐",
        "stage": "Cuartos de Final",
        "group": None,
        "date": d4_dates[i],
        "time": get_kickoff_time(match_idx),
        "stadium": get_stadium(home_name, away_name, match_idx),
        "recommendation": pred
    })

# SEMIFINALES (2 partidos)
for i in range(2):
    m_id = f"temp_2_m{i+1}"
    home_name = f"Ganador Cuartos {i*2 + 1}"
    away_name = f"Ganador Cuartos {i*2 + 2}"
    pred = get_deterministic_knockout_prediction(m_id, home_name, away_name)
    match_idx = len(matches)
    matches.append({
        "id": m_id,
        "homeTeam": home_name,
        "awayTeam": away_name,
        "homeFlag": "🌟",
        "awayFlag": "🌟",
        "stage": "Semifinal",
        "group": None,
        "date": d2_dates[i],
        "time": get_kickoff_time(match_idx),
        "stadium": get_stadium(home_name, away_name, match_idx),
        "recommendation": pred
    })

# TERCER LUGAR
m_id = "temp_3rd_place"
home_name = "Perdedor Semifinal 1"
away_name = "Perdedor Semifinal 2"
pred = get_deterministic_knockout_prediction(m_id, home_name, away_name)
match_idx = len(matches)
matches.append({
    "id": m_id,
    "homeTeam": home_name,
    "awayTeam": away_name,
    "homeFlag": "🥉",
    "awayFlag": "🥉",
    "stage": "Tercer Lugar",
    "group": None,
    "date": "18 de Julio 2026",
    "time": get_kickoff_time(match_idx),
    "stadium": get_stadium(home_name, away_name, match_idx),
    "recommendation": pred
})

# GRAN FINAL
m_id = "temp_grand_final"
home_name = "Ganador Semifinal 1"
away_name = "Ganador Semifinal 2"
pred = get_deterministic_knockout_prediction(m_id, home_name, away_name)
match_idx = len(matches)
matches.append({
    "id": m_id,
    "homeTeam": home_name,
    "awayTeam": away_name,
    "homeFlag": "👑",
    "awayFlag": "👑",
    "stage": "Gran Final",
    "group": None,
    "date": "19 de Julio 2026",
    "time": get_kickoff_time(match_idx),
    "stadium": get_stadium(home_name, away_name, match_idx),
    "recommendation": pred
})

# 7. Ordenación Cronológica Exacta (por Fecha y Hora)

def get_sort_key(m):
    date_str = m["date"]
    time_str = m["time"]
    
    # Mes: Junio (6) o Julio (7)
    month = 6 if "Junio" in date_str else 7
    
    # Día (primer token numérico)
    day = int(date_str.split(" de ")[0])
    
    # Horas y Minutos
    hour, minute = map(int, time_str.split(":"))
    
    return (month, day, hour, minute)

matches.sort(key=get_sort_key)

# 8. Reasignación de IDs Secuenciales Definitivos (m1 a m104) basándose en el mapeo original

with open("id_mapping.json", "r", encoding="utf-8") as f:
    id_mapping = json.load(f)

for match in matches:
    key = f"{match['homeTeam']}_VS_{match['awayTeam']}"
    if key in id_mapping:
        match["id"] = id_mapping[key]
    else:
        # Fallback for some reason, shouldn't happen
        pass

output = {
    "tournament": "World Cup 2026",
    "teams": 48,
    "groups": 12,
    "matches": matches
}

# 9. Escritura del archivo JSON final
with open("api/2026.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print("¡Base de datos JSON regenerada y ordenada cronológicamente de forma exitosa!")
