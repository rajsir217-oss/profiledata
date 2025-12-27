"""
Payment History Models
Created: December 26, 2025
Purpose: Pydantic models for payment history tracking
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class PaymentType(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    ONE_TIME = "one_time"
    LIFETIME = "lifetime"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    STRIPE = "stripe"
    PAYPAL = "paypal"
    CREDIT_CARD = "credit_card"
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    OTHER = "other"


class PaymentCreate(BaseModel):
    """Model for creating a new payment record"""
    username: str
    amount: float
    paymentType: PaymentType = PaymentType.ONE_TIME
    paymentMethod: PaymentMethod = PaymentMethod.OTHER
    promoCode: Optional[str] = None
    description: Optional[str] = None
    transactionId: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    """Model for payment response"""
    id: str = Field(alias="_id")
    username: str
    amount: float
    paymentType: str
    paymentMethod: str
    promoCode: Optional[str] = None
    description: Optional[str] = None
    transactionId: Optional[str] = None
    status: str = "completed"
    createdAt: datetime
    createdBy: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        populate_by_name = True


class PaymentSummary(BaseModel):
    """Summary of payments for a user"""
    username: str
    totalPayments: int
    totalAmount: float
    payments: List[PaymentResponse]
