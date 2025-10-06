"""
Tests for utility functions including file upload and image URL handling.
"""
import pytest
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, mock_open, AsyncMock
from fastapi import UploadFile
from io import BytesIO
from utils import save_upload_file, save_multiple_files, get_full_image_url


class TestSaveUploadFile:
    """Test cases for save_upload_file function."""

    @pytest.fixture
    def temp_upload_dir(self):
        """Create a temporary upload directory for testing."""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield temp_dir

    @pytest.fixture
    def mock_settings(self, temp_upload_dir):
        """Mock settings for testing."""
        with patch('utils.settings') as mock_settings:
            mock_settings.upload_dir = temp_upload_dir
            yield mock_settings

    async def test_save_upload_file_success(self, mock_settings):
        """Test successful file upload."""
        # Create a mock upload file
        file_content = b"test file content"
        mock_file = UploadFile(
            file=BytesIO(file_content),
            filename="test.jpg"
        )

        temp_dir = tempfile.mkdtemp()
        try:
            with patch('utils.settings') as mock_settings:
                mock_settings.upload_dir = temp_dir

                result_path = await save_upload_file(mock_file)

                # Check that file was saved
                assert result_path.startswith(f"/{temp_dir}/")
                assert result_path.endswith(".jpg")

                # Verify file exists
                full_path = Path(temp_dir) / result_path.replace(f"/{temp_dir}/", "")
                assert full_path.exists()

                # Verify content
                with open(full_path, 'rb') as f:
                    saved_content = f.read()
                assert saved_content == file_content
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

    async def test_save_upload_file_no_extension(self, mock_settings):
        """Test file upload without extension."""
        file_content = b"test content"
        mock_file = UploadFile(
            file=BytesIO(file_content),
            filename="testfile"  # No extension
        )

        temp_dir = tempfile.mkdtemp()
        try:
            with patch('utils.settings') as mock_settings:
                mock_settings.upload_dir = temp_dir

                result_path = await save_upload_file(mock_file)

                # Should still save without extension
                assert result_path.startswith(f"/{temp_dir}/")
                assert not result_path.endswith(".jpg")  # No extension added
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

    async def test_save_upload_file_creates_directory(self, mock_settings):
        """Test that upload directory is created if it doesn't exist."""
        temp_parent = tempfile.mkdtemp()
        try:
            new_dir = Path(temp_parent) / "new_upload_dir"
            
            with patch('utils.settings') as mock_settings:
                mock_settings.upload_dir = str(new_dir)

                file_content = b"test content"
                mock_file = UploadFile(
                    file=BytesIO(file_content),
                    filename="test.jpg"
                )
                result_path = await save_upload_file(mock_file)

                assert new_dir.exists()
                assert new_dir.is_dir()
                assert result_path.startswith(f"/{new_dir}/")
        finally:
            import shutil
            shutil.rmtree(temp_parent, ignore_errors=True)

    async def test_save_upload_file_exception_handling(self, mock_settings):
        """Test exception handling during file save."""
        file_content = b"test content"
        mock_file = UploadFile(
            file=BytesIO(file_content),
            filename="test.jpg"
        )

        with patch('utils.settings') as mock_settings:
            mock_settings.upload_dir = "/invalid/path/that/does/not/exist/and/cannot/be/created"
            
            with pytest.raises(Exception):  # Should raise some exception
                await save_upload_file(mock_file)


