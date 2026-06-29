import json
from google.cloud import firestore
import random

def apply_option_a():
    db = firestore.Client(project="quiniela-jaque")
    
    with open("api/2026.json", "r") as f:
        local_data = json.load(f)
        api_matches = local_data.get("matches", [])
        
    group_ref = db.collection("groups").document("mango_fc")
    group_doc = group_ref.get()
    group_data = group_doc.to_dict()
    fb_matches = group_data.get("matches", [])
    
    # 1. Identify inverted matches (Firebase vs Local)
    inverted_match_indices = set()
    for fm in fb_matches:
        am = next((m for m in api_matches if m["id"] == fm["id"]), None)
        if am:
            if fm["homeTeam"] == am["awayTeam"] and fm["awayTeam"] == am["homeTeam"]:
                idx = int(fm["id"].replace("m", "")) - 1
                inverted_match_indices.add(idx)
                
    if inverted_match_indices:
        print(f"Reverting predictions for {len(inverted_match_indices)} matches...")
        # ONLY DO IT FOR THE GROUPS WE TOUCHED YESTERDAY
        groups_to_fix = ["default", "mango_fc"]
        for group_id in groups_to_fix:
            print(f"Reverting group: {group_id}")
            group_ref = db.collection("groups").document(group_id)
            preds_ref = group_ref.collection("predictions").stream()
            for pred_doc in preds_ref:
                pred_data = pred_doc.to_dict()
                raw_str = pred_data.get("data", "")
                if isinstance(raw_str, str) and raw_str:
                    parts = raw_str.split(",")
                    changed = False
                    for idx in inverted_match_indices:
                        if idx < len(parts):
                            score = parts[idx]
                            if score and score != "-":
                                h, a = score.split("-")
                                parts[idx] = f"{a}-{h}"
                                changed = True
                    if changed:
                        new_str = ",".join(parts)
                        group_ref.collection("predictions").document(pred_doc.id).update({"data": new_str})
                        
    # 2. Modify api/2026.json so its home/away order strictly matches Firebase!
    # This guarantees that the UI will match Firebase, avoiding any flip.
    for fm in fb_matches:
        am = next((m for m in api_matches if m["id"] == fm["id"]), None)
        if am:
            am["homeTeam"] = fm.get("homeTeam", am["homeTeam"])
            am["awayTeam"] = fm.get("awayTeam", am["awayTeam"])
            am["homeFlagCode"] = fm.get("homeFlagCode", am.get("homeFlagCode"))
            am["awayFlagCode"] = fm.get("awayFlagCode", am.get("awayFlagCode"))
            if fm.get("homeFlag"): am["homeFlag"] = fm["homeFlag"]
            if fm.get("awayFlag"): am["awayFlag"] = fm["awayFlag"]

    # 3. Regenerate predictive model to align with the new fixed order
    tiers = {
        "Argentina": 1, "Francia": 1, "Brasil": 1, "Inglaterra": 1, "España": 1, "Alemania": 1, "Portugal": 1,
        "Países Bajos": 2, "Bélgica": 2, "Uruguay": 2, "Croacia": 2, "Colombia": 2, "Senegal": 2, "Marruecos": 2,
        "EE.UU.": 3, "México": 3, "Japón": 3, "Suiza": 3, "Ecuador": 3, "Turquía": 3, "Corea del Sur": 3,
        "Ghana": 4, "Canadá": 4, "Australia": 4, "Arabia Saudita": 4, "Paraguay": 4, "Túnez": 4, "Argelia": 4,
        "Panamá": 5, "Uzbekistán": 5, "RD Congo": 5, "Jordania": 5, "Haití": 5, "Cabo Verde": 5, "Curazao": 5
    }
    
    def get_tier(team):
        return tiers.get(team, 4)
        
    for m in api_matches:
        ht = m["homeTeam"]
        at = m["awayTeam"]
        htier = get_tier(ht)
        atier = get_tier(at)
        diff = atier - htier
        if "recommendation" not in m: m["recommendation"] = {}
        
        if diff > 1:
            m["recommendation"]["homeScore"] = random.randint(2, 4)
            m["recommendation"]["awayScore"] = random.randint(0, 1)
            m["recommendation"]["probability"] = {"home": random.randint(70, 85), "draw": random.randint(10, 20), "away": random.randint(2, 10)}
            m["recommendation"]["rationale"] = f"El abismo técnico y físico favorece plenamente a {ht}. El modelo prevé que impondrán su ritmo ante {at} sin complicaciones."
        elif diff == 1:
            m["recommendation"]["homeScore"] = random.randint(1, 2)
            m["recommendation"]["awayScore"] = random.randint(0, 1)
            m["recommendation"]["probability"] = {"home": random.randint(50, 65), "draw": random.randint(20, 30), "away": random.randint(10, 20)}
            m["recommendation"]["rationale"] = f"Duelo donde la jerarquía de {ht} debería pesar lo suficiente para doblegar a {at}."
        elif diff < -1:
            m["recommendation"]["homeScore"] = random.randint(0, 1)
            m["recommendation"]["awayScore"] = random.randint(2, 4)
            m["recommendation"]["probability"] = {"home": random.randint(2, 10), "draw": random.randint(10, 20), "away": random.randint(70, 85)}
            m["recommendation"]["rationale"] = f"La superioridad de {at} es evidente. {ht} tendrá muy difícil contener el bloque ofensivo visitante."
        elif diff == -1:
            m["recommendation"]["homeScore"] = random.randint(0, 1)
            m["recommendation"]["awayScore"] = random.randint(1, 2)
            m["recommendation"]["probability"] = {"home": random.randint(10, 20), "draw": random.randint(20, 30), "away": random.randint(50, 65)}
            m["recommendation"]["rationale"] = f"Un choque complejo para {ht}. El modelo favorece ligeramente a {at}."
        else:
            draw_score = random.randint(0, 2)
            m["recommendation"]["homeScore"] = draw_score
            m["recommendation"]["awayScore"] = draw_score
            m["recommendation"]["probability"] = {"home": random.randint(30, 40), "draw": random.randint(35, 45), "away": random.randint(30, 40)}
            m["recommendation"]["rationale"] = f"Choque de estilos muy parejo entre {ht} y {at}. El modelo prevé un empate táctico."
            
    with open("api/2026.json", "w") as f:
        json.dump(local_data, f, ensure_ascii=False, indent=2)
        
    print("Done applying Option A!")

if __name__ == "__main__":
    apply_option_a()
