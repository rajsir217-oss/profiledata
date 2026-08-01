import logging
import os

LOG_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(LOG_DIR, "photo_organizer.log")


def setup_logger(name="photo_organizer"):
    """Return a logger that writes to both console and a log file."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler
    file_handler = logging.FileHandler(LOG_FILE, mode="a")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger


def unique_path(path):
    """Return a unique path by appending (1), (2), ... before the extension."""
    if not os.path.exists(path):
        return path

    base, ext = os.path.splitext(path)
    counter = 1
    while True:
        candidate = f"{base}({counter}){ext}"
        if not os.path.exists(candidate):
            return candidate
        counter += 1