class TestSaveMultipleFiles:
    """Test cases for save_multiple_files function."""

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing."""
        with patch('utils.settings') as mock_settings:
            mock_settings.upload_dir = tempfile.gettempdir()
            yield mock_settings

    async def test_save_multiple_files_success(self, mock_settings):
        """Test saving multiple valid image files."""
        # Create mock image files
        files = []
        for i in range(3):
            file_content = f"content{i}".encode()
            mock_file = UploadFile(
                file=BytesIO(file_content),
                filename=f"test{i}.jpg",
                content_type="image/jpeg"
            )
            files.append(mock_file)

        result_paths = await save_multiple_files(files)

        # Should save all files
        assert len(result_paths) == 3
        for path in result_paths:
            assert path.startswith("/uploads/")
            assert path.endswith(".jpg")

    async def test_save_multiple_files_mixed_types(self, mock_settings):
        """Test saving files with mixed content types."""
        files = [
            UploadFile(
                file=BytesIO(b"image content"),
                filename="test.jpg",
                content_type="image/jpeg"
            ),
            UploadFile(
                file=BytesIO(b"text content"),
                filename="test.txt",
                content_type="text/plain"
            ),
            UploadFile(
                file=BytesIO(b"another image"),
                filename="test2.png",
                content_type="image/png"
            )
        ]

        result_paths = await save_multiple_files(files)

        # Should only save image files
        assert len(result_paths) == 2
        for path in result_paths:
            assert path.endswith((".jpg", ".png"))

    async def test_save_multiple_files_size_limit(self, mock_settings):
        """Test file size limit enforcement."""
        # Create a file that's too large (>5MB)
        large_content = b"x" * (6 * 1024 * 1024)  # 6MB
        large_file = UploadFile(
            file=BytesIO(large_content),
            filename="large.jpg",
            content_type="image/jpeg"
        )

        # Create a small valid file
        small_content = b"small content"
        small_file = UploadFile(
            file=BytesIO(small_content),
            filename="small.jpg",
            content_type="image/jpeg"
        )

        result_paths = await save_multiple_files([large_file, small_file])

        # Should only save the small file
        assert len(result_paths) == 1
        assert "small.jpg" in result_paths[0]

    async def test_save_multiple_files_partial_failure(self, mock_settings):
        """Test handling when some files fail to save."""
        files = [
            UploadFile(
                file=BytesIO(b"content1"),
                filename="test1.jpg",
                content_type="image/jpeg"
            ),
            UploadFile(
                file=BytesIO(b"content2"),
                filename="test2.jpg",
                content_type="image/jpeg"
            )
        ]

        # Mock save_upload_file to fail on second file
        original_save = save_upload_file
        call_count = 0

        async def mock_save_upload_file(file):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise Exception("Save failed")
            return await original_save(file)

        with patch('utils.save_upload_file', side_effect=mock_save_upload_file):
            result_paths = await save_multiple_files(files)

            # Should save only the first file
            assert len(result_paths) == 1

    async def test_save_multiple_files_empty_list(self, mock_settings):
        """Test handling empty file list."""
        result_paths = await save_multiple_files([])
        assert result_paths == []


class TestGetFullImageUrl:
    """Test cases for get_full_image_url function."""

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing."""
        with patch('utils.settings') as mock_settings:
            mock_settings.backend_url = "http://localhost:8000"
            yield mock_settings

    def test_relative_path_conversion(self, mock_settings):
        """Test converting relative path to full URL."""
        relative_path = "/uploads/test.jpg"
        full_url = get_full_image_url(relative_path)

        assert full_url == "http://localhost:8000/uploads/test.jpg"

    def test_absolute_url_passthrough(self, mock_settings):
        """Test that absolute URLs are passed through unchanged."""
        absolute_url = "https://cdn.example.com/images/test.jpg"
        result = get_full_image_url(absolute_url)

        assert result == absolute_url

    def test_http_url_passthrough(self, mock_settings):
        """Test that HTTP URLs are passed through unchanged."""
        http_url = "http://example.com/images/test.jpg"
        result = get_full_image_url(http_url)

        assert result == http_url

    def test_path_without_leading_slash(self, mock_settings):
        """Test path without leading slash."""
        path_without_slash = "uploads/test.jpg"
        full_url = get_full_image_url(path_without_slash)

        assert full_url == "http://localhost:8000/uploads/test.jpg"

    def test_empty_path(self, mock_settings):
        """Test empty path handling."""
        empty_path = ""
        result = get_full_image_url(empty_path)

        assert result == "http://localhost:8000"


class TestFileUploadEdgeCases:
    """Test edge cases for file upload functionality."""

    @pytest.mark.asyncio
    async def test_save_upload_file_special_characters(self):
        """Test file upload with special characters in filename."""
        special_filename = "test file (with) [brackets] {and} special.jpg"
        file_content = b"special content"
        mock_file = UploadFile(
            file=BytesIO(file_content),
            filename=special_filename
        )

        temp_dir = tempfile.mkdtemp()
        try:
            with patch('utils.settings') as mock_settings:
                mock_settings.upload_dir = temp_dir

                result_path = await save_upload_file(mock_file)

                # Should handle special characters  
                assert result_path.startswith(f"/{temp_dir}/")
                assert result_path.endswith(".jpg")
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_save_upload_file_very_long_filename(self):
        """Test file upload with very long filename."""
        long_filename = "a" * 200 + ".jpg"
        file_content = b"long filename content"
        mock_file = UploadFile(
            file=BytesIO(file_content),
            filename=long_filename
        )

        temp_dir = tempfile.mkdtemp()
        try:
            with patch('utils.settings') as mock_settings:
                mock_settings.upload_dir = temp_dir

                result_path = await save_upload_file(mock_file)

                # Should handle long filename by truncating UUID part
                assert result_path.startswith(f"/{temp_dir}/")
                assert len(result_path) < len(long_filename) + len(temp_dir) + 50  # Should be reasonable length
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
