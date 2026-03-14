"""
Process Recurring Contributions Job Template

Processes all recurring contributions that are due for payment.
Runs daily to charge PayPal and Clover accounts and update records.
"""

from datetime import datetime, timedelta
from typing import Dict, Any
from job_templates.base import JobTemplate, JobResult, JobExecutionContext
from services.paypal_service import paypal_service
from services.clover_service import clover_service


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
    
    def validate_params(self, params: Dict[str, Any]):
        """Validate job parameters. Returns (True, None) or (False, error_message)."""
        try:
            dry_run = params.get("dry_run", False)
            batch_size = params.get("batch_size", 50)
            max_retries = params.get("max_retries", 3)
            
            if not isinstance(dry_run, bool):
                return (False, "dry_run must be a boolean")
            if not isinstance(batch_size, int) or batch_size < 1:
                return (False, "batch_size must be a positive integer")
            if not isinstance(max_retries, int) or max_retries < 0:
                return (False, "max_retries must be a non-negative integer")
            
            return (True, None)
        except Exception as e:
            return (False, str(e))
    
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
        params = context.parameters
        dry_run = params.get("dry_run", False)
        batch_size = params.get("batch_size", 50)
        max_retries = params.get("max_retries", 3)
        
        context.log("info", f"Starting recurring contributions processing (dry_run={dry_run})")
        
        has_paypal = paypal_service.is_configured()
        has_clover = clover_service.is_configured()
        
        if not has_paypal and not has_clover:
            return JobResult(
                status="failed",
                message="No payment providers configured - cannot process payments",
                details={"error": "Neither PayPal nor Clover configured"}
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
        """Process a single recurring contribution, routing to the correct provider."""
        payment_method = contribution.get("payment_method", "paypal")
        
        if dry_run:
            return {
                "success": True,
                "message": f"Would charge via {payment_method} (dry run)"
            }
        
        try:
            if payment_method == "clover":
                result = await self._charge_clover(context, contribution, now)
            else:
                result = await self._charge_paypal(context, contribution, now)
            
            if result["success"]:
                # Update contribution record on success
                next_payment = now + timedelta(days=contribution.get("recurring_days", 30))
                
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
                tx_record = {
                    "contribution_id": contribution["_id"],
                    "username": contribution["username"],
                    "amount": contribution["amount"],
                    "currency": "USD",
                    "status": "completed",
                    "payment_method": payment_method,
                    "charge_id": result.get("charge_id"),
                    "job_run_id": context.job_id,
                    "created_at": now,
                    "auto_processed": True
                }
                await context.db.recurring_transactions.insert_one(tx_record)
                
                # Also log to payments collection for Contribution Management page
                await context.db.payments.insert_one({
                    "username": contribution["username"],
                    "amount": contribution["amount"],
                    "paymentType": "contribution_recurring",
                    "paymentProvider": payment_method,
                    "status": "completed",
                    "cloverChargeId": result.get("charge_id") if payment_method == "clover" else None,
                    "paypalCaptureId": result.get("capture_id") if payment_method == "paypal" else None,
                    "description": f"Recurring {payment_method} charge - ${contribution['amount']:.2f}",
                    "createdAt": now,
                    "updatedAt": now,
                    "autoCharged": True,
                })
                
                result["next_payment_date"] = next_payment
            else:
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
                    "payment_method": payment_method,
                    "error": result.get("error", "Unknown"),
                    "job_run_id": context.job_id,
                    "created_at": now,
                    "auto_processed": True
                })
            
            return result
            
        except Exception as e:
            await context.db.recurring_contributions.update_one(
                {"_id": contribution["_id"]},
                {
                    "$inc": {"failure_count": 1},
                    "$set": {"updated_at": now}
                }
            )
            await context.db.recurring_transactions.insert_one({
                "contribution_id": contribution["_id"],
                "username": contribution["username"],
                "amount": contribution["amount"],
                "currency": "USD",
                "status": "failed",
                "payment_method": payment_method,
                "error": str(e),
                "job_run_id": context.job_id,
                "created_at": now,
                "auto_processed": True
            })
            return {"success": False, "error": str(e)}
    
    async def _charge_clover(
        self,
        context: JobExecutionContext,
        contribution: Dict[str, Any],
        now: datetime
    ) -> Dict[str, Any]:
        """Charge a Clover customer using their stored card on file."""
        customer_id = contribution.get("clover_customer_id")
        if not customer_id:
            return {"success": False, "error": "No Clover customer ID stored - cannot auto-charge"}
        
        if not clover_service.is_configured():
            return {"success": False, "error": "Clover not configured"}
        
        amount_cents = int(round(contribution["amount"] * 100))
        result = await clover_service.charge_customer(
            customer_id=customer_id,
            amount_cents=amount_cents,
            description=f"Recurring contribution - {contribution['username']} - ${contribution['amount']:.2f}",
        )
        
        if result.get("success"):
            return {
                "success": True,
                "charge_id": result["charge_id"],
                "message": f"Clover recurring charge successful: {result['charge_id']}"
            }
        else:
            return {"success": False, "error": result.get("error", "Clover charge failed")}
    
    async def _charge_paypal(
        self,
        context: JobExecutionContext,
        contribution: Dict[str, Any],
        now: datetime
    ) -> Dict[str, Any]:
        """Charge via PayPal (create order + capture)."""
        if not paypal_service.is_configured():
            return {"success": False, "error": "PayPal not configured"}
        
        order_result = await paypal_service.create_order(
            amount=str(contribution["amount"]),
            currency="USD",
            description=f"Recurring contribution for {contribution['username']}",
            custom_id=f"recurring_{contribution['_id']}"
        )
        
        if not order_result.get("success"):
            return {"success": False, "error": f"PayPal order failed: {order_result.get('error')}"}
        
        capture_result = await paypal_service.capture_order(order_result["order_id"])
        
        if not capture_result.get("success"):
            return {"success": False, "error": f"PayPal capture failed: {capture_result.get('error')}"}
        
        return {
            "success": True,
            "charge_id": order_result["order_id"],
            "capture_id": capture_result.get("capture_id"),
            "message": "PayPal recurring charge successful"
        }


# Register the job template
def get_job_template():
    return ProcessRecurringContributionsJob()
