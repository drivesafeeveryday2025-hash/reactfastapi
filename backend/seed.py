from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import (
    C00_Category,
    C00_KnowledgeBase,
    C00_Order,
    C00_OrderItem,
    C00_ProdDetail,
    C00_Product,
    C00_Promotion,
    C00_SiteSetting,
    S00_Role,
    S00_User,
)

# Recreate all tables cleanly
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
db = SessionLocal()

# 1. System Roles & Demo Users
role_cust = S00_Role(name="customer")
role_admin = S00_Role(name="admin")
role_staff = S00_Role(name="staff")
db.add_all([role_cust, role_admin, role_staff])

user_admin = S00_User(
    email="admin@apex.local",
    hashed_password=hash_password("admin123"),
)
user_customer = S00_User(
    email="customer@apex.local",
    hashed_password=hash_password("user123"),
)
db.add_all([user_admin, user_customer])
db.flush()

# 2. Site Settings (Bilingual: English & Traditional Chinese)
db.add(
    C00_SiteSetting(
        store_name_en="Apex Book Haven",
        store_name_zh="文萃讀坊 (Apex Books)",
        hero_title_en="Curated Stories & Timeless Wisdom for Curious Minds",
        hero_title_zh="為熱愛探索的心靈，精選世界好書與智慧",
        hero_subtitle_en="Explore bestselling fiction, transformative personal growth, and cutting-edge tech literature. Free shipping on orders over $35.",
        hero_subtitle_zh="發掘暢銷小說、心靈成長典範與前沿科技經典。單筆滿額即享免運直送到府。",
        about_text_en="Founded in 2018, Apex Book Haven is an independent sanctuary for bibliophiles, thinkers, and lifelong learners. We believe every great book holds the power to spark curiosity, shift perspectives, and transform lives. Our curators hand-select each edition with care.",
        about_text_zh="文萃讀坊創立於 2018 年，是愛書人、思想家與終身學習者的精神綠洲。我們深信一本好書擁有啟發思維、轉變觀點與點亮人生的力量。每本上架書籍均由資深選書團隊嚴選。",
        address_en="88 Literature Blvd, Culture District, Taipei",
        address_zh="台北市文藝特區 文學大道 88 號",
        phone="+886 (02) 2345-6789",
        email="hello@apexbookhaven.com",
        opening_hours_en="Mon - Sun: 10:00 AM - 09:30 PM",
        opening_hours_zh="週一至週日：10:00 - 21:30",
    )
)

# 3. Promotions
db.add_all([
    C00_Promotion(
        title_en="Autumn Literary Festival: 20% Off Best Sellers",
        title_zh="秋季讀書節：精選暢銷書享 8 折優惠",
        badge_en="20% OFF",
        badge_zh="限時 8 折",
        discount_code="READ20",
        image_url="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=80",
    ),
    C00_Promotion(
        title_en="Student & Educator Reading Bundle",
        title_zh="學生與教育工作者專屬閱讀組合",
        badge_en="BUNDLE DEAL",
        badge_zh="超值套書",
        discount_code="EDUBOOK",
        image_url="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&auto=format&fit=crop&q=80",
    ),
    C00_Promotion(
        title_en="Weekend Flash Sale: Collector Hardcovers",
        title_zh="週末特賣：典藏精裝書限時特價",
        badge_en="SPECIAL",
        badge_zh="典藏精選",
        discount_code="WEEKEND",
        image_url="https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80",
    ),
])

# 4. Categories (Genres)
cat_tech = C00_Category(name_en="Tech & Programming", name_zh="資訊與程式技術", icon="💻", sort_order=1)
cat_growth = C00_Category(name_en="Personal Growth", name_zh="心理與個人成長", icon="🌱", sort_order=2)
cat_scifi = C00_Category(name_en="Sci-Fi & Fantasy", name_zh="科幻與奇幻文學", icon="🚀", sort_order=3)
cat_lit = C00_Category(name_en="World Literature", name_zh="世界經典文學", icon="📖", sort_order=4)
cat_design = C00_Category(name_en="Design & Art", name_zh="藝術與設計思維", icon="🎨", sort_order=5)

