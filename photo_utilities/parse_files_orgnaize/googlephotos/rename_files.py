import argparse
import os
import re

from utils import setup_logger, unique_path

logger = setup_logger("photo_organizer")

def rename_files_in_folder(folder_path):
    def pattern_transformations():
        return [
            # --- Existing patterns (1 to 27) ---
            (r'^VID_(\d{8}_\d{6})$', lambda m: f"{m.group(1)}"),
            (r'^[A-Z]+_(\d{8}_\d{6})$', lambda m: f"{m.group(1)}"),
            (r'^VID-(\d{8})-(WA\d+)$', lambda m: f"{m.group(1)}_{m.group(2)}"),
            (r'^VID-(\d{8})-(WA\d+)-([A-Z0-9_]+)$', lambda m: f"{m.group(1)}_{m.group(2)}_{m.group(3)}"),
            (r'^VID_(\d{8}_\d{6}_\d+)$', lambda m: m.group(1)),
            (r'^VID_(\d{8}_\d{6}\(\d+\))$', lambda m: m.group(1)),
            (r'^VideoCapture_(\d{8})-(\d{6})$', lambda m: f"{m.group(1)}_{m.group(2)}"),
            (r'^VID_(\d{8}_\d{6})-([A-Za-z0-9_]+)$', lambda m: f"{m.group(1)}_{m.group(2)}"),
            (r'^IMG-(\d{8})-(.+)$', lambda m: f"{m.group(1)}_{m.group(2)}"),
            (r'^.*_(\d{8})_(.+)$', lambda m: f"{m.group(1)}_{m.group(2)}"),
            (r'^(\d{8})(\d{6})$', lambda m: f"{m.group(1)}_{m.group(2)}"),
            (r'^(\d{8})-(.+)$', lambda m: f"{m.group(1)}_{m.group(2).replace('-', '_')}"),
            (r'^(\d{8})_(.+)$', lambda m: f"{m.group(1)}_{m.group(2)}"),
            (r'^(\d{4})-(\d{2})-(\d{2})-(.+)$', lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}_{m.group(4).replace('-', '_')}"),
            (r'^.*_(\d{8})-(.+)$', lambda m: f"{m.group(1)}_{m.group(2).replace('-', '_')}"),
            (r'^(\d{6})_(.+)$', lambda m: f"{m.group(1)}01_{m.group(2)}"),
            (r'^(\d{4})-(\d{2})-(\d{2})T(.+)$', lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}_{m.group(4).replace('-', '_')}"),
            (r'^.*(\d{4})-(\d{2})-(\d{2}) at (.+)$', lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}_{m.group(4).replace(' ', '_').replace('-', '_')}"),
            (r'^.*?(\d{2})(\d{2})(\d{4}) (\d{4})$', lambda m: f"{m.group(3)}{m.group(1)}{m.group(2)}_{m.group(4)}"),
            (r'^Screenshot_(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$', lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}_{m.group(4)}{m.group(5)}{m.group(6)}"),
            (r'^.*-(\d{8}) \((.+)\)$', lambda m: f"{m.group(1)}_{m.group(2)}"),
            (r'^(\d{2})-(\d{2})-(\d{2})_(.+)$', lambda m: f"{'20' + m.group(3) if int(m.group(3)) <= 50 else '19' + m.group(3)}{m.group(1)}{m.group(2)}_{m.group(4)}"),
            (r'^(\d{4})-(\d{2})-(\d{2}) (\d{2})\.(\d{2})\.(\d{2})$', lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}_{m.group(4)}{m.group(5)}{m.group(6)}"),
            (r'^(\d{8})_(\d{2})\.(\d{2})\.(\d{2})$', lambda m: f"{m.group(1)}_{m.group(2)}{m.group(3)}{m.group(4)}"),
            (r'^video-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$', lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}_{m.group(4)}-{m.group(5)}-{m.group(6)}"),
            (r'^Video_(\d{6})_(.+)$', lambda m: f"{'20' + m.group(1)[4:] if int(m.group(1)[4:]) <= 50 else '19' + m.group(1)[4:]}{m.group(1)[:2]}{m.group(1)[2:4]}_{m.group(2)}"),
            (r'^(.*)_(\d{6})_(.*)$', lambda m: f"{m.group(1)}_{'20' + m.group(2)[4:] if int(m.group(2)[4:]) <= 50 else '19' + m.group(2)[4:]}{m.group(2)[:2]}{m.group(2)[2:4]}_{m.group(3)}"),
            # Pattern 28: anything 2008_04_29_anything → 20080429_anything (drop prefix before date)
            (r'^(.*? )(\d{4})_(\d{2})_(\d{2})_(.+)$',
             lambda m: f"{m.group(2)}{m.group(3)}{m.group(4)}_{m.group(5)}"),
        ]

    patterns = pattern_transformations()

    for filename in os.listdir(folder_path):
        if filename.startswith('.'):
            logger.info("Skipping hidden file: %s", filename)
            continue

        old_path = os.path.join(folder_path, filename)
        if not os.path.isfile(old_path):
            logger.info("Skipping non-file: %s", filename)
            continue

        logger.info("Processing file for rename: %s", filename)

        name, ext = os.path.splitext(filename)
        new_name = None
        matched_pattern = None

        for pattern, transform in patterns:
            match = re.match(pattern, name)
            if match:
                new_name = f"{transform(match)}{ext}"
                matched_pattern = pattern
                break

        if new_name:
            new_path = os.path.join(folder_path, new_name)
            logger.info(
                "Matched pattern %r -> new_name: %s", matched_pattern, new_name
            )

            if os.path.exists(new_path):
                logger.warning("Target already exists: %s", new_path)
                new_path = unique_path(new_path)
                logger.warning("Renaming duplicate to: %s", new_path)

            os.rename(old_path, new_path)
            logger.info("Renamed: %s -> %s", filename, os.path.basename(new_path))
        else:
            logger.info("No pattern matched: %s", filename)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Rename media files to a YYYYMMDD_HHMMSS format."
    )
    parser.add_argument(
        "--folder",
        default="/Users/rajsiripuram02/Downloads/_fldr_",
        help="Folder to process (default: %(default)s)",
    )
    args = parser.parse_args()

    logger.info("Starting rename_files.py with args: %s", args)
    if os.path.isdir(args.folder):
        rename_files_in_folder(args.folder)
    else:
        logger.error("Invalid folder path: %s", args.folder)
