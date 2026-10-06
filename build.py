import re

with open("index_source.html", encoding="utf-8") as f:
    html = f.read()

# 1) Inline style.css
with open("style.css", encoding="utf-8") as f:
    css = f.read()
html = html.replace(
    '<link rel="stylesheet" href="style.css">',
    f"<style>\n{css}\n</style>"
)

# 2) Find every <script src="X.js"></script> tag, in order, and replace the
#    whole contiguous block with one <script> tag containing all of them
#    concatenated in the same order (matches the original build's format).
script_tag_re = re.compile(r'<script src="([^"]+\.js)"></script>\n?')
matches = list(script_tag_re.finditer(html))
if not matches:
    raise SystemExit("Nenhuma tag <script src> encontrada — build abortado.")

files_in_order = [m.group(1) for m in matches]
combined_js = []
for fname in files_in_order:
    with open(fname, encoding="utf-8") as f:
        combined_js.append(f.read())
combined = "\n\n".join(combined_js)

start = matches[0].start()
end = matches[-1].end()
html = html[:start] + f"<script>\n{combined}\n</script>\n" + html[end:]

# 3) Embute as imagens da logo como data URI (o index.html continua funcionando sozinho)
import base64, io
try:
    from PIL import Image
except ImportError:
    Image = None
for nome, largura in (("logo-emblema.png", 160), ("logo-orizon.png", 420)):
    caminho = nome
    if Image:
        im = Image.open(caminho).convert("RGBA")
        im.thumbnail((largura, largura * 2), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, "PNG", optimize=True); dados = buf.getvalue()
    else:
        dados = open(caminho, "rb").read()
    uri = "data:image/png;base64," + base64.b64encode(dados).decode()
    html = html.replace(f'src="{nome}"', f'src="{uri}"')

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("Build OK —", len(files_in_order), "arquivos JS combinados:", ", ".join(files_in_order))
print("Tamanho final do index.html:", len(html), "bytes")