db.add_all([cat_tech, cat_growth, cat_scifi, cat_lit, cat_design])
db.flush()

# 5. Products (Books) & Details
# Book 1: Atomic Habits
b1 = C00_Product(
    category_id=cat_growth.id,
    title_en="Atomic Habits",
    title_zh="原子習慣：細微改變帶來巨大成就",
    author_en="James Clear",
    author_zh="詹姆斯·克利爾 (James Clear)",
    short_desc_en="An easy & proven way to build good habits and break bad ones.",
    short_desc_zh="每天進步 1%，一年強大 37 倍！實證有效的微習慣建立指南。",
    price=22.00,
    image_url="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    is_recommended=True,
)
b1.detail = C00_ProdDetail(
    full_synopsis_en="No matter your goals, Atomic Habits offers a proven framework for improving every day. James Clear, one of the world's leading experts on habit formation, reveals practical strategies that teach you exactly how to master tiny behaviors that lead to remarkable results.",
    full_synopsis_zh="無論你的目標是什麼，《原子習慣》都提供了一套經過實踐檢驗的每日進步架構。世界頂尖習慣養成專家詹姆斯·克利爾揭示了實用策略，教你如何將微小的行為累積成驚人的長期成果。",
    publisher_en="Avery Publishing",
    publisher_zh="方智出版社",
    isbn="978-0735211292",
    publication_year=2018,
    page_count=320,
    format_en="Hardcover / 23x15 cm",
    format_zh="精裝本 / 23x15 公分",
)

# Book 2: Clean Code
b2 = C00_Product(
    category_id=cat_tech.id,
    title_en="Clean Code: A Handbook of Agile Software Craftsmanship",
    title_zh="無瑕的程式碼：敏捷軟體工藝手冊",
    author_en="Robert C. Martin (Uncle Bob)",
    author_zh="羅伯特·C·馬丁 (Robert C. Martin)",
    short_desc_en="Even bad code can function. But if code isn't clean, it can bring a development organization to its knees.",
    short_desc_zh="即使拙劣的程式碼也能運作，但不乾淨的程式碼足以拖垮整個團隊開發效率。",
    price=38.50,
    image_url="https://images.unsplash.com/photo-1532012164546-f432f2e3777f?w=600&auto=format&fit=crop&q=80",
    is_recommended=True,
)
b2.detail = C00_ProdDetail(
    full_synopsis_en="Renowned software expert Robert C. Martin presents a revolutionary paradigm with Clean Code. Learn how to write good code on the fly and transform bad code into clean architecture. A must-read for every developer wanting to elevate their craft.",
    full_synopsis_zh="世界級軟體大師 Robert C. Martin 提出編寫優質程式碼的工藝思維。本書包含大量真實重構案例，教你如何區分好程式與壞程式、如何編寫良好的函式與命名，以及單元測試的最佳實踐。",
    publisher_en="Prentice Hall",
    publisher_zh="博碩文化",
    isbn="978-0132350884",
    publication_year=2008,
    page_count=464,
    format_en="Paperback / Tech Edition",
    format_zh="平裝版 / 技術經典",
)

