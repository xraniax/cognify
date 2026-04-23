import base64
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from google.oauth2 import service_account
from googleapiclient.discovery import build

logger = logging.getLogger("engine-google-client")

_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
_CACHED_DRIVE_SERVICE = None


class GoogleDriveConfigError(RuntimeError):
    """Raised when Google Drive config is missing or invalid in development."""


class GoogleDriveNotConfiguredError(RuntimeError):
    """Raised when Google Drive is not configured in production."""


def _is_production() -> bool:
    env = (os.getenv("NODE_ENV") or os.getenv("ENV") or "").strip().lower()
    return env in {"production", "prod"}


def _safe_parse_service_account_json(raw_text: str) -> Dict[str, Any]:
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise GoogleDriveConfigError(
            "Invalid Google service account JSON payload in environment configuration"
        ) from e

    if not isinstance(data, dict):
        raise GoogleDriveConfigError("Google service account payload must be a JSON object")
    return data


def _load_credentials_from_base64() -> Optional[Tuple[Dict[str, Any], str]]:
    encoded = (os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64") or "").strip()
    if not encoded:
        return None

    try:
        decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
    except Exception as e:
        raise GoogleDriveConfigError(
            "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is set but is not valid base64"
        ) from e

    info = _safe_parse_service_account_json(decoded)
    return info, "base64"


def _load_credentials_from_file() -> Optional[Tuple[Dict[str, Any], str]]:
    file_path = (os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE") or "").strip()
    if not file_path:
        return None

    resolved = Path(file_path)
    if not resolved.exists():
        # Dev-only compatibility fallback for legacy relative paths.
        legacy = Path(__file__).resolve().parent / "credentials" / resolved.name
        if legacy.exists():
            resolved = legacy

    if not resolved.exists():
        raise GoogleDriveConfigError(
            "Google Drive fallback file not found. Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 or a valid GOOGLE_SERVICE_ACCOUNT_FILE"
        )

    logger.warning(
        "Using development-only GOOGLE_SERVICE_ACCOUNT_FILE fallback; prefer GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"
    )
    with resolved.open("r", encoding="utf-8") as fh:
        info = _safe_parse_service_account_json(fh.read())
    return info, "file"


def _load_service_account_info() -> Optional[Tuple[Dict[str, Any], str]]:
    file_result = _load_credentials_from_file()
    if file_result:
        return file_result

    base64_result = _load_credentials_from_base64()
    if base64_result:
        return base64_result

    if _is_production():
        return None

    raise GoogleDriveConfigError(
        "Google Drive credentials are missing. Set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (preferred) "
        "or GOOGLE_SERVICE_ACCOUNT_FILE (development fallback only)."
    )


def get_google_drive_folder_id() -> str:
    folder_id = (os.getenv("GOOGLE_DRIVE_FOLDER_ID") or "").strip()
    if folder_id:
        return folder_id

    if _is_production():
        raise GoogleDriveNotConfiguredError("Google Drive integration not configured")

    raise GoogleDriveConfigError(
        "GOOGLE_DRIVE_FOLDER_ID is required for Google Drive integration"
    )


def get_google_drive_config_mode() -> str:
    """Return credential mode without exposing secrets: FILE, BASE64, or NOT_CONFIGURED."""
    file_path = (os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE") or "").strip()
    if file_path:
        resolved = Path(file_path)
        if resolved.exists():
            return "FILE"

        # Dev-only compatibility fallback for legacy relative paths.
        legacy = Path(__file__).resolve().parent / "credentials" / resolved.name
        if legacy.exists():
            return "FILE"

    encoded = (os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64") or "").strip()
    if encoded:
        return "BASE64"

    return "NOT_CONFIGURED"


def log_google_drive_config_mode() -> None:
    mode = get_google_drive_config_mode()
    logger.info("Google Drive config mode: %s", mode)


def get_drive_service():
    global _CACHED_DRIVE_SERVICE

    if _CACHED_DRIVE_SERVICE is not None:
        return _CACHED_DRIVE_SERVICE

    info_source = _load_service_account_info()
    if info_source is None:
        # Production behavior: integration disabled, caller can surface clean message.
        raise GoogleDriveNotConfiguredError("Google Drive integration not configured")

    info, source = info_source
    creds = service_account.Credentials.from_service_account_info(info, scopes=_DRIVE_SCOPES)
    _CACHED_DRIVE_SERVICE = build("drive", "v3", credentials=creds)

    logger.info("Google Drive client initialized (credentials source: %s)", source)
    return _CACHED_DRIVE_SERVICE
