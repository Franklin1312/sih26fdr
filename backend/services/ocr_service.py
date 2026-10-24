"""OCR Service - Text extraction from documents (advisory only)."""

import logging
import re
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image, ImageEnhance
import pytesseract
from pdf2image import convert_from_path

from backend.config import get_settings

settings = get_settings()
logger = logging.getLogger("sih26psfdr.ocr")


class OCRService:
    """Service for extracting text from images and PDFs using Tesseract OCR.
    
    All OCR results are ADVISORY ONLY - never used for automatic decisions.
    Human reviewers must explicitly acknowledge any findings.
    """

    def __init__(self):
        self.tesseract_cmd = settings.tesseract_cmd
        self._available = self._verify_tesseract()

    def _verify_tesseract(self) -> bool:
        try:
            result = subprocess.run(
                [self.tesseract_cmd, "--version"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                logger.info(f"Tesseract OCR: {result.stdout.split(chr(10))[0]}")
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            logger.warning(f"Tesseract not available: {e}")
        except Exception as e:
            logger.warning(f"Tesseract check error: {e}")
        return False

    def is_available(self) -> bool:
        return self._available

    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        if image.mode != 'L':
            image = image.convert('L')
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
        w, h = image.size
        if w < 1000:
            scale = 1000 / w
            image = image.resize((int(w*scale), int(h*scale)), Image.Resampling.LANCZOS)
        return image

    async def extract_text(self, file_path: Path) -> Tuple[str, float]:
        if not self.is_available():
            logger.warning("OCR unavailable")
            return "", 0.0
        try:
            image = self._preprocess_image(Image.open(file_path))
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT, config='--psm 6')
            words, confs = [], []
            for i in range(len(data['text'])):
                t = data['text'][i].strip()
                c = data['conf'][i]
                if t and c > 0:
                    words.append(t)
                    confs.append(c)
            text = ' '.join(words)
            avg = sum(confs)/len(confs) if confs else 0.0
            logger.info(f"OCR: {len(words)} words, conf={avg:.1f}%")
            return text, avg
        except Exception as e:
            logger.error(f"OCR failed: {e}")
            return "", 0.0

    async def extract_from_pdf(self, file_path: Path) -> List[Tuple[str, float]]:
        if not self.is_available():
            return []
        try:
            images = convert_from_path(file_path, dpi=300, fmt='png', thread_count=1)
            results = []
            for i, img in enumerate(images):
                img = self._preprocess_image(img)
                data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT, config='--psm 6')
                words, confs = [], []
                for j in range(len(data['text'])):
                    t = data['text'][j].strip()
                    c = data['conf'][j]
                    if t and c > 0:
                        words.append(t)
                        confs.append(c)
                text = ' '.join(words)
                avg = sum(confs)/len(confs) if confs else 0.0
                results.append((text, avg))
                logger.info(f"  Page {i+1}: {len(words)} words, conf={avg:.1f}%")
            return results
        except Exception as e:
            logger.error(f"PDF OCR failed: {e}")
            return []

    def extract_structured_data(self, text: str) -> dict:
        extracted = {"dates": [], "amounts": [], "references": [], "raw_text": text[:5000]}
        
        for pat in [r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b', r'\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b', r'\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b']:
            extracted["dates"].extend(re.findall(pat, text, re.IGNORECASE))
        
        for pat in [r'(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)', r'([\d,]+\.?\d*)\s*(?:Rs\.?|INR|₹)', r'\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b']:
            for m in re.findall(pat, text, re.IGNORECASE):
                try:
                    v = float(m.replace(',', ''))
                    if v > 0: extracted["amounts"].append(v)
                except: pass
        
        for pat in [r'\b([A-Z]{2,5}[-/]\d{4,6}[-/]\d{3,8})\b', r'\b([A-Z]{3,6}\d{6,10})\b', r'\b(?:UTR|Ref|Reference)[:#\s]*([A-Z0-9]{10,})\b']:
            extracted["references"].extend(re.findall(pat, text, re.IGNORECASE))
        
        extracted["dates"] = list(set(extracted["dates"]))
        extracted["amounts"] = list(set(extracted["amounts"]))
        extracted["references"] = list(set(extracted["references"]))
        return extracted


_ocr_service: Optional[OCRService] = None


def get_ocr_service() -> OCRService:
    global _ocr_service
    if _ocr_service is None:
        _ocr_service = OCRService()
    return _ocr_service