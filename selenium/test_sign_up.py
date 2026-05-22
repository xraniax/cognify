"""
Sign Up (Register) Selenium Tests - Cognify
Tests the registration page at /register for the Sign Up use case.
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, NEW_USER_EMAIL, NEW_USER_PASSWORD, NEW_USER_NAME


class TestSignUp:

    def test_successful_registration(self, driver):
        """UC-SIGN-UP-01: Valid data should register user and redirect (e.g. to verify email page)."""
        driver.get(f"{BASE_URL}/register")

        # Fill in the registration form
        name_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder='Enter your name']")
        email_input = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        password_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='password']")

        name_input.send_keys(NEW_USER_NAME)
        email_input.send_keys(NEW_USER_EMAIL)
        password_inputs[0].send_keys(NEW_USER_PASSWORD)
        if len(password_inputs) > 1:
            password_inputs[1].send_keys(NEW_USER_PASSWORD)  # confirm password

        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

        # Should redirect away from /register on success
        WebDriverWait(driver, 10).until(
            lambda d: "/register" not in d.current_url
        )
        assert "/register" not in driver.current_url, "Should redirect after successful registration"

    def test_registration_duplicate_email(self, driver):
        """UC-SIGN-UP-02: Already registered email should display an error."""
        from conftest import USER_EMAIL
        driver.get(f"{BASE_URL}/register")

        name_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder='Enter your name']")
        email_input = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        password_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='password']")

        name_input.send_keys("Duplicate User")
        email_input.send_keys(USER_EMAIL)  # email that already exists
        password_inputs[0].send_keys(NEW_USER_PASSWORD)
        if len(password_inputs) > 1:
            password_inputs[1].send_keys(NEW_USER_PASSWORD)

        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

        error = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[class*='error'], [class*='red-600'], [role='alert']"))
        )
        assert error.is_displayed(), "Error message should appear for duplicate email"

    def test_registration_weak_password(self, driver):
        """UC-SIGN-UP-03: Weak password should display a validation error."""
        driver.get(f"{BASE_URL}/register")

        name_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder='Enter your name']")
        email_input = driver.find_element(By.CSS_SELECTOR, "input[type='email']")
        password_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='password']")

        name_input.send_keys("Weak Pass User")
        email_input.send_keys("weakpass@test.com")
        password_inputs[0].send_keys("123")  # too weak
        if len(password_inputs) > 1:
            password_inputs[1].send_keys("123")

        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

        error = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[class*='error'], [class*='red-600'], [role='alert']"))
        )
        assert error.is_displayed(), "Error message should appear for weak password"

    def test_register_link_on_login_page(self, driver):
        """UC-SIGN-UP-04: Login page should have a link to the register page."""
        driver.get(f"{BASE_URL}/login")

        register_link = driver.find_element(By.CSS_SELECTOR, "a[href*='register']")
        assert register_link.is_displayed(), "Register link should be visible on the login page"
        register_link.click()

        WebDriverWait(driver, 5).until(EC.url_contains("register"))
        assert "register" in driver.current_url, "Should navigate to register page"
