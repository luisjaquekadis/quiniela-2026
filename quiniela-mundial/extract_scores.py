import json

with open("/tmp/espn_data.json", "r") as f:
    data = json.load(f)

for event in data.get("events", []):
    name = event.get("name")
    status = event.get("status", {}).get("type", {}).get("name")
    if status == "STATUS_FINAL":
        comps = event.get("competitions", [{}])[0].get("competitors", [])
        if len(comps) == 2:
            team1 = comps[0].get("team", {}).get("displayName", "")
            score1 = comps[0].get("score", "")
            team2 = comps[1].get("team", {}).get("displayName", "")
            score2 = comps[1].get("score", "")
            print(f"FINISHED: {team1} {score1} - {score2} {team2}")
