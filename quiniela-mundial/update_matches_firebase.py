import sys
import json
import os
from google.cloud import firestore

def update_matches(group_id="default"):
    print(f"=== Starting Matches Update for Group: '{group_id}' ===")
    
    # Initialize client
    db = firestore.Client(project="quiniela-jaque")
    
    # Read local api/2026.json
    api_path = "api/2026.json"
    if not os.path.exists(api_path):
        print(f"Error: {api_path} not found.")
        return False
        
    with open(api_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        new_matches = data.get("matches", [])
        
    if not new_matches:
        print("Error: No matches found in api/2026.json.")
        return False
        
    print(f"Found {len(new_matches)} matches in {api_path}.")
    
    # Fetch existing matches from Firebase to preserve real scores
    doc_ref = db.collection("groups").document(group_id)
    doc_snap = doc_ref.get()
    
    existing_matches = []
    if doc_snap.exists:
        doc_data = doc_snap.to_dict()
        existing_matches = doc_data.get("matches", [])
        
    # Create a mapping of match_id -> (realHomeScore, realAwayScore)
    real_scores_map = {}
    for m in existing_matches:
        if "realHomeScore" in m and "realAwayScore" in m:
            if m["realHomeScore"] is not None and m["realAwayScore"] is not None:
                real_scores_map[m["id"]] = (m["realHomeScore"], m["realAwayScore"])
                
    # Merge real scores into the new matches
    for m in new_matches:
        if m["id"] in real_scores_map:
            m["realHomeScore"] = real_scores_map[m["id"]][0]
            m["realAwayScore"] = real_scores_map[m["id"]][1]
        else:
            m["realHomeScore"] = None
            m["realAwayScore"] = None
            
    print(f"Preserved {len(real_scores_map)} real scores from Firebase.")
    
    # Update Firebase
    print(f"Updating 'matches' array in Firestore for group '{group_id}'...")
    doc_ref.set({"matches": new_matches}, merge=True)
    
    print("=== Update Completed Successfully! ===")
    return True

if __name__ == "__main__":
    group = "default"
    if len(sys.argv) > 1:
        group = sys.argv[1]
    update_matches(group)
