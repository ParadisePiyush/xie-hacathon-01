from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.logging import logger

database_url = settings.DATABASE_URL
# Handle psycopg dialect or fallback
if database_url.startswith("postgresql+psycopg://") or database_url.startswith("postgresql://"):
    connect_args = {}
elif database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

try:
    engine = create_engine(
        database_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
except Exception as e:
    logger.warning("Could not initialize PostgreSQL engine with %s: %s. Using SQLite fallback.", database_url, e)
    engine = create_engine(
        "sqlite:///./waste_app.db",
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
