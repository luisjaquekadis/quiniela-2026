import os
from google.cloud import firestore

def find_user():
    db = firestore.Client(project="quiniela-jaque")
    
    print("Searching for Rossana across all groups...")
    groups = db.collection("groups").stream()
    
    found_profiles = []
    
    for g in groups:
        group_id = g.id
        # Check profiles
        profs = db.collection("groups").document(group_id).collection("profiles").stream()
        for p in profs:
            data = p.to_dict()
            if data and data.get("name") and "rossana" in data.get("name").lower():
                found_profiles.append((group_id, p.id, data))
                
    if not found_profiles:
        print("Profile 'Rossana' not found anywhere.")
        return
        
    for group_id, p_id, data in found_profiles:
        print(f"Found Rossana in group '{group_id}' with ID '{p_id}'.")
        # Check predictions for this profile
        pred_doc = db.collection("groups").document(group_id).collection("predictions").document(p_id).get()
        if pred_doc.exists:
            print(f"  -> Predictions found: {pred_doc.to_dict()}")
        else:
            print(f"  -> NO PREDICTIONS found for this user in group '{group_id}'.")

if __name__ == "__main__":
    find_user()
