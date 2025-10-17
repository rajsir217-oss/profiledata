"""
Webhook Trigger Job Template
Triggers external webhooks/APIs on a schedule
"""

from typing import Dict, Any, Optional, Tuple
from .base import JobTemplate, JobResult, JobExecutionContext
import logging
import aiohttp
import json

logger = logging.getLogger(__name__)


class WebhookTriggerTemplate(JobTemplate):
    """Template for triggering webhooks"""
    
    template_type = "webhook_trigger"
    template_name = "Webhook Trigger"
    template_description = "Trigger external webhooks or API endpoints on a schedule"
    category = "integrations"
    icon = "🔗"
    estimated_duration = "1-5 minutes"
    resource_usage = "low"
    risk_level = "medium"
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Webhook URL to trigger",
                    "format": "uri"
                },
                "method": {
                    "type": "string",
                    "description": "HTTP method",
                    "enum": ["GET", "POST", "PUT", "PATCH"],
                    "default": "POST"
                },
                "headers": {
                    "type": "object",
                    "description": "HTTP headers to send",
                    "default": {}
                },
                "body": {
                    "type": "object",
                    "description": "Request body (JSON)",
                    "default": {}
                },
                "timeout_seconds": {
                    "type": "integer",
                    "description": "Request timeout in seconds",
                    "minimum": 1,
                    "maximum": 300,
                    "default": 30
                },
                "retry_on_failure": {
                    "type": "boolean",
                    "description": "Retry if request fails",
                    "default": True
                },
                "max_retries": {
                    "type": "integer",
                    "description": "Maximum number of retries",
                    "minimum": 0,
                    "maximum": 5,
                    "default": 3
                },
                "expected_status": {
                    "type": "array",
                    "description": "Expected successful HTTP status codes",
                    "items": {"type": "integer"},
                    "default": [200, 201, 202, 204]
                }
            },
            "required": ["url"]
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        url = params.get("url", "").strip()
        if not url:
            return False, "Webhook URL is required"
        
        if not url.startswith(("http://", "https://")):
            return False, "URL must start with http:// or https://"
        
        method = params.get("method", "POST")
        if method not in ["GET", "POST", "PUT", "PATCH"]:
            return False, "Invalid HTTP method"
        
        timeout = params.get("timeout_seconds", 30)
        if not isinstance(timeout, int) or timeout < 1 or timeout > 300:
            return False, "Timeout must be between 1 and 300 seconds"
        
        max_retries = params.get("max_retries", 3)
        if not isinstance(max_retries, int) or max_retries < 0 or max_retries > 5:
            return False, "Max retries must be between 0 and 5"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute webhook trigger"""
        params = context.parameters
        url = params["url"]
        method = params.get("method", "POST")
        headers = params.get("headers", {})
        body = params.get("body", {})
        timeout = params.get("timeout_seconds", 30)
        retry_on_failure = params.get("retry_on_failure", True)
        max_retries = params.get("max_retries", 3)
        expected_status = params.get("expected_status", [200, 201, 202, 204])
        
        context.log("INFO", f"Triggering webhook: {method} {url}")
        
        # Set default headers
        if "Content-Type" not in headers and method in ["POST", "PUT", "PATCH"]:
            headers["Content-Type"] = "application/json"
        
        attempt = 0
        last_error = None
        
        while attempt <= max_retries:
            try:
                attempt += 1
                context.log("INFO", f"Attempt {attempt}/{max_retries + 1}")
                
                async with aiohttp.ClientSession() as session:
                    request_kwargs = {
                        "headers": headers,
                        "timeout": aiohttp.ClientTimeout(total=timeout)
                    }
                    
                    # Add body for POST/PUT/PATCH
                    if method in ["POST", "PUT", "PATCH"] and body:
                        request_kwargs["json"] = body
                    
                    # Make request
                    async with session.request(method, url, **request_kwargs) as response:
                        status_code = response.status
                        response_text = await response.text()
                        
                        context.log("INFO", f"Response: {status_code}")
                        
                        # Check if status is expected
                        if status_code in expected_status:
                            return JobResult(
                                status="success",
                                message=f"Webhook triggered successfully: {status_code}",
                                details={
                                    "url": url,
                                    "method": method,
                                    "status_code": status_code,
                                    "response": response_text[:500],  # First 500 chars
                                    "attempts": attempt
                                },
                                records_processed=1,
                                records_affected=1
                            )
                        else:
                            last_error = f"Unexpected status code: {status_code}"
                            context.log("WARNING", last_error)
                
            except aiohttp.ClientError as e:
                last_error = f"Request failed: {str(e)}"
                context.log("ERROR", last_error)
            
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
                context.log("ERROR", last_error)
            
            # Don't retry if retry_on_failure is False
            if not retry_on_failure:
                break
            
            # Sleep before retry (exponential backoff)
            if attempt <= max_retries:
                import asyncio
                wait_time = min(2 ** attempt, 60)  # Max 60 seconds
                context.log("INFO", f"Waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)
        
        # All attempts failed
        return JobResult(
            status="failed",
            message=f"Webhook failed after {attempt} attempts: {last_error}",
            details={
                "url": url,
                "method": method,
                "attempts": attempt,
                "last_error": last_error
            },
            errors=[last_error]
        )
