"""
Monthly Digest Email Job Template with 4-Week View
Compiles weekly metrics and sends a monthly summary with inline graphs
"""

from typing import Dict, Any, Tuple, Optional, List
from .base import JobTemplate, JobExecutionContext, JobResult
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
import time
import logging

logger = logging.getLogger(__name__)


class MonthlyDigestNotifierTemplate(JobTemplate):
    """Template for sending monthly digest emails with 4-week breakdown"""
    
    template_type = "monthly_digest_notifier"
    template_name = "Monthly Digest with Weekly Breakdown"
    template_description = "Send monthly activity digest emails with 4-week metrics and inline graphs"
    category = "communication"
    icon = "📊"
    estimated_duration = "10-30 minutes"
    resource_usage = "medium"
    risk_level = "low"
    
    # Metrics to track
    METRICS = [
        {"key": "profile_views_received", "label": "Profile Views", "icon": "👁️", "color": "#667eea"},
        {"key": "interests_received", "label": "Interests Received", "icon": "❤️", "color": "#e53e3e"},
        {"key": "interests_sent", "label": "Interests Sent", "icon": "💜", "color": "#9f7aea"},
        {"key": "messages_received", "label": "Messages Received", "icon": "💬", "color": "#38a169"},
        {"key": "messages_sent", "label": "Messages Sent", "icon": "📤", "color": "#3182ce"},
        {"key": "connection_requests", "label": "Connection Requests", "icon": "🔗", "color": "#dd6b20"},
        {"key": "new_matches", "label": "New Matches", "icon": "🔍", "color": "#805ad5"},
    ]
    
    def get_schema(self) -> Dict[str, Any]:
        """Return JSON schema for parameters"""
        return {
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": ["collect_weekly", "send_monthly"],
                    "description": "Mode: collect weekly stats or send monthly digest",
                    "default": "collect_weekly"
                },
                "week_number": {
                    "type": "integer",
                    "description": "Week number (1-4) for collection mode",
                    "minimum": 1,
                    "maximum": 4,
                    "default": 1
                },
                "max_recipients": {
                    "type": "integer",
                    "description": "Maximum number of recipients per run (0 = unlimited)",
                    "minimum": 0,
                    "maximum": 10000,
                    "default": 0
                },
                "dry_run": {
                    "type": "boolean",
                    "description": "Preview without sending emails",
                    "default": False
                }
            },
            "required": ["mode"]
        }
    
    def validate_params(self, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters"""
        mode = params.get("mode")
        if mode not in ["collect_weekly", "send_monthly"]:
            return False, "mode must be 'collect_weekly' or 'send_monthly'"
        return True, None
    
    async def execute(self, context: JobExecutionContext) -> JobResult:
        """Execute monthly digest job"""
        start_time = time.time()
        mode = context.parameters.get("mode", "collect_weekly")
        
        context.log("INFO", f"📊 Starting monthly digest job in '{mode}' mode...")
        
        try:
            if mode == "collect_weekly":
                return await self._collect_weekly_stats(context)
            else:
                return await self._send_monthly_digest(context)
                
        except Exception as e:
            duration = time.time() - start_time
            context.log("ERROR", f"❌ Monthly digest job failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return JobResult(
                status="failed",
                message=f"Monthly digest job failed: {str(e)}",
                errors=[str(e)],
                duration_seconds=duration
            )
    
    async def _collect_weekly_stats(self, context: JobExecutionContext) -> JobResult:
        """Collect and store weekly stats for all active users"""
        start_time = time.time()
        db = context.db
        
        # Determine week number (1-4 based on day of month)
        now = datetime.utcnow()
        day_of_month = now.day
        week_number = min(4, (day_of_month - 1) // 7 + 1)
        
        # Override with parameter if provided
        if context.parameters.get("week_number"):
            week_number = context.parameters["week_number"]
        
        month_key = now.strftime("%Y-%m")
        week_start = now - timedelta(days=7)
        week_end = now
        
        context.log("INFO", f"📅 Collecting Week {week_number} stats for {month_key}")
        context.log("INFO", f"   Date range: {week_start.date()} to {week_end.date()}")
        
        # Get all active users
        users_cursor = db.users.find({
            "accountStatus": "active",
            "contactEmail": {"$exists": True, "$ne": ""}
        }, {"username": 1, "firstName": 1})
        users = await users_cursor.to_list(length=None)
        
        context.log("INFO", f"   Found {len(users)} active users")
        
        processed = 0
        errors = 0
        
        for user in users:
            username = user["username"]
            try:
                stats = await self._gather_user_stats(db, username, week_start, week_end)
                
                # Upsert weekly stats
                await db.weekly_user_stats.update_one(
                    {
                        "username": username,
                        "month": month_key
                    },
                    {
                        "$set": {
                            f"week{week_number}": stats,
                            f"week{week_number}_range": {
                                "start": week_start.isoformat(),
                                "end": week_end.isoformat()
                            },
                            "updatedAt": now
                        },
                        "$setOnInsert": {
                            "username": username,
                            "month": month_key,
                            "createdAt": now
                        }
                    },
                    upsert=True
                )
                processed += 1
                
            except Exception as e:
                context.log("WARNING", f"   Failed to collect stats for {username}: {e}")
                errors += 1
        
        duration = time.time() - start_time
        context.log("INFO", f"✅ Weekly stats collection completed in {duration:.2f}s")
        context.log("INFO", f"   Processed: {processed}, Errors: {errors}")
        
        return JobResult(
            status="success" if errors == 0 else "partial_success",
            message=f"Week {week_number} stats collected for {month_key}",
            records_processed=processed,
            records_affected=processed,
            details={
                "mode": "collect_weekly",
                "month": month_key,
                "weekNumber": week_number,
                "usersProcessed": processed,
                "errors": errors
            },
            duration_seconds=duration
        )
    
    async def _gather_user_stats(
        self, 
        db: AsyncIOMotorDatabase, 
        username: str, 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[str, int]:
        """Gather all metrics for a user within date range"""
        stats = {}
        
        # Profile views received (uses viewedAt, not createdAt)
        stats["profile_views_received"] = await db.profile_views.count_documents({
            "viewedUsername": username,
            "viewedAt": {"$gte": start_date, "$lte": end_date}
        })
        
        # Interests received (favorites/shortlists where user is the target)
        stats["interests_received"] = await db.favorites.count_documents({
            "favoriteUsername": username,
            "createdAt": {"$gte": start_date, "$lte": end_date}
        }) + await db.shortlists.count_documents({
            "shortlistedUsername": username,
            "createdAt": {"$gte": start_date, "$lte": end_date}
        })
        
        # Interests sent (uses userUsername, not username)
        stats["interests_sent"] = await db.favorites.count_documents({
            "userUsername": username,
            "createdAt": {"$gte": start_date, "$lte": end_date}
        }) + await db.shortlists.count_documents({
            "userUsername": username,
            "createdAt": {"$gte": start_date, "$lte": end_date}
        })
        
        # Messages received (uses toUsername, not recipientUsername)
        # Note: createdAt is stored as ISO string, need to handle both formats
        stats["messages_received"] = await db.messages.count_documents({
            "toUsername": username,
            "$or": [
                {"createdAt": {"$gte": start_date, "$lte": end_date}},
                {"createdAt": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}
            ]
        })
        
        # Messages sent (uses fromUsername, not senderUsername)
        stats["messages_sent"] = await db.messages.count_documents({
            "fromUsername": username,
            "$or": [
                {"createdAt": {"$gte": start_date, "$lte": end_date}},
                {"createdAt": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}}
            ]
        })
        
        # Connection requests (PII requests received)
        stats["connection_requests"] = await db.pii_requests.count_documents({
            "targetUsername": username,
            "createdAt": {"$gte": start_date, "$lte": end_date}
        })
        
        # New matches from saved searches
        stats["new_matches"] = await db.saved_search_notifications.count_documents({
            "username": username,
            "createdAt": {"$gte": start_date, "$lte": end_date}
        })
        
        return stats
    
    async def _send_monthly_digest(self, context: JobExecutionContext) -> JobResult:
        """Send monthly digest emails with 4-week breakdown"""
        from services.notification_service import NotificationService
        from models.notification_models import NotificationQueueCreate, NotificationTrigger, NotificationChannel
        from crypto_utils import get_encryptor
        
        start_time = time.time()
        db = context.db
        max_recipients = context.parameters.get("max_recipients", 0)
        dry_run = context.parameters.get("dry_run", False)
        
        # Get current month
        now = datetime.utcnow()
        month_key = now.strftime("%Y-%m")
        month_name = now.strftime("%B %Y")
        
        context.log("INFO", f"📧 Sending monthly digest for {month_name}")
        
        # Get all users with weekly stats for this month
        stats_cursor = db.weekly_user_stats.find({"month": month_key})
        all_stats = await stats_cursor.to_list(length=None)
        
        context.log("INFO", f"   Found {len(all_stats)} users with pre-collected stats")
        
        # If no pre-collected stats, gather stats on-the-fly for all active users
        if len(all_stats) == 0:
            context.log("INFO", f"   No pre-collected stats found. Gathering stats on-the-fly...")
            
            # Get all active users with email
            users_cursor = db.users.find({
                "accountStatus": "active",
                "contactEmail": {"$exists": True, "$ne": ""}
            }, {"username": 1, "firstName": 1, "contactEmail": 1})
            active_users = await users_cursor.to_list(length=None)
            
            context.log("INFO", f"   Found {len(active_users)} active users with email")
            
            # Calculate 4-week date ranges (last 28 days)
            week_ranges = []
            for i in range(4, 0, -1):
                week_end = now - timedelta(days=(i-1) * 7)
                week_start = week_end - timedelta(days=7)
                week_ranges.append({
                    "week": 5 - i,
                    "start": week_start,
                    "end": week_end
                })
            
            # Build stats for each user on-the-fly
            for user in active_users:
                username = user["username"]
                user_stats = {"username": username, "month": month_key}
                
                for wr in week_ranges:
                    stats = await self._gather_user_stats(db, username, wr["start"], wr["end"])
                    user_stats[f"week{wr['week']}"] = stats
                    user_stats[f"week{wr['week']}_range"] = {
                        "start": wr["start"].isoformat(),
                        "end": wr["end"].isoformat()
                    }
                
                all_stats.append(user_stats)
            
            context.log("INFO", f"   Gathered on-the-fly stats for {len(all_stats)} users")
        
        if max_recipients > 0 and len(all_stats) > max_recipients:
            all_stats = all_stats[:max_recipients]
            context.log("INFO", f"   Limited to {max_recipients} recipients")
        
        notification_service = NotificationService(db)
        encryptor = get_encryptor()
        
        sent_count = 0
        skipped_count = 0
        error_count = 0
        
        for user_stats in all_stats:
            username = user_stats["username"]
            
            try:
                # Get user details
                user = await db.users.find_one({"username": username})
                if not user:
                    skipped_count += 1
                    continue
                
                # Decrypt email
                email = user.get("contactEmail", "")
                if email.startswith("gAAAAA"):
                    try:
                        email = encryptor.decrypt(email)
                    except:
                        skipped_count += 1
                        continue
                
                if not email:
                    skipped_count += 1
                    continue
                
                # Build 4-week data
                weeks_data = []
                for i in range(1, 5):
                    week_stats = user_stats.get(f"week{i}", {})
                    weeks_data.append({
                        "week": i,
                        "stats": week_stats,
                        "range": user_stats.get(f"week{i}_range", {})
                    })
                
                # Generate email HTML
                email_html = self._build_digest_email(
                    user.get("firstName", username),
                    month_name,
                    weeks_data
                )
                
                if dry_run:
                    context.log("INFO", f"   [DRY RUN] Would send to {username}")
                    sent_count += 1
                    continue
                
                # Queue notification
                notification = NotificationQueueCreate(
                    username=username,
                    trigger=NotificationTrigger.MONTHLY_DIGEST,
                    channels=[NotificationChannel.EMAIL],
                    templateData={
                        "user": {
                            "firstName": user.get("firstName", "User"),
                            "username": username
                        },
                        "month": month_name,
                        "weeksData": weeks_data,
                        "emailHtml": email_html
                    }
                )
                
                await notification_service.enqueue_notification(notification)
                sent_count += 1
                
            except Exception as e:
                context.log("ERROR", f"   Failed for {username}: {str(e)}")
                error_count += 1
        
        # Archive/reset stats after sending
        if not dry_run and sent_count > 0:
            # Move to archive collection
            await db.weekly_user_stats_archive.insert_many(
                [{"archivedAt": now, **s} for s in all_stats]
            )
            # Delete current month stats
            await db.weekly_user_stats.delete_many({"month": month_key})
            context.log("INFO", f"   Archived and reset {len(all_stats)} user stats")
        
        duration = time.time() - start_time
        context.log("INFO", f"✅ Monthly digest completed in {duration:.2f}s")
        context.log("INFO", f"   Sent: {sent_count}, Skipped: {skipped_count}, Errors: {error_count}")
        
        return JobResult(
            status="success" if error_count == 0 else "partial_success",
            message=f"Monthly digest emails queued for {month_name}",
            records_processed=len(all_stats),
            records_affected=sent_count,
            details={
                "mode": "send_monthly",
                "month": month_name,
                "sentCount": sent_count,
                "skippedCount": skipped_count,
                "errorCount": error_count,
                "dryRun": dry_run
            },
            duration_seconds=duration
        )
    
    def _build_svg_line_chart(
        self,
        values: List[int],
        color: str,
        width: int = 200,
        height: int = 60
    ) -> str:
        """Generate an inline SVG line chart with area fill"""
        if not values or all(v == 0 for v in values):
            # Return empty state chart
            return f'''
            <svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="{width}" height="{height}" fill="#f8f9fa" rx="4"/>
                <text x="{width//2}" y="{height//2 + 4}" text-anchor="middle" fill="#a0aec0" font-size="11" font-family="Arial, sans-serif">No data yet</text>
            </svg>
            '''
        
        max_val = max(values) if max(values) > 0 else 1
        padding = 10
        chart_width = width - (padding * 2)
        chart_height = height - (padding * 2)
        
        # Calculate points for the line
        points = []
        for i, val in enumerate(values):
            x = padding + (i * chart_width / (len(values) - 1)) if len(values) > 1 else padding + chart_width / 2
            y = padding + chart_height - (val / max_val * chart_height)
            points.append((x, y))
        
        # Create path for line
        line_path = f"M {points[0][0]},{points[0][1]}"
        for x, y in points[1:]:
            line_path += f" L {x},{y}"
        
        # Create path for area fill (closed polygon)
        area_path = line_path + f" L {points[-1][0]},{padding + chart_height} L {points[0][0]},{padding + chart_height} Z"
        
        # Generate SVG
        svg = f'''
        <svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" style="display: block;">
            <defs>
                <linearGradient id="grad_{color[1:]}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:{color};stop-opacity:0.3"/>
                    <stop offset="100%" style="stop-color:{color};stop-opacity:0.05"/>
                </linearGradient>
            </defs>
            
            <!-- Background -->
            <rect width="{width}" height="{height}" fill="#f8f9fa" rx="4"/>
            
            <!-- Grid lines -->
            <line x1="{padding}" y1="{padding + chart_height/2}" x2="{width - padding}" y2="{padding + chart_height/2}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4"/>
            
            <!-- Area fill -->
            <path d="{area_path}" fill="url(#grad_{color[1:]})" />
            
            <!-- Line -->
            <path d="{line_path}" fill="none" stroke="{color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            
            <!-- Data points -->
            {''.join([f'<circle cx="{x}" cy="{y}" r="4" fill="white" stroke="{color}" stroke-width="2"/>' for x, y in points])}
            
            <!-- Week labels -->
            {''.join([f'<text x="{points[i][0]}" y="{height - 2}" text-anchor="middle" fill="#718096" font-size="9" font-family="Arial, sans-serif">W{i+1}</text>' for i in range(len(points))])}
        </svg>
        '''
        return svg
    
    def _build_svg_bar_chart(
        self,
        values: List[int],
        color: str,
        width: int = 200,
        height: int = 60
    ) -> str:
        """Generate an inline SVG bar chart"""
        if not values or all(v == 0 for v in values):
            return f'''
            <svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="{width}" height="{height}" fill="#f8f9fa" rx="4"/>
                <text x="{width//2}" y="{height//2 + 4}" text-anchor="middle" fill="#a0aec0" font-size="11" font-family="Arial, sans-serif">No data yet</text>
            </svg>
            '''
        
        max_val = max(values) if max(values) > 0 else 1
        padding = 10
        bar_width = (width - padding * 2 - (len(values) - 1) * 8) / len(values)
        chart_height = height - padding * 2 - 12  # Leave space for labels
        
        bars_svg = ""
        for i, val in enumerate(values):
            bar_height = max(4, (val / max_val) * chart_height)  # Min height for visibility
            x = padding + i * (bar_width + 8)
            y = padding + chart_height - bar_height
            
            # Bar with rounded top
            bars_svg += f'''
            <rect x="{x}" y="{y}" width="{bar_width}" height="{bar_height}" fill="{color}" rx="3" ry="3"/>
            <text x="{x + bar_width/2}" y="{y - 4}" text-anchor="middle" fill="{color}" font-size="10" font-weight="600" font-family="Arial, sans-serif">{val}</text>
            <text x="{x + bar_width/2}" y="{height - 2}" text-anchor="middle" fill="#718096" font-size="9" font-family="Arial, sans-serif">W{i+1}</text>
            '''
        
        svg = f'''
        <svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" style="display: block;">
            <rect width="{width}" height="{height}" fill="#f8f9fa" rx="4"/>
            {bars_svg}
        </svg>
        '''
        return svg
    
    def _build_digest_email(
        self, 
        first_name: str, 
        month_name: str, 
        weeks_data: List[Dict]
    ) -> str:
        """Build the monthly digest email HTML with inline SVG charts"""
        
        # Calculate totals and trends for each metric
        metrics_summary = {}
        for metric in self.METRICS:
            key = metric["key"]
            values = [w["stats"].get(key, 0) for w in weeks_data]
            total = sum(values)
            max_val = max(values) if values else 1
            
            # Calculate trend (compare last 2 weeks)
            if len(values) >= 2 and values[-2] > 0:
                change = ((values[-1] - values[-2]) / values[-2]) * 100
                if change > 10:
                    trend = "📈"
                    trend_text = f"+{change:.0f}%"
                    trend_color = "#38a169"
                elif change < -10:
                    trend = "📉"
                    trend_text = f"{change:.0f}%"
                    trend_color = "#e53e3e"
                else:
                    trend = "➡️"
                    trend_text = "stable"
                    trend_color = "#718096"
            else:
                trend = "➡️"
                trend_text = "stable"
                trend_color = "#718096"
            
            metrics_summary[key] = {
                "values": values,
                "total": total,
                "max": max_val,
                "trend": trend,
                "trend_text": trend_text,
                "trend_color": trend_color,
                **metric
            }
        
        # Build metric cards with SVG charts
        # Alternate between line and bar charts for visual variety
        metrics_html = ""
        chart_types = ["line", "bar", "line", "bar", "line", "bar", "line"]
        
        for idx, (key, data) in enumerate(metrics_summary.items()):
            chart_type = chart_types[idx % len(chart_types)]
            
            if chart_type == "line":
                chart_svg = self._build_svg_line_chart(data["values"], data["color"], width=220, height=70)
            else:
                chart_svg = self._build_svg_bar_chart(data["values"], data["color"], width=220, height=70)
            
            metrics_html += f'''
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 14px; color: #718096; margin-bottom: 4px;">{data["icon"]} {data["label"]}</div>
                        <div style="font-size: 28px; font-weight: 700; color: {data["color"]};">{data["total"]}</div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 13px; color: {data["trend_color"]}; font-weight: 600;">{data["trend"]} {data["trend_text"]}</span>
                        <div style="font-size: 11px; color: #a0aec0; margin-top: 2px;">vs last week</div>
                    </div>
                </div>
                <div style="margin-top: 8px;">
                    {chart_svg}
                </div>
            </div>
            '''
        
        # Build complete email
        email_html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Logo -->
        <div style="text-align: center; padding: 25px 20px 15px 20px; background: white;">
            <img src="https://l3v3lmatches.com/logo192.png" alt="L3V3L MATCHES" style="height: 60px; width: auto;" />
        </div>
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600;">📊 Your Monthly Activity</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">{month_name}</p>
        </div>
        
        <!-- Greeting -->
        <div style="padding: 30px 30px 20px 30px;">
            <h2 style="margin: 0 0 10px 0; color: #2d3748; font-size: 22px;">Hi {first_name}! 👋</h2>
            <p style="color: #4a5568; font-size: 16px; margin: 0;">
                Here's your activity summary for the past 4 weeks. See how your profile performed!
            </p>
        </div>
        
        <!-- Metrics with Charts -->
        <div style="padding: 0 30px 30px 30px;">
            {metrics_html}
        </div>
        
        <!-- CTA -->
        <div style="padding: 0 30px 30px 30px; text-align: center;">
            <a href="https://l3v3lmatches.com/search" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                Explore New Matches →
            </a>
        </div>
        
        <!-- Tips -->
        <div style="background: #f8f9fa; padding: 20px 30px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 14px; color: #4a5568;">
                <strong>💡 Pro Tip:</strong> Profiles with 3+ photos and a complete bio get 5x more views!
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong>L3V3L MATCHES</strong> - Premium Matrimonial Platform</p>
            <p style="margin: 0;">
                <a href="https://l3v3lmatches.com/preferences" style="color: #667eea; text-decoration: none;">Manage Notifications</a> | 
                <a href="https://l3v3lmatches.com/preferences" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
            </p>
        </div>
        
    </div>
</body>
</html>'''
        
        return email_html
