import argparse
import logging
import os
import re
import shutil
from datetime import datetime

from utils import setup_logger, unique_path

logger = setup_logger("photo_organizer")

# Media file extensions to process
MEDIA_EXTENSIONS = {
    'avi', 'mov', 'mp4', 'mpeg', 'mpg', 'vcd', 'vob', 'wmv',  # Video
    'mp3', 'wma',  # Audio
    'bmp', 'gif', 'jpg', 'jpeg', 'mpo', 'png', 'tif', 'tiff', 'wmf'  # Image
}


def is_media_file(filename):
    """Check if file is a media file based on extension."""
    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    return ext in MEDIA_EXTENSIONS


def extract_count_suffix(filename):
    """
    Extract base name, count, and extension from filename with count suffix.
    Handles nested count suffixes like file(1)(2).jpg
    Returns (base_name, count, ext) or None if no count suffix.
    """
    # Match one or more (count) suffixes before the extension
    match = re.match(r'^(.*?)((?:\([0-9]+\))+)(\.[^.]+)$', filename)
    if match:
        base_name = match.group(1)
        count_str = match.group(2)
        ext = match.group(3)
        # Extract the first count (outermost)
        count_match = re.match(r'\(([0-9]+)\)', count_str)
        if count_match:
            count = int(count_match.group(1))
            return base_name, count, ext
    return None


def find_variants(dirname, base_name, ext):
    """Find all variants of a file in the given directory, including nested count suffixes."""
    variants = []
    
    # Check for base file without count
    base_file = os.path.join(dirname, f"{base_name}{ext}")
    if os.path.isfile(base_file):
        variants.append((base_file, None))
    
    # Find all count-suffixed variants (including nested like (1)(2))
    pattern = re.compile(re.escape(base_name) + r'((?:\([0-9]+\))+)' + re.escape(ext))
    for filename in os.listdir(dirname):
        match = pattern.match(filename)
        if match:
            count_str = match.group(1)
            # Extract the first count (outermost)
            count_match = re.match(r'\(([0-9]+)\)', count_str)
            if count_match:
                count = int(count_match.group(1))
                filepath = os.path.join(dirname, filename)
                if os.path.isfile(filepath):
                    variants.append((filepath, count))
    
    return variants


def determine_keep_and_move(variants):
    """
    Determine which file to keep and which to move.
    Returns (to_keep, to_move) lists.
    Priority: base file > lowest count.
    """
    if len(variants) <= 1:
        return [], []
    
    # Sort by count (None first, then ascending)
    def sort_key(item):
        filepath, count = item
        return (0 if count is None else 1, count if count is not None else 0)
    
    sorted_variants = sorted(variants, key=sort_key)
    
    # Keep the first one, move the rest
    to_keep = [sorted_variants[0][0]]
    to_move = [item[0] for item in sorted_variants[1:]]
    
    return to_keep, to_move

def unzip_files_in_folder(folder_path):
    working_folder = os.path.join(folder_path, "_working_")
    os.makedirs(working_folder, exist_ok=True)
    logger.info("Working folder for extraction: %s", working_folder)
    processed_zips = []

    for item in os.listdir(folder_path):
        if item.lower().endswith('.zip'):
            zip_path = os.path.join(folder_path, item)
            logger.info("Processing zip file: %s", zip_path)
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    file_count = sum(
                        1 for name in zip_ref.namelist() if not name.endswith('/')
                    )
                    zip_ref.extractall(working_folder)
                    logger.info(
                        "Unzipped %s: %d files extracted to %s",
                        item,
                        file_count,
                        working_folder,
                    )
                    processed_zips.append(item)
            except zipfile.BadZipFile:
                logger.error("Failed to unzip (corrupt?): %s", item)
    return working_folder, processed_zips


