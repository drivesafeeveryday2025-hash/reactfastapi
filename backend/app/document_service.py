"""
HTML Document Service for Printable Customer Tax Invoices and Warehouse Packing Slips.
Generates responsive, high-contrast, print-optimized HTML templates formatted for standard A4/Letter paper
with support for browser window.print() and PDF export.
"""
from datetime import datetime


def generate_invoice_html(order, autoprint: bool = False) -> str:
    """
    Generates a professional tax invoice / customer sales receipt HTML.
    """
    order_date = order.created_at.strftime("%B %d, %Y") if hasattr(order, "created_at") and order.created_at else datetime.now().strftime("%B %d, %Y")
    order_items_html = ""
    subtotal = 0.0

    for idx, item in enumerate(order.items, 1):
        item_total = round(item.quantity * item.unit_price, 2)
        subtotal += item_total
        prod_title = item.product.title_en if item.product else f"Book #{item.product_id}"
        prod_title_zh = f"<div style='font-size: 11px; color: #64748b;'>{item.product.title_zh}</div>" if item.product and item.product.title_zh else ""
        isbn = item.product.detail.isbn if item.product and item.product.detail and item.product.detail.isbn else "N/A"

        order_items_html += f"""
        <tr>
            <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">{idx}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">
                <div style="font-weight: 600; color: #0f172a; font-size: 13px;">{prod_title}</div>
                {prod_title_zh}
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">ISBN: {isbn}</div>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">{item.quantity}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155;">${item.unit_price:.2f}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #0f172a;">${item_total:.2f}</td>
        </tr>
        """

    shipping_fee = getattr(order, "shipping_fee", 0.0) or 0.0
    grand_total = getattr(order, "total_amount", subtotal + shipping_fee)
    payment_method = (getattr(order, "payment_method", "credit_card") or "credit_card").replace("_", " ").title()
    delivery_method = (getattr(order, "delivery_method", "standard") or "standard").title()
    tracking_no = getattr(order, "tracking_number", "PENDING") or "PENDING"
    recipient_name = getattr(order, "recipient_name", "Valued Customer") or "Valued Customer"
    recipient_phone = getattr(order, "recipient_phone", "") or ""
    shipping_address = getattr(order, "shipping_address", "Customer Storefront") or "Customer Storefront"
    invoice_no = f"INV-{order.id:06d}"

    autoprint_script = "<script>window.addEventListener('load', () => window.print());</script>" if autoprint else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice {invoice_no} — Apex Book Haven</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #f8fafc;
            color: #0f172a;
            padding: 30px 15px;
        }}
        .invoice-card {{
            max-width: 820px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            padding: 40px;
            border: 1px solid #e2e8f0;
        }}
        .header-row {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 24px;
            margin-bottom: 28px;
        }}
        .logo-box h1 {{
            font-size: 26px;
            font-weight: 800;
            color: #0284c7;
            letter-spacing: -0.5px;
        }}
        .logo-box p {{
            font-size: 13px;
            color: #64748b;
            margin-top: 4px;
        }}
        .invoice-badge {{
            text-align: right;
        }}
        .invoice-badge h2 {{
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
        }}
        .meta-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            margin-bottom: 30px;
            background: #f8fafc;
            padding: 18px 22px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }}
        .meta-col h3 {{
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }}
        .meta-col p {{
            font-size: 13px;
            color: #1e293b;
            line-height: 1.5;
        }}
        table.items-table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
        }}
        table.items-table th {{
            background: #f1f5f9;
            color: #475569;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 10px 12px;
            border-bottom: 1px solid #cbd5e1;
            text-align: left;
        }}
        .summary-box {{
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
        }}
        .summary-table {{
            width: 320px;
            border-collapse: collapse;
        }}
        .summary-table td {{
            padding: 8px 12px;
            font-size: 13px;
        }}
        .summary-table tr.total-row td {{
            font-size: 16px;
            font-weight: 800;
            color: #0284c7;
            border-top: 2px solid #0284c7;
            padding-top: 10px;
        }}
        .print-btn-bar {{
            max-width: 820px;
            margin: 0 auto 20px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .print-btn {{
            background: #0284c7;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            border: none;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(2,132,199,0.3);
        }}
        @media print {{
            body {{ background: #ffffff; padding: 0; }}
            .invoice-card {{ border: none; box-shadow: none; padding: 20px 0; }}
            .print-btn-bar {{ display: none !important; }}
        }}
    </style>
</head>
<body>
    <div class="print-btn-bar">
        <a href="javascript:history.back()" style="color: #64748b; text-decoration: none; font-size: 14px;">← Back to Storefront</a>
        <button class="print-btn" onclick="window.print()">🖨️ Print or Save as PDF</button>
    </div>

    <div class="invoice-card">
        <div class="header-row">
            <div class="logo-box">
                <h1>📚 Apex Book Haven</h1>
                <p>文萃讀坊 • Tax Invoice & Official Receipt</p>
                <p style="font-size: 12px; margin-top: 4px;">88 Literature Blvd, Culture Square, Taipei</p>
                <p style="font-size: 12px;">Tax ID (統編): 88765432 | support@apexbooks.com</p>
            </div>
            <div class="invoice-badge">
                <h2>INVOICE</h2>
                <p style="font-size: 13px; font-weight: 700; color: #0284c7; margin-top: 4px;">{invoice_no}</p>
                <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Date: {order_date}</p>
                <p style="font-size: 12px; color: #16a34a; font-weight: 600; margin-top: 2px;">Status: PAID</p>
            </div>
        </div>

        <div class="meta-grid">
            <div class="meta-col">
                <h3>Billed & Shipped To</h3>
                <p><strong>{recipient_name}</strong></p>
                <p>{shipping_address}</p>
                {f"<p>Phone: {recipient_phone}</p>" if recipient_phone else ""}
                <p style="font-size: 11px; color: #64748b; margin-top: 4px;">Order ID: #{order.id}</p>
            </div>
            <div class="meta-col">
                <h3>Order & Shipping Details</h3>
                <p><strong>Delivery Method:</strong> {delivery_method}</p>
                <p><strong>Tracking Number:</strong> <span style="font-family: monospace; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">{tracking_no}</span></p>
                <p><strong>Payment Method:</strong> {payment_method}</p>
            </div>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">#</th>
                    <th>Book Description & ISBN</th>
                    <th style="width: 70px; text-align: center;">Qty</th>
                    <th style="width: 100px; text-align: right;">Unit Price</th>
                    <th style="width: 100px; text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                {order_items_html}
            </tbody>
        </table>

        <div class="summary-box">
            <table class="summary-table">
                <tr>
                    <td style="color: #64748b;">Items Subtotal:</td>
                    <td style="text-align: right; font-weight: 600;">${subtotal:.2f}</td>
                </tr>
                <tr>
                    <td style="color: #64748b;">Shipping Fee:</td>
                    <td style="text-align: right; font-weight: 600;">${shipping_fee:.2f}</td>
                </tr>
                <tr>
                    <td style="color: #64748b;">Estimated Tax (5% Incl.):</td>
                    <td style="text-align: right; color: #64748b;">${(grand_total * 0.05 / 1.05):.2f}</td>
                </tr>
                <tr class="total-row">
                    <td>Grand Total:</td>
                    <td style="text-align: right;">${grand_total:.2f} USD</td>
                </tr>
            </table>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
            Thank you for supporting independent literature and ideas at Apex Book Haven.<br>
            For return or refund requests, please contact support@apexbooks.com within 14 days of receipt.
        </div>
    </div>
    {autoprint_script}
</body>
</html>
"""


def generate_packing_slip_html(order, item_locations: dict, autoprint: bool = False) -> str:
    """
    Generates a warehouse packing slip & picking checklist for fulfillment staff.
    item_locations: dict mapping product_id -> dict(location_code, zone, aisle, shelf, bin)
    """
    order_date = order.created_at.strftime("%Y-%m-%d %H:%M") if hasattr(order, "created_at") and order.created_at else datetime.now().strftime("%Y-%m-%d %H:%M")
    recipient_name = getattr(order, "recipient_name", "Valued Customer") or "Valued Customer"
    recipient_phone = getattr(order, "recipient_phone", "") or ""
    shipping_address = getattr(order, "shipping_address", "Standard Delivery Address") or "Standard Delivery Address"
    tracking_no = getattr(order, "tracking_number", "PENDING") or "PENDING"
    delivery_method = (getattr(order, "delivery_method", "standard") or "standard").upper()

    items_rows = ""
    for idx, item in enumerate(order.items, 1):
        loc_info = item_locations.get(item.product_id, {})
        loc_code = loc_info.get("location_code", "WH-CENTRAL-GENERIC")
        zone = loc_info.get("zone", "General")
        shelf_bin = f"Aisle {loc_info.get('aisle', '01')} / Shelf {loc_info.get('shelf', '01')} / Bin {loc_info.get('bin', '01')}"
        prod_title = item.product.title_en if item.product else f"Book #{item.product_id}"
        isbn = item.product.detail.isbn if item.product and item.product.detail and item.product.detail.isbn else "N/A"

        items_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #cbd5e1; text-align: center;">
                <input type="checkbox" style="width: 18px; height: 18px; cursor: pointer;">
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #cbd5e1;">
                <span style="display: inline-block; background: #0284c7; color: white; font-weight: 800; font-family: monospace; font-size: 13px; padding: 4px 8px; border-radius: 4px;">{loc_code}</span>
                <div style="font-size: 11px; color: #475569; margin-top: 3px;">Zone: {zone} • {shelf_bin}</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #cbd5e1;">
                <div style="font-weight: 700; color: #0f172a; font-size: 14px;">{prod_title}</div>
                <div style="font-size: 11px; color: #64748b;">ISBN: {isbn}</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #cbd5e1; text-align: center; font-size: 16px; font-weight: 800; color: #0f172a;">
                {item.quantity}
            </td>
        </tr>
        """

    autoprint_script = "<script>window.addEventListener('load', () => window.print());</script>" if autoprint else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Packing Slip — Order #{order.id}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #f1f5f9;
            color: #0f172a;
            padding: 24px 12px;
        }}
        .slip-card {{
            max-width: 840px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            padding: 36px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.06);
            border: 1px solid #cbd5e1;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 18px;
            margin-bottom: 24px;
        }}
        .header h1 {{
            font-size: 24px;
            font-weight: 800;
        }}
        .barcode-mock {{
            font-family: 'Courier New', Courier, monospace;
            letter-spacing: 5px;
            font-size: 20px;
            font-weight: bold;
            background: #f8fafc;
            border: 2px dashed #94a3b8;
            padding: 6px 14px;
            border-radius: 4px;
        }}
        .dispatch-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
            background: #f8fafc;
            padding: 16px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }}
        .dispatch-col h3 {{
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }}
        .dispatch-col p {{
            font-size: 13px;
            line-height: 1.4;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 28px;
        }}
        th {{
            background: #e2e8f0;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 10px 12px;
            text-align: left;
        }}
        .signoff-box {{
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-top: 36px;
            padding-top: 24px;
            border-top: 1px dashed #cbd5e1;
            font-size: 12px;
            color: #64748b;
        }}
        .signoff-line {{
            border-bottom: 1px solid #0f172a;
            height: 24px;
            margin-top: 6px;
        }}
        .print-btn-bar {{
            max-width: 840px;
            margin: 0 auto 16px auto;
            display: flex;
            justify-content: flex-end;
        }}
        .print-btn {{
            background: #0f172a;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            border: none;
            cursor: pointer;
        }}
        @media print {{
            body {{ background: white; padding: 0; }}
            .slip-card {{ border: none; box-shadow: none; padding: 10px 0; }}
            .print-btn-bar {{ display: none !important; }}
        }}
    </style>
