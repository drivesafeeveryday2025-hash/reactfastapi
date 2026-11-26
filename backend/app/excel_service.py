import io
import re
from datetime import datetime
from typing import Any
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session
from . import models


# ===================== FLEXIBLE HEADER COLUMN MAPPING =====================

COLUMN_KEY_MAP = {
    # Category
    "category": "category_en",
    "category_en": "category_en",
    "category (en)": "category_en",
    "category en": "category_en",
    "分類": "category_en",
    "類別": "category_en",
    "書籍分類": "category_en",
    "category_zh": "category_zh",
    "category (zh)": "category_zh",
    "category zh": "category_zh",
    "分類中文": "category_zh",
    "類別中文": "category_zh",

    # Title
    "title": "title_en",
    "title_en": "title_en",
    "title (en)": "title_en",
    "title en": "title_en",
    "書名": "title_en",
    "英文書名": "title_en",
    "title_zh": "title_zh",
    "title (zh)": "title_zh",
    "title zh": "title_zh",
    "中文書名": "title_zh",
    "書名中文": "title_zh",

    # Author
    "author": "author_en",
    "author_en": "author_en",
    "author (en)": "author_en",
    "author en": "author_en",
    "作者": "author_en",
    "英文作者": "author_en",
    "author_zh": "author_zh",
    "author (zh)": "author_zh",
    "author zh": "author_zh",
    "中文作者": "author_zh",
    "作者中文": "author_zh",

    # Price
    "price": "price",
    "price (usd)": "price",
    "price usd": "price",
    "價格": "price",
    "售價": "price",
    "定價": "price",
    "金額": "price",

    # ISBN
    "isbn": "isbn",
    "isbn碼": "isbn",
    "國際標準書號": "isbn",

    # Publisher
    "publisher": "publisher_en",
    "publisher_en": "publisher_en",
    "publisher (en)": "publisher_en",
    "出版社": "publisher_en",
    "英文出版社": "publisher_en",
    "publisher_zh": "publisher_zh",
    "publisher (zh)": "publisher_zh",
    "中文出版社": "publisher_zh",

    # Publication Year
    "year": "publication_year",
    "publication_year": "publication_year",
    "publication year": "publication_year",
    "出版年": "publication_year",
    "出版年份": "publication_year",

    # Page count
    "pages": "page_count",
    "page_count": "page_count",
    "page count": "page_count",
    "頁數": "page_count",

    # Format
    "format": "format_en",
    "format_en": "format_en",
    "format (en)": "format_en",
    "裝訂": "format_en",
    "規格": "format_en",
    "format_zh": "format_zh",
    "format (zh)": "format_zh",
    "中文規格": "format_zh",
    "中文裝訂": "format_zh",

    # Recommended
    "recommended": "is_recommended",
    "is_recommended": "is_recommended",
    "is recommended": "is_recommended",
    "推薦": "is_recommended",
    "店長推薦": "is_recommended",
    "精選推薦": "is_recommended",

    # Image URL
    "image": "image_url",
    "image_url": "image_url",
    "image url": "image_url",
    "封面圖片": "image_url",
    "封面圖片網址": "image_url",
    "圖片網址": "image_url",

    # Short Description
    "short_desc": "short_desc_en",
    "short_desc_en": "short_desc_en",
    "short description (en)": "short_desc_en",
    "簡介": "short_desc_en",
    "英文簡介": "short_desc_en",
    "short_desc_zh": "short_desc_zh",
    "short description (zh)": "short_desc_zh",
    "中文簡介": "short_desc_zh",

    # Full Synopsis
    "synopsis": "full_synopsis_en",
    "full_synopsis_en": "full_synopsis_en",
    "full synopsis (en)": "full_synopsis_en",
    "完整內容簡介英文": "full_synopsis_en",
    "內文簡介": "full_synopsis_en",
    "full_synopsis_zh": "full_synopsis_zh",
    "full synopsis (zh)": "full_synopsis_zh",
    "完整內容簡介中文": "full_synopsis_zh",
}


