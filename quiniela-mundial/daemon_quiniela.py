import urllib.request, json, time, os, sys
from google.cloud import firestore

PROJECT_ID = "quiniela-backup"
BASE_URL = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents"

def fetch_and_push():
    print("Fetching ESPN scores...")
    dates = [f"202606{i:02d}" for i in range(11, 31)] + [f"202607{i:02d}" for i in range(1, 20)]
    
    espn_scores = {}
    for d in dates:
        try:
            url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates={d}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urllib.request.urlopen(req, timeout=10)
            data = json.loads(resp.read().decode())
            for event in data.get("events", []):
                status = event["status"]["type"]["description"]
                if status == "Full Time":
                    comp = event["competitions"][0]
                    h = ""; a = ""; h_score = 0; a_score = 0
                    for c in comp["competitors"]:
                        if c["homeAway"] == "home":
                            h = c["team"]["displayName"]
                            h_score = int(c.get("score", 0))
                        else:
                            a = c["team"]["displayName"]
                            a_score = int(c.get("score", 0))
                    espn_scores[f"{h} vs {a}"] = {"h": h_score, "a": a_score}
        except Exception as e:
            pass
            
    print(f"Found {len(espn_scores)} completed matches on ESPN.")
    
    # Now read api/2026.json
    try:
        with open("/Users/luisjaquekadis/.gemini/antigravity-ide/scratch/quiniela-mundial/api/2026.json", "r") as f:
            local_data = json.load(f)
    except:
        return
        
    changed = False
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
    
    reverse_dict = {v: k for k, v in ESPNDictionary.items()}
    
    for m in local_data["matches"]:
        # Find in espn_scores
        h_espn = reverse_dict.get(m["homeTeam"], m["homeTeam"])
        a_espn = reverse_dict.get(m["awayTeam"], m["awayTeam"])
        key1 = f"{h_espn} vs {a_espn}"
        
        # Also try reverse mapping to Spanish just in case
        key2 = f"{m['homeTeam']} vs {m['awayTeam']}"
        
        match_score = espn_scores.get(key1) or espn_scores.get(key2)
        
        if match_score:
            if m.get("realHomeScore") != match_score["h"] or m.get("realAwayScore") != match_score["a"]:
                m["realHomeScore"] = match_score["h"]
                m["realAwayScore"] = match_score["a"]
                changed = True
                print(f"Detected new score: {key1} -> {match_score['h']}-{match_score['a']}")
                
    if changed:
        print("Scores changed! Updating JSON and pushing to Firebase...")
        with open("/Users/luisjaquekadis/.gemini/antigravity-ide/scratch/quiniela-mundial/api/2026.json", "w") as f:
            json.dump(local_data, f, indent=2, ensure_ascii=False)
            
        # Push to firebase (simulated by executing the push script)
        os.system("python3 /Users/luisjaquekadis/.gemini/antigravity-ide/scratch/quiniela-mundial/push_official_matches.py")
        
        # Recalculate points
        os.system("python3 -c 'import runpy; runpy.run_path(\"/Users/luisjaquekadis/.gemini/antigravity-ide/scratch/quiniela-mundial/update_scores.py\")'")
        print("Update complete.")
    else:
        print("No new scores detected.")

if __name__ == "__main__":
    fetch_and_push()