def collect_from_sources(sources, working_folder):
    """Copy media files from multiple source folders into the working folder."""
    os.makedirs(working_folder, exist_ok=True)
    logger.info("Collecting files from %d source(s) into %s", len(sources), working_folder)
    total_copied = 0

    for source in sources:
        if not os.path.isdir(source):
            logger.warning("Source not a directory, skipping: %s", source)
            continue
        logger.info("Scanning source: %s", source)

        source_file_count = 0
        for root, _dirs, files in os.walk(source):
            logger.debug("Scanning directory: %s (%d files)", root, len(files))
            for filename in files:
                src_file = os.path.join(root, filename)
                if not os.path.isfile(src_file):
                    logger.debug("Skipping non-file: %s", src_file)
                    continue
                if filename.lower().endswith('.zip'):
                    logger.debug("Skipping ZIP file: %s", src_file)
                    continue
                dst_file = os.path.join(working_folder, filename)
                if os.path.exists(dst_file):
                    dst_file = unique_path(dst_file)
                    logger.debug("Duplicate detected, renaming to: %s", dst_file)
                try:
                    shutil.copy2(src_file, dst_file)
                    total_copied += 1
                    source_file_count += 1
                    if source_file_count % 100 == 0:
                        logger.info("Progress: %d files copied from %s to %s", source_file_count, source, working_folder)
                except OSError as exc:
                    logger.error("Failed to copy %s: %s", src_file, exc)

        logger.info("Copied %d files from source: %s", source_file_count, source)

    logger.info("Collected %d total files from all sources", total_copied)
    return working_folder

def process_duplicates(folder_path):
    """Move duplicate files with count suffixes to _duplicate_ folder."""
    duplicate_dir = os.path.join(folder_path, "_duplicate_")
    total_moved = 0
    
    logger.info("Processing duplicates in: %s", folder_path)
    logger.info("Duplicate folder: %s", duplicate_dir)
    
    os.makedirs(duplicate_dir, exist_ok=True)
    
    # Track processed base names to avoid redundant processing
    processed = set()
    
    # Walk through all files
    for root, dirs, files in os.walk(folder_path):
        # Skip the duplicate folder itself
        if root.startswith(duplicate_dir):
            continue
        
        for filename in files:
            filepath = os.path.join(root, filename)
            
            # Check if file has count suffix
            suffix_info = extract_count_suffix(filename)
            if not suffix_info:
                continue
            
            base_name, count, ext = suffix_info
            
            # Create a key for this base name + directory
            key = (root, base_name, ext)
            if key in processed:
                continue
            
            processed.add(key)
            
            # Find all variants
            variants = find_variants(root, base_name, ext)
            
            if len(variants) > 1:
                # Determine which to keep and which to move
                to_keep, to_move = determine_keep_and_move(variants)
                
                # Move duplicates
                for move_file in to_move:
                    move_name = os.path.basename(move_file)
                    move_dir = os.path.dirname(move_file)
                    
                    # Create corresponding directory in duplicate folder
                    rel_path = os.path.relpath(move_dir, folder_path)
                    dup_dir = os.path.join(duplicate_dir, rel_path)
                    
                    os.makedirs(dup_dir, exist_ok=True)
                    shutil.move(move_file, os.path.join(dup_dir, move_name))
                    logger.info("Moved duplicate: %s -> %s/%s", move_file, dup_dir, move_name)
                    total_moved += 1
    
    logger.info("Total duplicates moved: %d", total_moved)
    return total_moved