# Book 3: Dune
b3 = C00_Product(
    category_id=cat_scifi.id,
    title_en="Dune (Deluxe Collector Edition)",
    title_zh="沙丘六部曲：經典珍藏版",
    author_en="Frank Herbert",
    author_zh="法蘭克·赫伯特 (Frank Herbert)",
    short_desc_en="Set on the desert planet Arrakis, Dune is the story of Paul Atreides and the ultimate fight for spice.",
    short_desc_zh="以沙漠星球厄拉科斯為舞台，科幻史詩不朽巨作，香料與權力的終極之戰。",
    price=26.00,
    image_url="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80",
    is_recommended=True,
)
b3.detail = C00_ProdDetail(
    full_synopsis_en="Frank Herbert's epic masterpiece—a triumph of the imagination and one of the bestselling science fiction novels of all time. Follow the young Paul Atreides as he journeys to the inhospitable planet Dune, the only source of the universe's most coveted substance: spice melange.",
    full_synopsis_zh="現代科幻殿堂級鉅作，雨果獎與星雲獎雙料得主。描寫亞崔迪家族在殘酷的沙漠行星上經歷背叛與重生的傳奇歷程，融合生態學、宗教哲學與星際政治。",
    publisher_en="Ace Books",
    publisher_zh="大家出版",
    isbn="978-0441172719",
    publication_year=1965,
    page_count=688,
    format_en="Hardcover Collector Foil",
    format_zh="精裝箔金典藏版",
)

# Book 4: The Design of Everyday Things
b4 = C00_Product(
    category_id=cat_design.id,
    title_en="The Design of Everyday Things",
    title_zh="設計的心理學：人性化的日常生活設計",
    author_en="Don Norman",
    author_zh="唐·諾曼 (Don Norman)",
    short_desc_en="The ultimate guide to human-centered design. Why bad design is never the user's fault.",
    short_desc_zh="設計大師唐諾曼經典之作：門把、開關、介面，好的設計如何符合人體直覺。",
    price=24.50,
    image_url="https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80",
    is_recommended=False,
)
b4.detail = C00_ProdDetail(
    full_synopsis_en="Even the smartest among us can feel inept as we fail to figure out which light switch or stove burner to turn on, or whether to push, pull, or slide a door. The fault lies not in ourselves, but in product design that ignores the needs of people.",
    full_synopsis_zh="日常生活中最令人沮喪的事莫過於面對推不開的門或按錯開關。認知心理學專家唐·諾曼說明，問題不在使用者，而在於忽視人性認知的設計缺陷。本書是 UX/UI 與產品設計師的必讀啟蒙聖經。",
    publisher_en="Basic Books",
    publisher_zh="遠流出版",
    isbn="978-0465050659",
    publication_year=2013,
    page_count=368,
    format_en="Paperback Illustrated",
    format_zh="平裝繁體增訂版",
)

# Book 5: The Little Prince
b5 = C00_Product(
    category_id=cat_lit.id,
    title_en="The Little Prince",
    title_zh="小王子 (全彩插畫精裝典藏版)",
    author_en="Antoine de Saint-Exupéry",
    author_zh="安東尼·聖修伯里",
    short_desc_en="It is only with the heart that one can see rightly; what is essential is invisible to the eye.",
    short_desc_zh="「真正重要的東西，只用眼睛是看不見的，必須用你的心。」",
    price=16.00,
    image_url="https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&auto=format&fit=crop&q=80",
    is_recommended=True,
)
b5.detail = C00_ProdDetail(
    full_synopsis_en="Few stories are as widely read and as universally cherished by children and adults alike as The Little Prince. A timeless fable of love, friendship, longing, and the profound essence of human connection.",
    full_synopsis_zh="全世界閱讀率最高、被翻譯為數百種語言的哲理寓言。透過來自 B612 小行星的小王子眼眸，揭開大人世界的荒謬與真愛的純粹面貌。全書收錄作者手繪原著插畫。",
    publisher_en="Mariner Books",
    publisher_zh="木馬文化",
    isbn="978-0156012195",
    publication_year=1943,
    page_count=144,
    format_en="Hardcover Illustrated Gift Edition",
    format_zh="全彩精裝禮物版",
)

