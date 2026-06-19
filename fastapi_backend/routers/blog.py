"""
Blog Management Routes
API endpoints for managing blog posts (admin CRUD + public read)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
import re
import logging

from models.blog_models import (
    BlogPostCreate,
    BlogPostUpdate,
    BlogPostResponse,
    BlogPostStatus
)
from auth.jwt_auth import get_current_user_dependency as get_current_user
from database import get_database

router = APIRouter(prefix="/api/blog", tags=["blog"])
logger = logging.getLogger(__name__)


def is_admin_or_moderator(current_user: dict) -> bool:
    role = current_user.get("role") or current_user.get("role_name")
    return role in ["admin", "moderator"]


def _slugify(title: str) -> str:
    s = title.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s[:300]


# ── PUBLIC ROUTES ──────────────────────────────────────

@router.get("", response_model=List[BlogPostResponse])
async def list_published_posts(
    tag: Optional[str] = Query(None, description="Filter by tag"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """List published blog posts (public, no auth required)"""
    query = {"status": "published"}
    if tag:
        query["tags"] = tag

    cursor = db.blog_posts.find(query).sort("publishedAt", -1).skip(skip).limit(limit)
    posts = await cursor.to_list(length=limit)

    result = []
    for post in posts:
        post["id"] = str(post.pop("_id"))
        result.append(BlogPostResponse(**post))
    return result


@router.get("/tags", response_model=List[str])
async def list_tags(
    db: AsyncIOMotorClient = Depends(get_database)
):
    """List all unique tags from published posts (public)"""
    pipeline = [
        {"$match": {"status": "published"}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags"}},
        {"$sort": {"_id": 1}}
    ]
    results = await db.blog_posts.aggregate(pipeline).to_list(length=500)
    return [r["_id"] for r in results]


@router.get("/{slug_or_id}", response_model=BlogPostResponse)
async def get_post(
    slug_or_id: str,
    db: AsyncIOMotorClient = Depends(get_database)
):
    """Get a single published blog post by slug or ID (public)"""
    # Try ObjectId first, then slug
    query = {"status": "published"}
    if ObjectId.is_valid(slug_or_id):
        query["_id"] = ObjectId(slug_or_id)
    else:
        query["slug"] = slug_or_id

    post = await db.blog_posts.find_one(query)
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    # Increment view count
    await db.blog_posts.update_one(
        {"_id": post["_id"]},
        {"$inc": {"viewCount": 1}}
    )

    post["id"] = str(post.pop("_id"))
    return BlogPostResponse(**post)


# ── ADMIN ROUTES ───────────────────────────────────────

@router.get("/admin/all", response_model=List[BlogPostResponse])
async def admin_list_all(
    status: Optional[BlogPostStatus] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """List all blog posts (admin/moderator only)"""
    if not is_admin_or_moderator(current_user):
        raise HTTPException(status_code=403, detail="Admin or Moderator access required")

    query = {}
    if status:
        query["status"] = status.value

    cursor = db.blog_posts.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    posts = await cursor.to_list(length=limit)

    result = []
    for post in posts:
        post["id"] = str(post.pop("_id"))
        result.append(BlogPostResponse(**post))
    return result


@router.post("/admin/create", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: BlogPostCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """Create a new blog post (admin/moderator only)"""
    if not is_admin_or_moderator(current_user):
        raise HTTPException(status_code=403, detail="Admin or Moderator access required")

    now = datetime.utcnow()
    username = current_user.get("username")

    slug = post_data.slug or _slugify(post_data.title)

    # Ensure slug uniqueness
    existing = await db.blog_posts.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{int(now.timestamp())}"

    doc = {
        "title": post_data.title,
        "slug": slug,
        "excerpt": post_data.excerpt,
        "content": post_data.content,
        "coverImage": post_data.coverImage,
        "tags": post_data.tags,
        "status": post_data.status.value,
        "metaDescription": post_data.metaDescription,
        "createdBy": username,
        "createdAt": now,
        "updatedAt": now,
        "publishedAt": now if post_data.status == BlogPostStatus.PUBLISHED else None,
        "viewCount": 0
    }

    result = await db.blog_posts.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)

    logger.info(f"Admin {username} created blog post: {doc['id']} - {doc['title']}")
    return BlogPostResponse(**doc)


@router.put("/admin/{post_id}", response_model=BlogPostResponse)
async def update_post(
    post_id: str,
    update: BlogPostUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """Update a blog post (admin/moderator only)"""
    if not is_admin_or_moderator(current_user):
        raise HTTPException(status_code=403, detail="Admin or Moderator access required")

    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=404, detail="Blog post not found")

    existing = await db.blog_posts.find_one({"_id": ObjectId(post_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Blog post not found")

    update_data = {k: v for k, v in update.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Handle slug auto-generation
    if "title" in update_data and "slug" not in update_data:
        update_data["slug"] = _slugify(update_data["title"])

    # Handle status change
    if "status" in update_data:
        update_data["status"] = update_data["status"].value if hasattr(update_data["status"], "value") else update_data["status"]
        if update_data["status"] == "published" and not existing.get("publishedAt"):
            update_data["publishedAt"] = datetime.utcnow()

    update_data["updatedAt"] = datetime.utcnow()

    await db.blog_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": update_data}
    )

    updated = await db.blog_posts.find_one({"_id": ObjectId(post_id)})
    updated["id"] = str(updated.pop("_id"))

    logger.info(f"Admin {current_user.get('username')} updated blog post: {post_id}")
    return BlogPostResponse(**updated)


@router.delete("/admin/{post_id}")
async def delete_post(
    post_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorClient = Depends(get_database)
):
    """Delete a blog post (admin/moderator only)"""
    if not is_admin_or_moderator(current_user):
        raise HTTPException(status_code=403, detail="Admin or Moderator access required")

    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=404, detail="Blog post not found")

    result = await db.blog_posts.delete_one({"_id": ObjectId(post_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")

    logger.info(f"Admin {current_user.get('username')} deleted blog post: {post_id}")
    return {"message": "Blog post deleted"}
