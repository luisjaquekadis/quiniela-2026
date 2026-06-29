import os
from google.cloud import firestore

def recover_justvilo():
    db = firestore.Client(project="quiniela-jaque")
    
    # OLD ID in 'default'
    old_id = "user_1780362444285"
    
    # NEW ID in 'mango_fc'
    new_id = "user_1780623352742"
    
    print(f"Fetching predictions for old justvilo ({old_id}) from 'default' group...")
    doc = db.collection("groups").document("default").collection("predictions").document(old_id).get()
    
    if doc.exists:
        data = doc.to_dict()
        print(f"Found old data: {data}")
        print(f"Overwriting new justvilo ({new_id}) in 'mango_fc' group...")
        db.collection("groups").document("mango_fc").collection("predictions").document(new_id).set(data)
        print("Recovery completed successfully!")
    else:
        print("Error: Predictions not found in the 'default' group for old justvilo.")

if __name__ == "__main__":
    recover_justvilo()
