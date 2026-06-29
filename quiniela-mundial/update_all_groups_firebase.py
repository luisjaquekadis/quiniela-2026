import json
import os
from google.cloud import firestore

def update_all_groups():
    print("=== Starting Matches Update for ALL Groups ===")
    
    db = firestore.Client(project="quiniela-jaque")
    api_path = "api/2026.json"
    if not os.path.exists(api_path):
        print(f"Error: {api_path} not found.")
        return
        
    with open(api_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        new_matches = data.get("matches", [])
        
    if not new_matches:
        print("Error: No matches found in api/2026.json.")
        return
        
    groups_ref = db.collection("groups").stream()
    
    for group_snap in groups_ref:
        group_id = group_snap.id
        print(f"\nProcessing group: '{group_id}'")
        doc_data = group_snap.to_dict()
        existing_matches = doc_data.get("matches", [])
        
        real_scores_map = {}
        for m in existing_matches:
            if "realHomeScore" in m and "realAwayScore" in m:
                if m["realHomeScore"] is not None and m["realAwayScore"] is not None:
                    real_scores_map[m["id"]] = (m["realHomeScore"], m["realAwayScore"])
                    
        # Clone new_matches so we don't modify the base reference
        merged_matches = []
        for m in new_matches:
            m_copy = dict(m)
            if m_copy["id"] in real_scores_map:
                m_copy["realHomeScore"] = real_scores_map[m_copy["id"]][0]
                m_copy["realAwayScore"] = real_scores_map[m_copy["id"]][1]
            else:
                m_copy["realHomeScore"] = None
                m_copy["realAwayScore"] = None
            merged_matches.append(m_copy)
            
        print(f"Preserved {len(real_scores_map)} real scores for '{group_id}'. Updating Firebase...")
        db.collection("groups").document(group_id).set({"matches": merged_matches}, merge=True)
        
    print("\n=== All Groups Updated Successfully! ===")

if __name__ == "__main__":
    update_all_groups()
