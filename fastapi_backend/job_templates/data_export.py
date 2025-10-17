"""
Data Export Job Template
Exports data from database collections to various formats
"""

from typing import Dict, Any, Optional, Tuple
from datetime import datetime
from .base import JobTemplate, JobResult, JobExecutionContext
import json
import csv
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class DataExportTemplate(JobTemplate):
    """Template for exporting data from database"""
    
    template_type = "data_export"
    template_name = "Data Export"
    template_description = "Export data from database collections to JSON or CSV format"
    category = "reports"
    icon = "📊"
    estimated_duration = "5-20 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    # Allowed collections
    ALLOWED_COLLECTIONS = [
        "users",
        "contact_tickets",
        "messages",
        "notifications",
        "activity_logs",
        "job_executions",
        "testimonials"
    ]
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "collection": {
                    "type": "string",
                    "description": "Collection to export",
                    "enum": self.ALLOWED_COLLECTIONS
                },
                "format": {
                    "type": "string",
                    "description": "Export format",
                    "enum": ["json", "csv"],
                    "default": "json"
                },
                "filters": {
                    "type": "object",
                    "description": "MongoDB query filters to apply"
                },
                "projection": {
                    "type": "object",
                    "description": "Fields to include/exclude in export"
                },
                "sort": {
                    "type": "object",
                    "description": "Sort order for exported data"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of records to export",
                    "minimum": 1,
                    "maximum": 100000,
                    "default": 10000
                },
                "destination": {
                    "type": "string",
                    "description": "Destination type for export",
                    "enum": ["file", "database", "memory"],
                    "default": "file"
                },
                "filename": {
                    "type": "string",
                    "description": "Output filename (without extension)",
                    "pattern": "^[a-zA-Z0-9_-]+$"
                }
            },
            "required": ["collection", "format"]
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        # Check collection
        collection = params.get("collection")
        if not collection:
            return False, "Collection name is required"
        
        if collection not in self.ALLOWED_COLLECTIONS:
            return False, f"Collection '{collection}' is not allowed for export"
        
        # Check format
        format_type = params.get("format", "json")
        if format_type not in ["json", "csv"]:
            return False, "Format must be either 'json' or 'csv'"
        
        # Check limit
        limit = params.get("limit", 10000)
        if not isinstance(limit, int) or limit < 1 or limit > 100000:
            return False, "Limit must be between 1 and 100000"
        
        # Validate filename if provided
        filename = params.get("filename")
        if filename:
            if not re.match(r'^[a-zA-Z0-9_-]+$', filename):
                return False, "Filename can only contain letters, numbers, hyphens, and underscores"
        
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute data export"""
        params = context.parameters
        collection_name = params["collection"]
        format_type = params.get("format", "json")
        filters = params.get("filters", {})
        projection = params.get("projection")
        sort_order = params.get("sort", {"_id": 1})
        limit = params.get("limit", 10000)
        destination = params.get("destination", "file")
        filename = params.get("filename", f"export_{collection_name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}")
        
        context.log("INFO", f"Starting data export from collection: {collection_name}")
        context.log("INFO", f"Format: {format_type}, Limit: {limit}")
        
        try:
            collection = context.db[collection_name]
            
            # Build query
            query = collection.find(filters, projection)
            if sort_order:
                query = query.sort(list(sort_order.items()))
            query = query.limit(limit)
            
            # Fetch data
            records = await query.to_list(length=limit)
            record_count = len(records)
            
            context.log("INFO", f"Fetched {record_count} records")
            
            if record_count == 0:
                return JobResult(
                    status="success",
                    message="No records found to export",
                    records_processed=0
                )
            
            # Convert ObjectId to string for JSON serialization
            for record in records:
                if "_id" in record:
                    record["_id"] = str(record["_id"])
            
            # Export based on format
            if format_type == "json":
                export_path = await self._export_json(records, filename, destination, context)
            elif format_type == "csv":
                export_path = await self._export_csv(records, filename, destination, context)
            else:
                raise ValueError(f"Unsupported format: {format_type}")
            
            context.log("INFO", f"Export completed: {export_path}")
            
            return JobResult(
                status="success",
                message=f"Successfully exported {record_count} records to {format_type.upper()}",
                details={
                    "collection": collection_name,
                    "format": format_type,
                    "record_count": record_count,
                    "export_path": export_path,
                    "filters": str(filters)
                },
                records_processed=record_count,
                records_affected=record_count
            )
            
        except Exception as e:
            context.log("ERROR", f"Export failed: {str(e)}")
            return JobResult(
                status="failed",
                message=f"Data export failed: {str(e)}",
                errors=[str(e)]
            )
    
    async def _export_json(self, records: list, filename: str, destination: str, context: JobExecutionContext) -> str:
        """Export records to JSON file"""
        if destination == "file":
            output_dir = Path("exports")
            output_dir.mkdir(exist_ok=True)
            
            output_path = output_dir / f"{filename}.json"
            
            with open(output_path, 'w') as f:
                json.dump(records, f, indent=2, default=str)
            
            context.log("INFO", f"Exported to file: {output_path}")
            return str(output_path)
        
        elif destination == "memory":
            # Store in job result details
            context.log("INFO", "Exported to memory (result details)")
            return "memory://result_details/export_data"
        
        else:
            raise ValueError(f"Unsupported destination: {destination}")
    
    async def _export_csv(self, records: list, filename: str, destination: str, context: JobExecutionContext) -> str:
        """Export records to CSV file"""
        if not records:
            return ""
        
        if destination == "file":
            output_dir = Path("exports")
            output_dir.mkdir(exist_ok=True)
            
            output_path = output_dir / f"{filename}.csv"
            
            # Get all unique keys from records
            keys = set()
            for record in records:
                keys.update(record.keys())
            keys = sorted(list(keys))
            
            with open(output_path, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows(records)
            
            context.log("INFO", f"Exported to file: {output_path}")
            return str(output_path)
        
        elif destination == "memory":
            context.log("INFO", "Exported to memory (result details)")
            return "memory://result_details/export_data"
        
        else:
            raise ValueError(f"Unsupported destination: {destination}")


# Import re for filename validation
import re
