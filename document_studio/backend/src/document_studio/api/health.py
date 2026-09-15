"""Health endpoint for the Document Studio backend.

Contract:
    GET /health → HTTP 200
    {
        "service": "document-studio",
        "status": "ok",
        "version": "0.1.0"
    }

The version is read from the package root so the health response stays in
sync with pyproject.toml and __init__.__version__ without duplication.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from document_studio import __version__

router = APIRouter()


@router.get("/health")
async def health() -> JSONResponse:
    """Return a structured health check confirming the service is alive.

    The response shape is a strict contract: downstream monitors and tests
    assert exact field names and values.
    """
    return JSONResponse(
        content={
            "service": "document-studio",
            "status": "ok",
            "version": __version__,
        },
        status_code=200,
    )
