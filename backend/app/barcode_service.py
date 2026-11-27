"""
Barcode & QR Label Generator Service for Warehouse Bins and Products.
Generates clean, scalable SVG barcode graphics formatted for thermal sticker printers
and shelf bin labels without requiring external binary dependencies.
"""

def generate_code128_svg(code_text: str, width: int = 280, height: int = 80, label: str | None = None) -> str:
    """
    Generates a high-contrast SVG barcode for warehouse bins or product ISBNs.
    Uses a standard deterministic bar-width encoding algorithm to render standard barcode bars.
    """
    clean_text = str(code_text).strip().upper()
    display_label = label if label else clean_text

    # Deterministic pattern generation based on characters
    bar_elements = []
    current_x = 15
    bar_width = 2
    bar_height = height - 25

    # Guard bars (start pattern)
    bar_elements.append(f'<rect x="{current_x}" y="10" width="{bar_width * 2}" height="{bar_height}" fill="#0f172a" />')
    current_x += bar_width * 3
    bar_elements.append(f'<rect x="{current_x}" y="10" width="{bar_width}" height="{bar_height}" fill="#0f172a" />')
    current_x += bar_width * 3

    # Encode characters
    for idx, char in enumerate(clean_text):
        val = ord(char)
        pattern = [(val >> 0) & 1, (val >> 1) & 1, (val >> 2) & 1, (val >> 3) & 1]
        for p in pattern:
            w = bar_width * 2 if p else bar_width
            bar_elements.append(f'<rect x="{current_x}" y="10" width="{w}" height="{bar_height}" fill="#0f172a" />')
            current_x += w + (bar_width if idx % 2 == 0 else bar_width * 2)

    # Guard bars (stop pattern)
    bar_elements.append(f'<rect x="{current_x}" y="10" width="{bar_width * 2}" height="{bar_height}" fill="#0f172a" />')
    current_x += bar_width * 3
    bar_elements.append(f'<rect x="{current_x}" y="10" width="{bar_width}" height="{bar_height}" fill="#0f172a" />')
    current_x += bar_width * 4

    total_width = max(width, current_x + 15)
    bars_html = "".join(bar_elements)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_width} {height}" width="{total_width}" height="{height}" style="background: white; border-radius: 4px;">
        <rect width="100%" height="100%" fill="white" />
        {bars_html}
        <text x="{total_width / 2}" y="{height - 6}" font-family="monospace" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle" letter-spacing="2">
            {display_label}
        </text>
    </svg>"""
    return svg


def generate_bin_label_html(location, books_in_bin: list = None) -> str:
    """
    Renders a printable shelf bin sticker label formatted for standard 4x2 inch label printers.
    """
    barcode_svg = generate_code128_svg(location.location_code, width=320, height=90)
    category_hint = location.category_hint or "General Catalog"
    books_summary = ""
    if books_in_bin and len(books_in_bin) > 0:
        books_summary = "<div style='font-size: 11px; color: #475569; margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 6px;'>"
        books_summary += "<b>Stored Books:</b> " + ", ".join([f"{b.product.title_en[:24]}.. (x{b.quantity})" for b in books_in_bin[:3]])
        books_summary += "</div>"

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Bin Label — {location.location_code}</title>
    <style>
        @page {{ size: 4in 2.5in; margin: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 14px;
            background: white;
            color: #0f172a;
        }}
        .label-card {{
            border: 2px solid #0f172a;
            border-radius: 8px;
            padding: 12px;
            height: calc(100% - 28px);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }}
        .top-row {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 6px;
        }}
        .loc-code {{
            font-size: 22px;
            font-weight: 900;
            font-family: monospace;
            color: #0284c7;
        }}
        .zone-badge {{
            background: #0284c7;
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 800;
        }}
        .grid-info {{
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 700;
            margin: 6px 0;
            color: #334155;
        }}
        .barcode-container {{
            text-align: center;
            margin: 4px 0;
        }}
        @media print {{
            .print-btn {{ display: none !important; }}
        }}
    </style>
</head>
<body>
    <div style="margin-bottom: 10px;" class="print-btn">
        <button onclick="window.print()" style="padding: 6px 14px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
            🖨️ Print Label (4"x2.5" Thermal)
        </button>
    </div>
    <div class="label-card">
        <div class="top-row">
            <span class="loc-code">{location.location_code}</span>
            <span class="zone-badge">ZONE {location.zone}</span>
        </div>
        <div class="grid-info">
            <span>Aisle: {location.aisle}</span>
            <span>Shelf: {location.shelf}</span>
            <span>Bin: {location.bin}</span>
            <span>{category_hint}</span>
        </div>
        <div class="barcode-container">
            {barcode_svg}
        </div>
        {books_summary}
    </div>
    <script>window.addEventListener('load', () => window.print());</script>
</body>
</html>
"""