def normalize_header(raw_header: Any) -> str | None:
    if raw_header is None:
        return None
    h = str(raw_header).strip().lower()

    # 1. Distinguish Chinese vs English sub-headers first
    if "zh" in h or "中文" in h:
        if "title" in h or "書名" in h:
            return "title_zh"
        if "author" in h or "作者" in h:
            return "author_zh"
        if "category" in h or "分類" in h or "類別" in h:
            return "category_zh"
        if "publisher" in h or "出版社" in h:
            return "publisher_zh"
        if "format" in h or "規格" in h or "裝訂" in h:
            return "format_zh"
        if "synopsis" in h or "完整" in h or "內文" in h:
            return "full_synopsis_zh"
        if "desc" in h or "簡介" in h:
            return "short_desc_zh"

    # 2. English fields or general fields
    if "title" in h or "書名" in h:
        return "title_en"
    if "author" in h or "作者" in h:
        return "author_en"
    if "category" in h or "分類" in h or "類別" in h:
        return "category_en"
    if "publisher" in h or "出版社" in h:
        return "publisher_en"
    if "format" in h or "規格" in h or "裝訂" in h:
        return "format_en"
    if "synopsis" in h or "完整" in h or "內文" in h:
        return "full_synopsis_en"
    if "desc" in h or "簡介" in h:
        return "short_desc_en"

    # 3. Numeric & Standard fields
    if "price" in h or "價格" in h or "售價" in h or "定價" in h:
        return "price"
    if "isbn" in h:
        return "isbn"
    if "year" in h or "年份" in h or "出版年" in h:
        return "publication_year"
    if "page" in h or "頁數" in h:
        return "page_count"
    if "image" in h or "圖片" in h or "封面" in h:
        return "image_url"
    if "rec" in h or "推薦" in h:
        return "is_recommended"

    return None


# ===================== 1. TEMPLATE GENERATOR =====================

