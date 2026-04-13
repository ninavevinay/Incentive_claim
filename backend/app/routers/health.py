from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    return {"status": "ok"}
@router.get("/")
def read_root():
    return {"message": "Hello World"}