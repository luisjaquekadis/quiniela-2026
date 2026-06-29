import os
from google.cloud import firestore

def recover_all_users():
    db = firestore.Client(project="quiniela-jaque")
    
    print("Starting global recovery from 'default' to 'mango_fc' based on exact usernames...")
    
    # 1. Fetch all profiles from default
    default_profs_ref = db.collection("groups").document("default").collection("profiles").stream()
    default_profiles = {}
    for p in default_profs_ref:
        data = p.to_dict()
        name = data.get("name", "").strip().lower()
        if name:
            default_profiles[name] = p.id
            
    # 2. Fetch all predictions from default
    default_preds_ref = db.collection("groups").document("default").collection("predictions").stream()
    default_preds = {}
    for p in default_preds_ref:
        data = p.to_dict()
        pred_str = data.get("data", "")
        # score = number of non-empty predictions
        if isinstance(pred_str, str):
            score = len([x for x in pred_str.split(",") if x != "-" and x.strip() != ""])
        elif isinstance(pred_str, dict):
            score = len(pred_str.keys())
        else:
            score = 0
            
        default_preds[p.id] = {
            "data": data,
            "score": score
        }
        
    # 3. Fetch all profiles from mango_fc
    mango_profs_ref = db.collection("groups").document("mango_fc").collection("profiles").stream()
    mango_profiles = {}
    for p in mango_profs_ref:
        data = p.to_dict()
        name = data.get("name", "").strip().lower()
        if name:
            mango_profiles[name] = p.id
            
    # 4. Fetch all predictions from mango_fc
    mango_preds_ref = db.collection("groups").document("mango_fc").collection("predictions").stream()
    mango_preds = {}
    for p in mango_preds_ref:
        data = p.to_dict()
        pred_str = data.get("data", "")
        if isinstance(pred_str, str):
            score = len([x for x in pred_str.split(",") if x != "-" and x.strip() != ""])
        elif isinstance(pred_str, dict):
            score = len(pred_str.keys())
        else:
            score = 0
            
        mango_preds[p.id] = {
            "data": data,
            "score": score
        }

    # 5. Cross-reference and recover
    for name, new_id in mango_profiles.items():
        if name in default_profiles:
            old_id = default_profiles[name]
            
            old_pred_info = default_preds.get(old_id, {"data": {"data": ""}, "score": 0})
            new_pred_info = mango_preds.get(new_id, {"data": {"data": ""}, "score": 0})
            
            # If the old group has MORE predictions filled than the new group, we recover it!
            if old_pred_info["score"] > new_pred_info["score"]:
                print(f"Recovering data for user '{name}' (Old ID: {old_id} -> New ID: {new_id})")
                print(f"  Old filled: {old_pred_info['score']} | New filled: {new_pred_info['score']}")
                
                db.collection("groups").document("mango_fc").collection("predictions").document(new_id).set(old_pred_info["data"])
            elif old_pred_info["score"] > 0 and old_pred_info["score"] == new_pred_info["score"]:
                print(f"User '{name}' has same amount of data in both. Skipping.")
            else:
                pass
                
    # 6. Check for users in default that DO NOT exist in mango_fc yet, and just copy their profiles and preds directly!
    # This prevents the issue before they even try to log in.
    print("\nChecking for missing profiles that should be migrated...")
    for name, old_id in default_profiles.items():
        if name not in mango_profiles:
            old_pred_info = default_preds.get(old_id, {"data": {"data": ""}, "score": 0})
            if old_pred_info["score"] > 0:
                print(f"Migrating missing user '{name}' completely to mango_fc...")
                # Copy profile
                old_prof_doc = db.collection("groups").document("default").collection("profiles").document(old_id).get()
                if old_prof_doc.exists:
                    db.collection("groups").document("mango_fc").collection("profiles").document(old_id).set(old_prof_doc.to_dict())
                
                # Copy preds
                db.collection("groups").document("mango_fc").collection("predictions").document(old_id).set(old_pred_info["data"])
                
    print("\nGlobal recovery completed successfully!")

if __name__ == "__main__":
    recover_all_users()
