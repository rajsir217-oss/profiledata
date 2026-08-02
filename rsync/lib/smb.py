from __future__ import annotations

import subprocess
import time
from pathlib import Path

from .logging import Logger


class SmbManager:
    def __init__(
        self,
        logger: Logger,
        server: str,
        smb_user: str,
        share: str,
        mount_point: Path,
        max_retries: int,
        retry_delay_seconds: int,
    ) -> None:
        self.logger = logger
        self.server = server
        self.smb_user = smb_user
        self.share = share
        self.mount_point = mount_point
        self.max_retries = max(max_retries, 1)
        self.retry_delay_seconds = max(retry_delay_seconds, 1)
        self.mounted_by_script = False

    def is_mounted(self) -> bool:
        result = subprocess.run(["mount"], capture_output=True, text=True, check=False)
        needle = f"on {self.mount_point} "
        return needle in result.stdout

    def mount(self) -> None:
        if self.is_mounted():
            self.logger.info(f"SMB already mounted at {self.mount_point}")
            return

        self.mount_point.mkdir(parents=True, exist_ok=True)

        target = f"//{self.smb_user}@{self.server}/{self.share}"
        for attempt in range(1, self.max_retries + 1):
            self.logger.info(f"Mounting SMB ({attempt}/{self.max_retries})...")
            rc = subprocess.run(
                ["mount_smbfs", target, str(self.mount_point)],
                capture_output=True,
                text=True,
                check=False,
            )
            if rc.returncode == 0 and self.is_mounted():
                self.mounted_by_script = True
                self.logger.success(f"Mount successful: {self.mount_point}")
                return

            stderr = (rc.stderr or "").strip()
            if stderr:
                self.logger.warn(f"mount_smbfs error: {stderr}")

            if attempt < self.max_retries:
                time.sleep(self.retry_delay_seconds)

        raise RuntimeError(f"Unable to mount SMB share at {self.mount_point}")

    def unmount(self) -> None:
        if not self.is_mounted():
            return
        rc = subprocess.run(
            ["umount", str(self.mount_point)],
            capture_output=True,
            text=True,
            check=False,
        )
        if rc.returncode == 0:
            self.logger.info(f"Unmounted {self.mount_point}")
            return
        stderr = (rc.stderr or "").strip()
        raise RuntimeError(f"Failed to unmount {self.mount_point}: {stderr}")
