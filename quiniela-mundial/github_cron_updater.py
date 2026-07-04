import urllib.request, json, time, os, sys

PROJECT_ID = "quiniela-backup"
BASE_URL = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents"

def to_firestore_value(val):
    if val is None: return {"nullValue": None}
    elif isinstance(val, bool): return {"booleanValue": val}
    elif isinstance(val, int): return {"integerValue": str(val)}
    elif isinstance(val, float): return {"doubleValue": val}
    elif isinstance(val, str): return {"stringValue": val}
    elif isinstance(val, dict): return {"mapValue": {"fields": {k: to_firestore_value(v) for k, v in val.items()}}}
    elif isinstance(val, list): return {"arrayValue": {"values": [to_firestore_value(v) for v in val]}}
    return {"stringValue": str(val)}

def calculate_points(preds_raw, matches):
    if not preds_raw: return 0
    points = 0
    # Extract prediction data based on firestore structure
    if "stringValue" in preds_raw:
        parts = preds_raw["stringValue"].split(",")
        for m in matches:
            idx = int(m["id"].replace("m", "")) - 1
            if m.get("realHomeScore") is not None and m.get("realAwayScore") is not None:
                if idx < len(parts) and parts[idx] and parts[idx] != "-":
                    try:
                        ph, pa = map(int, parts[idx].split("-"))
                        rh, ra = int(m["realHomeScore"]), int(m["realAwayScore"])
                        if ph == rh and pa == ra: points += 3
                        elif (ph > pa and rh > ra) or (ph < pa and rh < ra) or (ph == pa and rh == ra): points += 1
                    except: pass
    elif "mapValue" in preds_raw:
        fields = preds_raw["mapValue"].get("fields", {})
        for m in matches:
            if m.get("realHomeScore") is not None and m.get("realAwayScore") is not None:
                p = fields.get(m["id"])
                if p and "mapValue" in p:
                    p_fields = p["mapValue"].get("fields", {})
                    if "home" in p_fields and "away" in p_fields:
                        ph_str = p_fields["home"].get("stringValue", p_fields["home"].get("integerValue", ""))
                        pa_str = p_fields["away"].get("stringValue", p_fields["away"].get("integerValue", ""))
                        if ph_str and pa_str:
                            try:
                                ph, pa = int(ph_str), int(pa_str)
                                rh, ra = int(m["realHomeScore"]), int(m["realAwayScore"])
                                if ph == rh and pa == ra: points += 3
                                elif (ph > pa and rh > ra) or (ph < pa and rh < ra) or (ph == pa and rh == ra): points += 1
                            except: pass
    return points

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
                is_completed = event["status"]["type"].get("completed", False)
                if status == "Full Time" or "Final" in status or is_completed:
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
    
    # ---------------------------------------------------------
    # NEW: Fetch future matches to dynamically update the bracket
    # ---------------------------------------------------------
    try:
        future_url = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260709-20260719"
        future_req = urllib.request.Request(future_url, headers={"User-Agent": "Mozilla/5.0"})
        future_resp = urllib.request.urlopen(future_req, timeout=10)
        future_data = json.loads(future_resp.read().decode())
        future_matches = []
        for event in future_data.get("events", []):
            comp = event["competitions"][0]
            future_matches.append({
                "date": comp["date"],
                "home": comp["competitors"][0]["team"]["displayName"],
                "away": comp["competitors"][1]["team"]["displayName"]
            })
        future_matches.sort(key=lambda x: x["date"])
    except Exception as e:
        print("Error fetching future matches:", e)
        future_matches = []
    # ---------------------------------------------------------

    
    try:
        with open("api/2026.json", "r") as f:
            local_data = json.load(f)
    except Exception as e:
        print("Error reading JSON:", e)
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
        "Türkiye": "Turquía", "United States": "EE.UU.", "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistán",
        "Quarterfinal 1 Winner": "Ganador Cuartos 1", "Quarterfinal 2 Winner": "Ganador Cuartos 2",
        "Quarterfinal 3 Winner": "Ganador Cuartos 3", "Quarterfinal 4 Winner": "Ganador Cuartos 4",
        "Semifinal 1 Winner": "Ganador Semifinal 1", "Semifinal 2 Winner": "Ganador Semifinal 2",
        "Semifinal 1 Loser": "Perdedor Semifinal 1", "Semifinal 2 Loser": "Perdedor Semifinal 2"
    }
    
    # ---------------------------------------------------------
    # NEW: Apply future matches to the JSON
    # ---------------------------------------------------------
    future_slots = ["m97", "m99", "m98", "m100", "m101", "m102", "m103", "m104"]
    for i, slot_id in enumerate(future_slots):
        if i < len(future_matches):
            fm = future_matches[i]
            local_h = ESPNDictionary.get(fm["home"], fm["home"])
            local_a = ESPNDictionary.get(fm["away"], fm["away"])
            for m in local_data["matches"]:
                if m["id"] == slot_id:
                    if m.get("homeTeam") != local_h or m.get("awayTeam") != local_a:
                        m["homeTeam"] = local_h
                        m["awayTeam"] = local_a
                        # Also attempt to map flags if they are known teams
                        if "Ganador" not in local_h and "Perdedor" not in local_h:
                            # Try to find flag from other matches
                            for prev_m in local_data["matches"]:
                                if prev_m.get("homeTeam") == local_h:
                                    m["homeFlagCode"] = prev_m.get("homeFlagCode", "")
                                    m["homeFlag"] = prev_m.get("homeFlag", "")
                                    break
                                elif prev_m.get("awayTeam") == local_h:
                                    m["homeFlagCode"] = prev_m.get("awayFlagCode", "")
                                    m["homeFlag"] = prev_m.get("awayFlag", "")
                                    break
                        if "Ganador" not in local_a and "Perdedor" not in local_a:
                            for prev_m in local_data["matches"]:
                                if prev_m.get("homeTeam") == local_a:
                                    m["awayFlagCode"] = prev_m.get("homeFlagCode", "")
                                    m["awayFlag"] = prev_m.get("homeFlag", "")
                                    break
                                elif prev_m.get("awayTeam") == local_a:
                                    m["awayFlagCode"] = prev_m.get("awayFlagCode", "")
                                    m["awayFlag"] = prev_m.get("awayFlag", "")
                                    break
                        changed = True
                        print(f"Updated future slot {slot_id}: {local_h} vs {local_a}")
                    break
    # ---------------------------------------------------------
    
    reverse_dict = {v: k for k, v in ESPNDictionary.items()}
    
    for m in local_data["matches"]:
        h_espn = reverse_dict.get(m["homeTeam"], m["homeTeam"])
        a_espn = reverse_dict.get(m["awayTeam"], m["awayTeam"])
        key1 = f"{h_espn} vs {a_espn}"
        key2 = f"{m['homeTeam']} vs {m['awayTeam']}"
        
        match_score = espn_scores.get(key1) or espn_scores.get(key2)
        
        if match_score:
            if m.get("realHomeScore") != match_score["h"] or m.get("realAwayScore") != match_score["a"]:
                m["realHomeScore"] = match_score["h"]
                m["realAwayScore"] = match_score["a"]
                changed = True
                print(f"Detected new score: {key1} -> {match_score['h']}-{match_score['a']}")
                
    if changed:
        print("Scores changed! Updating JSON...")
        with open("api/2026.json", "w") as f:
            json.dump(local_data, f, indent=2, ensure_ascii=False)
            
        print("Pushing to Firebase...")
        firestore_matches = [to_firestore_value(m) for m in local_data["matches"]]
        
        try:
            req = urllib.request.Request(BASE_URL + "/groups")
            resp = urllib.request.urlopen(req)
            groups = json.loads(resp.read().decode()).get("documents", [])
            
            for group in groups:
                group_name = group["name"].split("/")[-1]
                fields = group.get("fields", {})
                fields["official_matches"] = {"arrayValue": {"values": firestore_matches}}
                
                patch_url = BASE_URL + "/groups/" + group_name + "?updateMask.fieldPaths=official_matches"
                payload = json.dumps({"fields": fields}).encode("utf-8")
                patch_req = urllib.request.Request(patch_url, data=payload, headers={"Content-Type": "application/json"}, method="PATCH")
                urllib.request.urlopen(patch_req)
                print(f"✅ Updated official_matches for group {group_name}")
                
                # RECALCULATE POINTS FOR THIS GROUP
                prof_url = BASE_URL + "/groups/" + group_name + "/profiles?pageSize=100"
                try:
                    prof_req = urllib.request.Request(prof_url)
                    prof_resp = urllib.request.urlopen(prof_req)
                    profiles = json.loads(prof_resp.read().decode()).get("documents", [])
                    
                    for prof in profiles:
                        prof_id = prof["name"].split("/")[-1]
                        prof_fields = prof.get("fields", {})
                        
                        # Get predictions
                        pred_url = BASE_URL + "/groups/" + group_name + "/predictions/" + prof_id
                        try:
                            pred_req = urllib.request.Request(pred_url)
                            pred_resp = urllib.request.urlopen(pred_req)
                            pred_doc = json.loads(pred_resp.read().decode())
                            preds_raw = pred_doc.get("fields", {}).get("data", {})
                        except:
                            preds_raw = {}
                            
                        pts = calculate_points(preds_raw, local_data["matches"])
                        old_pts = int(prof_fields.get("points", {}).get("integerValue", "0"))
                        
                        if old_pts != pts:
                            patch_prof_url = BASE_URL + "/groups/" + group_name + "/profiles/" + prof_id + "?updateMask.fieldPaths=points"
                            prof_fields["points"] = {"integerValue": str(pts)}
                            prof_payload = json.dumps({"fields": prof_fields}).encode("utf-8")
                            p_req = urllib.request.Request(patch_prof_url, data=prof_payload, headers={"Content-Type": "application/json"}, method="PATCH")
                            urllib.request.urlopen(p_req)
                            print(f"   -> Recalculated {prof_id} points: {old_pts} -> {pts}")
                            
                except Exception as e:
                    print(f"Error recalculating points for group {group_name}: {e}")
                    
        except Exception as e:
            print("Error pushing to firebase:", e)
            
        print("Update complete.")
    else:
        print("No new scores detected. Nothing to update.")

if __name__ == "__main__":
    fetch_and_push()
