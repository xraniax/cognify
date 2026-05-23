from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive']

flow = InstalledAppFlow.from_client_secrets_file(
    'services/credentials/client_secret.json', SCOPES
)
creds = flow.run_local_server(port=0)

service = build('drive', 'v3', credentials=creds)

# Shared Drive root ID — the Drive or folder to share with the service account.
# Run: python grant_service_account_access.py
# Requires services/credentials/client_secret.json (OAuth user credentials, not the SA key).
FOLDER_ID = "15uVFS5cxdwNZ_XJReprdl5w4_sLX6OZ1"  # matches GOOGLE_DRIVE_FOLDER_ID in engine/.env.docker

# Engine service account (cognify-1-492200 project).
# Also add BACKEND_SERVICE_ACCOUNT_EMAIL here if backend uses a separate SA.
SERVICE_ACCOUNT_EMAIL = "cognify-drive@cognify-1-492200.iam.gserviceaccount.com"

permission = {
    'type': 'user',
    'role': 'organizer',
    'emailAddress': SERVICE_ACCOUNT_EMAIL
}

service.permissions().create(
    fileId=FOLDER_ID,
    body=permission,
    supportsAllDrives=True,
    sendNotificationEmail=False
).execute()

print("✅ Permission granted!")