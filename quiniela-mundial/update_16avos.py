import json

# Definir los cruces confirmados
cruces = [
    {"date": "28 de Junio 2026", "homeTeam": "Sudáfrica", "awayTeam": "Canadá", "homeFlagCode": "za", "awayFlagCode": "ca", "homeFlag": "🇿🇦", "awayFlag": "🇨🇦"},
    {"date": "29 de Junio 2026", "homeTeam": "Brasil", "awayTeam": "Japón", "homeFlagCode": "br", "awayFlagCode": "jp", "homeFlag": "🇧🇷", "awayFlag": "🇯🇵"},
    {"date": "29 de Junio 2026", "homeTeam": "Países Bajos", "awayTeam": "Marruecos", "homeFlagCode": "nl", "awayFlagCode": "ma", "homeFlag": "🇳🇱", "awayFlag": "🇲🇦"},
    {"date": "30 de Junio 2026", "homeTeam": "Costa de Marfil", "awayTeam": "Noruega", "homeFlagCode": "ci", "awayFlagCode": "no", "homeFlag": "🇨🇮", "awayFlag": "🇳🇴"},
    {"date": "1 de Julio 2026", "homeTeam": "EE.UU.", "awayTeam": "Bosnia y Herzegovina", "homeFlagCode": "us", "awayFlagCode": "ba", "homeFlag": "🇺🇸", "awayFlag": "🇧🇦"},
    {"date": "29 de Junio 2026", "homeTeam": "Alemania", "awayTeam": "3º Clasificado", "homeFlagCode": "de", "awayFlagCode": "xx", "homeFlag": "🇩🇪", "awayFlag": "⚽"},
    {"date": "30 de Junio 2026", "homeTeam": "Francia", "awayTeam": "3º Clasificado", "homeFlagCode": "fr", "awayFlagCode": "xx", "homeFlag": "🇫🇷", "awayFlag": "⚽"},
    {"date": "30 de Junio 2026", "homeTeam": "México", "awayTeam": "3º Clasificado", "homeFlagCode": "mx", "awayFlagCode": "xx", "homeFlag": "🇲🇽", "awayFlag": "⚽"}
]

with open("api/2026.json", "r") as f:
    data = json.load(f)

# Buscar los partidos de Dieciseisavos y actualizarlos
dieciseisavos = [m for m in data["matches"] if m["stage"] == "Dieciseisavos de Final"]

# Simple asignación por fecha
for cruce in cruces:
    # Buscar el primer partido de dieciseisavos en esa fecha que aún tenga 'Clasificado'
    match = next((m for m in dieciseisavos if m["date"] == cruce["date"] and "Clasificado" in m["homeTeam"]), None)
    if match:
        match["homeTeam"] = cruce["homeTeam"]
        match["awayTeam"] = cruce["awayTeam"]
        match["homeFlagCode"] = cruce["homeFlagCode"]
        match["awayFlagCode"] = cruce["awayFlagCode"]
        match["homeFlag"] = cruce["homeFlag"]
        match["awayFlag"] = cruce["awayFlag"]

with open("api/2026.json", "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("api/2026.json updated with 16avos teams.")
