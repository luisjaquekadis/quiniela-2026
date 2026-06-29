from google.cloud import firestore

def update_missing_scores():
    db = firestore.Client(project="quiniela-jaque")
    groups = db.collection("groups").stream()
    
    for group in groups:
        gdata = group.to_dict()
        matches = gdata.get("matches", [])
        updated = False
        
        for m in matches:
            if m["id"] == "m11":
                m["realHomeScore"] = 1
                m["realAwayScore"] = 3
                updated = True
            elif m["id"] == "m27":
                m["realHomeScore"] = 2
                m["realAwayScore"] = 0
                updated = True
                
        if updated:
            group.reference.update({"matches": matches})
            print(f"Updated group {group.id}")

if __name__ == "__main__":
    update_missing_scores()