def generate_excel_template() -> bytes:
    """
    Generates a beautifully styled bookstore product import template (.xlsx)
    with pre-filled sample rows and instructions.
    """
    wb = openpyxl.Workbook()
    
    # ----------------- Sheet 1: Books Catalog Template -----------------
    ws1 = wb.active
    ws1.title = "Books_Catalog"
    ws1.views.sheetView[0].showGridLines = True

    headers = [
        ("Category (EN)", "分類英文"),
        ("Category (ZH)", "分類中文"),
        ("Title (EN) *", "英文書名 *"),
        ("Title (ZH) *", "中文書名 *"),
        ("Author (EN) *", "英文作者 *"),
        ("Author (ZH) *", "中文作者 *"),
        ("Price USD *", "價格 *"),
        ("ISBN", "國際標準書號"),
        ("Publisher (EN)", "英文出版社"),
        ("Publisher (ZH)", "中文出版社"),
        ("Publication Year", "出版年份"),
        ("Page Count", "頁數"),
        ("Format (EN)", "規格英文"),
        ("Format (ZH)", "規格中文"),
        ("Is Recommended", "店長推薦 (TRUE/FALSE)"),
        ("Image URL", "封面圖片網址"),
        ("Short Description (EN)", "英文簡介"),
        ("Short Description (ZH)", "中文簡介"),
        ("Full Synopsis (EN)", "完整內容簡介英文"),
        ("Full Synopsis (ZH)", "完整內容簡介中文"),
    ]

    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")  # Slate 800
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    # Write Header (Row 1)
    for col_idx, (en_name, zh_name) in enumerate(headers, start=1):
        cell = ws1.cell(row=1, column=col_idx, value=f"{en_name}\n({zh_name})")
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    ws1.row_dimensions[1].height = 36

    # Sample Row 1: Software Craftsmanship
    sample1 = [
        "Software Engineering",
        "軟體與程式工藝",
        "Refactoring: Improving the Design of Existing Code",
        "重構：改善既有程式的設計",
        "Martin Fowler",
        "馬丁·福勒 (Martin Fowler)",
        47.50,
        "978-0134757599",
        "Addison-Wesley Professional",
        "碁峰資訊",
        2018,
        448,
        "Hardcover 2nd Edition",
        "精裝第二版",
        "TRUE",
        "https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=600&auto=format&fit=crop&q=80",
        "Fully updated second edition of Martin Fowler's classic guide to improving software design.",
        "軟體工程界二十年傳奇巨作全新改版，手把手示範如何安全、優雅地重構程式架構。",
        "For more than twenty years, serious programmers have turned to Martin Fowler's Refactoring for guidance in improving code maintainability. This second edition uses modern JavaScript and presents systematic catalog of refactoring techniques.",
        "二十年來，全球專業程式設計師均將馬丁·福勒的《重構》奉為提升軟體品質的必讀殿堂經典。第二版採用現代化範例，完整收錄高達數十種立即可用的重構手法目錄與原則。",
    ]

    # Sample Row 2: Psychology & Thinking
    sample2 = [
        "Personal Growth",
        "心理與個人成長",
        "Thinking, Fast and Slow",
        "快思慢想",
        "Daniel Kahneman",
        "丹尼爾·康納曼 (Daniel Kahneman)",
        19.99,
        "978-0374533557",
        "Farrar, Straus and Giroux",
        "天下文化",
        2011,
        512,
        "Paperback",
        "繁體中文平裝版",
        "FALSE",
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
        "Explores the two systems that drive the way we think—fast, intuitive, vs slow and deliberate.",
        "諾貝爾經濟學獎得主康納曼代表作，剖析大腦運作的兩大思考系統與人類行為決策偏誤。",
        "In the international bestseller, Daniel Kahneman takes us on a groundbreaking tour of the mind and explains the two systems that drive how humans judge, decide, and act.",
        "本書帶領讀者深入大腦神經認知世界，剖析快思考的衝動直覺與慢思考的縝密理性，揭露我們自以為理性的決策背後隱藏的種種盲點與心理偏誤。",
    ]

    data_rows = [sample1, sample2]
    data_font = Font(name="Calibri", size=10)

    for row_idx, row_data in enumerate(data_rows, start=2):
        ws1.row_dimensions[row_idx].height = 24
        for col_idx, val in enumerate(row_data, start=1):
            cell = ws1.cell(row=row_idx, column=col_idx, value=val)
            cell.font = data_font
            cell.border = thin_border
            if isinstance(val, (int, float)):
                cell.alignment = Alignment(horizontal="right", vertical="center")
                if isinstance(val, float):
                    cell.number_format = "$#,##0.00"
            elif val in ("TRUE", "FALSE"):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    # Set column widths nicely
    for col in ws1.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or "")
            first_line = val_str.split("\n")[0]
            max_len = max(max_len, len(first_line))
        ws1.column_dimensions[col_letter].width = max(max_len + 5, 14)

    # ----------------- Sheet 2: Instructions -----------------
    ws2 = wb.create_sheet(title="Import_Guide")
    ws2.views.sheetView[0].showGridLines = True

    guide_title_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")  # Sky 600
    guide_title_font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")

    ws2.merge_cells("A1:C1")
    ws2.cell(row=1, column=1, value="📚 Bookstore Product Excel Import Specification Guide (匯入說明指南)").fill = guide_title_fill
    ws2.cell(row=1, column=1).font = guide_title_font
    ws2.cell(row=1, column=1).alignment = Alignment(horizontal="left", vertical="center")
    ws2.row_dimensions[1].height = 32

    instructions = [
        ("欄位名稱 (Field)", "必填 (Required)", "說明與格式規範 (Format Rules)"),
        ("Category (EN / ZH)", "選填", "書籍所屬分類。若資料庫尚無該分類，系統會自動建立新分類！"),
        ("Title (EN / ZH)", "必填 (至少填一)", "書名中英文標題。"),
        ("Author (EN / ZH)", "必填 (至少填一)", "作者姓名。"),
        ("Price USD", "必填", "書籍販售價格，必須為數字（例如 25.50 或 18）。"),
        ("ISBN", "強烈建議", "國際標準書號。系統以 ISBN 作為更新比對鍵；若 ISBN 已存在則自動執行【更新 (Update)】，不存在則【新增 (Insert)】。"),
        ("Publisher (EN / ZH)", "選填", "出版機構名稱。"),
        ("Publication Year", "選填", "4 位數出版年份（例如 2024）。"),
        ("Page Count", "選填", "書籍總頁數正整數（例如 384）。"),
        ("Format (EN / ZH)", "選填", "裝訂規格（例如：Paperback / 平裝版，Hardcover / 精裝版）。"),
        ("Is Recommended", "選填", "是否列入店長精選推薦：填寫 TRUE 或 FALSE (或 1 / 0)。"),
        ("Image URL", "選填", "書籍封面圖片網址。留空時系統會自動指派高質感預設封面。"),
        ("Short Description", "選填", "前台商品卡片展示的簡要介紹（100 字以內最佳）。"),
        ("Full Synopsis", "選填", "商品詳細頁面展示的完整內文導讀與推薦語。"),
    ]

    for r_idx, (col_a, col_b, col_c) in enumerate(instructions, start=3):
        ws2.row_dimensions[r_idx].height = 22
        cA = ws2.cell(row=r_idx, column=1, value=col_a)
        cB = ws2.cell(row=r_idx, column=2, value=col_b)
        cC = ws2.cell(row=r_idx, column=3, value=col_c)
        cA.border = thin_border
        cB.border = thin_border
        cC.border = thin_border

        if r_idx == 3:
            for cell in (cA, cB, cC):
                cell.fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
                cell.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
                cell.alignment = Alignment(horizontal="center", vertical="center")
        else:
            cA.font = Font(name="Calibri", size=10, bold=True)
            cB.font = Font(name="Calibri", size=10)
            cC.font = Font(name="Calibri", size=10)
            cB.alignment = Alignment(horizontal="center", vertical="center")

    ws2.column_dimensions["A"].width = 28
    ws2.column_dimensions["B"].width = 18
    ws2.column_dimensions["C"].width = 75

    out_stream = io.BytesIO()
    wb.save(out_stream)
    out_stream.seek(0)
    return out_stream.getvalue()


