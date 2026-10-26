"""File Storage Service - Handles secure document upload, versioning, and validation."""

import hashlib
import logging
import shutil
import uuid
from datetime import UTC, datetime
from pathlib import Path

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
            if not settings.ocr_enabled:
                self._ocr_service = False
                return None
            try:
                from backend.services.ocr_service import get_ocr_service
                self._ocr_service = get_ocr_service()
            except Exception as e:
                logger.warning(f"OCR service unavailable: {e}")
                self._ocr_service = False
        return self._ocr_service if self._ocr_service is not False else None
    async def _run_ocr(self, file_path: Path, mime_type: str) -> tuple[str | None, float | None, dict | None]:
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

    def _validate_content(self, content: bytes, filename: str, claimed_mime: str) -> str:
        if not content:
            raise FileValidationError("The uploaded file is empty")
        if len(content) > settings.max_upload_size_mb * 1024 * 1024:
            raise FileValidationError(f"File exceeds the {settings.max_upload_size_mb} MB limit")
        suffix = Path(filename or "").suffix.lower()
        signatures = {
            ".pdf": ("application/pdf", content.startswith(b"%PDF-")),
            ".jpg": ("image/jpeg", content.startswith(b"\xff\xd8\xff")),
            ".jpeg": ("image/jpeg", content.startswith(b"\xff\xd8\xff")),
            ".png": ("image/png", content.startswith(b"\x89PNG\r\n\x1a\n")),
            ".tif": ("image/tiff", content.startswith((b"II*\x00", b"MM\x00*"))),
            ".tiff": ("image/tiff", content.startswith((b"II*\x00", b"MM\x00*"))),
        }
        expected = signatures.get(suffix)
        if not expected or claimed_mime not in (expected[0], "application/octet-stream"):
            raise FileValidationError("Only valid PDF, JPEG, PNG, and TIFF evidence is accepted")
        if not expected[1]:
            raise FileValidationError("File content does not match its declared type")
        return expected[0]

    def _store_file(
        self, case_id: str, document_type: str, file_content: bytes,
        original_filename: str, mime_type: str,
    ) -> dict:
        safe_mime = self._validate_content(file_content, original_filename, mime_type)
        filename = Path(original_filename or "evidence").name
        suffix = Path(filename).suffix.lower()
        stored_name = f"{uuid.uuid4().hex}{suffix}"
        case_dir = self._get_case_upload_dir(case_id)
        destination = case_dir / stored_name
        payload = file_content
        if settings.demo_mode and safe_mime == "application/pdf":
            header_end = payload.find(b"\n")
            if header_end >= 0:
                payload = payload[:header_end + 1] + b"% SYNTHETIC DEMO COPY - NOT AN OFFICIAL DOCUMENT\n" + payload[header_end + 1:]
        destination.write_bytes(payload)
        relative_path = destination.relative_to(self.upload_root).as_posix()
        return {
            "relative_path": relative_path,
            "original_filename": filename,
            "file_size": len(payload),
            "mime_type": safe_mime,
            "file_hash": self._compute_file_hash(destination),
            "version": 1,
            "validation_flags": {
                "demo_watermark": settings.demo_mode,
                "virus_scan": "not_configured",
                "advisory_only": True,
            },
        }

    def create_demo_pdf(self, title: str, reference: str) -> bytes:
        """Create a small synthetic PDF with a visible demo watermark."""
        def pdf_text(value: str) -> str:
            return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

        stream = (
            "q 0.82 g 0.8 w 0.707 0.707 -0.707 0.707 125 275 cm "
            "BT /F1 40 Tf 0 0 Td (SYNTHETIC DEMO - NOT OFFICIAL) Tj ET Q\n"
            "BT /F1 22 Tf 60 740 Td (SYNTHETIC DEMONSTRATION DOCUMENT) Tj ET\n"
            f"BT /F1 16 Tf 60 690 Td ({pdf_text(title)}) Tj ET\n"
            f"BT /F1 12 Tf 60 650 Td (Case reference: {pdf_text(reference)}) Tj ET\n"
            "BT /F1 11 Tf 60 610 Td (Generated sample evidence. No real institution or financial data.) Tj ET\n"
        ).encode("ascii", errors="replace")
        objects = [
            b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"endstream",
        ]
        result = bytearray(b"%PDF-1.4\n")
        offsets = [0]
        for index, obj in enumerate(objects, start=1):
            offsets.append(len(result))
            result.extend(f"{index} 0 obj\n".encode())
            result.extend(obj + b"\nendobj\n")
        xref_offset = len(result)
        result.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
        for offset in offsets[1:]:
            result.extend(f"{offset:010d} 00000 n \n".encode())
        result.extend(
            f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode()
        )
        return bytes(result)

    async def upload_file(
        self, case_id: str, file_content: bytes, original_filename: str,
        mime_type: str, document_type: str,
    ) -> dict:
        """Validate, privately store, and optionally extract uploaded evidence."""
        metadata = self._store_file(case_id, document_type, file_content, original_filename, mime_type)
        ocr_text, confidence, extracted = await self._run_ocr(
            self.get_file_path(metadata["relative_path"]), metadata["mime_type"]
        )
        metadata.update(ocr_text=ocr_text, ocr_confidence=confidence, extracted_data=extracted)
        return metadata

    def save_file(
        self, case_id: str, document_type: str, file_content,
        original_filename: str, mime_type: str, uploaded_by: str,
    ) -> dict:
        """Synchronous compatibility entry point used by replacement uploads."""
        content = file_content.read() if hasattr(file_content, "read") else bytes(file_content)
        return self._store_file(case_id, document_type, content, original_filename, mime_type)
    def get_file_path(self, relative_path: str) -> Path:
        candidate = (self.upload_root / relative_path).resolve()
        if not candidate.is_relative_to(self.upload_root.resolve()):
            raise FileValidationError("Invalid file path")
        return candidate

    def file_exists(self, relative_path: str) -> bool:
        return self.get_file_path(relative_path).exists()

    def ensure_demo_file(self, relative_path: str, original_filename: str = "", case_id: str = "") -> Path:
        """Ensure a demo PDF exists on disk, generating synthetic content if missing."""
        file_path = self.get_file_path(relative_path)
        if not file_path.exists():
            file_path.parent.mkdir(parents=True, exist_ok=True)
            title = original_filename or file_path.name
            clean_title = title.replace("_", " ").replace(".pdf", "")
            reference = case_id or "AICTE-DEMO"
            pdf_bytes = self.create_demo_pdf(
                title=f"Sample Deposit Document: {clean_title}",
                reference=reference,
            )
            file_path.write_bytes(pdf_bytes)
            logger.info(f"Generated synthetic demo evidence at {file_path}")
        return file_path

    def delete_file(self, relative_path: str) -> bool:
        file_path = self.get_file_path(relative_path)
        if file_path.exists():
            trash_dir = self.upload_root / ".trash"
            trash_dir.mkdir(exist_ok=True)
            trash_path = trash_dir / f"{datetime.now(UTC).isoformat()}_{file_path.name}"
            shutil.move(str(file_path), str(trash_path))
            logger.info(f"File moved to trash: {trash_path}")
            return True
        return False

    def generate_download_token(self, relative_path: str, user_id: str, expires_in_seconds: int = 3600) -> str:
        import base64
        import hmac
        payload = f"{relative_path}|{user_id}|{datetime.now(UTC).timestamp() + expires_in_seconds}"
        secret = settings.secret_key.encode() if settings.secret_key else b"dev-secret"
        signature = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
        return base64.urlsafe_b64encode(f"{payload}|{signature}".encode()).decode()

    def verify_download_token(self, token: str, user_id: str) -> str | None:
        import base64
        import hmac
        try:
            decoded = base64.urlsafe_b64decode(token.encode()).decode()
            parts = decoded.split("|")
            if len(parts) != 4:
                return None
            relative_path, token_user_id, expiry_str, signature = parts
            if token_user_id != user_id:
                return None
            if float(expiry_str) < datetime.now(UTC).timestamp():
                return None
            payload = f"{relative_path}|{token_user_id}|{expiry_str}"
            secret = settings.secret_key.encode() if settings.secret_key else b"dev-secret"
            expected = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                return None
            return relative_path
        except Exception:
            return None


_file_storage_service: FileStorageService | None = None


def get_file_storage() -> FileStorageService:
    global _file_storage_service
    if _file_storage_service is None:
        _file_storage_service = FileStorageService()
    return _file_storage_service
