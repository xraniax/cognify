"""
Shared Selenium configuration for Cognify UI tests.
Uses Chromium (snap) in headless mode with the bundled chromedriver.
"""
import subprocess
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

BASE_URL = "http://localhost:3000"

# ─── Test account credentials ────────────────────────────────────────────────
# A regular user that already exists in the DB
USER_EMAIL = "testuser@cognify.com"
USER_PASSWORD = "Password123!"
USER_NAME = "Test User"

# An admin user that already exists in the DB
ADMIN_EMAIL = "admin@cognify.com"
ADMIN_PASSWORD = "Admin123!"

# A fresh email used only for sign-up tests (must NOT pre-exist in the DB)
NEW_USER_EMAIL = "newselenium@cognify.com"
NEW_USER_PASSWORD = "Password123!"
NEW_USER_NAME = "Selenium Tester"

# Find the snap chromedriver that matches the installed chromium version
def _find_chromedriver():
    result = subprocess.run(
        ["find", "/snap/chromium", "-name", "chromedriver", "-type", "f"],
        capture_output=True, text=True
    )
    paths = [p for p in result.stdout.strip().splitlines() if p]
    if paths:
        return sorted(paths)[-1]  # latest version
    return "/snap/chromium/current/usr/lib/chromium-browser/chromedriver"

CHROMEDRIVER_PATH = _find_chromedriver()


@pytest.fixture(scope="function")
def driver():
    """Create a headless Chromium instance for each test function."""
    options = Options()
    options.binary_location = "/snap/bin/chromium"
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,800")
    options.add_argument("--remote-debugging-port=9222")
    # options.add_argument("--user-data-dir=/tmp/selenium-chrome-profile")

    service = Service(executable_path=CHROMEDRIVER_PATH)
    browser = webdriver.Chrome(service=service, options=options)
    browser.implicitly_wait(10)
    yield browser
    browser.quit()

