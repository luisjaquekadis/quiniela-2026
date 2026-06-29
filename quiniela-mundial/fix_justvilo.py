import urllib.request
import json

PROJECT_ID = "quiniela-backup"
GROUP_ID = "mango_fc"
OLD_USER_ID = "user_1780362444285"

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

if __name__ == "__main__":
    delete_doc(f"profiles/{OLD_USER_ID}")
    delete_doc(f"predictions/{OLD_USER_ID}")
