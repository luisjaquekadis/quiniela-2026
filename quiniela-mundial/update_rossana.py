import os
from google.cloud import firestore

def update_data():
    db = firestore.Client(project="quiniela-jaque")
    user_id = "user_1780512478774" # Rossana
    
    print(f"Fetching predictions for Rossana ({user_id}) from 'default' group...")
    doc = db.collection("groups").document("default").collection("predictions").document(user_id).get()
    
    if doc.exists:
        data = doc.to_dict()
        print(f"Found data: {data}")
        print(f"Copying to 'mango_fc' group...")
        db.collection("groups").document("mango_fc").collection("predictions").document(user_id).set(data)
        print("Update completed successfully!")
    else:
        print("Error: Predictions not found in the 'default' group.")

if __name__ == "__main__":
    update_data()
