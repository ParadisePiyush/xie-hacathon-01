import io
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_bulk_csv_import(async_client: AsyncClient):
    csv_content = (
        "latitude,longitude,waste_type,volume,description,address\n"
        "19.9975,73.7898,hazardous,large,Hazardous battery dump,Old Market 1\n"
        "20.0100,73.8100,medical,medium,Medical clinic discard,East Street 4\n"
        "invalid_lat,73.8100,general,small,Broken lat row,Error road\n"
    )

    files = {"file": ("requests.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = await async_client.post("/api/v1/requests/import", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total_rows"] == 3
    assert data["imported_count"] == 2
    assert data["failed_count"] == 1
    assert len(data["errors"]) == 1
    assert data["errors"][0]["row_number"] == 4

    # Verify requests were actually imported into database/store
    list_res = await async_client.get("/api/v1/requests")
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 2
