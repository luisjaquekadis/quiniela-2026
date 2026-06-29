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

def load_local():
    with open("api/2026.json", "r") as f:
        return json.load(f)["matches"]

def extract_flags(matches):
    flags = {}
    for m in matches:
        if "Clasificado" not in m["homeTeam"]:
            flags[m["homeTeam"]] = {"code": m.get("homeFlagCode", ""), "emoji": m.get("homeFlag", "")}
        if "Clasificado" not in m["awayTeam"]:
            flags[m["awayTeam"]] = {"code": m.get("awayFlagCode", ""), "emoji": m.get("awayFlag", "")}
    return flags

def fetch_espn():
    url = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260628-20260719"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

def update_16avos():
    matches = load_local()
    flags = extract_flags(matches)
    espn_data = fetch_espn()
    
    espn_matches = []
    for event in espn_data.get("events", []):
        comp = event.get("competitions", [{}])[0]
        date_str = comp.get("date")
        if not date_str: continue
        home, away = "", ""
        for c in comp.get("competitors", []):
            if c["homeAway"] == "home":
                home = c["team"]["displayName"]
            else:
                away = c["team"]["displayName"]
        
        local_home = ESPNDictionary.get(home, home)
        local_away = ESPNDictionary.get(away, away)
        espn_matches.append({"date": date_str, "home": local_home, "away": local_away})

    # For each ESPN match, try to find it. If not found, assign to a "Clasificado" slot.
    for em in espn_matches:
        # Check if already exists exactly
        existing = next((m for m in matches if m["homeTeam"] == em["home"] and m["awayTeam"] == em["away"]), None)
        if not existing:
            existing = next((m for m in matches if m["homeTeam"] == em["away"] and m["awayTeam"] == em["home"]), None)
            
        if existing:
            print(f"Match {em['home']} vs {em['away']} already found as {existing['id']}.")
            continue
            
        # Check if it partially matches a slot like "Alemania vs 3º Clasificado"
        partial = next((m for m in matches if (m["homeTeam"] == em["home"] and "Clasificado" in m["awayTeam"]) or 
                                              (m["awayTeam"] == em["away"] and "Clasificado" in m["homeTeam"]) or
                                              (m["homeTeam"] == em["away"] and "Clasificado" in m["awayTeam"]) or
                                              (m["awayTeam"] == em["home"] and "Clasificado" in m["homeTeam"])), None)
        if partial:
            print(f"Partial match found for {em['home']} vs {em['away']} in {partial['id']} ({partial['homeTeam']} vs {partial['awayTeam']})")
            partial["homeTeam"] = em["home"]
            partial["awayTeam"] = em["away"]
            partial["homeFlagCode"] = flags.get(em["home"], {}).get("code", "")
            partial["homeFlag"] = flags.get(em["home"], {}).get("emoji", "")
            partial["awayFlagCode"] = flags.get(em["away"], {}).get("code", "")
            partial["awayFlag"] = flags.get(em["away"], {}).get("emoji", "")
            continue
            
        # If neither, find a completely empty slot
        empty = next((m for m in matches if "Clasificado" in m["homeTeam"] and "Clasificado" in m["awayTeam"]), None)
        if empty:
            print(f"Filling empty slot {empty['id']} with {em['home']} vs {em['away']}")
            empty["homeTeam"] = em["home"]
            empty["awayTeam"] = em["away"]
            empty["homeFlagCode"] = flags.get(em["home"], {}).get("code", "")
            empty["homeFlag"] = flags.get(em["home"], {}).get("emoji", "")
            empty["awayFlagCode"] = flags.get(em["away"], {}).get("code", "")
            empty["awayFlag"] = flags.get(em["away"], {}).get("emoji", "")
            
    with open("api/2026.json", "w") as f:
        json.dump({"matches": matches}, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    update_16avos()