def process_folder(folder_path, media_only=False):
    default_folder = "_fldr_"
    logger.info("Starting folder organization: %s", folder_path)
    if media_only:
        logger.info("Media-only mode: only processing media files")

    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)

        # Skip directories and ZIP files
        if not os.path.isfile(file_path) or filename.lower().endswith('.zip'):
            logger.info("Skipping non-file/zip: %s", filename)
            continue
        
        # Skip non-media files if media_only is True
        if media_only and not is_media_file(filename):
            logger.info("Skipping non-media file: %s", filename)
            continue

        logger.info("Processing photo: %s", filename)

        # Try to parse date from filename first
        date_from_filename = None
        if '_' in filename:
            date_part = filename.split('_')[0]
            if len(date_part) == 8 and date_part.isdigit():
                date_from_filename = date_part
                year = date_part[:4]
                month = date_part[4:6]
                target_folder = os.path.join(folder_path, year, month, date_part)
                logger.info(
                    "Parsed date from filename: %s -> year=%s, month=%s, day=%s",
                    date_part,
                    year,
                    month,
                    date_part[6:8],
                )

        # If no valid date from filename, use file attributes (modified/creation)
        if not date_from_filename:
            try:
                stat = os.stat(file_path)
                # Use the older of birthtime (creation) and mtime (modified)
                birthtime = getattr(stat, 'st_birthtime', None)
                mtime = stat.st_mtime
                
                if birthtime:
                    # Use the older timestamp
                    timestamp = min(birthtime, mtime)
                else:
                    timestamp = mtime
                
                file_date = datetime.fromtimestamp(timestamp)
                year = str(file_date.year)
                month = f"{file_date.month:02d}"
                day = f"{file_date.day:02d}"
                date_str = f"{year}{month}{day}"
                target_folder = os.path.join(folder_path, year, month, date_str)
                logger.info(
                    "Parsed date from file attributes (older of creation/modified): %s -> year=%s, month=%s, day=%s",
                    file_date.strftime('%Y-%m-%d'),
                    year,
                    month,
                    day,
                )
            except Exception as exc:
                logger.warning("Failed to get date from file attributes: %s", exc)
                logger.info("Moving to '%s': %s", default_folder, filename)
                target_folder = os.path.join(folder_path, default_folder)

        os.makedirs(target_folder, exist_ok=True)

        dst_file = os.path.join(target_folder, filename)
        if os.path.exists(dst_file):
            logger.warning("Target already exists: %s", dst_file)
            dst_file = unique_path(dst_file)
            logger.warning("Renaming duplicate to: %s", dst_file)

        shutil.move(file_path, dst_file)
        logger.info("Moved: %s -> %s", filename, os.path.dirname(dst_file))

    logger.info("Folder organization complete: %s", folder_path)

def merge_folder(source, target):
    """Move files from source into target while preserving the year/month/day structure."""
    logger.info("Merging %s into %s", source, target)
    os.makedirs(target, exist_ok=True)

    for root, _dirs, files in os.walk(source):
        # Move regular files first, then macOS sidecars (._*), so sidecars are
        # renamed to match the final name of the main file.
        files.sort(key=lambda f: f.startswith("._"))

        rel_dir = os.path.relpath(root, source)
        target_dir = os.path.join(target, rel_dir)
        os.makedirs(target_dir, exist_ok=True)

        for filename in files:
            src_file = os.path.join(root, filename)
            if not os.path.isfile(src_file):
                logger.warning("Source file no longer exists; skipping: %s", src_file)
                continue

            dst_file = os.path.join(target_dir, filename)
            if os.path.exists(dst_file):
                logger.warning("Target exists in merge: %s", dst_file)
                dst_file = unique_path(dst_file)

            try:
                shutil.move(src_file, dst_file)
                logger.info("Merged: %s -> %s", src_file, dst_file)
            except FileNotFoundError:
                logger.warning("Source file disappeared during merge: %s", src_file)
            except OSError as exc:
                logger.error("Failed to merge %s: %s", src_file, exc)

    if os.path.exists(source):
        shutil.rmtree(source)
        logger.info("Removed source folder after merge: %s", source)


