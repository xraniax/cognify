import requests
import uuid

# 1. create dummy UUID
user_id = str(uuid.uuid4())
subject_id = str(uuid.uuid4())

# hit backend to trigger process-document? Wait, process-document requires a real subject.
# It's easier to just call the API directly to see where integer = uuid occurs.
print("Check celery logs after this.")
