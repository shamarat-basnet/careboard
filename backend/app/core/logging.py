import logging
import sys


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        stream=sys.stdout,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        force=True,
    )
    # Our own middleware logs requests; uvicorn's access log would duplicate them.
    logging.getLogger("uvicorn.access").disabled = True
