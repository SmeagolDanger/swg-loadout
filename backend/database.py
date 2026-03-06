import os
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
    UniqueConstraint, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://slt_user:slt_pass@db:5432/slt_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ══════════════════════════════════════════════════════════════════════
# User
# ══════════════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    # Loadout relationships
    loadouts = relationship("Loadout", back_populates="owner", cascade="all, delete-orphan")
    components = relationship("UserComponent", back_populates="owner", cascade="all, delete-orphan")
    fc_loadouts = relationship("FCLoadout", back_populates="owner", cascade="all, delete-orphan")
    re_projects = relationship("REProject", back_populates="owner", cascade="all, delete-orphan")
    # Collections relationships
    characters = relationship("Character", back_populates="owner", cascade="all, delete-orphan")


# ══════════════════════════════════════════════════════════════════════
# Loadout Tool Models
# ══════════════════════════════════════════════════════════════════════

class Loadout(Base):
    __tablename__ = "loadouts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    chassis = Column(String(100), nullable=False)
    mass = Column(Float, default=0)
    reactor = Column(String(100), default="None")
    engine = Column(String(100), default="None")
    booster = Column(String(100), default="None")
    shield = Column(String(100), default="None")
    front_armor = Column(String(100), default="None")
    rear_armor = Column(String(100), default="None")
    capacitor = Column(String(100), default="None")
    cargo_hold = Column(String(100), default="None")
    droid_interface = Column(String(100), default="None")
    slot1 = Column(String(100), default="None")
    slot2 = Column(String(100), default="None")
    slot3 = Column(String(100), default="None")
    slot4 = Column(String(100), default="None")
    slot5 = Column(String(100), default="None")
    slot6 = Column(String(100), default="None")
    slot7 = Column(String(100), default="None")
    slot8 = Column(String(100), default="None")
    pack1 = Column(String(100), default="None")
    pack2 = Column(String(100), default="None")
    pack3 = Column(String(100), default="None")
    pack4 = Column(String(100), default="None")
    pack5 = Column(String(100), default="None")
    pack6 = Column(String(100), default="None")
    pack7 = Column(String(100), default="None")
    pack8 = Column(String(100), default="None")
    ro_level = Column(String(20), default="None")
    eo_level = Column(String(20), default="None")
    co_level = Column(String(20), default="None")
    wo_level = Column(String(20), default="None")
    shield_adjust = Column(String(50), default="None")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_public = Column(Boolean, default=False)
    owner = relationship("User", back_populates="loadouts")


class UserComponent(Base):
    __tablename__ = "user_components"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comp_type = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    stat1 = Column(Float, default=0)
    stat2 = Column(Float, default=0)
    stat3 = Column(Float, default=0)
    stat4 = Column(Float, default=0)
    stat5 = Column(Float, default=0)
    stat6 = Column(Float, default=0)
    stat7 = Column(Float, default=0)
    stat8 = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="components")


class FCLoadout(Base):
    __tablename__ = "fc_loadouts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    fc_level = Column(Integer, default=0)
    dcs = Column(Integer, default=0)
    programs = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="fc_loadouts")


class REProject(Base):
    __tablename__ = "re_projects"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    comp_type = Column(String(50), nullable=False)
    re_level = Column(Integer, default=0)
    stat0 = Column(Float, default=0)
    stat1 = Column(Float, default=0)
    stat2 = Column(Float, default=0)
    stat3 = Column(Float, default=0)
    stat4 = Column(Float, default=0)
    stat5 = Column(Float, default=0)
    stat6 = Column(Float, default=0)
    stat7 = Column(Float, default=0)
    stat8 = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="re_projects")


# ══════════════════════════════════════════════════════════════════════
# Collections Models
# ══════════════════════════════════════════════════════════════════════

class Character(Base):
    __tablename__ = "characters"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False, index=True)
    server = Column(String(50), default="Legends")
    species = Column(String(50), default="")
    profession = Column(String(50), default="")
    combat_level = Column(Integer, default=1)
    guild = Column(String(100), default="")
    bio = Column(Text, default="")
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    owner = relationship("User", back_populates="characters")
    completed_collections = relationship("CharacterCollection", back_populates="character", cascade="all, delete-orphan")


class CollectionGroup(Base):
    __tablename__ = "collection_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)
    icon = Column(String(50), default="default")
    category = Column(String(50), default="other")
    description = Column(Text, default="")
    sort_order = Column(Integer, default=0)
    items = relationship("CollectionItem", back_populates="group", cascade="all, delete-orphan")


class CollectionItem(Base):
    __tablename__ = "collection_items"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("collection_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    notes = Column(Text, default="")
    difficulty = Column(String(20), default="medium")
    sort_order = Column(Integer, default=0)
    group = relationship("CollectionGroup", back_populates="items")
    __table_args__ = (UniqueConstraint("group_id", "name", name="uq_group_item"),)


class CharacterCollection(Base):
    __tablename__ = "character_collections"
    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("collection_items.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, default="")
    character = relationship("Character", back_populates="completed_collections")
    item = relationship("CollectionItem")
    __table_args__ = (UniqueConstraint("character_id", "item_id", name="uq_char_item"),)


# ══════════════════════════════════════════════════════════════════════
# DB helpers
# ══════════════════════════════════════════════════════════════════════

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
