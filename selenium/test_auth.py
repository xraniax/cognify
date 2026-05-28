"""
Authentication E2E Tests - Cognify
Covers the gaps not addressed by test_sign_in.py / test_sign_up.py:
  - Logout
  - Session persistence (reload / revisit)
  - Unauthenticated redirect for multiple protected routes
  - Password field client-side validation messaging
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from conftest import BASE_URL, USER_EMAIL, USER_PASSWORD
from pages.login_page import LoginPage
from pages.register_page import RegisterPage

# Stable selector present on both MainLayout and AdminLayout logout buttons
LOGOUT_BTN = (By.CSS_SELECTOR, "[data-testid='logout-btn']")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def do_login(driver, email=USER_EMAIL, password=USER_PASSWORD):
    """Log in via the UI and wait until redirected away from /login."""
    page = LoginPage(driver, BASE_URL)
    page.open()
    page.login(email, password)
    page.wait_for_redirect_away()


def do_logout(driver):
    """Click the logout button and wait for the /login redirect."""
    wait = WebDriverWait(driver, 15)
    wait.until(EC.element_to_be_clickable(LOGOUT_BTN)).click()
    wait.until(EC.url_contains("/login"))


# Admin routes use <Navigate to="/login"> for unauthenticated visitors.
# Student routes (/dashboard, /profile, etc.) intentionally show a GuestGate
# component instead of redirecting, so they are not listed here.
PROTECTED_ROUTES = [
    "/admin",
    "/admin/users",
    "/admin/files",
]


# ─── Tests ───────────────────────────────────────────────────────────────────

class TestLogout:

    def test_logout_redirects_to_login(self, driver):
        """After logging out, the user should be redirected to /login."""
        do_login(driver)
        do_logout(driver)

        assert "/login" in driver.current_url, "Logout should redirect to /login"

    def test_logout_clears_session(self, driver):
        """After logout, navigating to an admin route should redirect to /login."""
        do_login(driver)
        do_logout(driver)

        driver.get(f"{BASE_URL}/admin/users")
        WebDriverWait(driver, 10).until(
            lambda d: "login" in d.current_url or "welcome" in d.current_url
        )
        assert "login" in driver.current_url or "welcome" in driver.current_url, \
            "Accessing /admin/users after logout should redirect to /login"


class TestUnauthenticatedRedirect:

    @pytest.mark.parametrize("route", PROTECTED_ROUTES)
    def test_protected_route_redirects_unauthenticated(self, driver, route):
        """Each protected route should redirect an unauthenticated visitor to /login."""
        driver.get(f"{BASE_URL}{route}")

        WebDriverWait(driver, 10).until(
            lambda d: "login" in d.current_url or "welcome" in d.current_url
        )
        assert "login" in driver.current_url or "welcome" in driver.current_url, \
            f"Unauthenticated access to {route} should redirect to /login"


class TestSessionPersistence:

    def test_session_survives_page_reload(self, driver):
        """An authenticated session should persist after a hard reload."""
        do_login(driver)
        url_before = driver.current_url

        driver.refresh()

        WebDriverWait(driver, 10).until(
            lambda d: d.current_url == url_before or (
                "login" not in d.current_url and "welcome" not in d.current_url
            )
        )
        assert "login" not in driver.current_url and "welcome" not in driver.current_url, \
            "Authenticated user should remain logged in after page reload"

    def test_session_survives_direct_navigation(self, driver):
        """Navigating directly to a protected route while logged in should not trigger redirect."""
        do_login(driver)

        driver.get(f"{BASE_URL}/dashboard")

        WebDriverWait(driver, 10).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )
        assert "login" not in driver.current_url, \
            "Authenticated user should reach /dashboard without being redirected"


class TestPasswordValidation:

    def test_login_shows_error_for_invalid_email_format(self, driver):
        """Client-side validation should flag a malformed email before submission."""
        page = LoginPage(driver, BASE_URL)
        page.open()
        page.fill_email("not-an-email")
        # Trigger blur to activate inline validation
        page.fill_password("anything")

        errors = WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "p.text-red-600, p.text-red-500"))
        )
        assert any(e.is_displayed() for e in errors), \
            "An inline validation error should appear for a malformed email"

    def test_register_shows_error_for_short_password(self, driver):
        """Registration should surface a client-side error for passwords under 8 characters."""
        page = RegisterPage(driver, BASE_URL)
        page.open()
        page.fill_name("Test User")
        page.fill_email("shortpass@test.com")
        page.fill_password("abc")
        # Trigger blur on the password field
        page.fill_name("Test User")  # clicking away triggers blur

        page.submit()

        errors = WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "p.text-red-500"))
        )
        assert any(e.is_displayed() for e in errors), \
            "A validation error should appear for a password shorter than 8 characters"

    def test_register_shows_error_for_empty_name(self, driver):
        """Submitting registration with a blank name should show a field-level error."""
        page = RegisterPage(driver, BASE_URL)
        page.open()
        page.fill_email("noname@test.com")
        page.fill_password("Password123!")
        page.submit()

        errors = WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "p.text-red-500"))
        )
        assert any(e.is_displayed() for e in errors), \
            "A validation error should appear when name is left blank"
