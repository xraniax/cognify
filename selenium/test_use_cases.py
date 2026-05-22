"""
Playwright test suite for Cognify Core Use Cases.
Covers: Sign In, Sign Up, Manage Users, and Manage Profile.
"""
import pytest
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://localhost:3000"

# ─── Auth Constants ──────────────────────────────────────────────────────────
USER_EMAIL = "testuser@cognify.com"
USER_PASSWORD = "Password123!"

ADMIN_EMAIL = "admin@cognify.com"
ADMIN_PASSWORD = "Admin123!"

NEW_USER_EMAIL = f"newuser_{pytest.importorskip('uuid').uuid4()}@example.com"
NEW_USER_PASSWORD = "Password123!"

# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()

@pytest.fixture
def page(browser):
    context = browser.new_context()
    page = context.new_page()
    yield page
    context.close()

# ─── Tests ───────────────────────────────────────────────────────────────────

def test_sign_up(page):
    """UC: Sign Up - Register a new user."""
    try:
        page.goto(f"{BASE_URL}/register")
        page.get_by_placeholder("Enter your name").fill("Selenium Tester")
        page.get_by_placeholder("name@example.com").fill(NEW_USER_EMAIL)
        page.get_by_placeholder("••••••••").fill(NEW_USER_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url(lambda url: "/verify-email" in url, timeout=15000)
        page.screenshot(path="success_signup.png")
    except Exception as e:
        page.screenshot(path="signup_failure.png")
        raise e

def test_sign_in(page):
    """UC: Sign In - Login with existing user."""
    try:
        page.goto(f"{BASE_URL}/login")
        page.get_by_placeholder("name@example.com").fill(USER_EMAIL)
        page.get_by_placeholder("••••••••").fill(USER_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url(lambda url: "/login" not in url, timeout=15000)
        assert "/dashboard" in page.url or "/welcome" in page.url or "/materials" in page.url
        page.screenshot(path="success_signin.png")
    except Exception as e:
        page.screenshot(path="signin_failure.png")
        raise e

def test_manage_profile(page):
    """UC: Manage Profile - Navigate and check profile info."""
    try:
        # Login first
        page.goto(f"{BASE_URL}/login")
        page.get_by_placeholder("name@example.com").fill(USER_EMAIL)
        page.get_by_placeholder("••••••••").fill(USER_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url(lambda url: "/login" not in url)

        # Go to profile
        page.goto(f"{BASE_URL}/profile")
        page.wait_for_selector(f"text={USER_EMAIL}", timeout=15000)
        expect(page.get_by_text(USER_EMAIL, exact=True).first).to_be_visible()
        page.screenshot(path="success_profile.png")
    except Exception as e:
        page.screenshot(path="profile_failure.png")
        raise e

def test_manage_users_admin(page):
    """UC: Manage Users - Admin view of user list."""
    try:
        # Admin Login
        page.goto(f"{BASE_URL}/login")
        page.get_by_placeholder("name@example.com").fill(ADMIN_EMAIL)
        page.get_by_placeholder("••••••••").fill(ADMIN_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url(lambda url: "/login" not in url)

        # Go to Admin Users
        page.goto(f"{BASE_URL}/admin/users")
        page.wait_for_selector('input[placeholder*="SEARCH"]', timeout=15000)
        expect(page.get_by_text(USER_EMAIL)).to_be_visible()
        page.screenshot(path="success_admin.png")
    except Exception as e:
        page.screenshot(path="admin_failure.png")
        raise e

