import json
import urllib.request
import urllib.error

PROJECT_ID = "quiniela-backup"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def migrate_scores():
    # Fetch default group to get legacy scores
    req = urllib.request.Request(f"{BASE_URL}/groups/default")
    response = urllib.request.urlopen(req)
    default_data = json.loads(response.read().decode())
    
    legacy_matches = default_data.get("fields", {}).get("matches", {}).get("arrayValue", {}).get("values", [])
    scores_map = {}
    
    for lm in legacy_matches:
        fields = lm.get("mapValue", {}).get("fields", {})
        m_id = fields.get("id", {}).get("stringValue")
        h_score = fields.get("realHomeScore", {}).get("integerValue")
        a_score = fields.get("realAwayScore", {}).get("integerValue")
        
        if h_score is not None and a_score is not None:
            scores_map[m_id] = (int(h_score), int(a_score))
            
    print(f"Extracted {len(scores_map)} scores from legacy 'matches' field.")
    
    # Load pristine JSON for base structure (with new 16avos teams)
    with open("api/2026.json", "r") as f:
        matches = json.load(f)["matches"]
        
    for m in matches:
        m_id = m["id"]
        # Restore scores from legacy DB
        if m_id in scores_map:
            m["realHomeScore"] = scores_map[m_id][0]
            m["realAwayScore"] = scores_map[m_id][1]
        else:
            m["realHomeScore"] = None
            m["realAwayScore"] = None
            
        # Apply explicit manual fixes
        if m_id == "m11":
            m["realHomeScore"] = 1
            m["realAwayScore"] = 3
        elif m_id == "m27":
            m["realHomeScore"] = 2
            m["realAwayScore"] = 0
        elif m_id == "m55":
            m["homeTeam"] = "Portugal"
            m["awayTeam"] = "Colombia"
            m["homeFlagCode"] = "pt"
            m["awayFlagCode"] = "co"
            m["homeFlag"] = "🇵🇹"
            m["awayFlag"] = "🇨🇴"
            
    # Convert to Firestore format
    def to_firestore_value(val):
        if val is None:
            return {"nullValue": None}
        elif isinstance(val, bool):
            return {"booleanValue": val}
        elif isinstance(val, int):
            return {"integerValue": str(val)}
        elif isinstance(val, float):
            return {"doubleValue": val}
        elif isinstance(val, str):
            return {"stringValue": val}
        elif isinstance(val, dict):
            return {"mapValue": {"fields": {k: to_firestore_value(v) for k, v in val.items()}}}
        elif isinstance(val, list):
            return {"arrayValue": {"values": [to_firestore_value(v) for v in val]}}
        return {"stringValue": str(val)}

    firestore_matches = [to_firestore_value(m) for m in matches]

    # Fetch all groups and patch official_matches
    req_groups = urllib.request.Request(f"{BASE_URL}/groups")
    response_groups = urllib.request.urlopen(req_groups)
    groups_data = json.loads(response_groups.read().decode())
    groups = groups_data.get("documents", [])
    
    for group in groups:
        group_name = group["name"].split("/")[-1]
        fields = group.get("fields", {})
        
        fields["official_matches"] = {"arrayValue": {"values": firestore_matches}}
        
        patch_url = f"{BASE_URL}/groups/{group_name}?updateMask.fieldPaths=official_matches"
        payload = json.dumps({"fields": fields}).encode("utf-8")
        patch_req = urllib.request.Request(patch_url, data=payload, headers={"Content-Type": "application/json"}, method="PATCH")
        urllib.request.urlopen(patch_req)
        print(f"✅ Migrated all scores into official_matches for group {group_name}")

if __name__ == "__main__":
    migrate_scores()
