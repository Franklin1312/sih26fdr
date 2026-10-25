"""Reporting response models."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ReportCaseRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    case_id: str
    case_number: str
    institution_name: str
    instrument_number: str
    amount: float
    status: str
    maturity_date: Optional[datetime] = None
    days_to_maturity: Optional[int] = None
    missing_documents: List[str] = Field(default_factory=list)
    requires_intervention: bool
    intervention_reason: Optional[str] = None


class ReportsSummary(BaseModel):
    generated_at: datetime
    total_cases: int
    total_amount: float
    pending_verification: int
    upcoming_maturities: int
    missing_documents: int
    requiring_intervention: int
    cases: List[ReportCaseRow]
