"""
Shared Selenium configuration for Cognify UI tests.
Uses Chromium (snap) in headless mode with the bundled chromedriver.
"""
# test_use_cases.py uses Playwright, not Selenium — exclude it from this suite
collect_ignore = ["test_use_cases.py"]

import os
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

BASE_URL = os.environ.get("COGNIFY_BASE_URL", "http://localhost:3000")

# ─── Test account credentials ────────────────────────────────────────────────
USER_EMAIL    = os.environ.get("COGNIFY_USER_EMAIL",    "testuser@cognify.com")
USER_PASSWORD = os.environ.get("COGNIFY_USER_PASSWORD", "Password123!")
USER_NAME     = "Test User"

ADMIN_EMAIL    = os.environ.get("COGNIFY_ADMIN_EMAIL",    "admin@cognify.com")
ADMIN_PASSWORD = os.environ.get("COGNIFY_ADMIN_PASSWORD", "Admin123!")

# Must NOT pre-exist in the DB — a timestamp suffix keeps each run unique
import time as _time
_ts = int(_time.time())
NEW_USER_EMAIL    = os.environ.get("COGNIFY_NEW_USER_EMAIL",    f"selenium_{_ts}@cognify.com")
NEW_USER_PASSWORD = os.environ.get("COGNIFY_NEW_USER_PASSWORD", "Password123!")
NEW_USER_NAME     = "Selenium Tester"

SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


CHROMEDRIVER_PATH = "/snap/bin/chromium.chromedriver"


@pytest.fixture(scope="module")
def driver():
    """
    One headless Chromium instance per test module (file).
    Reusing the browser across tests in the same file avoids the 3-5 s
    snap Chromium startup cost on every single test.
    Each test is still responsible for navigating to the page it needs —
    never assume what URL or state the previous test left behind.
    """
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,800")

    service = Service(executable_path=CHROMEDRIVER_PATH)
    browser = webdriver.Chrome(service=service, options=options)
    browser.set_page_load_timeout(30)
    browser.set_script_timeout(15)
    yield browser
    browser.quit()


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Save a screenshot on test failure if the 'driver' fixture is active."""
    outcome = yield
    report = outcome.get_result()

    if report.when == "call" and report.failed:
        driver = item.funcargs.get("driver")
        if driver:
            safe_name = item.nodeid.replace("/", "_").replace("::", "__").replace(" ", "_")
            path = os.path.join(SCREENSHOTS_DIR, f"FAIL_{safe_name}.png")
            try:
                driver.save_screenshot(path)
            except Exception:
                pass

