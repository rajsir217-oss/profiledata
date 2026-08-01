#!/usr/bin/env python3
"""
Move duplicate files with count suffixes to _duplicate_ folder.
Keeps the base file or lowest count, moves higher counts.
"""

import argparse
import logging
import os
import re
import shutil
from pathlib import Path

from utils import setup_logger

logger = setup_logger("move_duplicates")


def extract_count_suffix(filename):
    """
    Extract base name, count, and extension from filename with count suffix.
    Returns (base_name, count, ext) or None if no count suffix.
    Examples:
        "us_blue(1).jpg" -> ("us_blue", 1, ".jpg")
        "us_blue.jpg" -> None
    """
    match = re.match(r'^(.*)\(([0-9]+)\)(\.[^.]+)$', filename)
    if match:
        base_name = match.group(1)
        count = int(match.group(2))
        ext = match.group(3)
        return base_name, count, ext
    return None


def find_variants(dirname, base_name, ext):
    """
    Find all variants of a file in the given directory.
    Returns list of (filepath, count) tuples.
    Count is None for base file without suffix.
    """
    variants = []
    
    # Check for base file without count
    base_file = os.path.join(dirname, f"{base_name}{ext}")
    if os.path.isfile(base_file):
        variants.append((base_file, None))
    
    # Find all count-suffixed variants
    pattern = re.compile(re.escape(base_name) + r'\(([0-9]+)\)' + re.escape(ext))
    for filename in os.listdir(dirname):
        match = pattern.match(filename)
        if match:
            count = int(match.group(1))
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


def move_duplicates(directory, dry_run=False):
    """
    Scan directory recursively and move duplicate files to _duplicate_ folder.
    """
    duplicate_dir = os.path.join(directory, "_duplicate_")
    total_moved = 0
    
    logger.info("Scanning directory: %s", directory)
    logger.info("Duplicate folder: %s", duplicate_dir)
    logger.info("=" * 40)
    
    if dry_run:
        logger.info("DRY RUN MODE - No files will be moved")
        logger.info("=" * 40)
    
    # Create duplicate directory if not dry run
    if not dry_run:
        os.makedirs(duplicate_dir, exist_ok=True)
    
    # Walk through all files
    for root, dirs, files in os.walk(directory):
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
                    rel_path = os.path.relpath(move_dir, directory)
                    dup_dir = os.path.join(duplicate_dir, rel_path)
                    
                    if dry_run:
                        logger.info("Would move: %s -> %s/%s", move_file, dup_dir, move_name)
                    else:
                        os.makedirs(dup_dir, exist_ok=True)
                        shutil.move(move_file, os.path.join(dup_dir, move_name))
                        logger.info("Moved: %s -> %s/%s", move_file, dup_dir, move_name)
                        total_moved += 1
    
    logger.info("=" * 40)
    if dry_run:
        logger.info("Dry run complete. Run without --dry-run to actually move files.")
    else:
        logger.info("Total files moved to duplicates: %d", total_moved)
    
    return total_moved


def main():
    parser = argparse.ArgumentParser(
        description="Move duplicate files with count suffixes to _duplicate_ folder."
    )
    parser.add_argument(
        "directory",
        help="Directory to scan for duplicates",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be moved without actually moving",
    )
    
    args = parser.parse_args()
    
    setup_logger()
    
    move_duplicates(args.directory, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