# ===================== 2. EXCEL PARSER & DATABASE IMPORTER =====================

def import_books_from_excel(db: Session, file_contents: bytes, filename: str) -> dict:
    """
    Parses an uploaded Excel file (.xlsx / .xls), validates all records,
    creates categories if needed, and safely inserts or updates C00_Product & C00_ProdDetail.
    Returns a comprehensive result dictionary.
    """
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_contents), data_only=True)
    except Exception as exc:
        return {
            "success": False,
            "filename": filename,
            "total_rows": 0,
            "inserted": 0,
            "updated": 0,
            "failed": 0,
            "errors": [{"row": 0, "reason": f"Invalid Excel file or format: {str(exc)}"}],
            "imported_books": [],
        }

    # Find candidate sheet (Books_Catalog or first sheet)
    ws = None
    if "Books_Catalog" in wb.sheetnames:
        ws = wb["Books_Catalog"]
    else:
        ws = wb.active

    if not ws:
        return {
            "success": False,
            "filename": filename,
            "total_rows": 0,
            "inserted": 0,
            "updated": 0,
            "failed": 0,
            "errors": [{"row": 0, "reason": "No readable worksheets found in Excel file"}],
            "imported_books": [],
        }

    # Read Header row (Row 1)
    col_mapping: dict[int, str] = {}
    for col_idx in range(1, ws.max_column + 1):
        cell_val = ws.cell(row=1, column=col_idx).value
        key = normalize_header(cell_val)
        if key:
            col_mapping[col_idx] = key

    if "title_en" not in col_mapping.values() and "title_zh" not in col_mapping.values():
        return {
            "success": False,
            "filename": filename,
            "total_rows": 0,
            "inserted": 0,
            "updated": 0,
            "failed": 0,
            "errors": [
                {
                    "row": 1,
                    "reason": "Missing required title header ('Title (EN)' or 'Title (ZH)'). Please use the official template.",
                }
            ],
            "imported_books": [],
        }

    # Cache existing categories to avoid redundant DB hits
    categories = db.query(models.C00_Category).all()
    cat_map: dict[str, models.C00_Category] = {}
    for c in categories:
        cat_map[c.name_en.lower()] = c
        cat_map[c.name_zh.lower()] = c

    # Fallback category
    default_cat = categories[0] if categories else None
    if not default_cat:
        default_cat = models.C00_Category(name_en="General Literature", name_zh="綜合文學", icon="📚", sort_order=1)
        db.add(default_cat)
        db.flush()
        cat_map["general literature"] = default_cat
        cat_map["綜合文學"] = default_cat

    inserted_count = 0
    updated_count = 0
    failed_count = 0
    errors: list[dict] = []
    imported_books: list[dict] = []

    # Iterate rows starting from Row 2
    for row_num in range(2, ws.max_row + 1):
        row_dict: dict[str, Any] = {}
        has_content = False

        for col_idx, key in col_mapping.items():
            val = ws.cell(row=row_num, column=col_idx).value
            if val is not None and str(val).strip():
                has_content = True
                row_dict[key] = val

        # Skip completely empty rows
        if not has_content:
            continue

        # Check required fields
        raw_title_en = str(row_dict.get("title_en", "")).strip()
        raw_title_zh = str(row_dict.get("title_zh", "")).strip()

        if not raw_title_en and not raw_title_zh:
            failed_count += 1
            errors.append({
                "row": row_num,
                "reason": "Row skipped: Book title (English or Chinese) is required.",
            })
            continue

        title_en = raw_title_en or raw_title_zh
        title_zh = raw_title_zh or raw_title_en

        # Author
        author_en = str(row_dict.get("author_en", "")).strip() or "Various Authors"
        author_zh = str(row_dict.get("author_zh", "")).strip() or "各大名家"

        # Price parsing
        raw_price = row_dict.get("price")
        price = 0.0
        try:
            if raw_price is not None:
                # Strip currency symbols if present
                clean_price_str = str(raw_price).replace("$", "").replace("¥", "").replace(",", "").strip()
                price = round(float(clean_price_str), 2)
                if price < 0:
                    price = 0.0
        except Exception:
            failed_count += 1
            errors.append({
                "row": row_num,
                "title": title_en,
                "reason": f"Invalid price format '{raw_price}'. Must be a positive decimal number.",
            })
            continue

        # Category resolution (lookup or auto-create)
        cat_en_name = str(row_dict.get("category_en", "")).strip()
        cat_zh_name = str(row_dict.get("category_zh", "")).strip()
        matched_cat = None

        if cat_en_name and cat_en_name.lower() in cat_map:
            matched_cat = cat_map[cat_en_name.lower()]
        elif cat_zh_name and cat_zh_name.lower() in cat_map:
            matched_cat = cat_map[cat_zh_name.lower()]
        elif cat_en_name or cat_zh_name:
            # Auto-create new category
            new_cat_en = cat_en_name or cat_zh_name
            new_cat_zh = cat_zh_name or cat_en_name
            new_cat = models.C00_Category(name_en=new_cat_en, name_zh=new_cat_zh, icon="📖", sort_order=len(cat_map) + 1)
            db.add(new_cat)
            db.flush()
            cat_map[new_cat_en.lower()] = new_cat
            cat_map[new_cat_zh.lower()] = new_cat
            matched_cat = new_cat
        else:
            matched_cat = default_cat

        # ISBN
        raw_isbn = str(row_dict.get("isbn", "")).strip()
        isbn = raw_isbn if raw_isbn else None

        # Detail fields
        publisher_en = str(row_dict.get("publisher_en", "")).strip() or "Apex Publishing"
        publisher_zh = str(row_dict.get("publisher_zh", "")).strip() or "文萃文化"
        format_en = str(row_dict.get("format_en", "")).strip() or "Paperback"
        format_zh = str(row_dict.get("format_zh", "")).strip() or "平裝版"

        # Year & Pages
        try:
            pub_year = int(row_dict.get("publication_year", 2024))
        except Exception:
            pub_year = 2024

        try:
            pages = int(row_dict.get("page_count", 250))
        except Exception:
            pages = 250

        # Boolean: is_recommended
        raw_rec = str(row_dict.get("is_recommended", "false")).strip().lower()
        is_rec = raw_rec in ("true", "1", "yes", "y", "t", "是", "真")

        # Descriptions & Images
        short_desc_en = str(row_dict.get("short_desc_en", "")).strip() or f"Curated edition of {title_en}."
        short_desc_zh = str(row_dict.get("short_desc_zh", "")).strip() or f"文萃讀坊嚴選推薦：《{title_zh}》。"
        full_synopsis_en = str(row_dict.get("full_synopsis_en", "")).strip() or short_desc_en
        full_synopsis_zh = str(row_dict.get("full_synopsis_zh", "")).strip() or short_desc_zh

        image_url = str(row_dict.get("image_url", "")).strip()
        if not image_url or not image_url.startswith("http"):
            image_url = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&auto=format&fit=crop&q=80"

        # ----------------- UPSERT LOGIC -----------------
        existing_product = None

        # 1. Match by ISBN if available
        if isbn:
            detail_match = db.query(models.C00_ProdDetail).filter(models.C00_ProdDetail.isbn == isbn).first()
            if detail_match and detail_match.product:
                existing_product = detail_match.product

        # 2. Match by exact title_en if not matched by ISBN
        if not existing_product:
            existing_product = db.query(models.C00_Product).filter(
                models.C00_Product.title_en.ilike(title_en)
            ).first()

        try:
            if existing_product:
                # Update existing product
                existing_product.category_id = matched_cat.id
                existing_product.title_en = title_en
                existing_product.title_zh = title_zh
                existing_product.author_en = author_en
                existing_product.author_zh = author_zh
                existing_product.price = price
                existing_product.short_desc_en = short_desc_en
                existing_product.short_desc_zh = short_desc_zh
                existing_product.image_url = image_url
                existing_product.is_recommended = is_rec
                existing_product.is_active = True

                if existing_product.detail:
                    existing_product.detail.full_synopsis_en = full_synopsis_en
                    existing_product.detail.full_synopsis_zh = full_synopsis_zh
                    existing_product.detail.publisher_en = publisher_en
                    existing_product.detail.publisher_zh = publisher_zh
                    if isbn:
                        existing_product.detail.isbn = isbn
                    existing_product.detail.publication_year = pub_year
                    existing_product.detail.page_count = pages
                    existing_product.detail.format_en = format_en
                    existing_product.detail.format_zh = format_zh
                else:
                    new_detail = models.C00_ProdDetail(
                        product_id=existing_product.id,
                        full_synopsis_en=full_synopsis_en,
                        full_synopsis_zh=full_synopsis_zh,
                        publisher_en=publisher_en,
                        publisher_zh=publisher_zh,
                        isbn=isbn or f"AUTO-{existing_product.id}",
                        publication_year=pub_year,
                        page_count=pages,
                        format_en=format_en,
                        format_zh=format_zh,
                    )
                    db.add(new_detail)

                db.flush()
                updated_count += 1
                imported_books.append({
                    "id": existing_product.id,
                    "title_en": title_en,
                    "title_zh": title_zh,
                    "author_en": author_en,
                    "price": price,
                    "isbn": isbn,
                    "action": "UPDATED",
                })
            else:
                # Insert brand new product
                new_product = models.C00_Product(
                    category_id=matched_cat.id,
                    title_en=title_en,
                    title_zh=title_zh,
                    author_en=author_en,
                    author_zh=author_zh,
                    price=price,
                    short_desc_en=short_desc_en,
                    short_desc_zh=short_desc_zh,
                    image_url=image_url,
                    is_recommended=is_rec,
                    is_active=True,
                )
                db.add(new_product)
                db.flush()

                new_detail = models.C00_ProdDetail(
                    product_id=new_product.id,
                    full_synopsis_en=full_synopsis_en,
                    full_synopsis_zh=full_synopsis_zh,
                    publisher_en=publisher_en,
                    publisher_zh=publisher_zh,
                    isbn=isbn or f"APEX-{new_product.id:06d}",
                    publication_year=pub_year,
                    page_count=pages,
                    format_en=format_en,
                    format_zh=format_zh,
                )
                db.add(new_detail)
                db.flush()

                inserted_count += 1
                imported_books.append({
                    "id": new_product.id,
                    "title_en": title_en,
                    "title_zh": title_zh,
                    "author_en": author_en,
                    "price": price,
                    "isbn": isbn,
                    "action": "INSERTED",
                })

        except Exception as row_err:
            failed_count += 1
            errors.append({
                "row": row_num,
                "title": title_en,
                "isbn": isbn,
                "reason": f"Database write error: {str(row_err)}",
            })

    db.commit()

    total_processed = inserted_count + updated_count + failed_count
    return {
        "success": failed_count == 0 or (inserted_count + updated_count > 0),
        "filename": filename,
        "total_rows": total_processed,
        "inserted": inserted_count,
        "updated": updated_count,
        "failed": failed_count,
        "errors": errors,
        "imported_books": imported_books,
    }


