"""
Process Recurring Contributions Job Template

Processes all recurring contributions that are due for payment.
Runs daily to charge PayPal accounts and update records.
"""

from datetime import datetime, timedelta
from typing import Dict, Any
from job_templates.base import JobTemplate, JobResult, JobExecutionContext
from services.paypal_service import paypal_service


class ProcessRecurringContributionsJob(JobTemplate):
    """Job to process recurring contribution payments."""
    
    template_type = "process_recurring_contributions"
    template_name = "Process Recurring Contributions"
    template_description = "Process all recurring contributions due for payment"
    category = "payment"
    icon = "💳"
    estimated_duration = "5-15 minutes"
    resource_usage = "medium"
    risk_level = "medium"
    
    def validate_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Validate job parameters."""
        # Set default values
        validated = {
            "dry_run": False,  # If true, only report what would be charged
            "batch_size": 50,  # Process in batches to avoid overwhelming
            "max_retries": 3   # Max retry attempts for failed payments
        }
        validated.update(params)
        
        # Validate parameters
        if not isinstance(validated.get("dry_run"), bool):
            raise ValueError("dry_run must be a boolean")
        
        if not isinstance(validated.get("batch_size"), int) or validated["batch_size"] < 1:
            raise ValueError("batch_size must be a positive integer")
        
        if not isinstance(validated.get("max_retries"), int) or validated["max_retries"] < 0:
            raise ValueError("max_retries must be a non-negative integer")
        
        return validated
    
    def get_schema(self) -> Dict[str, Any]:
        """Get the schema for job parameters."""
        return {
            "type": "object",
            "properties": {
                "dry_run": {
                    "type": "boolean",
                    "title": "Dry Run",
                    "description": "If true, only simulate the processing without actually charging",
                    "default": False
                },
                "batch_size": {
                    "type": "integer",
                    "title": "Batch Size",
                    "description": "Number of contributions to process in each batch",
                    "default": 50,
                    "minimum": 1,
                    "maximum": 100
                },
                "max_retries": {
                    "type": "integer",
                    "title": "Max Retries",
                    "description": "Maximum number of retry attempts for failed payments",
                    "default": 3,
                    "minimum": 0,
                    "maximum": 10
                }
            }
        }
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute the recurring contributions processing job."""
        params = context.params
        dry_run = params.get("dry_run", False)
        batch_size = params.get("batch_size", 50)
        max_retries = params.get("max_retries", 3)
        
        context.log("info", f"Starting recurring contributions processing (dry_run={dry_run})")
        
        if not paypal_service.is_configured():
            return JobResult(
                status="failed",
                message="PayPal is not configured - cannot process payments",
                details={"error": "PayPal not configured"}
            )
        
        # Find all contributions due for payment
        now = datetime.utcnow()
        due_filter = {
            "status": "active",
            "next_payment_date": {"$lte": now},
            "failure_count": {"$lt": max_retries}
        }
        
        total_due = await context.db.recurring_contributions.count_documents(due_filter)
        context.log("info", f"Found {total_due} contributions due for payment")
        
        if total_due == 0:
            return JobResult(
                status="success",
                message="No contributions due for payment",
                details={"processed": 0, "charged": 0, "failed": 0}
            )
        
        # Process in batches
        processed = 0
        charged = 0
        failed = 0
        total_amount = 0.0
        
        cursor = context.db.recurring_contributions.find(due_filter).limit(batch_size)
        
        async for contribution in cursor:
            processed += 1
            result = await self._process_contribution(
                context, 
                contribution, 
                dry_run, 
                now
            )
            
            if result["success"]:
                charged += 1
                total_amount += contribution["amount"]
                context.log("info", f"✅ Charged {contribution['username']}: ${contribution['amount']}")
            else:
                failed += 1
                context.log("error", f"❌ Failed to charge {contribution['username']}: {result['error']}")
        
        details = {
            "processed": processed,
            "charged": charged,
            "failed": failed,
            "total_amount": total_amount,
            "dry_run": dry_run
        }
        
        if dry_run:
            return JobResult(
                status="success",
                message=f"Dry run completed - would charge {charged} contributions (${total_amount:.2f})",
                details=details
            )
        else:
            return JobResult(
                status="success" if failed == 0 else "partial_success",
                message=f"Processed {processed} contributions: {charged} charged, {failed} failed (${total_amount:.2f})",
                details=details
            )
    
    async def _process_contribution(
        self, 
        context: JobExecutionContext, 
        contribution: Dict[str, Any], 
        dry_run: bool,
        now: datetime
    ) -> Dict[str, Any]:
        """Process a single recurring contribution."""
        if dry_run:
            return {
                "success": True,
                "message": "Would charge (dry run)"
            }
        
        try:
            # Create PayPal order
            order_result = await paypal_service.create_order(
                amount=str(contribution["amount"]),
                currency="USD",
                description=f"Recurring contribution for {contribution['username']}",
                custom_id=f"recurring_{contribution['_id']}"
            )
            
            if not order_result.get("success"):
                return {
                    "success": False,
                    "error": f"PayPal order creation failed: {order_result.get('error', 'Unknown error')}"
                }
            
            # Capture the payment
            capture_result = await paypal_service.capture_order(order_result["order_id"])
            
            if not capture_result.get("success"):
                return {
                    "success": False,
                    "error": f"PayPal capture failed: {capture_result.get('error', 'Unknown error')}"
                }
            
            # Update contribution record
            next_payment = now + timedelta(days=contribution["recurring_days"])
            
            await context.db.recurring_contributions.update_one(
                {"_id": contribution["_id"]},
                {
                    "$set": {
                        "last_paid_date": now,
                        "next_payment_date": next_payment,
                        "updated_at": now,
                        "failure_count": 0
                    },
                    "$inc": {
                        "total_contributed": contribution["amount"],
                        "payment_count": 1
                    }
                }
            )
            
            # Log the transaction
            await context.db.recurring_transactions.insert_one({
                "contribution_id": contribution["_id"],
                "username": contribution["username"],
                "amount": contribution["amount"],
                "currency": "USD",
                "status": "completed",
                "paypal_order_id": order_result["order_id"],
                "paypal_capture_id": capture_result.get("capture_id"),
                "job_run_id": context.job_id if hasattr(context, 'job_id') else None,
                "created_at": now,
                "auto_processed": True
            })
            
            return {
                "success": True,
                "message": "Payment processed successfully",
                "order_id": order_result["order_id"],
                "next_payment_date": next_payment
            }
            
        except Exception as e:
            # Update failure count
            await context.db.recurring_contributions.update_one(
                {"_id": contribution["_id"]},
                {
                    "$inc": {"failure_count": 1},
                    "$set": {"updated_at": now}
                }
            )
            
            # Log failed transaction
            await context.db.recurring_transactions.insert_one({
                "contribution_id": contribution["_id"],
                "username": contribution["username"],
                "amount": contribution["amount"],
                "currency": "USD",
                "status": "failed",
                "error": str(e),
                "job_run_id": context.job_id if hasattr(context, 'job_id') else None,
                "created_at": now,
                "auto_processed": True
            })
            
            return {
                "success": False,
                "error": str(e)
            }


# Register the job template
def get_job_template():
    return ProcessRecurringContributionsJob()
