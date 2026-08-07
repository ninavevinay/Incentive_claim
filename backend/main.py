import uvicorn
from app.core.config import settings
from app.main import app

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        reload_dirs=["app"],
        reload_excludes=["venv", ".venv", "uploads", "*.sqlite3", "*.pyc"],
    )




