from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class LoginPage:
    PATH = "/login"

    # Selectors
    EMAIL_INPUT    = (By.CSS_SELECTOR, "input[type='email']")
    PASSWORD_INPUT = (By.CSS_SELECTOR, "input[type='password']")
    SUBMIT_BTN     = (By.CSS_SELECTOR, "button[type='submit']")
    GLOBAL_ERROR   = (By.CSS_SELECTOR, "div.bg-red-50")
    FIELD_ERROR    = (By.CSS_SELECTOR, "p.text-red-600, p.text-red-500")
    REGISTER_LINK  = (By.CSS_SELECTOR, "a[href*='register']")

    def __init__(self, driver, base_url, timeout=15):
        self.driver = driver
        self.base_url = base_url
        self.wait = WebDriverWait(driver, timeout)

    def open(self):
        self.driver.get(f"{self.base_url}{self.PATH}")
        self.wait.until(EC.visibility_of_element_located(self.EMAIL_INPUT))
        return self

    def fill_email(self, email):
        field = self.wait.until(EC.visibility_of_element_located(self.EMAIL_INPUT))
        field.clear()
        field.send_keys(email)
        return self

    def fill_password(self, password):
        field = self.wait.until(EC.visibility_of_element_located(self.PASSWORD_INPUT))
        field.clear()
        field.send_keys(password)
        return self

    def submit(self):
        self.wait.until(EC.element_to_be_clickable(self.SUBMIT_BTN)).click()
        return self

    def login(self, email, password):
        self.fill_email(email)
        self.fill_password(password)
        self.submit()
        return self

    def wait_for_redirect_away(self):
        self.wait.until(lambda d: self.PATH not in d.current_url)

    def get_global_error(self):
        return self.wait.until(EC.visibility_of_element_located(self.GLOBAL_ERROR))

    def get_field_errors(self):
        return self.wait.until(EC.presence_of_all_elements_located(self.FIELD_ERROR))

    def click_register_link(self):
        self.wait.until(EC.element_to_be_clickable(self.REGISTER_LINK)).click()
