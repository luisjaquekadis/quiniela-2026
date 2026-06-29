import json
import os
from google.cloud import bigquery

os.environ["GOOGLE_CLOUD_PROJECT"] = "quiniela-backup"
client = bigquery.Client()
dataset_id = "quiniela-backup.quiniela_data"

def create_table(table_name, schema):
    table_id = f"{dataset_id}.{table_name}"
    table = bigquery.Table(table_id, schema=schema)
    try:
        table = client.create_table(table, exists_ok=True)
        print(f"Ensured table {table_name} exists.")
    except Exception as e:
        print(f"Error creating {table_name}: {e}")

def migrate_data():
    with open("firebase_backup.json", "r") as f:
        data = json.load(f)

    # 1. Groups Table
    groups_schema = [
        bigquery.SchemaField("group_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("sheets_url", "STRING"),
    ]
    create_table("groups", groups_schema)
    
    groups_rows = []
    for gid, group in data.items():
        url = group.get("data", {}).get("sheets_url", None)
        groups_rows.append({"group_id": gid, "sheets_url": url})
        
    if groups_rows:
        client.insert_rows_json(f"{dataset_id}.groups", groups_rows)

    # 2. Users Table
    users_schema = [
        bigquery.SchemaField("user_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("group_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("name", "STRING"),
        bigquery.SchemaField("avatar", "STRING"),
        bigquery.SchemaField("points", "INTEGER"),
        bigquery.SchemaField("is_admin", "BOOLEAN"),
    ]
    create_table("users", users_schema)
    
    users_rows = []
    for gid, group in data.items():
        for uid, prof in group.get("profiles", {}).items():
            users_rows.append({
                "user_id": uid,
                "group_id": gid,
                "name": prof.get("name"),
                "avatar": prof.get("avatar"),
                "points": int(prof.get("points", 0)),
                "is_admin": bool(prof.get("isAdmin", False))
            })
            
    if users_rows:
        client.insert_rows_json(f"{dataset_id}.users", users_rows)

    # 3. Matches Table
    matches_schema = [
        bigquery.SchemaField("match_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("group_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("home_team", "STRING"),
        bigquery.SchemaField("away_team", "STRING"),
        bigquery.SchemaField("real_home_score", "INTEGER"),
        bigquery.SchemaField("real_away_score", "INTEGER"),
        bigquery.SchemaField("stage", "STRING"),
    ]
    create_table("matches", matches_schema)
    
    matches_rows = []
    for gid, group in data.items():
        fb_matches = group.get("data", {}).get("matches", [])
        for m in fb_matches:
            # handle possible empty string scores
            rhs = m.get("realHomeScore")
            ras = m.get("realAwayScore")
            rhs = int(rhs) if rhs not in [None, "", "-"] else None
            ras = int(ras) if ras not in [None, "", "-"] else None
            matches_rows.append({
                "match_id": m.get("id"),
                "group_id": gid,
                "home_team": m.get("homeTeam"),
                "away_team": m.get("awayTeam"),
                "real_home_score": rhs,
                "real_away_score": ras,
                "stage": m.get("stage")
            })
            
    if matches_rows:
        # BQ max insert size limits, we can just insert all as it is small
        # But we'll chunk it to be safe
        for i in range(0, len(matches_rows), 500):
            client.insert_rows_json(f"{dataset_id}.matches", matches_rows[i:i+500])

    # 4. Predictions Table
    predictions_schema = [
        bigquery.SchemaField("prediction_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("user_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("group_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("match_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("predicted_home_score", "INTEGER"),
        bigquery.SchemaField("predicted_away_score", "INTEGER"),
    ]
    create_table("predictions", predictions_schema)
    
    predictions_rows = []
    for gid, group in data.items():
        for uid, pred in group.get("predictions", {}).items():
            pred_data = pred.get("data", "")
            if not pred_data: continue
            
            if isinstance(pred_data, str):
                scores = pred_data.split(",")
                for i, score in enumerate(scores):
                    if score and "-" in score and score != "-":
                        parts = score.split("-")
                        if len(parts) == 2 and parts[0] != "" and parts[1] != "":
                            try:
                                phs = int(parts[0])
                                pas = int(parts[1])
                                predictions_rows.append({
                                    "prediction_id": f"{gid}_{uid}_m{i+1}",
                                    "user_id": uid,
                                    "group_id": gid,
                                    "match_id": f"m{i+1}",
                                    "predicted_home_score": phs,
                                    "predicted_away_score": pas
                                })
                            except ValueError:
                                pass
            elif isinstance(pred_data, dict):
                for match_id, score_dict in pred_data.items():
                    if "home" in score_dict and "away" in score_dict:
                        try:
                            phs = int(score_dict["home"])
                            pas = int(score_dict["away"])
                            predictions_rows.append({
                                "prediction_id": f"{gid}_{uid}_{match_id}",
                                "user_id": uid,
                                "group_id": gid,
                                "match_id": match_id,
                                "predicted_home_score": phs,
                                "predicted_away_score": pas
                            })
                        except ValueError:
                            pass
                            
    if predictions_rows:
        for i in range(0, len(predictions_rows), 500):
            client.insert_rows_json(f"{dataset_id}.predictions", predictions_rows[i:i+500])

    print("Migration to BigQuery complete!")

if __name__ == "__main__":
    migrate_data()
