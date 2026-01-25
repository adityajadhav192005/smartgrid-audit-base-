"""Debug logging configuration for Smart Grid Audit Framework."""

import logging


def setup_debug_logging(level=logging.INFO):
    """Set up comprehensive debug logging for the framework.
    
    Args:
        level: Logging level (default: logging.INFO)
        
    Example:
        >>> setup_debug_logging()
        >>> logger = logging.getLogger(__name__)
        >>> logger.info("Framework initialized")
    """
    root = logging.getLogger()

    # Avoid duplicate handlers when setup is called multiple times
    if root.handlers:
        root.handlers.clear()

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def get_logger(name):
    """Get a logger instance for a specific module.
    
    Args:
        name: Module name (typically __name__)
        
    Returns:
        logging.Logger instance
    """
    return logging.getLogger(name)
