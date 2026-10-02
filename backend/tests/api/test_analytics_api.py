import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_get_analytics_summary():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/analytics/summary")
        assert res.status_code == 200
        data = res.json()

        assert "total_requests" in data
        assert "open_backlog" in data
        assert "sla_compliance_pct" in data
        assert "estimated_km_saved" in data
        assert "status_distribution" in data
        assert "priority_distribution" in data
        assert "waste_type_distribution" in data
        assert data["sla_compliance_pct"] >= 0.0


@pytest.mark.asyncio
async def test_get_heatmap_points():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/analytics/heatmap")
        assert res.status_code == 200
        points = res.json()
        assert isinstance(points, list)
        if len(points) > 0:
            pt = points[0]
            assert "latitude" in pt
            assert "longitude" in pt
            assert "intensity" in pt
            assert "request_count" in pt


@pytest.mark.asyncio
async def test_get_team_productivity():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/analytics/teams")
        assert res.status_code == 200
        teams = res.json()
        assert isinstance(teams, list)


@pytest.mark.asyncio
async def test_get_notifications():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/analytics/notifications")
        assert res.status_code == 200
        notifs = res.json()
        assert isinstance(notifs, list)


@pytest.mark.asyncio
async def test_export_operations_csv():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/analytics/export")
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "id,created_at,latitude,longitude" in res.text
