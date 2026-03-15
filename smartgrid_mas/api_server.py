"""Run REST API server for SCADA integration.

Usage:
    python -m smartgrid_mas.api_server
    
Environment variables:
    SMARTGRID_API_HOST: API host (default: 127.0.0.1)
    SMARTGRID_API_PORT: API port (default: 8000)
    SMARTGRID_API_KEY: API key for /v1/* endpoints (default: smartgrid-dev-key)
    SMARTGRID_RATE_LIMIT: Max requests per minute (default: 100)
"""

from __future__ import annotations

import os
import logging
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    host = os.environ.get("SMARTGRID_API_HOST", "127.0.0.1")
    port = int(os.environ.get("SMARTGRID_API_PORT", "8000"))
    api_key = os.environ.get("SMARTGRID_API_KEY", "smartgrid-dev-key")
    
    logger.info(f"Starting API server on {host}:{port}")
    logger.info(f"API key protection enabled: {bool(api_key)}")
    
    uvicorn.run("smartgrid_mas.api.app:app", host=host, port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()
