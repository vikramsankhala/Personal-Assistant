"""User and organization models."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class Organization(Base):
    """Multi-tenant organization."""

    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    tier = Column(String(20), default="free")  # free, pro, team, enterprise

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users = relationship("User", back_populates="organization")


class User(Base):
    """User account."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    org_id = Column(String(36), ForeignKey("organizations.id"), index=True)

    email = Column(String(255), unique=True, index=True)
    hashed_password = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="users")