# Book 6: Sapiens: A Brief History of Humankind
b6 = C00_Product(
    category_id=cat_growth.id,
    title_en="Sapiens: A Brief History of Humankind",
    title_zh="人類大歷史：從野獸到扮演上帝",
    author_en="Yuval Noah Harari",
    author_zh="哈拉瑞 (Yuval Noah Harari)",
    short_desc_en="100,000 years ago, at least six human species inhabited the earth. Today there is just one: Homo sapiens.",
    short_desc_zh="十萬年前地球上至少有六個人種，為何今天只剩下智人？震撼全球思想鉅著。",
    price=25.00,
    image_url="https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=600&auto=format&fit=crop&q=80",
    is_recommended=False,
)
b6.detail = C00_ProdDetail(
    full_synopsis_en="From a renowned historian comes a groundbreaking narrative of humanity’s creation and evolution—a #1 international bestseller that explores the ways in which biology and history have defined us.",
    full_synopsis_zh="以色列歷史學家哈拉瑞以宏觀視角貫穿認知革命、農業革命與科學革命，剖析想像的秩序（國家、宗教、貨幣）如何使人類成為地球主宰，並深刻叩問人類未來的命運。",
    publisher_en="Harper",
    publisher_zh="天下文化",
    isbn="978-0062316097",
    publication_year=2014,
    page_count=464,
    format_en="Paperback Special Edition",
    format_zh="繁體中文十週年修訂版",
)

db.add_all([b1, b2, b3, b4, b5, b6])
db.flush()

# 5. Sample Completed Orders & Sales Data (For grounded bestseller rankings)
order1 = C00_Order(user_id=user_customer.id, total_amount=450.0, status="completed")
db.add(order1)
db.flush()
db.add_all([
    C00_OrderItem(order_id=order1.id, product_id=b3.id, quantity=15, unit_price=b3.price),  # Atomic Habits (15 sold)
    C00_OrderItem(order_id=order1.id, product_id=b1.id, quantity=10, unit_price=b1.price),  # Clean Code (10 sold)
    C00_OrderItem(order_id=order1.id, product_id=b5.id, quantity=8, unit_price=b5.price),   # The Little Prince (8 sold)
    C00_OrderItem(order_id=order1.id, product_id=b2.id, quantity=6, unit_price=b2.price),   # DDIA (6 sold)
    C00_OrderItem(order_id=order1.id, product_id=b6.id, quantity=5, unit_price=b6.price),   # Sapiens (5 sold)
    C00_OrderItem(order_id=order1.id, product_id=b4.id, quantity=3, unit_price=b4.price),   # Deep Work (3 sold)
])

# 6. Unified Knowledge Base (FAQs & Store Policies)
faq1 = C00_KnowledgeBase(
    topic="refund_policy",
    question_en="How do I return a damaged book or request a refund?",
    question_zh="我的書有破損、缺頁或瑕疵，要怎麼退款退貨？",
    answer_en="We offer a 7-day unconditional free return and replacement guarantee for any damaged or defective books. Please photograph the damaged pages/cover and contact us at service@apexbookhaven.com or call +886 (02) 2345-6789. We will arrange a free courier pick-up and issue a 100% full refund or dispatch a brand-new replacement within 24 hours.",
    answer_zh="文萃讀坊提供【7 天瑕疵無條件免費退換貨】保障！若您收到的書籍有缺頁、破損、折損或髒污，請協助拍攝照片並寄至 service@apexbookhaven.com 或致電 (02) 2345-6789。我們將安排宅配免費到府收件，並在 24 小時內為您辦理全額退款或補寄全新書籍，您無須負擔任何運費。",
    keywords="退款, 退貨, 破損, 瑕疵, 換貨, 壞掉, 缺頁, 折損, 補寄, refund, return, damaged, replace, broken",
)

faq2 = C00_KnowledgeBase(
    topic="shipping_duration",
    question_en="How long does delivery take and what is the shipping fee?",
    question_zh="訂單一般多久送達？運費如何計算？",
    answer_en="All orders over $35 enjoy complimentary carbon-neutral shipping! For orders under $35, a flat shipping fee of $4.50 applies. Delivery takes 1-2 business days in metropolitan areas and 2-3 business days for remote locations.",
    answer_zh="全館單筆滿 $35 (約新台幣 1,100 元) 即享【低碳免運費】直送到府！未滿額酌收 $4.50 基礎運費。本島都會區下單後約 1-2 個工作天送達，偏遠或離島地區約 2-3 個工作天。",
    keywords="運費, 配送, 送達, 時間, 多久, 幾天, 免運, 宅配, shipping, delivery, fee, time, courier",
)

