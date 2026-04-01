import requests
import json
import uuid
import os
import time

BASE_URL = "http://localhost:8000"

def log_test(name, resp, expected_status=200):
    print(f"\n--- TEST: {name} ---")
    if resp is None:
        print("FAILED: No response (request error)")
        return False
    
    print(f"Status: {resp.status_code} (Expected: {expected_status})")
    try:
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)[:500]}...")
    except:
        print(f"Raw Response: {resp.text[:500]}...")
    
    if resp.status_code == expected_status:
        print("RESULT: PASS")
        return True
    else:
        print("RESULT: FAIL")
        return False

def test_uploads():
    # Empty file
    with open("/tmp/empty.pdf", "wb") as f: pass
    resp = requests.post(f"{BASE_URL}/preprocess", files={"file": ("empty.pdf", open("/tmp/empty.pdf", "rb"), "application/pdf")})
    log_test("Empty PDF", resp, 200) # Should return 200 but empty text warning in logs

    # Corrupted
    with open("/tmp/corrupted.pdf", "w") as f: f.write("not a pdf")
    resp = requests.post(f"{BASE_URL}/preprocess", files={"file": ("corrupted.pdf", open("/tmp/corrupted.pdf", "rb"), "application/pdf")})
    # PyPDF2 might not fail immediately, but let's see
    log_test("Corrupted PDF", resp)

    # Unsupported
    resp = requests.post(f"{BASE_URL}/preprocess", files={"file": ("test.txt", "some text", "text/plain")})
    log_test("Unsupported extension", resp, 400)

def test_chunking():
    # Short text
    resp = requests.post(f"{BASE_URL}/debug/chunk", json={"text": "hello"})
    log_test("Short text chunking", resp)

    # Huge text
    resp = requests.post(f"{BASE_URL}/debug/chunk", json={"text": "A" * 10000})
    log_test("Huge text chunking", resp)

    # Mixed Languages
    resp = requests.post(f"{BASE_URL}/debug/chunk", json={"text": "Hello world. مرحبا بك في كوجنيفي."})
    log_test("Mixed languages chunking", resp)

def test_embeddings():
    # Empty string
    # /debug/embed takes text in body
    resp = requests.post(f"{BASE_URL}/debug/embed", json={"text": " "})
    log_test("Empty string embedding", resp)

def test_database_retrieval():
    subj_id = str(uuid.uuid4())
    # Retrieve on empty subject
    resp = requests.get(f"{BASE_URL}/debug/retrieve/{subj_id}")
    log_test("Retrieve empty subject", resp)

    # Topic = None (via query param absence or empty string)
    resp = requests.get(f"{BASE_URL}/debug/retrieve/{subj_id}?topic=")
    log_test("Retrieve topic=None", resp)

    # Topic = random
    resp = requests.get(f"{BASE_URL}/debug/retrieve/{subj_id}?topic=random_unrelated_stuff")
    log_test("Retrieve random topic", resp)

if __name__ == "__main__":
    test_uploads()
    test_chunking()
    test_embeddings()
    test_database_retrieval()
