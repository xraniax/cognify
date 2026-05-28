"""
Sign Up (Register) Selenium Tests - Cognify
Tests the registration page at /register for the Sign Up use case.
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, USER_EMAIL, NEW_USER_EMAIL, NEW_USER_PASSWORD, NEW_USER_NAME
from pages.register_page import RegisterPage
from pages.login_page import LoginPage


class TestSignUp:

    def test_successful_registration(self, driver):
        """UC-SIGN-UP-01: Valid data should register user and redirect to verify-email page."""
        page = RegisterPage(driver, BASE_URL)
        page.open()
        page.register(NEW_USER_NAME, NEW_USER_EMAIL, NEW_USER_PASSWORD)
        page.wait_for_redirect_away()

        assert "/register" not in driver.current_url, "Should redirect after successful registration"

    def test_registration_duplicate_email(self, driver):
        """UC-SIGN-UP-02: Already registered email should display an error."""
        page = RegisterPage(driver, BASE_URL)
        page.open()
        page.register("Duplicate User", USER_EMAIL, NEW_USER_PASSWORD)

        error = page.get_global_error()
        assert error.is_displayed(), "Error message should appear for duplicate email"

    def test_registration_weak_password(self, driver):
        """UC-SIGN-UP-03: Weak password should display a validation error."""
        page = RegisterPage(driver, BASE_URL)
        page.open()
        page.register("Weak Pass User", "weakpass@test.com", "123")

        errors = page.get_field_errors()
        assert any(e.is_displayed() for e in errors), "Error message should appear for weak password"

    def test_register_link_on_login_page(self, driver):
        """UC-SIGN-UP-04: Login page should have a link to the register page."""
        page = LoginPage(driver, BASE_URL)
        page.open()

        link = page.wait.until(EC.element_to_be_clickable(page.REGISTER_LINK))
        assert link.is_displayed(), "Register link should be visible on the login page"
        page.click_register_link()

        WebDriverWait(driver, 10).until(EC.url_contains("register"))
        assert "register" in driver.current_url, "Should navigate to register page"