# ===================== WMS PHYSICAL STOCKTAKE CHECKLIST EXPORT =====================

def generate_stocktake_checklist_excel(
    inventory_items: list[dict],
    warehouse_name: str = "All Facilities",
    zone_name: str = "All Zones",
) -> bytes:
    """
    Generates a print-ready, professional Excel (.xlsx) Stocktake Checklist.
    Includes inventory identifiers, location codes, expected book quantities,
    and dedicated blank fields for physical count, discrepancy, and manager approval sign-offs.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Stocktake Checklist"
    ws.views.sheetView[0].showGridLines = True

    # Styling definitions
    font_company = Font(name="Calibri", size=15, bold=True, color="1E3A8A")
    font_subtitle = Font(name="Calibri", size=10, italic=True, color="475569")
    font_meta_label = Font(name="Calibri", size=9, bold=True, color="334155")
    font_meta_val = Font(name="Calibri", size=9, color="0F172A")
    font_tbl_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_data = Font(name="Calibri", size=9, color="0F172A")
    font_data_bold = Font(name="Calibri", size=9, bold=True, color="0F172A")
    font_sign_label = Font(name="Calibri", size=9, bold=True, color="475569")

    fill_tbl_header = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    fill_accent_header = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    fill_even = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    fill_write_col = PatternFill(start_color="FEF9C3", end_color="FEF9C3", fill_type="solid")  # light yellow tint

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )
    box_write_border = Border(
        left=Side(style="medium", color="64748B"),
        right=Side(style="medium", color="64748B"),
        top=Side(style="thin", color="94A3B8"),
        bottom=Side(style="thin", color="94A3B8"),
    )
    double_bottom_border = Border(
        top=Side(style="thin", color="94A3B8"),
        bottom=Side(style="double", color="0F172A"),
    )

    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    batch_ref = f"STK-{datetime.now().strftime('%Y%m%d')}-{len(inventory_items):03d}"

    # Row 1-2: Banner
    ws.merge_cells("A1:M1")
    ws["A1"] = "APEX BOOK HAVEN — PHYSICAL STOCKTAKE AUDIT CHECKLIST"
    ws["A1"].font = font_company
    ws["A1"].alignment = Alignment(horizontal="left", vertical="center")

    ws.merge_cells("A2:M2")
    ws["A2"] = "Official Warehouse Physical Count & Variance Verification Form (門市與倉儲實體盤點核對表)"
    ws["A2"].font = font_subtitle
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center")

    # Row 3: Meta box
    ws["A3"] = "Audit Ref:"
    ws["A3"].font = font_meta_label
    ws["B3"] = batch_ref
    ws["B3"].font = font_meta_val

    ws["D3"] = "Warehouse:"
    ws["D3"].font = font_meta_label
    ws["E3"] = warehouse_name
    ws["E3"].font = font_meta_val

    ws["G3"] = "Target Zone / Area:"
    ws["G3"].font = font_meta_label
    ws["H3"] = zone_name
    ws["H3"].font = font_meta_val

    ws["K3"] = "Audit Date:"
    ws["K3"].font = font_meta_label
    ws["L3"] = now_str
    ws["L3"].font = font_meta_val

    # Table headers at Row 5
    headers = [
        ("#", 5, align_center),
        ("ISBN / SKU", 17, align_center),
        ("Book Title (English)", 30, align_left),
        ("Book Title (繁體中文)", 22, align_left),
        ("Category", 18, align_left),
        ("Warehouse", 14, align_center),
        ("Zone / Area", 20, align_left),
        ("Location (Aisle-Shelf-Bin)", 24, align_center),
        ("Condition", 15, align_center),
        ("System Expected Qty", 19, align_right),
        ("Physical Counted Qty", 20, align_center),
        ("Variance (+ / -)", 16, align_center),
        ("Auditor Inspection Notes", 28, align_left),
    ]

    header_row = 5
    for col_idx, (h_title, width, h_align) in enumerate(headers, start=1):
        cell = ws.cell(row=header_row, column=col_idx, value=h_title)
        if col_idx in (11, 12):
            cell.fill = fill_accent_header
        else:
            cell.fill = fill_tbl_header
        cell.font = font_tbl_header
        cell.alignment = align_center
        cell.border = thin_border
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = max(width, 10)

    ws.row_dimensions[header_row].height = 26

    # Data Rows
    current_row = 6
    total_sys_units = 0

    for idx, item in enumerate(inventory_items, start=1):
        sys_qty = item.get("quantity", 0)
        total_sys_units += sys_qty

        cond_display = {
            "brand_new": "Brand New (全新)",
            "minor_wear": "Minor Wear (微損/展示)",
            "damaged": "Damaged (瑕疵/隔離)",
        }.get(item.get("condition", ""), item.get("condition", ""))

        loc_code = item.get("location_code", "")
        aisle = item.get("aisle", "")
        shelf = item.get("shelf", "")
        bin_val = item.get("bin", "")
        formatted_loc = f"{aisle} / {shelf} / {bin_val} ({loc_code})" if aisle else loc_code

        row_fill = fill_even if idx % 2 == 0 else PatternFill(fill_type=None)

        values = [
            (idx, align_center, font_data),
            (item.get("isbn") or f"SKU-{item.get('product_id', 0):05d}", align_center, font_data),
            (item.get("product_title_en", ""), align_left, font_data_bold),
            (item.get("product_title_zh", ""), align_left, font_data),
            (item.get("category_name_en", ""), align_left, font_data),
            (item.get("warehouse_code", ""), align_center, font_data),
            (item.get("zone_name_en") or item.get("zone", ""), align_left, font_data),
            (formatted_loc, align_center, font_data),
            (cond_display, align_center, font_data),
            (sys_qty, align_right, font_data_bold),
            ("", align_center, font_data_bold),
            ("", align_center, font_data),
            ("", align_left, font_data),
        ]

        for col_idx, (val, cell_align, cell_font) in enumerate(values, start=1):
            cell = ws.cell(row=current_row, column=col_idx, value=val)
            cell.font = cell_font
            cell.alignment = cell_align
            cell.border = thin_border
            if col_idx == 11:
                cell.fill = fill_write_col
                cell.border = box_write_border
            elif row_fill.fill_type:
                cell.fill = row_fill

        ws.row_dimensions[current_row].height = 20
        current_row += 1

    # Total Summary Row
    summary_row = current_row
    ws.merge_cells(start_row=summary_row, start_column=1, end_row=summary_row, end_column=9)
    ws.cell(row=summary_row, column=1, value=f"Total Audited Line Items: {len(inventory_items)} SKUs").font = font_data_bold
    ws.cell(row=summary_row, column=1).alignment = align_left

    sum_cell = ws.cell(row=summary_row, column=10, value=total_sys_units)
    sum_cell.font = font_data_bold
    sum_cell.alignment = align_right

    for c in range(1, 14):
        ws.cell(row=summary_row, column=c).border = double_bottom_border

    ws.row_dimensions[summary_row].height = 22
    current_row += 3

    # Sign-off Blocks for Physical Auditor and Manager
    ws.cell(row=current_row, column=2, value="Stocktake Auditor Signature:").font = font_sign_label
    ws.cell(row=current_row, column=4, value="___________________________").font = font_sign_label
    ws.cell(row=current_row, column=7, value="Warehouse Supervisor Sign-off:").font = font_sign_label
    ws.cell(row=current_row, column=9, value="___________________________").font = font_sign_label

    current_row += 1
    ws.cell(row=current_row, column=2, value="Audit Date & Time:").font = font_sign_label
    ws.cell(row=current_row, column=4, value="____ / ____ / ________   ___:___").font = font_sign_label
    ws.cell(row=current_row, column=7, value="Approval Date & Time:").font = font_sign_label
    ws.cell(row=current_row, column=9, value="____ / ____ / ________   ___:___").font = font_sign_label

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()

