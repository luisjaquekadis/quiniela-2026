"""
Fix the 'matches' field directly in Firebase for group mango_fc
where a zombie client overwrote m55 back to RD Congo vs Uzbekistan.
This fixes the LIVE site without requiring any deploy.
"""
from google.cloud import firestore

db = firestore.Client(project="quiniela-backup")

# Fix ALL groups, not just mango_fc, to be safe
groups = db.collection("groups").stream()

for group in groups:
    data = group.to_dict()
    matches = data.get("matches", [])
    changed = False
    
    for m in matches:
        if m.get("id") == "m55":
            if m.get("homeTeam") != "Portugal" or m.get("awayTeam") != "Colombia":
                print(f"FIXING {group.id}: m55 was {m.get('homeTeam')} vs {m.get('awayTeam')}")
                m["homeTeam"] = "Portugal"
                m["awayTeam"] = "Colombia"
                m["homeFlagCode"] = "pt"
                m["awayFlagCode"] = "co"
                m["homeFlag"] = "🇵🇹"
                m["awayFlag"] = "🇨🇴"
                changed = True
            else:
                print(f"OK {group.id}: m55 already Portugal vs Colombia")
    
    if changed:
        db.collection("groups").document(group.id).update({"matches": matches})
        print(f"✅ Updated matches field for {group.id}")

print("\nDone. The live site should now show Portugal vs Colombia and no duplicate.")
