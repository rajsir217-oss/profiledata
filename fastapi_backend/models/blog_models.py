"""
Blog Post Models
Pydantic models for the blog management system
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class BlogPostStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class BlogPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300, description="Blog post title")
    slug: Optional[str] = Field(None, max_length=300, description="URL-friendly slug (auto-generated if empty)")
    excerpt: Optional[str] = Field(None, max_length=500, description="Short summary for previews")
    content: str = Field(..., min_length=1, description="Full blog content (HTML supported)")
    coverImage: Optional[str] = Field(None, description="Cover image URL")
    tags: List[str] = Field(default_factory=list, description="List of tags")
    status: BlogPostStatus = Field(default=BlogPostStatus.DRAFT, description="Publication status")
    metaDescription: Optional[str] = Field(None, max_length=300, description="SEO meta description")


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    slug: Optional[str] = Field(None, max_length=300)
    excerpt: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = Field(None, min_length=1)
    coverImage: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[BlogPostStatus] = None
    metaDescription: Optional[str] = Field(None, max_length=300)


class BlogPostResponse(BaseModel):
    id: str = Field(..., description="Blog post ID")
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: str
    coverImage: Optional[str] = None
    tags: List[str] = []
    status: BlogPostStatus
    metaDescription: Optional[str] = None
    createdBy: str = Field(..., description="Author username")
    createdAt: datetime
    updatedAt: datetime
    publishedAt: Optional[datetime] = None
    viewCount: int = 0

    class Config:
        json_schema_extra = {
            "example": {
                "id": "63f1a2b3c4d5e6f7g8h9i0j1",
                "title": "How L3V3L Matches Are Calculated",
                "slug": "how-l3v3l-matches-are-calculated",
                "excerpt": "Learn about the AI-powered compatibility engine behind L3V3L.",
                "content": "<p>Full article content here...</p>",
                "coverImage": "/images/blog/compatibility.jpg",
                "tags": ["ai", "matching", "compatibility"],
                "status": "published",
                "metaDescription": "Discover how L3V3L uses AI to analyze 50+ compatibility factors.",
                "createdBy": "admin",
                "createdAt": "2025-11-26T12:00:00Z",
                "updatedAt": "2025-11-26T12:00:00Z",
                "publishedAt": "2025-11-26T12:00:00Z",
                "viewCount": 150
            }
        }
