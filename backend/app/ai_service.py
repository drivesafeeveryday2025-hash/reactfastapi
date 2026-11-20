import os
import re
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session, joinedload
from . import models

# Constants for rate limiting
MAX_MESSAGES_PER_MINUTE = 5
MAX_MESSAGES_PER_DAY = 40

STOP_WORDS = {
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "a", "an", "the", "and", "but", "if", "or", "because",
    "as", "until", "while", "of", "at", "by", "for", "with", "about", "against",
    "between", "into", "through", "during", "before", "after", "above", "below",
    "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
    "further", "then", "once", "here", "there", "when", "where", "why", "how",
    "all", "any", "both", "each", "few", "more", "most", "other", "some", "such",
    "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can",
    "will", "just", "should", "now", "i", "me", "my", "myself", "we", "our",
    "ours", "you", "your", "yours", "it", "its", "they", "them", "their", "what",
    "which", "who", "this", "that", "thie", "these", "those", "one", "two", "work",
    "working", "tell", "show", "give", "want", "like", "know", "need"
}


def scrub_pii(text: str) -> str:
    """Redacts phone numbers, emails, and credit cards before passing to any processor."""
    text = re.sub(r"[\w\.-]+@[\w\.-]+\.\w+", "[REDACTED_EMAIL]", text)
    text = re.sub(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b", "[REDACTED_CARD]", text)
    text = re.sub(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b", "[REDACTED_PHONE]", text)
    return text


def enforce_chat_rate_limit(db: Session, user_id: int, ip_address: str):
    """
    Sliding window rate-limiter:
    - 5 messages per 60 seconds
    - 40 messages per 24 hours
    Blocks automated spam scripts with HTTP 429.
    """
    now = datetime.now(timezone.utc)
    record = db.query(models.S00_ChatRateLimit).filter(models.S00_ChatRateLimit.user_id == user_id).first()

    if not record:
        record = models.S00_ChatRateLimit(
            user_id=user_id,
            ip_address=ip_address,
            message_count_minute=1,
            message_count_day=1,
            window_start=now,
            day_start=now,
        )
        db.add(record)
        db.commit()
        return

    # Check 24-hour daily quota
    if now - record.day_start > timedelta(days=1):
        record.day_start = now
        record.message_count_day = 1
    else:
        if record.message_count_day >= MAX_MESSAGES_PER_DAY:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily chat limit of {MAX_MESSAGES_PER_DAY} messages reached. Please return tomorrow.",
            )
        record.message_count_day += 1

    # Check 60-second burst limit
    if now - record.window_start > timedelta(seconds=60):
        record.window_start = now
        record.message_count_minute = 1
    else:
        if record.message_count_minute >= MAX_MESSAGES_PER_MINUTE:
            remaining_seconds = 60 - int((now - record.window_start).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded (max 5 msgs/min). Please wait {remaining_seconds} seconds before sending another message.",
            )
        record.message_count_minute += 1

    record.ip_address = ip_address
    db.commit()


# ===================== INTERNAL GROUNDED DATABASE TOOLS =====================

def query_knowledge_base(db: Session, query: str) -> list[models.C00_KnowledgeBase]:
    """Retrieves matching policies, return guidelines, FAQs, or support answers using precise keyword matching."""
    query_lower = query.lower()
    all_faqs = db.query(models.C00_KnowledgeBase).filter(models.C00_KnowledgeBase.is_active.is_(True)).all()
    matches = []

    for faq in all_faqs:
        kw_list = [k.strip().lower() for k in faq.keywords.split(",")]
        score = 0
        for kw in kw_list:
            if not kw:
                continue
            if re.search(r"[\u4e00-\u9fff]", kw):
                # Chinese keyword: require at least 2 chars and substring match
                if len(kw) >= 2 and kw in query_lower:
                    score += 2
            else:
                # English keyword: exact word match via word boundary to avoid substring false positives
                if len(kw) >= 3 and kw not in STOP_WORDS:
                    if re.search(rf"\b{re.escape(kw)}\b", query_lower):
                        score += 2

        # Check key terms in the questions (only meaningful 4+ letter non-stop words)
        for w in re.findall(r"[a-zA-Z]{4,}", faq.question_en.lower()):
            if w not in STOP_WORDS and re.search(rf"\b{re.escape(w)}\b", query_lower):
                score += 1

        if score >= 2:
            matches.append((score, faq))

    matches.sort(key=lambda x: x[0], reverse=True)
    return [m[1] for m in matches[:2]]


def search_store_books(db: Session, keywords: list[str]) -> list[models.C00_Product]:
    """Strictly queries books present in the store's PostgreSQL inventory."""
    valid_keywords = [k.strip().lower() for k in keywords if len(k.strip()) >= 2 and k.strip().lower() not in STOP_WORDS]
    if not valid_keywords:
        return []

    filters = []
    for kw in valid_keywords:
        filters.append(models.C00_Product.title_en.ilike(f"%{kw}%"))
        filters.append(models.C00_Product.title_zh.ilike(f"%{kw}%"))
        filters.append(models.C00_Product.short_desc_en.ilike(f"%{kw}%"))
        filters.append(models.C00_Product.short_desc_zh.ilike(f"%{kw}%"))

    return (
        db.query(models.C00_Product)
        .options(joinedload(models.C00_Product.detail))
        .filter(models.C00_Product.is_active.is_(True), or_(*filters))
        .limit(4)
        .all()
    )


def get_store_bestsellers_summary(db: Session, limit: int = 5) -> list[models.C00_Product]:
    """Computes actual bestseller rankings from C00_order_items."""
    sales_subquery = (
        db.query(
            models.C00_OrderItem.product_id,
            func.coalesce(func.sum(models.C00_OrderItem.quantity), 0).label("total_sold"),
        )
        .group_by(models.C00_OrderItem.product_id)
        .subquery()
    )

    return (
        db.query(models.C00_Product)
        .outerjoin(sales_subquery, models.C00_Product.id == sales_subquery.c.product_id)
        .options(joinedload(models.C00_Product.detail))
        .filter(models.C00_Product.is_active.is_(True))
        .order_by(desc(sales_subquery.c.total_sold), desc(models.C00_Product.price))
        .limit(limit)
        .all()
    )


# ===================== UNIFIED INTENT ROUTER & AI ORCHESTRATOR =====================

def process_chat_message(db: Session, user_message: str, is_zh: bool = True) -> tuple[str, str, list[str]]:
    """
    1. Analyzes intent safely
    2. Executes grounded SQL queries
    3. Synthesizes a response strictly grounded on store data
    Returns: (reply_text, intent_name, sources_list)
    """
    clean_msg = scrub_pii(user_message).strip()
    lower_msg = clean_msg.lower()

    # 1. SECURITY REFUSAL: Password / Account Credentials Request
    if any(k in lower_msg for k in ["password", "密碼", "帳號密碼", "我的密碼"]):
        refusal = (
            "基於資安與個人隱私防護，文萃讀坊所有用戶密碼均以高強度單向雜湊（Argon2）加密儲存，系統與客服人員皆無法查閱您的密碼。\n\n"
            "若您忘記密碼，請於登入畫面點擊「忘記密碼」連結，系統將發送安全的重設密碼驗證信至您的註冊電子信箱。"
            if is_zh else
            "For security and privacy reasons, customer passwords are stored using one-way Argon2 cryptographic hashing and cannot be retrieved by staff or AI.\n\n"
            "If you forgot your password, please use the 'Forgot Password' link on the sign-in screen to securely reset your credentials."
        )
        return refusal, "SECURITY_REFUSAL", ["Security Policy"]

    # 2. INTENT: Greeting / Status Check / Capability Inquiries
    # E.g. "is this working?", "is thie one work?", "hello", "hi", "testing", "are you alive"
    status_patterns = [
        r"\b(is|does|are)\b.*\b(this|thie|it|one|you)\b.*\b(work|working|alive|ok|online)\b",
        r"\b(work|working|alive|online)\b.*\b(you|this|thie|it|one)\b",
        r"\b(hi|hello|hey|greetings|howdy)\b",
        r"\b(test|testing)\b",
        r"\bwho are you\b",
        r"\bwhat can you do\b",
    ]
    is_status_or_greeting = any(re.search(pat, lower_msg) for pat in status_patterns) or any(
        k in lower_msg for k in ["你好", "嗨", "哈囉", "在嗎", "你是誰", "可以做什麼", "有什麼功能", "測試", "正常嗎", "有在運作嗎", "有上班嗎"]
    )
    # Ensure it's not a specific product search masquerading as a greeting
    has_specific_keywords = any(k in lower_msg for k in ["書", "退款", "退貨", "破損", "運費", "買", "排行", "暢銷", "推薦", "book", "refund", "shipping", "rank"])

    if is_status_or_greeting and not has_specific_keywords:
        welcome_reply = (
            "您好！我是文萃讀坊（Apex Book Haven）的 AI 智能助理，系統正全天候為您服務中！\n\n"
            "您可以向我詢問書店相關問題，例如：\n"
            "• 📦 瑕疵書籍如何退款與換貨？（享 7 天免費到府換新）\n"
            "• 🚚 運費計算與到貨時間？（單筆滿 $35 即享免運）\n"
            "• 🎁 免費精緻送禮包裝與會員獨家權益\n"
            "• 📊 本店門市真實銷售排行榜 Top 5\n"
            "• 📖 針對不同喜好（如國小學生、遊戲迷、軟體工程師）的推薦好書\n\n"
            "請問今天想找哪本好書或了解什麼門市資訊呢？"
            if is_zh else
            "Hello! Yes, I am working properly and ready to assist you! I am your AI assistant at Apex Book Haven.\n\n"
            "Feel free to ask me anything about our bookstore, including:\n"
            "• 📦 How to return a damaged book (7-day free return & replacement)\n"
            "• 🚚 Delivery times & shipping fees (free shipping on orders over $35)\n"
            "• 🎁 Complimentary gift wrapping & exclusive member perks\n"
            "• 📊 Store official Bestseller Top 5 (computed strictly from our store sales)\n"
            "• 📖 Curated book recommendations for students, gamers, or software engineers\n\n"
            "How can I help you find your next great read today?"
        )
        return welcome_reply, "GREETING_OR_STATUS", ["Store Directory"]

    # 3. INTENT: Store Location, Hours, Contact
    # E.g. "where are you located", "address", "opening hours", "phone"
    if any(k in lower_msg for k in ["address", "location", "located", "hours", "opening", "phone", "contact", "地址", "營業時間", "門市", "電話", "聯絡", "在哪裡"]):
        setting = db.query(models.C00_SiteSetting).first()
        if setting:
            store_reply = (
                f"【文萃讀坊 (Apex Book Haven) 門市資訊】：\n"
                f"• 實體門市地址：{setting.address_zh}\n"
                f"• 營業時間：{setting.opening_hours_zh}\n"
                f"• 客服電話：{setting.phone}\n"
                f"• 電子郵件：{setting.email}\n\n"
                f"歡迎親臨書店沉浸於書香氛圍，我們現場備有閱讀座位區與手沖精品咖啡！"
                if is_zh else
                f"【Apex Book Haven Store Information】:\n"
                f"• Address: {setting.address_en}\n"
                f"• Hours: {setting.opening_hours_en}\n"
                f"• Phone: {setting.phone}\n"
                f"• Email: {setting.email}\n\n"
                f"We welcome you to visit our physical sanctuary in the Culture District to browse editions and enjoy artisan coffee!"
            )
            return store_reply, "STORE_LOCATION_HOURS", ["Store Settings"]

    # 4. INTENT: Discounts & Promotions
    # E.g. "discount", "promotion", "coupon", "code", "折扣", "優惠", "特價"
    if any(k in lower_msg for k in ["discount", "promotion", "promo", "coupon", "code", "deal", "折扣", "優惠", "優惠券", "折扣碼", "特價", "特惠"]):
        promos = db.query(models.C00_Promotion).filter(models.C00_Promotion.is_active.is_(True)).all()
        if promos:
            promo_lines = [
                f"• {p.title_zh if is_zh else p.title_en} 【{p.badge_zh if is_zh else p.badge_en}】" + (f" (折扣碼：`{p.discount_code}`)" if p.discount_code else "")
                for p in promos
            ]
            promo_reply = (
                "文萃讀坊目前正熱烈進行以下館內優惠活動：\n\n" +
                "\n".join(promo_lines) +
                "\n\n在購物車結帳時輸入折扣碼即可享有折扣優惠！"
                if is_zh else
                "Apex Book Haven is currently offering the following promotions:\n\n" +
                "\n".join(promo_lines) +
                "\n\nEnter the discount code at checkout to claim your savings!"
            )
            return promo_reply, "STORE_PROMOTIONS", [p.title_en for p in promos]

    # 5. INTENT: Bestseller / Ranking
    if any(k in lower_msg for k in ["best", "bestsell", "rank", "暢銷", "熱銷", "排行"]):
        bestsellers = get_store_bestsellers_summary(db, limit=5)
        if bestsellers:
            book_lines = [
                f"{idx + 1}. 《{b.title_zh if is_zh else b.title_en}》 - {b.author_zh if is_zh else b.author_en} (${b.price:.2f})"
                for idx, b in enumerate(bestsellers)
            ]
            intro = (
                "這是文萃讀坊本門市的【真實銷售排行榜 Top 5】（數據嚴格統計自本店訂單紀錄，現貨在庫）：\n\n"
                if is_zh else
                "Here is the official Top 5 Bestsellers list strictly from Apex Book Haven's store sales records:\n\n"
            )
            return intro + "\n".join(book_lines), "STORE_BESTSELLERS", [b.title_en for b in bestsellers]

    # 6. INTENT: Policy / Returns / Shipping / Gift Wrap / Membership / Tech / Payment
    faq_matches = query_knowledge_base(db, clean_msg)
    if faq_matches:
        top_faq = faq_matches[0]
        answer = top_faq.answer_zh if is_zh else top_faq.answer_en
        return answer, f"POLICY_{top_faq.topic.upper()}", [top_faq.topic]

    # 7. INTENT: Demographic & Profile Book Recommendations
    # E.g. "Elementary school boy / kids"
    if any(k in lower_msg for k in ["elementary", "child", "kid", "boy", "國小", "小學生", "兒童", "小孩"]):
        books = search_store_books(db, ["prince", "小王子", "文學"])
        if books:
            b = books[0]
            reply = (
                f"針對國小學童與孩子閱讀，店長首推我們的典藏名著《{b.title_zh if is_zh else b.title_en}》（作者：{b.author_zh if is_zh else b.author_en}，價格：${b.price:.2f}）！\n\n"
                f"【推薦理由】：全書文字優美並富含精美全彩插畫，透過純真的眼眸探索友誼、責任與關懷，是一部啟發想像力與同理心的必讀經典首選！"
                if is_zh else
                f"For young readers and elementary school students, our #1 recommendation is '{b.title_en}' by {b.author_en} (${b.price:.2f})!\n\n"
                f"Why it's perfect: It features timeless wisdom and full-color illustrations, inspiring imagination, empathy, and the joy of reading."
            )
            return reply, "DEMOGRAPHIC_RECOMMENDATION", [b.title_en]

    # E.g. "Gamer / Internet user"
    if any(k in lower_msg for k in ["game", "gamer", "video game", "電玩", "打電動", "遊戲", "上網"]):
        books = search_store_books(db, ["dune", "沙丘", "design", "設計"])
        if books:
            book_lines = [
                f"• 《{b.title_zh if is_zh else b.title_en}》 (${b.price:.2f})：{b.short_desc_zh if is_zh else b.short_desc_en}"
                for b in books[:2]
            ]
            reply = (
                "對於喜愛電玩冒險與網路科技的朋友，為您推薦本店兩部極具共鳴的好書：\n\n" +
                "\n\n".join(book_lines) +
                "\n\n《沙丘》擁有宛如 3A 遊戲般的宏大星際史詩世界觀；而《設計的心理學》則揭密了遊戲與介面如何巧妙引導玩家行為！"
                if is_zh else
                "For video game and tech enthusiasts, we recommend these two captivating titles from our inventory:\n\n" +
                "\n\n".join(book_lines)
            )
            return reply, "GAMER_RECOMMENDATION", [b.title_en for b in books]

    # E.g. "Trendy programming language / coding"
    if any(k in lower_msg for k in ["program", "code", "coding", "language", "python", "react", "程式", "技術"]):
        books = search_store_books(db, ["clean", "code", "無瑕"])
        if books:
            b = books[0]
            reply = (
                f"當前熱門的程式語言為 Python、TypeScript (React) 與 Rust！而在軟體工程領域，無論學習哪種語言，最核心的工藝經典莫過於本店暢銷作《{b.title_zh if is_zh else b.title_en}》（價格：${b.price:.2f}）。\n\n"
                f"本書教導軟體架構重構、清晰命名與專業測試思維，是每位工程師必備的殿堂手冊！"
                if is_zh else
                f"The most trendy languages today are Python, TypeScript (React), and Rust! Regardless of the language you choose, our top software craftsmanship classic is '{b.title_en}' (${b.price:.2f})."
            )
            return reply, "TECH_RECOMMENDATION", [b.title_en]

    # E.g. "Japanese language / foreign books"
    if any(k in lower_msg for k in ["japanese", "japan", "日本", "日語", "日文"]):
        books = search_store_books(db, ["日本", "日文", "japanese"])
        if not books:
            reply = (
                "很抱歉，文萃讀坊目前的實體現貨庫存中暫時沒有「日本語言學習」相關專書。\n\n"
                "我們目前的典藏重點在於【世界經典文學、資訊與程式工藝、心理成長與設計】。歡迎您瀏覽我們的暢銷榜單，或聯絡客服登記預購！"
                if is_zh else
                "We do not currently carry Japanese language learning titles in our active store inventory.\n\n"
                "Our current catalog specializes in World Literature, Software Engineering, Personal Growth, and Design. Feel free to explore our featured bestsellers!"
            )
            return reply, "BOOK_SEARCH_EMPTY", []

    # 8. GENERAL INVENTORY BOOK SEARCH FALLBACK
    search_terms = [w for w in re.findall(r"[\w\u4e00-\u9fff]+", lower_msg) if len(w) > 1 and w not in STOP_WORDS]
    if search_terms:
        matching_books = search_store_books(db, search_terms)
        if matching_books:
            book_lines = [
                f"• 《{b.title_zh if is_zh else b.title_en}》 (${b.price:.2f})：{b.short_desc_zh if is_zh else b.short_desc_en}"
                for b in matching_books
            ]
            reply = (
                "在文萃讀坊為您找到以下相符的館藏好書：\n\n" + "\n\n".join(book_lines)
                if is_zh else
                "Here are the matching books from our bookstore catalog:\n\n" + "\n\n".join(book_lines)
            )
            return reply, "BOOK_SEARCH_MATCH", [b.title_en for b in matching_books]

    # 9. DEFAULT POLITE LITERARY ASSISTANT RESPONSE
    fallback_reply = (
        "您好！我是文萃讀坊的智能助理。您可以向我詢問：\n"
        "• 📦 瑕疵書籍如何退款退貨？（提供 7 天免費到府換新）\n"
        "• 🚚 運費與配送需要多久？（滿 $35 即享免運）\n"
        "• 🎁 送禮包裝與會員專屬優惠\n"
        "• 📊 店長本期真實暢銷排行榜 Top 5\n"
        "• 📖 針對國小學童、遊戲愛好者或工程師的精選推薦好書\n"
        "• 📍 實體門市地址與營業時間"
        if is_zh else
        "Hello! I am your assistant at Apex Book Haven. Feel free to ask me about:\n"
        "• 📦 How to return a damaged book (7-day free return policy)\n"
        "• 🚚 Delivery time & shipping fees (free shipping over $35)\n"
        "• 🎁 Gift wrapping & member benefits\n"
        "• 📊 Our store's official Bestseller Top 5\n"
        "• 📖 Book recommendations for young readers, gamers, or software engineers\n"
        "• 📍 Store location and opening hours"
    )
    return fallback_reply, "GENERAL_HELP", ["Store Guide"]
