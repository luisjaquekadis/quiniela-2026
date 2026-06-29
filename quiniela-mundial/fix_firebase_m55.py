import json
import urllib.request
import urllib.error

PROJECT_ID = "quiniela-backup"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def fix_m55():
    # Fetch all groups
    req = urllib.request.Request(f"{BASE_URL}/groups")
    try:
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode())
        groups = data.get("documents", [])
        
        for group in groups:
            group_name = group["name"].split("/")[-1]
            fields = group.get("fields", {})
            if "matches" in fields:
                matches_array = fields["matches"].get("arrayValue", {}).get("values", [])
                updated = False
                
                for m_val in matches_array:
                    match_obj = m_val.get("mapValue", {}).get("fields", {})
                    if match_obj.get("id", {}).get("stringValue") == "m55":
                        # Found m55. Check if it's RD Congo
                        if match_obj.get("homeTeam", {}).get("stringValue") != "Portugal":
                            print(f"Fixing m55 in group {group_name}")
                            match_obj["homeTeam"] = {"stringValue": "Portugal"}
                            match_obj["awayTeam"] = {"stringValue": "Colombia"}
                            match_obj["homeFlagCode"] = {"stringValue": "pt"}
                            match_obj["awayFlagCode"] = {"stringValue": "co"}
                            updated = True
                
                if updated:
                    # Patch the group document
                    patch_url = f"{BASE_URL}/groups/{group_name}?updateMask.fieldPaths=matches"
                    payload = json.dumps({"fields": fields}).encode("utf-8")
                    patch_req = urllib.request.Request(patch_url, data=payload, headers={"Content-Type": "application/json"}, method="PATCH")
                    urllib.request.urlopen(patch_req)
                    print(f"Updated group {group_name} successfully.")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_m55()
