import os
from google.cloud import firestore

def find_all():
    db = firestore.Client(project="quiniela-jaque")
    
    print("Searching ALL non-empty predictions across ALL groups...")
    groups = db.collection("groups").stream()
    
    for g in groups:
        group_id = g.id
        # get all profiles first
        profiles = {}
        profs_ref = db.collection("groups").document(group_id).collection("profiles").stream()
        for p in profs_ref:
            profiles[p.id] = p.to_dict().get("name", "Unknown")
            
        # check predictions
        preds_ref = db.collection("groups").document(group_id).collection("predictions").stream()
        for p in preds_ref:
            data = p.to_dict()
            if not data: continue
            
            d = data.get("data", "")
            # check if it's not totally empty
            if isinstance(d, dict) and len(d) > 0:
                print(f"Group: {group_id} | Name: {profiles.get(p.id, p.id)} | ID: {p.id}")
                print(f"  -> Dict Preds: {d}")
            elif isinstance(d, str):
                # remove all '-', ',' and whitespace
                stripped = d.replace("-", "").replace(",", "").strip()
                if stripped != "":
                    print(f"Group: {group_id} | Name: {profiles.get(p.id, p.id)} | ID: {p.id}")
                    print(f"  -> String Preds snippet: {d[:50]}...")

if __name__ == "__main__":
    find_all()
