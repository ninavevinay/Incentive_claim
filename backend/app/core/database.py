from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

engine_kwargs = {
    "pool_pre_ping": True,
}
if not str(settings.database_url).startswith("sqlite"):
    engine_kwargs.update({
        "pool_size": settings.db_pool_size,
        "max_overflow": settings.db_max_overflow,
        "pool_timeout": settings.db_pool_timeout_seconds,
        "pool_recycle": settings.db_pool_recycle_seconds,
        "pool_use_lifo": settings.db_pool_use_lifo,
    })
if (
    not str(settings.database_url).startswith("sqlite")
    and settings.db_statement_timeout_ms > 0
):
    engine_kwargs["connect_args"] = {
        "options": f"-c statement_timeout={settings.db_statement_timeout_ms}"
    }

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
