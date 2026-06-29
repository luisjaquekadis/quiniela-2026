import markdown
import os
import subprocess

brain_dir = "/Users/luisjaquekadis/.gemini/antigravity-ide/brain/66adacc2-31b3-478a-96eb-d0d8b5eef791"

images = [
    ("Opción 1: La Letra Q", "quiniela_option_1_q_1781277545562.png"),
    ("Opción 2: El Acierto", "quiniela_option_2_checkmark_1781277557165.png"),
    ("Opción 3: El Calendario Furtivo", "quiniela_option_3_calendar_1781277566793.png"),
    ("Opción 4: Ticket VIP", "quiniela_option_4_ticket_1781277578058.png"),
    ("Opción 5: El Mundo en Juego", "quiniela_option_5_globe_1781277587511.png")
]

html_content = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reporte de Quiniela Mundial</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            line-height: 1.6;
            margin: 40px auto;
            max-width: 800px;
            padding: 20px;
        }
        h1 { color: #1a1a1a; border-bottom: 2px solid #a3e635; padding-bottom: 10px; }
        h2 { color: #2c3e50; margin-top: 30px; }
        p { text-align: justify; }
        code { background: #f4f4f4; padding: 2px 5px; border-radius: 4px; font-family: monospace; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
        blockquote { border-left: 4px solid #a3e635; margin: 0; padding-left: 15px; color: #555; background: #f9f9f9; padding: 10px; }
        img { max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .page-break { page-break-before: always; }
        .header-logo { text-align: center; margin-bottom: 40px; }
        .header-logo h1 { border: none; font-size: 36px; margin: 0; color: #1b1e24; }
        .header-logo p { text-align: center; color: #777; font-size: 14px; }
        .image-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin-top: 20px; }
        .image-card { width: 45%; text-align: center; }
        .image-card img { max-width: 100%; height: auto; border: 2px solid #a3e635; border-radius: 12px; }
        .image-card p { font-weight: bold; margin-top: 5px; text-align: center; }
    </style>
</head>
<body>
    <div class="header-logo">
        <h1>🏆 Reporte Ejecutivo: Quiniela Mundial 2026</h1>
        <p>Resumen Arquitectónico e Identidad Visual</p>
    </div>
"""

files_to_include = [
    ("architecture_overview.md", "Arquitectura General"),
    ("walkthrough.md", "Resumen de la Migración a onSnapshot"),
    ("task.md", "Tareas Ejecutadas"),
    ("logo_options.md", "Opciones de Diseño de Logo"),
    ("users_report.md", "Reporte Detallado de Usuarios y Pronósticos")
]

for filename, title in files_to_include:
    file_path = os.path.join(brain_dir, filename)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            md_text = f.read()
            html = markdown.markdown(md_text, extensions=['fenced_code', 'tables'])
            html_content += f"<div class='section'>\n<h2>{title}</h2>\n{html}\n</div>\n"

# Add images
html_content += """
    <div class="page-break"></div>
    <h2>Propuestas de Identidad Visual (Neo-Brutalismo)</h2>
    <p>A continuación se presentan los conceptos de diseño propuestos para el isotipo de la aplicación, respetando la paleta de colores de la interfaz gráfica y los bordes duros característicos del Neo-Brutalismo.</p>
    <div class="image-grid">
"""

for title, img_file in images:
    img_path = os.path.join(brain_dir, img_file)
    if os.path.exists(img_path):
        html_content += f"""
        <div class="image-card">
            <img src="file://{img_path}" alt="{title}">
            <p>{title}</p>
        </div>
        """

html_content += """
    </div>
</body>
</html>
"""

html_path = os.path.join(os.getcwd(), "report.html")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

pdf_path = os.path.join(os.path.expanduser("~"), "Desktop", "Arquitectura_y_Logos_Quiniela.pdf")
chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

print("Generando PDF con Chrome...")
result = subprocess.run([
    chrome_path,
    "--headless",
    "--disable-gpu",
    f"--print-to-pdf={pdf_path}",
    f"file://{html_path}"
], capture_output=True, text=True)

if result.returncode == 0:
    print(f"PDF generado con éxito en: {pdf_path}")
else:
    print(f"Error generando PDF:\n{result.stderr}")
