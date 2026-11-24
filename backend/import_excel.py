"""
Apex Bookstore - Command Line Excel Importer & Template Generator
Usage:
    python import_excel.py <path_to_excel_file.xlsx>
    python import_excel.py --template [optional_output_path.xlsx]
"""

import os
import sys
from app.database import SessionLocal
from app.excel_service import generate_excel_template, import_books_from_excel


def main():
    if len(sys.argv) < 2:
        print("=" * 60)
        print("  Apex Bookstore - Excel Book Importer CLI")
        print("=" * 60)
        print("Usage:")
        print("  1. Import an Excel file into PostgreSQL:")
        print("     python import_excel.py <file.xlsx>")
        print("\n  2. Generate a clean, styled Excel template:")
        print("     python import_excel.py --template [output.xlsx]")
        print("=" * 60)
        sys.exit(0)

    arg = sys.argv[1].strip()

    # 1. Generate Template
    if arg in ("--template", "-t"):
        out_path = sys.argv[2] if len(sys.argv) > 2 else "apex_books_template.xlsx"
        print(f"Generating Excel template to: {out_path} ...")
        content = generate_excel_template()
        with open(out_path, "wb") as f:
            f.write(content)
        print(f" Template successfully generated: {os.path.abspath(out_path)}")
        sys.exit(0)

    # 2. Import Excel
    excel_file = arg
    if not os.path.exists(excel_file):
        print(f" Error: File not found: {excel_file}")
        sys.exit(1)

    print(f"Reading file: {excel_file} ...")
    with open(excel_file, "rb") as f:
        file_bytes = f.read()

    db = SessionLocal()
    try:
        print("Parsing rows and importing to PostgreSQL database...")
        res = import_books_from_excel(db, file_bytes, os.path.basename(excel_file))
        
        print("\n" + "=" * 50)
        print(f"  Excel Import Summary: {res['filename']}")
        print("=" * 50)
        print(f"• Total Rows Processed : {res['total_rows']}")
        print(f"• Books Newly Inserted : {res['inserted']}")
        print(f"• Books Updated        : {res['updated']}")
        print(f"• Failed Rows          : {res['failed']}")

        if res["imported_books"]:
            print("\n--- Books Successfully Processed ---")
            for b in res["imported_books"]:
                print(f"  [{b['action']}] ID #{b['id']}: {b['title_en']} ({b['title_zh']}) - ${b['price']:.2f}")

        if res["errors"]:
            print("\n--- Errors / Skipped Rows ---")
            for err in res["errors"]:
                print(f"  Row #{err['row']}: {err['reason']}")

        print("=" * 50)
        if res["success"]:
            print(" Import completed successfully!")
        else:
            print(" Import finished with some errors (see above).")

    finally:
        db.close()


if __name__ == "__main__":
    main()
