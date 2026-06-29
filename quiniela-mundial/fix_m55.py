import json
from google.cloud import firestore
import random

def fix_m55():
    # Fix local JSON
    with open("api/2026.json", "r") as f:
        data = json.load(f)
        
    for m in data.get("matches", []):
        if m["id"] == "m55":
            m["homeTeam"] = "Portugal"
            m["awayTeam"] = "Colombia"
            m["homeFlag"] = "🇵🇹"
            m["awayFlag"] = "🇨🇴"
            m["homeFlagCode"] = "pt"
            m["awayFlagCode"] = "co"
            m["recommendation"]["rationale"] = "Duelo donde la jerarquía de Portugal debería pesar lo suficiente para doblegar a Colombia, aunque el trámite será disputado."
            
    with open("api/2026.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    # Fix Firebase for ALL groups
    db = firestore.Client(project="quiniela-jaque")
    for group in db.collection("groups").stream():
        gdata = group.to_dict()
        fb_matches = gdata.get("matches", [])
        changed = False
        for fm in fb_matches:
            if fm["id"] == "m55":
                fm["homeTeam"] = "Portugal"
                fm["awayTeam"] = "Colombia"
                fm["homeFlag"] = "🇵🇹"
                fm["awayFlag"] = "🇨🇴"
                fm["homeFlagCode"] = "pt"
                fm["awayFlagCode"] = "co"
                changed = True
        
        if changed:
            group.reference.update({"matches": fb_matches})
            print(f"Fixed m55 in group {group.id}")

if __name__ == "__main__":
    fix_m55()
