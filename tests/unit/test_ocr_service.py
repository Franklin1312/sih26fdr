"""Unit tests for OCRService."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

from backend.services.ocr_service import OCRService


class TestOCRService:
    """Tests for OCRService."""

    @pytest.fixture
    def ocr_service(self):
        """Create an OCR service instance with mocked Tesseract."""
        with patch('backend.services.ocr_service.subprocess.run') as mock_run:
            mock_run.return_value.returncode = 0
            mock_run.return_value.stdout = "tesseract 5.3.0\n"
            service = OCRService()
            yield service

    def test_initialization(self, ocr_service):
        """Test OCR service initializes correctly."""
        assert ocr_service is not None
        assert hasattr(ocr_service, 'tesseract_cmd')

    def test_is_available_when_tesseract_installed(self, ocr_service):
        """Test is_available returns True when Tesseract is installed."""
        assert ocr_service.is_available() is True

    def test_is_available_when_tesseract_missing(self):
        """Test is_available returns False when Tesseract is missing."""
        with patch('backend.services.ocr_service.subprocess.run') as mock_run:
            mock_run.side_effect = FileNotFoundError("tesseract not found")
            service = OCRService()
            assert service.is_available() is False

    @pytest.mark.asyncio
    async def test_extract_text_unavailable(self):
        """Test extract_text returns empty when OCR unavailable."""
        with patch('backend.services.ocr_service.subprocess.run') as mock_run:
            mock_run.side_effect = FileNotFoundError("tesseract not found")
            service = OCRService()
            text, conf = await service.extract_text(Path("test.jpg"))
            assert text == ""
            assert conf == 0.0

    @pytest.mark.asyncio
    async def test_extract_from_pdf_unavailable(self):
        """Test extract_from_pdf returns empty when OCR unavailable."""
        with patch('backend.services.ocr_service.subprocess.run') as mock_run:
            mock_run.side_effect = FileNotFoundError("tesseract not found")
            service = OCRService()
            results = await service.extract_from_pdf(Path("test.pdf"))
            assert results == []

    def test_extract_structured_data_dates(self, ocr_service):
        """Test structured data extraction finds dates."""
        text = "Date: 15/01/2024 and 2024-02-20 and 10 Jan 2024"
        extracted = ocr_service.extract_structured_data(text)
        assert len(extracted["dates"]) >= 2
        assert any("15/01/2024" in d for d in extracted["dates"])
        assert any("2024-02-20" in d for d in extracted["dates"])

    def test_extract_structured_data_amounts(self, ocr_service):
        """Test structured data extraction finds amounts."""
        text = "Amount: Rs. 1,50,000 and INR 200000 and ₹ 5000.50"
        extracted = ocr_service.extract_structured_data(text)
        assert 150000.0 in extracted["amounts"]
        assert 200000.0 in extracted["amounts"]
        assert 5000.5 in extracted["amounts"]

    def test_extract_structured_data_references(self, ocr_service):
        """Test structured data extraction finds references."""
        text = "Ref: FDR-2024-0001 and UTR: ABCDEFGHIJK and Ref# XYZ123456"
        extracted = ocr_service.extract_structured_data(text)
        assert "FDR-2024-0001" in extracted["references"]
        assert "ABCDEFGHIJK" in extracted["references"]

    def test_extract_structured_data_deduplication(self, ocr_service):
        """Test extracted data is deduplicated."""
        text = "Date: 15/01/2024 Date: 15/01/2024 Amount: Rs. 1000 Amount: Rs. 1000"
        extracted = ocr_service.extract_structured_data(text)
        assert extracted["dates"].count("15/01/2024") == 1
        assert extracted["amounts"].count(1000.0) == 1