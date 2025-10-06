"""
Tests for database connection and operations.
"""
import pytest
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
from motor.motor_asyncio import AsyncIOMotorClient
import database
from database import connect_to_mongo, close_mongo_connection, get_database


class TestConnectToMongo:
    """Test cases for MongoDB connection functions."""

    @pytest.fixture(autouse=True)
    def reset_database_globals(self):
        """Reset database global variables before each test."""
        database.client = None
        database.database = None
        yield
        # Clean up after test
        database.client = None
        database.database = None

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for testing."""
        with patch('database.settings') as mock_settings:
            mock_settings.mongodb_url = "mongodb://localhost:27017"
            mock_settings.database_name = "test_db"
            yield mock_settings

    @pytest.mark.asyncio
    async def test_connect_to_mongo_success(self, mock_settings):
        """Test successful MongoDB connection."""
        # Mock the AsyncIOMotorClient and its admin.command
        mock_client = AsyncMock()
        mock_client.admin.command = AsyncMock()
        mock_db = AsyncMock()
        mock_client.__getitem__.return_value = mock_db

        with patch('database.AsyncIOMotorClient', return_value=mock_client):
            await connect_to_mongo()

            # Verify client was created with correct URL
            database.AsyncIOMotorClient.assert_called_once_with("mongodb://localhost:27017")

            # Verify ping was called
            mock_client.admin.command.assert_called_once_with('ping')

            # Verify global variables were set
            assert database.client == mock_client
            assert database.database == mock_db
            mock_client.__getitem__.assert_called_once_with("test_db")

    @pytest.mark.asyncio
    async def test_connect_to_mongo_connection_failure(self, mock_settings):
        """Test MongoDB connection failure."""
        # Mock AsyncIOMotorClient to raise an exception
        with patch('database.AsyncIOMotorClient', side_effect=Exception("Connection failed")):
            with pytest.raises(Exception) as exc_info:
                await connect_to_mongo()

            assert "Connection failed" in str(exc_info.value)

            # Verify global variables remain None
            assert database.client is None
            assert database.database is None

    @pytest.mark.asyncio
    async def test_connect_to_mongo_ping_failure(self, mock_settings):
        """Test MongoDB ping failure."""
        mock_client = AsyncMock()
        mock_client.admin.command = AsyncMock(side_effect=Exception("Ping failed"))

        with patch('database.AsyncIOMotorClient', return_value=mock_client):
            with pytest.raises(Exception) as exc_info:
                await connect_to_mongo()

            assert "Ping failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_connect_to_mongo_multiple_calls(self, mock_settings):
        """Test multiple connection attempts."""
        mock_client1 = AsyncMock()
        mock_client1.admin.command = AsyncMock()
        mock_client2 = AsyncMock()
        mock_client2.admin.command = AsyncMock()

        with patch('database.AsyncIOMotorClient') as mock_client_class:
            mock_client_class.side_effect = [mock_client1, mock_client2]

            # First connection
            await connect_to_mongo()
            assert database.client == mock_client1

            # Second connection should replace the first
            await connect_to_mongo()
            assert database.client == mock_client2


class TestCloseMongoConnection:
    """Test cases for MongoDB connection closing."""

    @pytest.mark.asyncio
    async def test_close_mongo_connection_with_client(self):
        """Test closing connection when client exists."""
        # Set up a mock client
        mock_client = AsyncMock()
        database.client = mock_client

        await close_mongo_connection()

        # Verify close was called
        mock_client.close.assert_called_once()

        # Verify client is still set (close doesn't clear it)
        assert database.client == mock_client

    @pytest.mark.asyncio
    async def test_close_mongo_connection_without_client(self):
        """Test closing connection when no client exists."""
        # Ensure client is None
        database.client = None

        # Should not raise an exception
        await close_mongo_connection()

        # Client should remain None
        assert database.client is None

    @pytest.mark.asyncio
    async def test_close_mongo_connection_client_close_exception(self):
        """Test closing connection when client.close() raises exception."""
        mock_client = AsyncMock()
        mock_client.close = AsyncMock(side_effect=Exception("Close failed"))

        database.client = mock_client

        # Should not raise an exception, should log the error
        await close_mongo_connection()

        mock_client.close.assert_called_once()


class TestGetDatabase:
    """Test cases for get_database function."""

    def test_get_database_success(self):
        """Test getting database when initialized."""
        mock_db = MagicMock()
        database.database = mock_db

        result = get_database()

        assert result == mock_db

    def test_get_database_not_initialized(self):
        """Test getting database when not initialized."""
        # Ensure database is None
        database.database = None

        with pytest.raises(RuntimeError) as exc_info:
            get_database()

        assert "Database not initialized" in str(exc_info.value)

    def test_get_database_client_none_database_none(self):
        """Test getting database when both client and database are None."""
        database.client = None
        database.database = None

        with pytest.raises(RuntimeError) as exc_info:
            get_database()

        assert "Database not initialized" in str(exc_info.value)


class TestDatabaseIntegration:
    """Integration tests for database operations."""

    @pytest.mark.asyncio
    async def test_full_connection_lifecycle(self):
        """Test full connection lifecycle: connect -> use -> close."""
        # This is a more realistic integration test
        mock_client = AsyncMock()
        mock_client.admin.command = AsyncMock()
        mock_db = MagicMock()
        mock_client.__getitem__ = MagicMock(return_value=mock_db)

        with patch('database.settings') as mock_settings:
            mock_settings.mongodb_url = "mongodb://localhost:27017"
            mock_settings.database_name = "test_db"

            with patch('database.AsyncIOMotorClient', return_value=mock_client):
                # Connect
                await connect_to_mongo()
                assert database.client == mock_client
                assert database.database == mock_db

                # Use database
                db = get_database()
                assert db == mock_db

                # Close
                await close_mongo_connection()
                mock_client.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_connection_with_real_mongodb_url(self):
        """Test connection with a real MongoDB URL format (mocked)."""
        with patch('database.settings') as mock_settings:
            mock_settings.mongodb_url = "mongodb+srv://user:pass@cluster.mongodb.net"
            mock_settings.database_name = "production_db"

            mock_client = AsyncMock()
            mock_client.admin.command = AsyncMock()

            with patch('database.AsyncIOMotorClient', return_value=mock_client):
                await connect_to_mongo()

                # Verify correct URL was used
                database.AsyncIOMotorClient.assert_called_once_with(
                    "mongodb+srv://user:pass@cluster.mongodb.net"
                )

                # Verify correct database name
                mock_client.__getitem__.assert_called_once_with("production_db")


class TestDatabaseErrorHandling:
    """Test error handling in database operations."""

    @pytest.mark.asyncio
    async def test_connect_to_mongo_invalid_url(self):
        """Test connection with invalid MongoDB URL."""
        with patch('database.settings') as mock_settings:
            mock_settings.mongodb_url = "invalid://url"
            mock_settings.database_name = "test_db"

            with patch('database.AsyncIOMotorClient', side_effect=Exception("Invalid URL")):
                with pytest.raises(Exception) as exc_info:
                    await connect_to_mongo()

                assert "Invalid URL" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_database_after_connection_failure(self):
        """Test get_database after a failed connection attempt."""
        # Simulate connection failure
        database.client = None
        database.database = None

        with pytest.raises(RuntimeError) as exc_info:
            get_database()

        assert "Database not initialized" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_concurrent_connections(self):
        """Test handling concurrent connection attempts."""
        mock_client = AsyncMock()
        mock_client.admin.command = AsyncMock()

        with patch('database.settings') as mock_settings:
            mock_settings.mongodb_url = "mongodb://localhost:27017"
            mock_settings.database_name = "test_db"

            with patch('database.AsyncIOMotorClient', return_value=mock_client):
                # Start multiple connection tasks
                tasks = [connect_to_mongo() for _ in range(3)]
                await asyncio.gather(*tasks)

                # Should handle concurrent connections gracefully
                assert database.client == mock_client
