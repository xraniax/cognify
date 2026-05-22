"""
Sign In (Login) Selenium Tests - Cognify
Tests the login page at /login for the Sign In use case.
"""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, USER_EMAIL, USER_PASSWORD


class TestSignIn:

    def test_successful_login(self, driver):
        """UC-SIGN-IN-01: Valid credentials should log the user in and redirect to dashboard."""
        driver.get(f"{BASE_URL}/login")

        # Wait for fields to be present and visible
        wait = WebDriverWait(driver, 15)
        email_field = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='email']")))
        pass_field = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "input[type='password']")))
        submit_btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit']")))

        # Fill in credentials
        email_field.send_keys(USER_EMAIL)
        pass_field.send_keys(USER_PASSWORD)
        
        # Take a screenshot before clicking
        driver.save_screenshot("/home/rania/cognify/selenium/before_login_click.png")
        
        submit_btn.click()

        # Wait for redirect away from /login
        wait.until(
            lambda d: "/login" not in d.current_url
        )
        # Take a screenshot after login attempt
        driver.save_screenshot("/home/rania/cognify/selenium/after_login_click.png")
        
        assert "/login" not in driver.current_url, "Should redirect to dashboard after successful login"

    def test_login_wrong_password(self, driver):
        """UC-SIGN-IN-02: Wrong password should display an error message."""
        driver.get(f"{BASE_URL}/login")

        driver.find_element(By.CSS_SELECTOR, "input[type='email']").send_keys(USER_EMAIL)
        driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys("WrongPass999!")
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

        # Expect an error message to appear on the page
        error = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[class*='error'], [class*='red-600'], [role='alert']"))
        )
        assert error.is_displayed(), "Error message should appear for wrong password"

    def test_login_nonexistent_email(self, driver):
        """UC-SIGN-IN-03: Non-existent email should display an error message."""
        driver.get(f"{BASE_URL}/login")

        driver.find_element(By.CSS_SELECTOR, "input[type='email']").send_keys("nobody@nowhere.com")
        driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys("Password123!")
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

        error = WebDriverWait(driver, 10).until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "[class*='error'], [class*='red-600'], [role='alert']"))
        )
        assert error.is_displayed(), "Error message should appear for non-existent email"

    def test_login_empty_fields(self, driver):
        """UC-SIGN-IN-04: Submitting empty form should not navigate away."""
        driver.get(f"{BASE_URL}/login")

        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

        # Should still be on the login page
        assert "/login" in driver.current_url, "Should remain on login page with empty fields"
