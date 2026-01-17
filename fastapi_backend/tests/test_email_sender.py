"""
Test suite for centralized email sender (email_sender.py)
Tests Resend + SMTP fallback mechanism
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import os


class TestSendEmail:
    """Tests for the centralized send_email function"""
    
    @pytest.mark.asyncio
    async def test_send_email_returns_dict(self):
        """Test that send_email returns a result dict"""
        with patch.dict(os.environ, {"EMAIL_PROVIDER": "smtp", "SMTP_USER": "test@test.com", "SMTP_PASSWORD": "test"}):
            with patch('services.email_sender._send_via_smtp', new_callable=AsyncMock) as mock_smtp:
                mock_smtp.return_value = True
                
                from services.email_sender import send_email
                result = await send_email("to@test.com", "Subject", "<p>Body</p>")
                
                assert isinstance(result, dict)
                assert "success" in result
                assert "provider" in result
    
    @pytest.mark.asyncio
    async def test_send_email_smtp_only_mode(self):
        """Test email sending in SMTP-only mode"""
        with patch.dict(os.environ, {"EMAIL_PROVIDER": "smtp", "SMTP_USER": "test@test.com", "SMTP_PASSWORD": "test"}):
            with patch('services.email_sender._send_via_smtp', new_callable=AsyncMock) as mock_smtp:
                mock_smtp.return_value = True
                
                from services.email_sender import send_email
                result = await send_email("to@test.com", "Subject", "<p>Body</p>")
                
                assert result["success"] is True
                assert result["provider"] == "smtp"
                assert result["smtp_attempted"] is True
                assert result["resend_attempted"] is False
    
    @pytest.mark.asyncio
    async def test_send_email_resend_success(self):
        """Test email sending via Resend when it succeeds"""
        with patch.dict(os.environ, {"EMAIL_PROVIDER": "resend", "RESEND_API_KEY": "test_key"}):
            with patch('services.email_sender._send_via_resend', new_callable=AsyncMock) as mock_resend:
                mock_resend.return_value = True
                
                from services.email_sender import send_email
                result = await send_email("to@test.com", "Subject", "<p>Body</p>")
                
                assert result["success"] is True
                assert result["provider"] == "resend"
                assert result["resend_attempted"] is True
                assert result["smtp_attempted"] is False
    
    @pytest.mark.asyncio
    async def test_send_email_resend_fallback_to_smtp(self):
        """Test fallback to SMTP when Resend fails"""
        with patch.dict(os.environ, {
            "EMAIL_PROVIDER": "resend",
            "RESEND_API_KEY": "test_key",
            "SMTP_USER": "test@test.com",
            "SMTP_PASSWORD": "test"
        }):
            with patch('services.email_sender._send_via_resend', new_callable=AsyncMock) as mock_resend:
                with patch('services.email_sender._send_via_smtp', new_callable=AsyncMock) as mock_smtp:
                    mock_resend.return_value = False  # Resend fails
                    mock_smtp.return_value = True  # SMTP succeeds
                    
                    from services.email_sender import send_email
                    result = await send_email("to@test.com", "Subject", "<p>Body</p>")
                    
                    assert result["success"] is True
                    assert result["provider"] == "smtp"
                    assert result["resend_attempted"] is True
                    assert result["smtp_attempted"] is True
    
    @pytest.mark.asyncio
    async def test_send_email_both_fail(self):
        """Test that exception is raised when both Resend and SMTP fail"""
        with patch.dict(os.environ, {
            "EMAIL_PROVIDER": "resend",
            "RESEND_API_KEY": "test_key",
            "SMTP_USER": "test@test.com",
            "SMTP_PASSWORD": "test"
        }):
            with patch('services.email_sender._send_via_resend', new_callable=AsyncMock) as mock_resend:
                with patch('services.email_sender._send_via_smtp', new_callable=AsyncMock) as mock_smtp:
                    mock_resend.return_value = False
                    mock_smtp.side_effect = Exception("SMTP failed")
                    
                    from services.email_sender import send_email
                    
                    with pytest.raises(Exception) as exc_info:
                        await send_email("to@test.com", "Subject", "<p>Body</p>")
                    
                    assert "SMTP failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_send_email_generates_text_from_html(self):
        """Test that plain text is generated from HTML if not provided"""
        with patch.dict(os.environ, {"EMAIL_PROVIDER": "smtp", "SMTP_USER": "test@test.com", "SMTP_PASSWORD": "test"}):
            with patch('services.email_sender._send_email_with_fallback', new_callable=AsyncMock) as mock_fallback:
                mock_fallback.return_value = {"success": True, "provider": "smtp"}
                
                from services.email_sender import send_email
                await send_email("to@test.com", "Subject", "<p>Hello World</p>")
                
                # Verify text_content was generated (HTML tags stripped)
                call_args = mock_fallback.call_args
                text_content = call_args[0][3]  # 4th argument is text_content
                assert "<p>" not in text_content
                assert "Hello World" in text_content


class TestResendProvider:
    """Tests for Resend email provider"""
    
    @pytest.mark.asyncio
    async def test_resend_no_api_key(self):
        """Test Resend returns False when API key not configured"""
        with patch.dict(os.environ, {"RESEND_API_KEY": ""}, clear=False):
            from services.email_sender import _send_via_resend
            result = await _send_via_resend("to@test.com", "Subject", "<p>Body</p>", "Body")
            assert result is False
    
    @pytest.mark.asyncio
    async def test_resend_api_error(self):
        """Test Resend handles API errors gracefully"""
        with patch.dict(os.environ, {"RESEND_API_KEY": "test_key", "FROM_EMAIL": "from@test.com"}):
            with patch('resend.Emails.send') as mock_send:
                mock_send.side_effect = Exception("API Error")
                
                from services.email_sender import _send_via_resend
                result = await _send_via_resend("to@test.com", "Subject", "<p>Body</p>", "Body")
                
                assert result is False


class TestSmtpProvider:
    """Tests for SMTP email provider"""
    
    @pytest.mark.asyncio
    async def test_smtp_no_credentials(self):
        """Test SMTP raises exception when credentials not configured"""
        # Test that _send_via_smtp checks for credentials
        from services.email_sender import _send_via_smtp
        
        with patch.dict(os.environ, {"SMTP_USER": "", "SMTP_PASSWORD": ""}, clear=False):
            with patch('services.email_sender.settings') as mock_settings:
                mock_settings.smtp_user = None
                mock_settings.smtp_password = None
                mock_settings.smtp_host = "smtp.test.com"
                mock_settings.smtp_port = 587
                mock_settings.from_name = "Test"
                
                with pytest.raises(Exception):
                    await _send_via_smtp("to@test.com", "Subject", "<p>Body</p>", "Body")
    
    @pytest.mark.asyncio
    async def test_smtp_connection_error(self):
        """Test SMTP handles connection errors"""
        with patch.dict(os.environ, {"SMTP_USER": "test@test.com", "SMTP_PASSWORD": "test"}):
            with patch('smtplib.SMTP') as mock_smtp:
                mock_smtp.side_effect = Exception("Connection refused")
                
                from services.email_sender import _send_via_smtp
                
                with pytest.raises(Exception) as exc_info:
                    await _send_via_smtp("to@test.com", "Subject", "<p>Body</p>", "Body")
                
                assert "Connection refused" in str(exc_info.value)
