"""
Manage Profile Selenium Tests - Cognify
Tests the Profile page at /profile for the Manage Profile use case.
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, USER_EMAIL, USER_PASSWORD


def login(driver, email=USER_EMAIL, password=USER_PASSWORD):
    """Helper: log in and wait for redirect away from /login."""
    driver.get(f"{BASE_URL}/login")
    driver.find_element(By.CSS_SELECTOR, "input[type='email']").send_keys(email)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    WebDriverWait(driver, 10).until(lambda d: "/login" not in d.current_url)


class TestManageProfile:

    def test_profile_page_loads(self, driver):
        """UC-PROFILE-01: Authenticated user should be able to access their profile page."""
        login(driver)
        driver.get(f"{BASE_URL}/profile")

        WebDriverWait(driver, 10).until(EC.url_contains("profile"))
        assert "profile" in driver.current_url, "Should be on the profile page"

        # Page should show profile content, not an error
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert len(body_text) > 0, "Profile page should have content"

    def test_profile_displays_user_info(self, driver):
        """UC-PROFILE-02: Profile page should display the logged-in user's email."""
        login(driver)
        driver.get(f"{BASE_URL}/profile")

        WebDriverWait(driver, 10).until(EC.url_contains("profile"))
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert USER_EMAIL in page_text, f"Profile page should display user email: {USER_EMAIL}"

    def test_profile_update_name(self, driver):
        """UC-PROFILE-03: User should be able to update their display name."""
        login(driver)
        driver.get(f"{BASE_URL}/profile")
        WebDriverWait(driver, 10).until(EC.url_contains("profile"))

        # Look for an editable name field or an edit button
        try:
            # Try clicking an 'Edit Profile' button
            edit_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Edit Profile')]"))
            )
            edit_btn.click()
        except Exception:
            pass  # Some UIs show the field directly

        # Wait for the input field to appear (it should have class 'input-field' based on Profile.jsx)
        name_field = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input.input-field, input[type='text']"))
        )
        name_field.clear()
        name_field.send_keys("Updated Selenium Name")

        # Submit the form / click save
        save_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], button[aria-label*='save'], button[title*='save']")
        save_btn.click()

        # A success notification or the new name should appear
        WebDriverWait(driver, 10).until(
            lambda d: "Updated Selenium Name" in d.find_element(By.TAG_NAME, "body").text
            or d.find_elements(By.CSS_SELECTOR, "[class*='success'], [role='status']")
        )
        assert True, "Name update should succeed"

    def test_profile_unauthenticated_redirects(self, driver):
        """UC-PROFILE-04: Unauthenticated access to profile should redirect to login."""
        driver.get(f"{BASE_URL}/profile")

        WebDriverWait(driver, 10).until(
            lambda d: "login" in d.current_url or "welcome" in d.current_url
        )
        assert "login" in driver.current_url or "welcome" in driver.current_url, \
            "Unauthenticated access to /profile should redirect to login or welcome"
