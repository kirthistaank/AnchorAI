"""Pydantic schemas for auth and user endpoints"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user_id: str
    username: str
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ProfileResponse(BaseModel):
    id: str
    username: str
    email: str
    health_goals: Optional[str] = None
    preferred_strategies: Optional[List[str]] = []
    timezone: Optional[str] = "UTC"
    created_at: datetime
    last_login: Optional[datetime] = None


class UpdateProfileRequest(BaseModel):
    health_goals: Optional[str] = None
    timezone: Optional[str] = None
