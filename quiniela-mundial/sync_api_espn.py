import json
import urllib.request
from datetime import datetime, timedelta

ESPNDictionary = {
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
}

url = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719"
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
except Exception as e:
    print(f"Error fetching ESPN API: {e}")
    exit(1)

try:
    with open("api/2026.json", "r") as f:
        local_data = json.load(f)
        matches = local_data.get("matches", [])
except Exception as e:
    print(f"Error reading api/2026.json: {e}")
    exit(1)

months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

updated_count = 0
for event in data.get("events", []):
    comp = event.get("competitions", [{}])[0]
    date_str = comp.get("date")
    venue = comp.get("venue", {}).get("displayName", "")
    if not date_str: continue

    home_espn = ""
    away_espn = ""
    for c in comp.get("competitors", []):
        if c["homeAway"] == "home":
            home_espn = c["team"]["displayName"]
        else:
            away_espn = c["team"]["displayName"]
            
    local_home = ESPNDictionary.get(home_espn, home_espn)
    local_away = ESPNDictionary.get(away_espn, away_espn)

    # Find the match in local
    match = next((m for m in matches if m["homeTeam"] == local_home and m["awayTeam"] == local_away), None)
    if not match:
        # Try reverse (though ESPN home/away is usually accurate)
        match = next((m for m in matches if m["homeTeam"] == local_away and m["awayTeam"] == local_home), None)
        
    if match:
        match["utcDate"] = date_str
        dt_utc = datetime.strptime(date_str, "%Y-%m-%dT%H:%MZ")
        # Subtract 4 hours to convert from UTC to local display time roughly (Chile / ET)
        dt_local = dt_utc - timedelta(hours=4)
        
        match["date"] = f"{dt_local.day} de {months[dt_local.month - 1]} {dt_local.year}"
        match["time"] = f"{dt_local.hour:02d}:{dt_local.minute:02d}"
        if venue:
            match["stadium"] = venue
        updated_count += 1

# Sort matches by utcDate
matches.sort(key=lambda x: x["utcDate"])

with open("api/2026.json", "w") as f:
    json.dump({"matches": matches}, f, ensure_ascii=False, indent=2)

print(f"Successfully updated dates for {updated_count} matches from ESPN API.")
