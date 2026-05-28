"""
Sign In (Login) Selenium Tests - Cognify
Tests the login page at /login for the Sign In use case.
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, USER_EMAIL, USER_PASSWORD
from pages.login_page import LoginPage


class TestSignIn:

    def test_successful_login(self, driver):
        """UC-SIGN-IN-01: Valid credentials should log the user in and redirect to dashboard."""
        page = LoginPage(driver, BASE_URL)
        page.open()
        page.login(USER_EMAIL, USER_PASSWORD)
        page.wait_for_redirect_away()

        assert "/login" not in driver.current_url, "Should redirect to dashboard after successful login"

    def test_login_wrong_password(self, driver):
        """UC-SIGN-IN-02: Wrong password should display an error message."""
        page = LoginPage(driver, BASE_URL)
        page.open()
        page.login(USER_EMAIL, "WrongPass999!")

        error = page.get_global_error()
        assert error.is_displayed(), "Error message should appear for wrong password"

    def test_login_nonexistent_email(self, driver):
        """UC-SIGN-IN-03: Non-existent email should display an error message."""
        page = LoginPage(driver, BASE_URL)
        page.open()
        page.login("nobody@nowhere.com", "Password123!")

        error = page.get_global_error()
        assert error.is_displayed(), "Error message should appear for non-existent email"

    def test_login_empty_fields(self, driver):
        """UC-SIGN-IN-04: Submitting empty form should not navigate away."""
        page = LoginPage(driver, BASE_URL)
        page.open()
        page.submit()

        assert "/login" in driver.current_url, "Should remain on login page with empty fields"
