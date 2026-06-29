import json
from datetime import datetime, timedelta, timezone

# Dictionary mapping Spanish country names to ISO 3166-1 alpha-2 codes
ISO_CODES = {
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
}

MONTHS = {
    "Junio": 6,
    "Julio": 7
}

STADIUM_TZ_OFFSET = {
    "Gillette Stadium (Boston)": -4,
    "Hard Rock Stadium (Miami)": -4,
    "Mercedes-Benz Stadium (Atlanta)": -4,
    "Lincoln Financial Field (Philadelphia)": -4,
    "MetLife Stadium (New York/New Jersey)": -4,
    "BMO Field (Toronto)": -4,
    "AT&T Stadium (Dallas)": -5,
    "NRG Stadium (Houston)": -5,
    "Arrowhead Stadium (Kansas City)": -5,
    "Estadio Azteca (Ciudad de México)": -6,
    "Estadio BBVA (Monterrey)": -6,
    "Estadio Akron (Guadalajara)": -6,
    "SoFi Stadium (Los Angeles)": -7,
    "Levi's Stadium (San Francisco)": -7,
    "Lumen Field (Seattle)": -7,
    "BC Place (Vancouver)": -7
}

def main():
    file_path = "api/2026.json"
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    for m in data.get("matches", []):
        parts = m["date"].split(" ")
        day = int(parts[0])
        month = MONTHS[parts[2]]
        year = int(parts[3])
        
        t_parts = m["time"].split(":")
        hour = int(t_parts[0])
        minute = int(t_parts[1])
        
        stadium = m.get("stadium", "")
        # Default to EDT (-4) if unknown
        offset = STADIUM_TZ_OFFSET.get(stadium, -4)
        local_tz = timezone(timedelta(hours=offset))
        
        dt_aware = datetime(year, month, day, hour, minute, tzinfo=local_tz)
        dt_utc = dt_aware.astimezone(timezone.utc)
        
        m["utcDate"] = dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        
        h_team = m["homeTeam"]
        a_team = m["awayTeam"]
        
        m["homeFlagCode"] = ISO_CODES.get(h_team, "un")
        m["awayFlagCode"] = ISO_CODES.get(a_team, "un")
        
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print("Migration completed successfully with correct stadium timezones.")

if __name__ == "__main__":
    main()
