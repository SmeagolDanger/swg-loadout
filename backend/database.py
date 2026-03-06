import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://slt_user:slt_pass@db:5432/slt_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    loadouts = relationship("Loadout", back_populates="owner", cascade="all, delete-orphan")
    components = relationship("UserComponent", back_populates="owner", cascade="all, delete-orphan")
    fc_loadouts = relationship("FCLoadout", back_populates="owner", cascade="all, delete-orphan")
    re_projects = relationship("REProject", back_populates="owner", cascade="all, delete-orphan")


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
    comp_type = Column(String(50), nullable=False)  # reactor, engine, booster, shield, armor, etc.
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
    programs = Column(Text, default="")  # JSON string of program slots
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
