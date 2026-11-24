import io
import re
from typing import Any
import docx
from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Inches, Pt, RGBColor
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
    "book title": "title_en",
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
    h = re.sub(r"[\*:\uff1a]", "", h).strip()

    if h in COLUMN_KEY_MAP:
        return COLUMN_KEY_MAP[h]

    # Distinguish Chinese vs English sub-headers
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


def _set_cell_background(cell, hex_color: str):
    """Sets background color of a docx table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)


def _set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Sets cell margins (padding) in dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


# ===================== 1. WORD TEMPLATE GENERATOR =====================

def generate_word_template() -> bytes:
    """
    Generates a professionally styled Microsoft Word document (.docx)
    containing an official product catalog import table with sample books.
    """
    doc = Document()

    # Page Setup (Landscape orientation for wide catalog tables)
    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.7)
        section.right_margin = Inches(0.7)
        section.orientation = docx.enum.section.WD_ORIENT.LANDSCAPE
        section.page_width = Inches(11.0)
        section.page_height = Inches(8.5)

    # Document Title
    title_p = doc.add_paragraph()
    title_run = title_p.add_run("📚 Apex Book Haven - Product Catalog Import Form")
    title_run.font.name = "Calibri"
    title_run.font.size = Pt(20)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)  # Slate 800

    # Subtitle & Purpose
    sub_p = doc.add_paragraph()
    sub_run = sub_p.add_run("Official Bulk Book Import Template (Microsoft Word Document format - .docx)")
    sub_run.font.name = "Calibri"
    sub_run.font.size = Pt(11)
    sub_run.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)  # Slate 500

    # Instructions Callout
    inst_p = doc.add_paragraph()
    inst_run1 = inst_p.add_run("Instructions:\n")
    inst_run1.font.bold = True
    inst_run1.font.size = Pt(10)
    inst_run2 = inst_p.add_run(
        "1. Fill in your bookstore products into the table below. Each row corresponds to one book.\n"
        "2. Required fields: Title (EN or ZH) and Price (USD). All other metadata fields are optional.\n"
        "3. Upsert Mechanism: The system will match existing books by ISBN or English Title. Existing books are updated; new books are inserted.\n"
        "4. Auto Category: If the specified category doesn't exist yet, it will be automatically created in the database."
    )
    inst_run2.font.size = Pt(9.5)
    inst_run2.font.color.rgb = RGBColor(0x33, 0x41, 0x55)

    # Data Table
    headers = [
        "Category",
        "Title (EN) *",
        "Title (ZH) *",
        "Author (EN) *",
        "Author (ZH) *",
        "Price USD *",
        "ISBN",
        "Publisher",
        "Year",
        "Pages",
        "Format",
        "Recommended",
        "Image URL",
        "Short Description",
        "Full Synopsis",
    ]

    # Sample Books
    sample1 = [
        "Software Engineering",
        "Clean Architecture: A Craftsman's Guide",
        "無瑕的架構：整潔的軟體架構實踐",
        "Robert C. Martin",
        "羅伯特·C·馬丁 (Uncle Bob)",
        "42.99",
        "978-0134494166",
        "Prentice Hall",
        "2017",
        "432",
        "Paperback",
        "TRUE",
        "https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=600&auto=format&fit=crop&q=80",
        "Practical rules for software structures and patterns from legendary craftsman Uncle Bob.",
        "Building upon the success of his best-selling books Clean Code and The Clean Coder, Robert C. Martin reveals universal rules of software design and architecture.",
    ]

    sample2 = [
        "Art & Design",
        "The Design of Everyday Things",
        "設計的心理學：人性化的生活優良設計",
        "Don Norman",
        "唐·諾曼 (Don Norman)",
        "21.50",
        "978-0465050659",
        "Basic Books",
        "2013",
        "368",
        "Paperback Revised Edition",
        "TRUE",
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
        "The definitive guide to human-centered design by cognitive scientist Don Norman.",
        "Donald Norman explains how usability and ergonomics shape modern everyday technology and delightful human product experiences.",
    ]

    sample3 = [
        "Personal Growth",
        "Atomic Habits: An Easy & Proven Way to Build Good Habits",
        "原子習慣：細微改變帶來巨大成就的實證法則",
        "James Clear",
        "詹姆斯·克利爾 (James Clear)",
        "23.00",
        "978-0735211292",
        "Avery Publishing",
        "2018",
        "320",
        "Hardcover",
        "FALSE",
        "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&auto=format&fit=crop&q=80",
        "Transform your life with tiny changes that compound into remarkable remarkable results.",
        "A supremely practical framework for improving every day. James Clear uncovers the biological, cognitive, and environmental mechanisms behind habits.",
    ]

    rows_data = [sample1, sample2, sample3]

    table = doc.add_table(rows=1 + len(rows_data), cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True

    # Style Header Row
    header_tr = table.rows[0]
    header_tr._tr.get_or_add_trPr().append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

    for col_idx, h_text in enumerate(headers):
        cell = header_tr.cells[col_idx]
        _set_cell_background(cell, "1E293B")  # Slate 800
        _set_cell_margins(cell, top=120, bottom=120, left=100, right=100)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h_text)
        run.font.name = "Calibri"
        run.font.size = Pt(8.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    # Style Data Rows
    for row_idx, r_vals in enumerate(rows_data, start=1):
        tr = table.rows[row_idx]
        bg_color = "FFFFFF" if row_idx % 2 == 1 else "F8FAFC"  # Alternate shading
        for col_idx, val in enumerate(r_vals):
            cell = tr.cells[col_idx]
            _set_cell_background(cell, bg_color)
            _set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            run = p.add_run(str(val))
            run.font.name = "Calibri"
            run.font.size = Pt(8)
            run.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

    # Footer note
    doc.add_paragraph()
    footer_p = doc.add_paragraph()
    footer_run = footer_p.add_run("Tip: You can add more rows directly to the table above in Microsoft Word, Google Docs, or LibreOffice, then upload the file back to the Apex Bookstore portal.")
    footer_run.font.name = "Calibri"
    footer_run.font.size = Pt(8.5)
    footer_run.font.italic = True
    footer_run.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

    stream = io.BytesIO()
    doc.save(stream)
    stream.seek(0)
    return stream.getvalue()


# ===================== 2. WORD PARSER & DATABASE IMPORTER =====================

def import_books_from_word(db: Session, file_contents: bytes, filename: str) -> dict:
    """
    Parses an uploaded Microsoft Word document (.docx), extracts book records
    from tables or key-value entries, resolves/creates categories, and performs
    an intelligent Upsert into C00_Product & C00_ProdDetail in PostgreSQL.
    """
    try:
        doc = Document(io.BytesIO(file_contents))
    except Exception as exc:
        return {
            "success": False,
            "filename": filename,
            "total_rows": 0,
            "inserted": 0,
            "updated": 0,
            "failed": 0,
            "errors": [{"row": 0, "reason": f"Invalid or corrupted Word document (.docx): {str(exc)}"}],
            "imported_books": [],
        }

    # Extract parsed book candidate dictionaries
    candidates: list[dict[str, Any]] = []

    # Strategy 1: Grid Tables (Row 0 = headers, Rows 1..N = book records)
    for t_idx, table in enumerate(doc.tables):
        if len(table.rows) < 2:
            continue

        # Check if row 0 has headers
        col_map: dict[int, str] = {}
        header_row = table.rows[0]
        for col_idx, cell in enumerate(header_row.cells):
            cell_text = cell.text.strip()
            norm = normalize_header(cell_text)
            if norm:
                col_map[col_idx] = norm

        # If title_en or title_zh is found in header row, it is a Grid Table
        if "title_en" in col_map.values() or "title_zh" in col_map.values():
            for r_idx in range(1, len(table.rows)):
                row_cells = table.rows[r_idx].cells
                book_data: dict[str, Any] = {}
                has_content = False

                for c_idx, key in col_map.items():
                    if c_idx < len(row_cells):
                        val = row_cells[c_idx].text.strip()
                        if val:
                            has_content = True
                            book_data[key] = val

                if has_content:
                    book_data["_source"] = f"Table #{t_idx+1}, Row #{r_idx+1}"
                    candidates.append(book_data)

        # Strategy 2: Two-Column Key-Value Table (Column 0 = Field, Column 1 = Value)
        elif len(header_row.cells) == 2:
            kv_book: dict[str, Any] = {}
            for r_idx, row in enumerate(table.rows):
                if len(row.cells) >= 2:
                    k_text = row.cells[0].text.strip()
                    v_text = row.cells[1].text.strip()
                    norm_k = normalize_header(k_text)
                    if norm_k and v_text:
                        kv_book[norm_k] = v_text
            if "title_en" in kv_book or "title_zh" in kv_book:
                kv_book["_source"] = f"Table #{t_idx+1} (Key-Value)"
                candidates.append(kv_book)

    # Strategy 3: Text Paragraphs fallback if no valid tables were detected
    if not candidates:
        current_book: dict[str, Any] = {}
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                if "title_en" in current_book or "title_zh" in current_book:
                    candidates.append(current_book)
                    current_book = {}
                continue

            # Check if paragraph is a separator
            if text.startswith("---") or text.startswith("==="):
                if "title_en" in current_book or "title_zh" in current_book:
                    candidates.append(current_book)
                    current_book = {}
                continue

            if ":" in text or "：" in text:
                sep = ":" if ":" in text else "："
                parts = text.split(sep, 1)
                k = normalize_header(parts[0].strip())
                v = parts[1].strip()
                if k and v:
                    current_book[k] = v

        if "title_en" in current_book or "title_zh" in current_book:
            candidates.append(current_book)

    if not candidates:
        return {
            "success": False,
            "filename": filename,
            "total_rows": 0,
            "inserted": 0,
            "updated": 0,
            "failed": 0,
            "errors": [
                {
                    "row": 0,
                    "reason": "No book product data could be detected in Word document. Please use the official Word template table.",
                }
            ],
            "imported_books": [],
        }

    # Category Cache
    categories = db.query(models.C00_Category).all()
    cat_map: dict[str, models.C00_Category] = {}
    for c in categories:
        cat_map[c.name_en.lower()] = c
        cat_map[c.name_zh.lower()] = c

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

    # Process candidates
    for idx, c_data in enumerate(candidates, start=1):
        raw_title_en = str(c_data.get("title_en", "")).strip()
        raw_title_zh = str(c_data.get("title_zh", "")).strip()

        if not raw_title_en and not raw_title_zh:
            failed_count += 1
            errors.append({
                "row": idx,
                "reason": f"Row #{idx} skipped: Book title (English or Chinese) is required.",
            })
            continue

        title_en = raw_title_en or raw_title_zh
        title_zh = raw_title_zh or raw_title_en

        # Author
        author_en = str(c_data.get("author_en", "")).strip() or "Various Authors"
        author_zh = str(c_data.get("author_zh", "")).strip() or "各大名家"

        # Price parsing
        raw_price = c_data.get("price")
        price = 0.0
        try:
            if raw_price is not None:
                clean_p = str(raw_price).replace("$", "").replace("¥", "").replace(",", "").strip()
                price = round(float(clean_p), 2)
                if price < 0:
                    price = 0.0
        except Exception:
            failed_count += 1
            errors.append({
                "row": idx,
                "title": title_en,
                "reason": f"Invalid price '{raw_price}'. Must be a valid numeric price.",
            })
            continue

        # Category
        cat_en_name = str(c_data.get("category_en", "")).strip()
        cat_zh_name = str(c_data.get("category_zh", "")).strip()
        matched_cat = None

        if cat_en_name and cat_en_name.lower() in cat_map:
            matched_cat = cat_map[cat_en_name.lower()]
        elif cat_zh_name and cat_zh_name.lower() in cat_map:
            matched_cat = cat_map[cat_zh_name.lower()]
        elif cat_en_name or cat_zh_name:
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
        raw_isbn = str(c_data.get("isbn", "")).strip()
        isbn = raw_isbn if raw_isbn else None

        # Details
        publisher_en = str(c_data.get("publisher_en", "")).strip() or "Apex Publishing"
        publisher_zh = str(c_data.get("publisher_zh", "")).strip() or "文萃文化"
        format_en = str(c_data.get("format_en", "")).strip() or "Paperback"
        format_zh = str(c_data.get("format_zh", "")).strip() or "平裝版"

        try:
            pub_year = int(c_data.get("publication_year", 2024))
        except Exception:
            pub_year = 2024

        try:
            pages = int(c_data.get("page_count", 250))
        except Exception:
            pages = 250

        raw_rec = str(c_data.get("is_recommended", "false")).strip().lower()
        is_rec = raw_rec in ("true", "1", "yes", "y", "t", "是", "真")

        short_desc_en = str(c_data.get("short_desc_en", "")).strip() or f"Curated edition of {title_en}."
        short_desc_zh = str(c_data.get("short_desc_zh", "")).strip() or f"文萃讀坊嚴選推薦：《{title_zh}》。"
        full_synopsis_en = str(c_data.get("full_synopsis_en", "")).strip() or short_desc_en
        full_synopsis_zh = str(c_data.get("full_synopsis_zh", "")).strip() or short_desc_zh

        image_url = str(c_data.get("image_url", "")).strip()
        if not image_url or not image_url.startswith("http"):
            image_url = "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&auto=format&fit=crop&q=80"

        # ----------------- UPSERT LOGIC -----------------
        existing_product = None

        if isbn:
            detail_match = db.query(models.C00_ProdDetail).filter(models.C00_ProdDetail.isbn == isbn).first()
            if detail_match and detail_match.product:
                existing_product = detail_match.product

        if not existing_product:
            existing_product = db.query(models.C00_Product).filter(
                models.C00_Product.title_en.ilike(title_en)
            ).first()

        try:
            if existing_product:
                # Update existing
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
                # Insert new product
                new_product = models.C00_Product(
                    category_id=matched_cat.id,
                    title_en=title_en,
                    title_zh=title_zh,
                    author_en=author_en,
                    author_zh=author_zh,
                    price=price,
                    image_url=image_url,
                    short_desc_en=short_desc_en,
                    short_desc_zh=short_desc_zh,
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
                    isbn=isbn or f"AUTO-{new_product.id}",
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
        except Exception as e:
            failed_count += 1
            errors.append({
                "row": idx,
                "title": title_en,
                "reason": f"Database error while saving book: {str(e)}",
            })

    db.commit()

    return {
        "success": (inserted_count + updated_count) > 0 and failed_count == 0,
        "filename": filename,
        "total_rows": len(candidates),
        "inserted": inserted_count,
        "updated": updated_count,
        "failed": failed_count,
        "errors": errors,
        "imported_books": imported_books,
    }
