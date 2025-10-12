# fastapi_backend/authorization.py
"""
Role-Based Access Control (RBAC) Authorization System
"""

from fastapi import HTTPException, status, Depends
from typing import List, Callable
from functools import wraps
from .jwt_auth import get_current_user_dependency
from .security_config import DEFAULT_PERMISSIONS
import re

class PermissionChecker:
    """Permission checking utilities"""
    
    @staticmethod
    def has_permission(user_permissions: List[str], required_permission: str) -> bool:
        """
        Check if user has a specific permission
        Supports wildcards: users.* matches users.create, users.read, etc.
        """
        for permission in user_permissions:
            # Exact match
            if permission == required_permission:
                return True
            
            # Wildcard match (e.g., users.* matches users.create)
            if permission.endswith('.*'):
                resource = permission.split('.')[0]
                required_resource = required_permission.split('.')[0]
                if resource == required_resource:
                    return True
            
            # Full wildcard
            if permission == '*' or permission == '*.*':
                return True
        
        return False
    
    @staticmethod
    def get_user_permissions(user: dict) -> List[str]:
        """Get all permissions for a user (role + custom)"""
        permissions = []
        
        # Get role permissions
        role_name = user.get('role_name', 'free_user')
        role_permissions = DEFAULT_PERMISSIONS.get(role_name, [])
        permissions.extend(role_permissions)
        
        # Add custom permissions
        custom_permissions = user.get('custom_permissions', [])
        permissions.extend(custom_permissions)
        
        return list(set(permissions))  # Remove duplicates
    
    @staticmethod
    def check_permission(user: dict, required_permission: str) -> bool:
        """Check if user has required permission"""
        user_permissions = PermissionChecker.get_user_permissions(user)
        return PermissionChecker.has_permission(user_permissions, required_permission)
    
    @staticmethod
    def check_any_permission(user: dict, required_permissions: List[str]) -> bool:
        """Check if user has ANY of the required permissions"""
        user_permissions = PermissionChecker.get_user_permissions(user)
        for required in required_permissions:
            if PermissionChecker.has_permission(user_permissions, required):
                return True
        return False
    
    @staticmethod
    def check_all_permissions(user: dict, required_permissions: List[str]) -> bool:
        """Check if user has ALL of the required permissions"""
        user_permissions = PermissionChecker.get_user_permissions(user)
        for required in required_permissions:
            if not PermissionChecker.has_permission(user_permissions, required):
                return False
        return True

class RoleChecker:
    """Role checking utilities"""
    
    @staticmethod
    def has_role(user: dict, required_role: str) -> bool:
        """Check if user has a specific role"""
        user_role = user.get('role_name', 'free_user')
        return user_role == required_role
    
    @staticmethod
    def has_any_role(user: dict, required_roles: List[str]) -> bool:
        """Check if user has any of the required roles"""
        user_role = user.get('role_name', 'free_user')
        return user_role in required_roles
    
    @staticmethod
    def is_admin(user: dict) -> bool:
        """Check if user is admin"""
        return RoleChecker.has_role(user, 'admin')
    
    @staticmethod
    def is_moderator_or_admin(user: dict) -> bool:
        """Check if user is moderator or admin"""
        return RoleChecker.has_any_role(user, ['admin', 'moderator'])
    
    @staticmethod
    def is_premium_user(user: dict) -> bool:
        """Check if user is premium user or higher"""
        return RoleChecker.has_any_role(user, ['admin', 'moderator', 'premium_user'])

# ===== Authorization Dependencies =====

def require_permission(permission: str):
    """
    Dependency to require a specific permission
    Usage: @router.get("/endpoint", dependencies=[Depends(require_permission("users.read"))])
    """
    async def permission_checker(current_user: dict = Depends(get_current_user_dependency)):
        if not PermissionChecker.check_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required permission: {permission}"
            )
        return current_user
    return permission_checker

def require_any_permission(permissions: List[str]):
    """
    Dependency to require any of the specified permissions
    """
    async def permission_checker(current_user: dict = Depends(get_current_user_dependency)):
        if not PermissionChecker.check_any_permission(current_user, permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required any of: {', '.join(permissions)}"
            )
        return current_user
    return permission_checker

def require_all_permissions(permissions: List[str]):
    """
    Dependency to require all of the specified permissions
    """
    async def permission_checker(current_user: dict = Depends(get_current_user_dependency)):
        if not PermissionChecker.check_all_permissions(current_user, permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required all of: {', '.join(permissions)}"
            )
        return current_user
    return permission_checker

def require_role(role: str):
    """
    Dependency to require a specific role
    Usage: @router.get("/admin", dependencies=[Depends(require_role("admin"))])
    """
    async def role_checker(current_user: dict = Depends(get_current_user_dependency)):
        if not RoleChecker.has_role(current_user, role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {role}"
            )
        return current_user
    return role_checker

def require_any_role(roles: List[str]):
    """
    Dependency to require any of the specified roles
    """
    async def role_checker(current_user: dict = Depends(get_current_user_dependency)):
        if not RoleChecker.has_any_role(current_user, roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required any of: {', '.join(roles)}"
            )
        return current_user
    return role_checker

# ===== Convenience Dependencies =====

async def require_admin(current_user: dict = Depends(get_current_user_dependency)):
    """Require admin role"""
    if not RoleChecker.is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

async def require_moderator_or_admin(current_user: dict = Depends(get_current_user_dependency)):
    """Require moderator or admin role"""
    if not RoleChecker.is_moderator_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator or admin access required"
        )
    return current_user

async def require_premium_user(current_user: dict = Depends(get_current_user_dependency)):
    """Require premium user or higher"""
    if not RoleChecker.is_premium_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium user access required"
        )
    return current_user

# ===== Resource Ownership Check =====

class OwnershipChecker:
    """Check if user owns a resource"""
    
    @staticmethod
    async def check_ownership(current_user: dict, resource_owner: str) -> bool:
        """Check if current user owns the resource"""
        return current_user.get('username') == resource_owner
    
    @staticmethod
    async def require_ownership_or_admin(current_user: dict, resource_owner: str):
        """Require user to be owner or admin"""
        is_owner = await OwnershipChecker.check_ownership(current_user, resource_owner)
        is_admin = RoleChecker.is_admin(current_user)
        
        if not (is_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this resource"
            )
        
        return True

# ===== Decorator for Route Protection =====

def protected(permission: str = None, role: str = None, admin_only: bool = False):
    """
    Decorator to protect routes with permission or role checks
    
    Usage:
    @protected(permission="users.create")
    async def create_user(...):
        ...
    
    @protected(role="admin")
    async def admin_endpoint(...):
        ...
    
    @protected(admin_only=True)
    async def admin_only_endpoint(...):
        ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current user from kwargs (injected by FastAPI)
            current_user = kwargs.get('current_user')
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check admin only
            if admin_only and not RoleChecker.is_admin(current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin access required"
                )
            
            # Check role
            if role and not RoleChecker.has_role(current_user, role):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Required role: {role}"
                )
            
            # Check permission
            if permission and not PermissionChecker.check_permission(current_user, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Required permission: {permission}"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator
