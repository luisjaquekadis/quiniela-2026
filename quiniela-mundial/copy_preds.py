import os
from google.cloud import firestore

def copy_data():
    db = firestore.Client(project="quiniela-jaque")
    
    # Copy predictions
    preds_ref = db.collection("groups").document("default").collection("predictions")
    preds = preds_ref.stream()
    for p in preds:
        print(f"Copying prediction for {p.id} to mango_fc...")
        db.collection("groups").document("mango_fc").collection("predictions").document(p.id).set(p.to_dict())
        
    print("Done copying predictions.")

if __name__ == "__main__":
    copy_data()
