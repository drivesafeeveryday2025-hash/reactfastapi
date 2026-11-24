import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def test_navigation_menu():
    print("=== TESTING DATABASE-DRIVEN HIERARCHICAL NAVIGATION MENUS ===")
    
    req = urllib.request.Request(f"{BASE_URL}/api/navigation")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        data = json.loads(resp.read().decode("utf-8"))

    print(f"✓ Successfully fetched {len(data)} root navigation menus from database")
    
    # Verify Parent-Child concept
    parents_with_children = [m for m in data if len(m["children"]) > 0]
    direct_links = [m for m in data if len(m["children"]) == 0]
    
    print(f"✓ Found {len(parents_with_children)} dropdown parent menus:")
    for p in parents_with_children:
        print(f"   [Parent] ID={p['id']}, Title='{p['title_en']}' ({p['title_zh']}), Children Count={len(p['children'])}")
        for c in p["children"]:
            badge_str = f" [Badge: {c['badge_en']}]" if c.get("badge_en") else ""
            print(f"      └─ [Child] ID={c['id']}, ParentID={c['parent_id']}, Title='{c['title_en']}' -> URL='{c['url']}'{badge_str}")

    print(f"✓ Found {len(direct_links)} direct link menus:")
    for d in direct_links:
        print(f"   [Direct Link] ID={d['id']}, Title='{d['title_en']}' -> URL='{d['url']}'")

    # Assertions
    titles = [m["title_en"] for m in data]
    assert "Explore Books" in titles, "Missing Explore Books menu"
    assert "About Apex" in titles, "Missing About Apex menu"
    assert "Customer Hub" in titles, "Missing Customer Hub menu"
    assert "Manager Portal" in titles, "Missing Manager Portal menu"
    
    explore = next(m for m in data if m["title_en"] == "Explore Books")
    assert len(explore["children"]) >= 4, "Explore Books should contain child items"
    
    hub = next(m for m in data if m["title_en"] == "Customer Hub")
    assert hub["requires_auth"] is True, "Customer Hub should require authentication"
    
    mgr = next(m for m in data if m["title_en"] == "Manager Portal")
    assert mgr["requires_role"] == "manager", "Manager Portal should require manager role"

    print("\n=== ALL NAVIGATION MENU TESTS PASSED 100% ===")

if __name__ == "__main__":
    test_navigation_menu()
