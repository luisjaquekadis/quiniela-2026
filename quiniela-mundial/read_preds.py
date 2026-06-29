import os
from google.cloud import firestore

def read_predictions():
    db = firestore.Client(project="quiniela-jaque")
    
    group_id = "mango_fc"
    
    print(f"Reading predictions for group {group_id}...")
    preds_ref = db.collection("groups").document(group_id).collection("predictions")
    preds = preds_ref.stream()
    
    found = False
    for p in preds:
        found = True
        print(f"User ID: {p.id}")
        data = p.to_dict()
        print(f"Data: {data}")
        print("---")
        
    if not found:
        print("No predictions found in this group.")
        
    print("\nReading profiles for group", group_id)
    profs_ref = db.collection("groups").document(group_id).collection("profiles")
    profs = profs_ref.stream()
    for p in profs:
        print(f"Profile ID: {p.id}")
        print(f"Profile Data: {p.to_dict()}")
        print("---")

if __name__ == "__main__":
    read_predictions()