faq3 = C00_KnowledgeBase(
    topic="gift_service",
    question_en="Can I buy a book as a gift for someone else? Do you offer gift wrapping?",
    question_zh="可以送禮給朋友嗎？有提供包裝或卡片嗎？",
    answer_en="Yes! At checkout, simply check 'Send as a Gift'. We provide complimentary artisanal Kraft paper wrapping and a handwritten greeting card with your personalized message, sealed with a classic wax seal bookmark.",
    answer_zh="有的！文萃讀坊提供【免費文藝禮物包裝】。在購物車結帳時勾選「送禮包裝」，我們將使用進口牛皮紙與質感緞帶手工包裝，並附贈手寫祝賀卡片與專屬封蠟書籤，直接寄達收禮者手中。",
    keywords="送禮, 禮物, 包裝, 卡片, 朋友, 祝賀, 生日, 緞帶, gift, wrap, present, card, wrapping",
)

faq4 = C00_KnowledgeBase(
    topic="member_perks",
    question_en="What are the benefits of becoming a member?",
    question_zh="註冊成為會員有什麼好處與專屬權益？",
    answer_en="Members enjoy: 1) Instant 10% discount on first purchase with code READ20, 2) Monthly free shipping coupons, 3) 48-hour early priority pre-orders for limited collector hardcovers, and 4) VIP invitations to author literary salons.",
    answer_zh="文萃讀坊會員享有四大專屬禮遇：1) 註冊即享首購 9 折優惠；2) 每月贈送會員專屬免運券；3) 珍藏精裝限定版享有 48 小時優先預購權；4) 受邀參加每季作家線上與實體文學沙龍講座。",
    keywords="會員, 好處, 權益, 折扣, 註冊, 優惠, 禮遇, member, perks, benefit, privilege, join",
)

faq5 = C00_KnowledgeBase(
    topic="payment_support",
    question_en="My payment failed or my credit card won't go through. What should I do?",
    question_zh="線上刷卡失敗或付款系統異常，該如何處理？",
    answer_en="We support Visa, MasterCard, Apple Pay, and Cash on Delivery (COD). If your card fails, it is usually a bank 3D-Secure SMS timeout. You can try another card or simply select 'Cash on Delivery' at checkout to pay safely when receiving your parcel.",
    answer_zh="我們支援 Visa、MasterCard、Apple Pay 及「貨到付款 (COD)」。若刷卡失敗，通常為發卡銀行 3D 簡訊驗證逾時，建議更換卡片，或直接選擇「貨到付款」，包裹送達時直接將款項交付宅配員即可。",
    keywords="付款, 信用卡, 刷卡, 失敗, 異常, 扣款, 貨到付款, 沒成功, payment, fail, credit card, cod, checkout",
)

faq6 = C00_KnowledgeBase(
    topic="tech_support",
    question_en="I am experiencing technical problems operating the website.",
    question_zh="操作網站遇到技術問題或按鈕沒有反應，該怎麼辦？",
    answer_en="Please try hard-refreshing your browser (Ctrl + F5 or Cmd + Shift + R) or opening in an Incognito private window. If the issue persists, our technical team is available 24/7 at tech@apexbookhaven.com.",
    answer_zh="若按鈕無反應或畫面異常，建議您嘗試按下 Ctrl + F5 強制重新整理，或以無痕視窗開啟。若問題未解決，歡迎將畫面截圖寄至技術小組 tech@apexbookhaven.com，我們會在 1 小時內協助排除。",
    keywords="技術, 網頁, 當機, 錯誤, 按鈕, 當掉, 不能按, 壞掉, technical, error, bug, crash, issue",
)

db.add_all([faq1, faq2, faq3, faq4, faq5, faq6])
db.commit()
db.close()
print("BOOKSTORE_SEED_SUCCESS")
