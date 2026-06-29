import json

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
kickoff_times = ["13:00", "16:00", "18:00", "20:00"]
def get_kickoff_time(match_idx): return kickoff_times[match_idx % len(kickoff_times)]

matches = []

for group_name, teams in groups.items():
    pairs = [(0,1), (2,3), (0,2), (1,3), (0,3), (1,2)]
    day_offset = list(groups.keys()).index(group_name)
    for i, (t1, t2) in enumerate(pairs):
        home = teams[t1]
        away = teams[t2]
        match_idx = len(matches)
        matches.append({
            "homeTeam": home, "awayTeam": away,
            "date": f"{11 + day_offset + (i%3)} de Junio 2026",
            "time": get_kickoff_time(match_idx),
        })

for i in range(16):
    home_name = f"1º o 2º Clasificado {i+1}"
    away_name = f"Rival Clasificado {i+1}"
    match_idx = len(matches)
    matches.append({"homeTeam": home_name, "awayTeam": away_name, "date": f"{28 + (i%4)} de Junio 2026", "time": get_kickoff_time(match_idx)})

for i in range(8):
    home_name = f"Ganador 16vos {i*2 + 1}"
    away_name = f"Ganador 16vos {i*2 + 2}"
    match_idx = len(matches)
    matches.append({"homeTeam": home_name, "awayTeam": away_name, "date": f"{4 + (i%4)} de Julio 2026", "time": get_kickoff_time(match_idx)})

for i in range(4):
    home_name = f"Ganador Octavos {i*2 + 1}"
    away_name = f"Ganador Octavos {i*2 + 2}"
    match_idx = len(matches)
    matches.append({"homeTeam": home_name, "awayTeam": away_name, "date": f"{9 + (i%2)} de Julio 2026", "time": get_kickoff_time(match_idx)})

for i in range(2):
    home_name = f"Ganador Cuartos {i*2 + 1}"
    away_name = f"Ganador Cuartos {i*2 + 2}"
    match_idx = len(matches)
    matches.append({"homeTeam": home_name, "awayTeam": away_name, "date": f"{14 + i} de Julio 2026", "time": get_kickoff_time(match_idx)})

match_idx = len(matches)
matches.append({"homeTeam": "Perdedor Semifinal 1", "awayTeam": "Perdedor Semifinal 2", "date": "18 de Julio 2026", "time": get_kickoff_time(match_idx)})
match_idx = len(matches)
matches.append({"homeTeam": "Ganador Semifinal 1", "awayTeam": "Ganador Semifinal 2", "date": "19 de Julio 2026", "time": get_kickoff_time(match_idx)})

def get_sort_key(m):
    date_str = m["date"]
    time_str = m["time"]
    month = 6 if "Junio" in date_str else 7
    day = int(date_str.split(" de ")[0])
    hour, minute = map(int, time_str.split(":"))
    return (month, day, hour, minute)

matches.sort(key=get_sort_key)

mapping = {}
for idx, match in enumerate(matches):
    mapping[f"{match['homeTeam']}_VS_{match['awayTeam']}"] = f"m{idx + 1}"

with open("id_mapping.json", "w") as f:
    json.dump(mapping, f, indent=2, ensure_ascii=False)
