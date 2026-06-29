import os
from google.cloud import firestore

def generate_report():
    db = firestore.Client(project="quiniela-jaque")
    groups = db.collection("groups").stream()
    
    total_groups = 0
    total_profiles = 0
    total_predictions = 0
    
    md_content = "# Reporte Detallado de Usuarios y Pronósticos\n\n"
    
    for group in groups:
        group_id = group.id
        md_content += f"## Grupo: `{group_id}`\n"
        md_content += "| Usuario (ID) | Nombre | Rol | Puntos | Partidos Pronosticados |\n"
        md_content += "|---|---|---|---|---|\n"
        
        total_groups += 1
        
        # Get all profiles
        profiles_ref = db.collection("groups").document(group_id).collection("profiles").stream()
        profiles_data = {}
        for p in profiles_ref:
            profiles_data[p.id] = p.to_dict()
            total_profiles += 1
            
        # Get all predictions
        predictions_ref = db.collection("groups").document(group_id).collection("predictions").stream()
        predictions_data = {}
        for p in predictions_ref:
            predictions_data[p.id] = p.to_dict().get("data", "")
            
        # Correlate
        group_users = 0
        for uid, p_data in profiles_data.items():
            name = p_data.get("name", "Desconocido")
            points = p_data.get("points", 0)
            is_admin = "👑 Admin" if p_data.get("isAdmin") else "👤 Usuario"
            
            raw_pred = predictions_data.get(uid, "")
            preds_count = 0
            if isinstance(raw_pred, dict):
                preds_count = len(raw_pred.keys())
            elif isinstance(raw_pred, str) and raw_pred:
                # format is usually "1-0,2-1,-,3-1"
                # split by comma and count non-empty strings that have a hyphen but aren't just "-"
                parts = raw_pred.split(",")
                preds_count = sum(1 for part in parts if "-" in part and part.strip() != "-")
            
            total_predictions += preds_count
            group_users += 1
            
            md_content += f"| {uid} | **{name}** | {is_admin} | {points} | {preds_count} |\n"
            
        if group_users == 0:
            md_content += "| *Vacío* | - | - | - | - |\n"
            
        md_content += "\n"

    md_content = f"**Total de Grupos:** {total_groups}  \n**Total de Usuarios:** {total_profiles}  \n**Total de Pronósticos Individuales:** {total_predictions}\n\n" + md_content

    # Write to artifact
    brain_dir = "/Users/luisjaquekadis/.gemini/antigravity-ide/brain/66adacc2-31b3-478a-96eb-d0d8b5eef791"
    report_path = os.path.join(brain_dir, "users_report.md")
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md_content)
        
    print(f"Report generated at {report_path}")

if __name__ == "__main__":
    generate_report()
