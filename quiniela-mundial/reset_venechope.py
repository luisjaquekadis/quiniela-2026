import urllib.request
import json

PROJECT_ID = "quiniela-backup"
GROUP_ID = "mango_fc"
USER_ID = "user_1780623636644"
NEW_HASH = "cb442d7239f3943325b0d300f9fc7b5040bf41e4a98b661af3436684273cfb66" # Hash for venechope2026

BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/groups/{GROUP_ID}/profiles/{USER_ID}"

def get_profile():
    req = urllib.request.Request(BASE_URL)
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read().decode())
    except Exception as e:
        print(f"Error fetching: {e}")
        return None

def update_profile(doc_data):
    fields = doc_data.get("fields", {})
    fields["passHash"] = {"stringValue": NEW_HASH}
    
    payload = json.dumps({"fields": fields}).encode("utf-8")
    req = urllib.request.Request(BASE_URL, data=payload, headers={"Content-Type": "application/json"}, method="PATCH")
    try:
        resp = urllib.request.urlopen(req)
        print("✅ venechope password successfully reset to 'venechope2026'")
    except Exception as e:
        print(f"Error updating: {e}")

if __name__ == "__main__":
    doc = get_profile()
    if doc:
        update_profile(doc)
