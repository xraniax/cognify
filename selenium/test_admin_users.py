"""
Manage Users (Admin) Selenium Tests - Cognify
Tests the Admin Users page at /admin/users for the Manage Users use case.
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, USER_EMAIL


def admin_login(driver):
    """Helper: log in as admin and wait for redirect."""
    driver.get(f"{BASE_URL}/login")
    driver.find_element(By.CSS_SELECTOR, "input[type='email']").send_keys(ADMIN_EMAIL)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(ADMIN_PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    WebDriverWait(driver, 10).until(lambda d: "/login" not in d.current_url)


class TestManageUsers:

    def test_admin_users_page_loads(self, driver):
        """UC-ADMIN-01: Admin should be able to access the user management page."""
        admin_login(driver)
        driver.get(f"{BASE_URL}/admin/users")

        WebDriverWait(driver, 10).until(EC.url_contains("admin"))
        assert "admin" in driver.current_url, "Admin should be on the admin users page"

        # Page should display a list of users (table or list element)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table, [class*='user-list'], [class*='UserList'], [class*='DataTable']"))
        )

    def test_admin_can_search_users(self, driver):
        """UC-ADMIN-02: Admin should be able to search for a specific user."""
        admin_login(driver)
        driver.get(f"{BASE_URL}/admin/users")

        search_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[placeholder*='SEARCH']"))
        )
        search_input.send_keys(USER_EMAIL)

        # Wait for filtered results
        import time
        time.sleep(1.5)  # Allow debounce

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert USER_EMAIL in page_text, "Searched user email should appear in results"

    def test_admin_user_list_shows_users(self, driver):
        """UC-ADMIN-03: Users list should display at least one user."""
        admin_login(driver)
        driver.get(f"{BASE_URL}/admin/users")

        # Wait for at least one row in the table
        rows = WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.CSS_SELECTOR, "tbody tr, [class*='user-row'], [class*='UserRow']"))
        )
        assert len(rows) >= 1, "User list should contain at least one user"

    def test_non_admin_cannot_access_admin_page(self, driver):
        """UC-ADMIN-04: Regular user should not be able to access admin pages."""
        from conftest import USER_EMAIL, USER_PASSWORD

        # Login as regular user
        driver.get(f"{BASE_URL}/login")
        driver.find_element(By.CSS_SELECTOR, "input[type='email']").send_keys(USER_EMAIL)
        driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(USER_PASSWORD)
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        WebDriverWait(driver, 10).until(lambda d: "/login" not in d.current_url)

        # Try to access admin page
        driver.get(f"{BASE_URL}/admin/users")

        # Should be redirected away or show "access denied"
        WebDriverWait(driver, 5).until(
            lambda d: "admin/users" not in d.current_url
            or "denied" in d.find_element(By.TAG_NAME, "body").text.lower()
            or "forbidden" in d.find_element(By.TAG_NAME, "body").text.lower()
        )
        page_text = driver.find_element(By.TAG_NAME, "body").text.lower()
        assert (
            "admin/users" not in driver.current_url
            or "denied" in page_text
            or "forbidden" in page_text
        ), "Regular user should not access admin/users"
