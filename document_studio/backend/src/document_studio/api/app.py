"""Application factory for the Document Studio standalone backend.

Usage with uvicorn:
    uvicorn document_studio.api.app:create_app --factory --host 127.0.0.1 --port 8100
"""

from fastapi import FastAPI

from document_studio.api.health import router as health_router


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    This factory keeps the application instance out of module-level state,
    which makes testing straightforward (each test gets a fresh app) and
    avoids import-time side effects.
    """
    app = FastAPI(
        title="Document Studio",
        version="0.1.0",
        description="Standalone document-processing backend.",
    )

    # --- Route registration -------------------------------------------------
    # Health is the only route in the scaffold. Future chunks will add
    # document upload, extraction, and export routers here.
    app.include_router(health_router)

    return app
