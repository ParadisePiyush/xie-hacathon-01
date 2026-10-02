from typing import List
from pydantic import BaseModel
from app.schemas.request import PickupRequestResponse


class ImportRowError(BaseModel):
    row_number: int
    error: str


class ImportRequestsResult(BaseModel):
    total_rows: int
    imported_count: int
    failed_count: int
    errors: List[ImportRowError] = []
    sample_imported: List[PickupRequestResponse] = []
