import json
import urllib.request
import urllib.error

PROJECT_ID = "quiniela-backup"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

def dict_to_firestore(data):
    if not isinstance(data, dict):
        return data
    
    fields = {}
    for k, v in data.items():
        if isinstance(v, str):
            fields[k] = {"stringValue": v}
        elif isinstance(v, bool):
            fields[k] = {"booleanValue": v}
        elif isinstance(v, int):
            fields[k] = {"integerValue": str(v)}
        elif isinstance(v, float):
            fields[k] = {"doubleValue": float(v)}
        elif v is None:
            fields[k] = {"nullValue": None}
        elif isinstance(v, dict):
            fields[k] = {"mapValue": {"fields": dict_to_firestore(v).get("fields", {})}}
        elif isinstance(v, list):
            values = []
            for item in v:
                if isinstance(item, str): values.append({"stringValue": item})
                elif isinstance(item, bool): values.append({"booleanValue": item})
                elif isinstance(item, int): values.append({"integerValue": str(item)})
                elif isinstance(item, float): values.append({"doubleValue": float(item)})
                elif isinstance(item, dict): values.append({"mapValue": {"fields": dict_to_firestore(item).get("fields", {})}})
            fields[k] = {"arrayValue": {"values": values}}
    
    return {"fields": fields}

def upload_doc(path, data):
    url = f"{BASE_URL}/{path}"
    parts = path.split("/")
    doc_id = parts[-1]
    coll_path = "/".join(parts[:-1])
    
    create_url = f"{BASE_URL}/{coll_path}?documentId={doc_id}"
    
    payload = json.dumps(dict_to_firestore(data)).encode("utf-8")
    req = urllib.request.Request(create_url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    
    try:
        urllib.request.urlopen(req)
        print(f"Created: {path}")
    except urllib.error.HTTPError as e:
        if e.code == 409: # Already exists, try PATCH
            patch_url = f"{BASE_URL}/{path}"
            req = urllib.request.Request(patch_url, data=payload, headers={"Content-Type": "application/json"}, method="PATCH")
            try:
                urllib.request.urlopen(req)
                print(f"Updated: {path}")
            except Exception as e2:
                print(f"Failed to update {path}: {e2}")
        elif e.code == 403:
            print("ERROR: PERMISSION DENIED. Please make sure Firestore Rules are set to 'Start in test mode'!")
            raise e
        else:
            print(f"Failed {path}: {e.read().decode()}")

def upload_all():
    with open("firebase_backup.json", "r") as f:
        data = json.load(f)
        
    for group_id, group in data.items():
        upload_doc(f"groups/{group_id}", group["data"])
        
        for prof_id, prof in group["profiles"].items():
            upload_doc(f"groups/{group_id}/profiles/{prof_id}", prof)
            
        for pred_id, pred in group["predictions"].items():
            upload_doc(f"groups/{group_id}/predictions/{pred_id}", pred)
            
    print("Done uploading!")

if __name__ == "__main__":
    upload_all()
