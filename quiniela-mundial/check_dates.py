import json

with open("api/2026.json", "r") as f:
    data = json.load(f)

matches = data["matches"]
team_dates = {}
issues = []

for m in matches:
    h = m["homeTeam"]
    a = m["awayTeam"]
    d = m["date"]
    
    if h not in team_dates:
        team_dates[h] = []
    if a not in team_dates:
        team_dates[a] = []
        
    if d in team_dates[h]:
        issues.append(f"{h} plays multiple matches on {d}")
    if d in team_dates[a]:
        issues.append(f"{a} plays multiple matches on {d}")
        
    team_dates[h].append(d)
    team_dates[a].append(d)

if not issues:
    print("All good, no overlapping dates for any team.")
else:
    for issue in issues:
        print(issue)
