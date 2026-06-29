import sys
import datetime
import json
import os
from google.cloud import firestore
from google.cloud import bigquery

def sync_data(group_id="default"):
    print(f"=== Starting Sync for Group: '{group_id}' (using Free-Tier Load Jobs) ===")
    
    # Initialize clients
    db = firestore.Client(project="quiniela-jaque")
    bq = bigquery.Client(project="quiniela-jaque")
    
    # Create temp directory in workspace
    workspace_temp = "/Users/luisjaquekadis/.gemini/antigravity/scratch"
    os.makedirs(workspace_temp, exist_ok=True)
    
    profiles_ndjson_path = os.path.join(workspace_temp, "profiles.ndjson")
    predictions_ndjson_path = os.path.join(workspace_temp, "predictions.ndjson")
    
    # --- 1. SYNC PROFILES ---
    print("Fetching profiles from Firestore...")
    profiles_ref = db.collection("groups").document(group_id).collection("profiles")
    profiles = [doc.to_dict() for doc in profiles_ref.stream()]
    print(f"Found {len(profiles)} profiles in Firestore.")
    
    # Write profiles to NDJSON
    with open(profiles_ndjson_path, "w", encoding="utf-8") as f:
        for p in profiles:
            bq_profile = {
                "id": p.get("id"),
                "name": p.get("name"),
                "avatar": p.get("avatar", "👤"),
                "points": int(p.get("points", 0)),
                "isAdmin": bool(p.get("isAdmin", False)),
                "passHash": p.get("passHash"),
                "lastUpdated": datetime.datetime.now(datetime.UTC).isoformat()
            }
            f.write(json.dumps(bq_profile, ensure_ascii=False) + "\n")
            
    # Load profiles using WRITE_TRUNCATE Load Job
    print("Loading profiles to BigQuery (Truncate & Replace)...")
    profiles_table_ref = bq.dataset("quiniela").table("profiles")
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE
    )
    
    with open(profiles_ndjson_path, "rb") as source_file:
        job = bq.load_table_from_file(source_file, profiles_table_ref, job_config=job_config)
        job.result() # Wait for completion
    print("Profiles successfully loaded.")
    
    # --- 2. SYNC PREDICTIONS ---
    print("Fetching predictions from Firestore...")
    predictions_ref = db.collection("groups").document(group_id).collection("predictions")
    
    # Write predictions to NDJSON
    predictions_count = 0
    with open(predictions_ndjson_path, "w", encoding="utf-8") as f:
        for doc in predictions_ref.stream():
            profile_id = doc.id
            doc_data = doc.to_dict()
            preds_dict = doc_data.get("data")
            
            # If the predictions are stored as a dict
            if isinstance(preds_dict, dict):
                for match_id, scores in preds_dict.items():
                    if isinstance(scores, dict) and "home" in scores and "away" in scores:
                        if scores["home"] is not None and scores["away"] is not None:
                            bq_pred = {
                                "profileId": profile_id,
                                "matchId": match_id,
                                "homeScore": int(scores["home"]),
                                "awayScore": int(scores["away"]),
                                "lastUpdated": datetime.datetime.now(datetime.UTC).isoformat()
                            }
                            f.write(json.dumps(bq_pred, ensure_ascii=False) + "\n")
                            predictions_count += 1
            # If predictions are stored as a serialized string (fallback)
            elif isinstance(preds_dict, str):
                parts = preds_dict.split(",")
                for idx, score in enumerate(parts):
                    if score and score != "-":
                        try:
                            h, a = map(int, score.split("-"))
                            bq_pred = {
                                "profileId": profile_id,
                                "matchId": f"m{idx + 1}",
                                "homeScore": h,
                                "awayScore": a,
                                "lastUpdated": datetime.datetime.now(datetime.UTC).isoformat()
                            }
                            f.write(json.dumps(bq_pred, ensure_ascii=False) + "\n")
                            predictions_count += 1
                        except ValueError:
                            pass
                            
    print(f"Formatted {predictions_count} predictions to NDJSON.")
    
    # Load predictions using WRITE_TRUNCATE Load Job
    print("Loading predictions to BigQuery (Truncate & Replace)...")
    predictions_table_ref = bq.dataset("quiniela").table("predictions")
    
    with open(predictions_ndjson_path, "rb") as source_file:
        job = bq.load_table_from_file(source_file, predictions_table_ref, job_config=job_config)
        job.result() # Wait for completion
    print("Predictions successfully loaded.")
    
    # Clean up NDJSON files
    try:
        os.remove(profiles_ndjson_path)
        os.remove(predictions_ndjson_path)
    except OSError:
        pass
        
    print("=== Sync Completed Successfully! ===")
    return True

if __name__ == "__main__":
    group = "default"
    if len(sys.argv) > 1:
        group = sys.argv[1]
    sync_data(group)
