import urllib.request
import json

PROJECT_ID = "quiniela-backup"
GROUP_ID = "mango_fc"
ZOMBIE_ID = "user_1780362444285"

BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/groups/{GROUP_ID}"

def delete_doc(path):
    url = f"{BASE_URL}/{path}"
    print(f"Deleting {url}...")
    req = urllib.request.Request(url, method="DELETE")
    try:
        urllib.request.urlopen(req)
        print("✅ Deleted successfully.")
    except Exception as e:
        print(f"Error deleting: {e}")

def remove_from_prof_index():
    print("Fetching prof_index...")
    req = urllib.request.Request(BASE_URL)
    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read().decode())
        prof_index = data.get("fields", {}).get("prof_index", {}).get("stringValue", "")
        
        ids = [x for x in prof_index.split(",") if x and x != ZOMBIE_ID]
        new_prof_index = ",".join(ids)
        
        print("Updating prof_index...")
        patch_url = f"{BASE_URL}?updateMask.fieldPaths=prof_index"
        payload = {
            "fields": {
                "prof_index": {
                    "stringValue": new_prof_index
                }
            }
        }
        req_patch = urllib.request.Request(patch_url, data=json.dumps(payload).encode(), method="PATCH")
        req_patch.add_header("Content-Type", "application/json")
        urllib.request.urlopen(req_patch)
        print("✅ prof_index updated successfully.")
    except Exception as e:
        print("Error updating prof_index:", e)

if __name__ == "__main__":
    remove_from_prof_index()
    delete_doc(f"profiles/{ZOMBIE_ID}")
    delete_doc(f"predictions/{ZOMBIE_ID}")
