"""
Pause Analytics API Routes
Admin-only endpoints for pause feature analytics
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, List, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from database import get_database
from auth.jwt_auth import get_current_user_dependency as get_current_user
from services.pause_analytics_service import PauseAnalyticsService


router = APIRouter(prefix="/api/pause-analytics", tags=["pause-analytics"])


# Response Models
class OverviewStatsResponse(BaseModel):
    """Overview statistics response"""
    totalUsersPaused: int
    activePausedAccounts: int
    totalPauseEvents: int
    averagePauseCount: float
    averageDurationDays: float


class ReasonDistribution(BaseModel):
    """Pause reason distribution"""
    reason: str
    count: int
    percentage: float


class DurationPatternsResponse(BaseModel):
    """Duration patterns response"""
    patterns: Dict[str, int]
    total: int
    percentages: Dict[str, float]


class TimeSeriesDataPoint(BaseModel):
    """Time series data point"""
    date: str
    pauses: int
    unpauses: int
    netChange: int


class TopPauserResponse(BaseModel):
    """Top pauser data"""
    username: str
    pauseCount: int
    currentStatus: str
    pausedAt: Optional[datetime] = None  # Optional datetime
    pauseReason: Optional[str] = None


class AutoUnpauseStatsResponse(BaseModel):
    """Auto-unpause statistics"""
    scheduledAutoUnpause: int
    overdueAutoUnpause: int
    manualPauseOnly: int
    totalPaused: int


class ComprehensiveReportResponse(BaseModel):
    """Comprehensive analytics report"""
    overview: OverviewStatsResponse
    reasonsDistribution: List[ReasonDistribution]
    durationPatterns: DurationPatternsResponse
    autoUnpauseStats: AutoUnpauseStatsResponse
    topPausers: List[TopPauserResponse]
    timeSeries: List[TimeSeriesDataPoint]
    generatedAt: datetime


# Helper function to check admin access
def check_admin_access(current_user: dict):
    """Verify user is admin"""
    is_admin = current_user.get("role") == "admin" or current_user.get("role_name") == "admin"
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


# API Endpoints
@router.get("/overview", response_model=OverviewStatsResponse)
async def get_overview_stats(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get overview statistics for pause feature
    
    **Admin only**
    
    Returns:
        - Total users who have paused
        - Currently paused accounts
        - Total pause events
        - Average pause count per user
        - Average pause duration
    """
    check_admin_access(current_user)
    
    service = PauseAnalyticsService(db)
    stats = await service.get_overview_stats()
    
    return OverviewStatsResponse(**stats)


@router.get("/reasons", response_model=List[ReasonDistribution])
async def get_pause_reasons(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get distribution of pause reasons
    
    **Admin only**
    
    Returns:
        List of reasons with counts and percentages
    """
    check_admin_access(current_user)
    
    service = PauseAnalyticsService(db)
    reasons = await service.get_pause_reasons_distribution()
    
    return [ReasonDistribution(**r) for r in reasons]


@router.get("/duration-patterns", response_model=DurationPatternsResponse)
async def get_duration_patterns(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get pause duration patterns
    
    **Admin only**
    
    Returns:
        Breakdown of 3d, 7d, 14d, 30d, manual pauses
    """
    check_admin_access(current_user)
    
    service = PauseAnalyticsService(db)
    patterns = await service.get_duration_patterns()
    
    return DurationPatternsResponse(**patterns)


@router.get("/time-series", response_model=List[TimeSeriesDataPoint])
async def get_time_series(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get time-series data for pause events
    
    **Admin only**
    
    Args:
        days: Number of days to look back (default 30)
    
    Returns:
        Daily pause/unpause counts
    """
    check_admin_access(current_user)
    
    if days < 1 or days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Days must be between 1 and 365"
        )
    
    service = PauseAnalyticsService(db)
    data = await service.get_time_series_data(days=days)
    
    return [TimeSeriesDataPoint(**d) for d in data]


@router.get("/top-pausers", response_model=List[TopPauserResponse])
async def get_top_pausers(
    limit: int = 10,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get users with highest pause counts
    
    **Admin only**
    
    Args:
        limit: Number of top users to return (default 10, max 50)
    
    Returns:
        List of top pausers with their stats
    """
    check_admin_access(current_user)
    
    if limit < 1 or limit > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 50"
        )
    
    service = PauseAnalyticsService(db)
    pausers = await service.get_top_pausers(limit=limit)
    
    return [TopPauserResponse(**p) for p in pausers]


@router.get("/auto-unpause-stats", response_model=AutoUnpauseStatsResponse)
async def get_auto_unpause_stats(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get auto-unpause feature statistics
    
    **Admin only**
    
    Returns:
        - Scheduled auto-unpause count
        - Overdue auto-unpause count
        - Manual-only pause count
    """
    check_admin_access(current_user)
    
    service = PauseAnalyticsService(db)
    stats = await service.get_auto_unpause_stats()
    
    return AutoUnpauseStatsResponse(**stats)


@router.get("/comprehensive-report", response_model=ComprehensiveReportResponse)
async def get_comprehensive_report(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get comprehensive analytics report
    
    **Admin only**
    
    Returns:
        Complete analytics data including:
        - Overview statistics
        - Reason distribution
        - Duration patterns
        - Auto-unpause stats
        - Top pausers
        - Time-series data
    """
    check_admin_access(current_user)
    
    service = PauseAnalyticsService(db)
    report = await service.get_comprehensive_report()
    
    return ComprehensiveReportResponse(**report)


@router.get("/export")
async def export_analytics(
    format: str = "json",
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Export analytics data
    
    **Admin only**
    
    Args:
        format: Export format (json or csv)
    
    Returns:
        Analytics data in requested format
    """
    check_admin_access(current_user)
    
    if format not in ["json", "csv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format must be 'json' or 'csv'"
        )
    
    service = PauseAnalyticsService(db)
    report = await service.get_comprehensive_report()
    
    if format == "json":
        # Return JSON (already in correct format)
        return report
    else:
        # CSV format - simplified for now
        # In production, you'd convert to proper CSV
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="CSV export not yet implemented"
        )
