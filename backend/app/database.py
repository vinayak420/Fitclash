import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fitclash.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print("DATABASE_URL:", DATABASE_URL)


def ensure_schema():
    """create_all will not add columns to existing tables."""
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("users")}
    if "avatar_key" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_key VARCHAR(512)"))
