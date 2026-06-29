from google.cloud import firestore
from google.cloud import firestore

def check_missing_scores():
    db = firestore.Client(project="quiniela-jaque")
    doc_ref = db.collection("groups").document("default")
    doc_snap = doc_ref.get()
    
    if doc_snap.exists:
        matches = doc_snap.to_dict().get("matches", [])
        for m in matches:
            date_str = m.get("date", "")
            if "24 de Junio" in date_str or "25 de Junio" in date_str or "26 de Junio" in date_str:
                if m.get("realHomeScore") is None:
                    print(f"Missing score: {m['id']} - {m['homeTeam']} vs {m['awayTeam']} on {date_str}")
                else:
                    print(f"Has score: {m['id']} - {m['homeTeam']} {m['realHomeScore']} vs {m['realAwayScore']} {m['awayTeam']} on {date_str}")

check_missing_scores()
