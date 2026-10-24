"""File Storage Service - Handles secure document upload, versioning, and validation."""

import hashlib
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

from backend.config import get_settings
from backend.services.rule_engine import get_rule_engine

settings = get_settings()
logger = logging.getLogger("sih26psfdr.file_storage")


class FileValidationError(Exception):
    """Raised when file validation fails."""
    pass


class FileStorageService:
    """Service for managing file uploads, storage, and validation."""
    
    def __init__(self):
        self.upload_root = settings.upload_path
        self.rule_engine = get_rule_engine()
        self._ocr_service = None
    
    def _get_ocr_service(self):
        if self._ocr_service is None:
            try:
                from backend.services.ocr_service import get_ocr_service
                self._ocr_service = get_ocr_service()
            except Exception as e:
                logger.warning(f"OCR service unavailable: {e}")
                self._ocr_service = False
        return self._ocr_service if self._ocr_service is not False else None
    async def _run_ocr(self, file_path: Path, mime_type: str) -> Tuple[Optional[str], Optional[float], Optional[dict]]:
        if mime_type not in ["application/pdf", "image/jpeg", "image/png", "image/tiff"]:
            return None, None, None
        
        ocr_service = self._get_ocr_service()
        if not ocr_service or not ocr_service.is_available():
            return None, None, None
        
        try:
            if mime_type == "application/pdf":
                results = await ocr_service.extract_from_pdf(file_path)
                if not results:
                    return None, None, None
                all_text = " ".join([r[0] for r in results if r[0]])
                avg_conf = sum(r[1] for r in results) / len(results) if results else 0.0
            else:
                all_text, avg_conf = await ocr_service.extract_text(file_path)
                if not all_text:
                    return None, None, None
            
            extracted = ocr_service.extract_structured_data(all_text)
            logger.info(f"OCR complete: {len(all_text)} chars, confidence={avg_conf:.1f}%")
            return all_text, avg_conf, extracted
        except Exception as e:
            logger.error(f"OCR failed: {e}")
            return None, None, None
    
    def _get_case_upload_dir(self, case_id: str) -> Path:
        case_dir = self.upload_root / "cases" / case_id
        case_dir.mkdir(parents=True, exist_ok=True)
        return case_dir
    
    def _compute_file_hash(self, file_path: Path) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def _detect_mime_type(self, file_path: Path, filename: str) -> str:
        ext = file_path.suffix.lower()
        mime_map = {
            ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".tiff": "image/tiff", ".tif": "image/tiff",
            ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        return mime_map.get(ext, "application/octet-stream")
    def get_file_path(self, relative_path: str) -> Path:
        return self.upload_root / relative_path
    
    def file_exists(self, relative_path: str) -> bool:
        return self.get_file_path(relative_path).exists()
    
    def delete_file(self, relative_path: str) -> bool:
        file_path = self.get_file_path(relative_path)
        if file_path.exists():
            trash_dir = self.upload_root / ".trash"
            trash_dir.mkdir(exist_ok=True)
            trash_path = trash_dir / f"{datetime.now(timezone.utc).isoformat()}_{file_path.name}"
            shutil.move(str(file_path), str(trash_path))
            logger.info(f"File moved to trash: {trash_path}")
            return True
        return False
    
    def generate_download_token(self, relative_path: str, user_id: str, expires_in_seconds: int = 3600) -> str:
        import hmac, base64
        payload = f"{relative_path}|{user_id}|{datetime.now(timezone.utc).timestamp() + expires_in_seconds}"
        secret = settings.secret_key.encode() if settings.secret_key else b"dev-secret"
        signature = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
        return base64.urlsafe_b64encode(f"{payload}|{signature}".encode()).decode()
    
    def verify_download_token(self, token: str, user_id: str) -> Optional[str]:
        import hmac, base64
        try:
            decoded = base64.urlsafe_b64decode(token.encode()).decode()
            parts = decoded.split("|")
            if len(parts) != 4: return None
            relative_path, token_user_id, expiry_str, signature = parts
            if token_user_id != user_id: return None
            if float(expiry_str) < datetime.now(timezone.utc).timestamp(): return None
            payload = f"{relative_path}|{token_user_id}|{expiry_str}"
            secret = settings.secret_key.encode() if settings.secret_key else b"dev-secret"
            expected = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected): return None
            return relative_path
        except Exception:
            return None


_file_storage_service: Optional[FileStorageService] = None


def get_file_storage() -> FileStorageService:
    global _file_storage_service
    if _file_storage_service is None:
        _file_storage_service = FileStorageService()
    return _file_storage_service
