import pytest
from httpx import ASGITransport, AsyncClient

from app.core.rate_limiter import rate_limiter
from app.main import app


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    rate_limiter.reset()
    yield
    rate_limiter.reset()


@pytest.mark.asyncio
async def test_login_successful_and_jwt_format():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@smartwaste.city", "password": "Admin@123"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "admin@smartwaste.city"
        assert data["user"]["role"] == "admin"


@pytest.mark.asyncio
async def test_login_invalid_password_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@smartwaste.city", "password": "WrongPassword!"},
        )
        assert res.status_code == 401
        data = res.json()
        assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_token_refresh():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Login
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "dispatcher@smartwaste.city", "password": "Dispatch@123"},
        )
        refresh_token = login_res.json()["refresh_token"]

        # 2. Refresh
        refresh_res = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_res.status_code == 200
        data = refresh_res.json()
        assert "access_token" in data
        assert data["user"]["role"] == "dispatcher"


@pytest.mark.asyncio
async def test_get_me_profile_with_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Login
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "collector@smartwaste.city", "password": "Collector@123"},
        )
        token = login_res.json()["access_token"]

        # 2. Call /auth/me
        me_res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        user = me_res.json()
        assert user["email"] == "collector@smartwaste.city"
        assert user["role"] == "collector"
        assert user["team_id"] == "team-alpha"


@pytest.mark.asyncio
async def test_get_me_unauthorized_without_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/auth/me")
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_register_new_reporter():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        unique_email = "jane.resident@example.com"
        res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "SecurePassword123",
                "full_name": "Jane Resident",
                "role": "reporter",
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert data["user"]["email"] == unique_email
        assert data["user"]["role"] == "reporter"

        # Duplicate register attempt
        dup_res = await client.post(
            "/api/v1/auth/register",
            json={
                "email": unique_email,
                "password": "SecurePassword123",
                "full_name": "Jane Resident",
            },
        )
        assert dup_res.status_code == 400


@pytest.mark.asyncio
async def test_rbac_admin_can_access_users_and_audit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Login as Admin
        admin_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@smartwaste.city", "password": "Admin@123"},
        )
        admin_token = admin_login.json()["access_token"]

        # 1. Admin accesses /users
        users_res = await client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert users_res.status_code == 200
        assert len(users_res.json()) >= 4

        # 2. Admin accesses /audit-logs
        audit_res = await client.get(
            "/api/v1/audit-logs",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert audit_res.status_code == 200
        assert len(audit_res.json()) > 0


@pytest.mark.asyncio
async def test_rbac_reporter_forbidden_from_admin_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Login as Citizen Reporter
        reporter_login = await client.post(
            "/api/v1/auth/login",
            json={"email": "citizen@smartwaste.city", "password": "Citizen@123"},
        )
        reporter_token = reporter_login.json()["access_token"]

        # Reporter tries to access /users -> 403 Forbidden
        users_res = await client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {reporter_token}"},
        )
        assert users_res.status_code == 403
        assert users_res.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_rate_limiter_blocks_excessive_logins():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Attempt 5 logins
        for _ in range(5):
            await client.post(
                "/api/v1/auth/login",
                json={"email": "admin@smartwaste.city", "password": "WrongPassword"},
            )

        # 6th login triggers 429
        blocked_res = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@smartwaste.city", "password": "Admin@123"},
        )
        assert blocked_res.status_code == 429
        assert blocked_res.json()["error"]["code"] == "RATE_LIMITED"
        assert "Retry-After" in blocked_res.headers
