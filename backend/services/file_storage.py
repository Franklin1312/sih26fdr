"""File Storage Service - Handles secure document upload, versioning, and validation."""

import hashlib
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO, Optional, Tuple

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
    
    def _get_case_upload_dir(self, case_id: str) -> Path:
        """Get the upload directory for a specific case."""
        case_dir = self.upload_root / "cases" / case_id
        case_dir.mkdir(parents=True, exist_ok=True)
        return case_dir
    
    def _compute_file_hash(self, file_path: Path) -> str:
        """Compute SHA-256 hash of a file."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def _detect_mime_type(self, file_path: Path, filename: str) -> str:
        """Detect MIME type from file extension (fallback)."""
        ext = file_path.suffix.lower()
        mime_map = {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".tiff": "image/tiff",
            ".tif": "image/tiff",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        return mime_map.get(ext, "application/octet-stream")
    
    def validate_file(self, file_path: Path, filename: str, mime_type: str) -> Tuple[bool, str]:
        """
        Validate uploaded file against configured rules.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check file size
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        max_size_mb = self.rule_engine.get_max_file_size_mb()
        
        if file_size_mb > max_size_mb:
            return False, f"File size ({file_size_mb:.1f} MB) exceeds maximum allowed ({max_size_mb} MB)"
        
        # Check MIME type
        allowed_types = self.rule_engine.get_allowed_mime_types()
        detected_mime = self._detect_mime_type(file_path, filename)
        
        # Use detected MIME type if provided one is generic
        if mime_type in ["application/octet-stream", ""]:
            mime_type = detected_mime
        
        if mime_type not in allowed_types:
            return False, f"File type '{mime_type}' is not allowed. Allowed types: {', '.join(allowed_types)}"
        
        return True, ""
    
    def virus_scan_stub(self, file_path: Path) -> Tuple[bool, str]:
        """
        Stub for virus scanning.
        
        In production, integrate with ClamAV, Windows Defender, or cloud AV.
        Returns (is_clean, scan_details)
        """
        if not self.rule_engine.is_virus_scan_enabled():
            return True, "Virus scan disabled (stub)"
        
        # Stub implementation - in production, call actual AV scanner
        # Example: subprocess.run(["clamscan", str(file_path)], capture_output=True)
        logger.info(f"Virus scan stub executed for {file_path}")
        return True, "Virus scan passed (stub)"
    
    def save_file(
        self,
        case_id: str,
        document_type: str,
        file_content: BinaryIO,
        original_filename: str,
        mime_type: str,
        uploaded_by: str,
    ) -> dict:
        """
        Save uploaded file with validation, versioning, and metadata.
        
        Returns:
            Dict with file metadata including path, hash, version, etc.
        """
        case_dir = self._get_case_upload_dir(case_id)
        
        # Create a unique filename with UUID to avoid collisions
        file_ext = Path(original_filename).suffix
        unique_filename = f"{document_type}_{uuid.uuid4().hex[:8]}{file_ext}"
        file_path = case_dir / unique_filename
        
        # Write file to disk
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file_content, f)
        
        # Validate file
        is_valid, error_msg = self.validate_file(file_path, original_filename, mime_type)
        if not is_valid:
            file_path.unlink(missing_ok=True)
            raise FileValidationError(error_msg)
        
        # Virus scan (stub)
        scan_clean, scan_details = self.virus_scan_stub(file_path)
        if not scan_clean:
            file_path.unlink(missing_ok=True)
            raise FileValidationError(f"Virus scan failed: {scan_details}")
        
        # Compute hash
        file_hash = self._compute_file_hash(file_path)
        file_size = file_path.stat().st_size
        
        # Determine version if versioning is enabled
        version = 1
        if self.rule_engine.is_versioning_enabled():
            # Check for existing files with same document_type
            existing_files = list(case_dir.glob(f"{document_type}_*"))
            if existing_files:
                version = len(existing_files) + 1
        
        logger.info(f"File saved: {file_path}, hash: {file_hash}, size: {file_size}, version: {version}")
        
        return {
            "file_path": str(file_path),
            "relative_path": str(file_path.relative_to(self.upload_root)),
            "original_filename": original_filename,
            "file_size": file_size,
            "mime_type": mime_type,
            "file_hash": file_hash,
            "version": version,
            "scan_details": scan_details,
        }
    
    def get_file_path(self, relative_path: str) -> Path:
        """Get absolute file path from relative path."""
        return self.upload_root / relative_path
    
    def file_exists(self, relative_path: str) -> bool:
        """Check if a file exists."""
        return self.get_file_path(relative_path).exists()
    
    def delete_file(self, relative_path: str) -> bool:
        """Delete a file (soft delete - moves to trash)."""
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
        """
        Generate a secure download token.
        
        In production, use JWT or signed URLs. This is a simple stub.
        """
        import hmac
        import base64
        
        payload = f"{relative_path}|{user_id}|{datetime.now(timezone.utc).timestamp() + expires_in_seconds}"
        secret = settings.secret_key.encode() if settings.secret_key else b"dev-secret"
        signature = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
        token = base64.urlsafe_b64encode(f"{payload}|{signature}".encode()).decode()
        return token
    
    def verify_download_token(self, token: str, user_id: str) -> Optional[str]:
        """
        Verify download token and return relative path if valid.
        
        Returns:
            relative_path if valid, None otherwise
        """
        import hmac
        import base64
        
        try:
            decoded = base64.urlsafe_b64decode(token.encode()).decode()
            parts = decoded.split("|")
            if len(parts) != 4:
                return None
            
            relative_path, token_user_id, expiry_str, signature = parts
            
            if token_user_id != user_id:
                return None
            
            if float(expiry_str) < datetime.now(timezone.utc).timestamp():
                return None
            
            # Verify signature
            payload = f"{relative_path}|{token_user_id}|{expiry_str}"
            secret = settings.secret_key.encode() if settings.secret_key else b"dev-secret"
            expected_signature = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                return None
            
            return relative_path
        except Exception:
            return None


# Module-level singleton
_file_storage_service: Optional[FileStorageService] = None


def get_file_storage() -> FileStorageService:
    """Get cached file storage service instance."""
    global _file_storage_service
    if _file_storage_service is None:
        _file_storage_service = FileStorageService()
    return _file_storage_service
