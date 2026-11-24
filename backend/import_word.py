"""
Apex Bookstore - Command Line Word Document (.docx) Importer & Template Generator
Usage:
    python import_word.py <path_to_word_file.docx>
    python import_word.py --template [optional_output_path.docx]
"""

import os
import sys
from app.database import SessionLocal
from app.word_service import generate_word_template, import_books_from_word


def main():
    if len(sys.argv) < 2:
        print("=" * 60)
        print("  Apex Bookstore - Word Document (.docx) Book Importer CLI")
        print("=" * 60)
        print("Usage:")
        print("  1. Import a Word document into PostgreSQL:")
        print("     python import_word.py <file.docx>")
        print("\n  2. Generate a clean, styled Word template:")
        print("     python import_word.py --template [output.docx]")
        print("=" * 60)
        sys.exit(0)

    arg = sys.argv[1].strip()

    # 1. Generate Template
    if arg in ("--template", "-t"):
        out_path = sys.argv[2] if len(sys.argv) > 2 else "apex_books_template.docx"
        print(f"Generating Word template to: {out_path} ...")
        content = generate_word_template()
        with open(out_path, "wb") as f:
            f.write(content)
        print(f" Template successfully generated: {os.path.abspath(out_path)}")
        sys.exit(0)

    # 2. Import Word Document
    word_file = arg
    if not os.path.exists(word_file):
        print(f" Error: File not found: {word_file}")
        sys.exit(1)

    print(f"Reading file: {word_file} ...")
    with open(word_file, "rb") as f:
        file_bytes = f.read()

    db = SessionLocal()
    try:
        print("Parsing tables and importing to PostgreSQL database...")
        res = import_books_from_word(db, file_bytes, os.path.basename(word_file))

        print("\n" + "=" * 50)
        print(f"  Word Import Summary: {res['filename']}")
        print("=" * 50)
        print(f"• Total Rows Processed : {res['total_rows']}")
        print(f"• Books Newly Inserted : {res['inserted']}")
        print(f"• Books Updated        : {res['updated']}")
        print(f"• Failed Rows          : {res['failed']}")

        if res["imported_books"]:
            print("\n  Successfully Processed Books:")
            for b in res["imported_books"]:
                print(f"  [{b['action']}] #{b['id']} {b['title_en']} - ${b['price']:.2f}")

        if res["errors"]:
            print("\n  Warnings / Errors:")
            for err in res["errors"]:
                print(f"  • Row #{err.get('row')}: {err.get('reason')}")

        print("=" * 50)
        print("✅ Finished.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