</head>
<body>
    <div class="print-btn-bar">
        <button class="print-btn" onclick="window.print()">🖨️ Print Packing Slip</button>
    </div>

    <div class="slip-card">
        <div class="header">
            <div>
                <h1>📦 WAREHOUSE PACKING SLIP</h1>
                <p style="font-size: 13px; color: #64748b; margin-top: 3px;">Apex Fulfillment Center • Order #{order.id}</p>
            </div>
            <div style="text-align: right;">
                <div class="barcode-mock">*{tracking_no}*</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Date: {order_date}</div>
            </div>
        </div>

        <div class="dispatch-grid">
            <div class="dispatch-col">
                <h3>Ship To Recipient</h3>
                <p><strong>{recipient_name}</strong></p>
                <p>{shipping_address}</p>
                {f"<p>Phone: {recipient_phone}</p>" if recipient_phone else ""}
            </div>
            <div class="dispatch-col">
                <h3>Carrier & Fulfillment Method</h3>
                <p><strong>Method:</strong> {delivery_method}</p>
                <p><strong>Tracking No:</strong> {tracking_no}</p>
                <p><strong>Status:</strong> {order.status}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 50px; text-align: center;">Picked</th>
                    <th style="width: 220px;">Location (Zone / Bin)</th>
                    <th>Book Title & Details</th>
                    <th style="width: 70px; text-align: center;">Qty</th>
                </tr>
            </thead>
            <tbody>
                {items_rows}
            </tbody>
        </table>

        <div class="signoff-box">
            <div>
                <span>Picked By (Signature):</span>
                <div class="signoff-line"></div>
            </div>
            <div>
                <span>Packed By (Signature):</span>
                <div class="signoff-line"></div>
            </div>
            <div>
                <span>Quality Check Passed:</span>
                <div class="signoff-line"></div>
            </div>
        </div>
    </div>
    {autoprint_script}
</body>
</html>
"""
