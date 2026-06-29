import json
import urllib.request
import urllib.error

PROJECT_ID = "quiniela-backup"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def push_official_matches():
    # Load pristine JSON
    with open("api/2026.json", "r") as f:
        matches = json.load(f)["matches"]
        
    # Apply corrections that were lost to zombies
    for m in matches:
        # ENSURE realHomeScore and realAwayScore exist explicitly, even if null.
        # This was the bug: previously it just skipped them if they weren't there, leading to undefined in UI.
        m["realHomeScore"] = m.get("realHomeScore", None)
        m["realAwayScore"] = m.get("realAwayScore", None)
        
        if m["id"] == "m11":
            m["realHomeScore"] = 1
            m["realAwayScore"] = 3
        elif m["id"] == "m27":
            m["realHomeScore"] = 2
            m["realAwayScore"] = 0
        elif m["id"] == "m55":
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

    # Fetch all groups
    req = urllib.request.Request(f"{BASE_URL}/groups")
    try:
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode())
        groups = data.get("documents", [])
        
        for group in groups:
            group_name = group["name"].split("/")[-1]
            fields = group.get("fields", {})
            
            # Set official_matches
            fields["official_matches"] = {"arrayValue": {"values": firestore_matches}}
            
            patch_url = f"{BASE_URL}/groups/{group_name}?updateMask.fieldPaths=official_matches"
            payload = json.dumps({"fields": fields}).encode("utf-8")
            patch_req = urllib.request.Request(patch_url, data=payload, headers={"Content-Type": "application/json"}, method="PATCH")
            urllib.request.urlopen(patch_req)
            print(f"✅ Created/Updated official_matches for group {group_name}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    push_official_matches()
