import json
from google.cloud import firestore

def fix_firebase_and_invert_predictions():
    db = firestore.Client(project="quiniela-jaque")
    
    # Read truth from local JSON
    with open("api/2026.json", "r") as f:
        local_data = json.load(f)
        api_matches = local_data.get("matches", [])
        
    groups = db.collection("groups").stream()
    
    total_inverted = 0
    total_groups_fixed = 0
    
    for group in groups:
        group_id = group.id
        print(f"Processing group {group_id}...")
        group_ref = db.collection("groups").document(group_id)
        group_doc = group_ref.get()
        if not group_doc.exists:
            continue
            
        group_data = group_doc.to_dict()
        fb_matches = group_data.get("matches", [])
        
        # 1. Identify inverted matches (where FB home == API away)
        inverted_match_indices = set() # 0-indexed (m1 is 0, m18 is 17)
        for fm in fb_matches:
            am = next((m for m in api_matches if m["id"] == fm["id"]), None)
            if am:
                if fm["homeTeam"] == am["awayTeam"] and fm["awayTeam"] == am["homeTeam"]:
                    idx = int(fm["id"].replace("m", "")) - 1
                    inverted_match_indices.add(idx)
                    
        if inverted_match_indices:
            print(f"  Found {len(inverted_match_indices)} inverted matches in group {group_id}")
            
            # 2. Invert predictions for users
            preds_ref = group_ref.collection("predictions").stream()
            for pred_doc in preds_ref:
                pred_data = pred_doc.to_dict()
                raw_str = pred_data.get("data", "")
                if isinstance(raw_str, str) and raw_str:
                    parts = raw_str.split(",")
                    changed = False
                    for idx in inverted_match_indices:
                        if idx < len(parts):
                            score = parts[idx]
                            if score and score != "-":
                                h, a = score.split("-")
                                # Swap
                                parts[idx] = f"{a}-{h}"
                                changed = True
                    
                    if changed:
                        new_str = ",".join(parts)
                        group_ref.collection("predictions").document(pred_doc.id).update({"data": new_str})
                        total_inverted += 1
                        
            # 3. Update the matches array in Firebase to match api/2026.json
            # This fixes duplicates and permanently aligns Firebase with the local JSON
            # However, we must preserve realHomeScore and realAwayScore from Firebase if they exist
            new_fb_matches = []
            for am in api_matches:
                # find corresponding in fb_matches to keep scores
                fm = next((m for m in fb_matches if m["id"] == am["id"]), None)
                new_match = dict(am)
                if fm:
                    new_match["realHomeScore"] = fm.get("realHomeScore", None)
                    new_match["realAwayScore"] = fm.get("realAwayScore", None)
                else:
                    new_match["realHomeScore"] = None
                    new_match["realAwayScore"] = None
                new_fb_matches.append(new_match)
                
            group_ref.update({"matches": new_fb_matches})
            total_groups_fixed += 1
            print(f"  Updated matches array for group {group_id}")

    print(f"\nDone! Fixed matches in {total_groups_fixed} groups and inverted predictions for {total_inverted} user profiles.")

if __name__ == "__main__":
    fix_firebase_and_invert_predictions()