def generate_readme(target):
    """Write a readme.md in `target` listing year/month folders and file counts."""
    if not os.path.isdir(target):
        logger.warning("Cannot generate README; target is not a directory: %s", target)
        return

    rows = []
    total = 0
    tree = []
    for year in sorted(os.listdir(target)):
        year_path = os.path.join(target, year)
        if not os.path.isdir(year_path) or year.startswith('.'):
            continue
        tree.append(year)
        for month in sorted(os.listdir(year_path)):
            month_path = os.path.join(year_path, month)
            if not os.path.isdir(month_path) or month.startswith('.'):
                continue
            count = sum(
                1
                for root, _dirs, files in os.walk(month_path)
                for f in files
                if not f.startswith('.') and f.lower() != 'readme.md'
            )
            rows.append((year, month, count))
            total += count
            tree.append(f"   -> {month} -> ({count})")

    readme_path = os.path.join(target, "readme.md")
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write("# Photo Organizer Summary\n\n")
        f.write(f"**Destination:** {target}\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## Graphical Folder Summary\n\n")
        if tree:
            f.write("```text\n")
            f.write("\n".join(tree))
            f.write("\n```\n")
        else:
            f.write("No year/month folders found.\n")
        f.write("\n")
        f.write("## Year / Month File Counts\n\n")
        f.write("| Year | Month | File Count |\n")
        f.write("|------|-------|------------|\n")
        for year, month, count in rows:
            f.write(f"| {year} | {month} | {count} |\n")
        f.write(f"| **Total** | | **{total}** |\n")

    logger.info("Generated README: %s", readme_path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Organize Google Photos media into year/month/day folders."
    )
    parser.add_argument(
        "--folder",
        default="/Volumes/Extreme SSD/archived-zip",
        help="Root folder containing ZIPs and/or extracted media (default: %(default)s)",
    )
    parser.add_argument(
        "--sources",
        default=None,
        help="Additional source folders to collect media from before organizing (colon-separated)",
    )
    parser.add_argument(
        "--unzip", action="store_true", help="Extract ZIP files before organizing"
    )
    parser.add_argument(
        "--merge",
        nargs="?",
        const="/Volumes/Extreme SSD/google photos",
        default=None,
        help="Merge processed files into this folder (default: '%(const)s')",
    )
    parser.add_argument(
        "--direct",
        action="store_true",
        help="Process the folder directly without creating a _working_ subfolder",
    )
    parser.add_argument(
        "--media-only",
        action="store_true",
        help="Only process media files (skip non-media files)",
    )
    parser.add_argument(
        "--process-duplicates",
        action="store_true",
        help="Move duplicate files with count suffixes to _duplicate_ folder before organizing",
    )
    args = parser.parse_args()

    logger.info("Starting organize_google_media.py with args: %s", args)
    folder_path = args.folder
    if args.unzip:
        working_folder, processed_zips = unzip_files_in_folder(folder_path)
    elif args.direct:
        working_folder = folder_path
        processed_zips = []
    else:
        working_folder = os.path.join(folder_path, "_working_")
        processed_zips = []
    os.makedirs(working_folder, exist_ok=True)

    if args.sources:
        source_list = args.sources.split(":")
        collect_from_sources(source_list, working_folder)

    # Process duplicates before organization if requested
    if args.process_duplicates:
        logger.info("=== Processing duplicates (before organization) ===")
        process_duplicates(working_folder)

    process_folder(working_folder, media_only=args.media_only)

    # Process duplicates after organization if requested
    if args.process_duplicates:
        logger.info("=== Processing duplicates (after organization) ===")
        process_duplicates(working_folder)

    if processed_zips:
        done_folder = os.path.join(folder_path, "_done_")
        os.makedirs(done_folder, exist_ok=True)
        logger.info("Moving %d processed ZIP(s) to %s", len(processed_zips), done_folder)
        for zip_file in processed_zips:
            src = os.path.join(folder_path, zip_file)
            if not os.path.exists(src):
                logger.warning("ZIP no longer exists (already moved?): %s", zip_file)
                continue
            dst = os.path.join(done_folder, zip_file)
            if os.path.exists(dst):
                logger.warning("Done folder already contains %s; renaming", zip_file)
                dst = unique_path(dst)
            shutil.move(src, dst)
            logger.info("Moved processed zip to _done_: %s", zip_file)

    if args.merge:
        merge_folder(working_folder, args.merge)
        generate_readme(args.merge)
