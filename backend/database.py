import os
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://slt_user:slt_pass@db:5432/slt_db")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
)
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
    display_name = Column(String(100), default="")

    discord_id = Column(String(40), unique=True, index=True, nullable=True)
    discord_username = Column(String(100), nullable=True)
    discord_avatar = Column(String(255), nullable=True)
    auth_provider = Column(String(30), default="local", nullable=False)

    password_reset_token_hash = Column(String(64), nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    password_reset_sent_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    role = Column(String(30), default="user")  # user | admin | collection_admin

    # Loadout relationships
    loadouts = relationship("Loadout", back_populates="owner", cascade="all, delete-orphan")
    components = relationship("UserComponent", back_populates="owner", cascade="all, delete-orphan")
    fc_loadouts = relationship("FCLoadout", back_populates="owner", cascade="all, delete-orphan")
    re_projects = relationship("REProject", back_populates="owner", cascade="all, delete-orphan")

    # Collections relationships
    characters = relationship("Character", back_populates="owner", cascade="all, delete-orphan")

    # Curated mods
    mods = relationship("Mod", back_populates="owner", cascade="all, delete-orphan")

    # Ent buff builds
    ent_buff_builds = relationship("EntBuffBuild", back_populates="owner", cascade="all, delete-orphan")


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
    is_featured = Column(Boolean, default=False)
    is_starter = Column(Boolean, default=False)
    starter_description = Column(Text, default="")
    starter_tags = Column(String(255), default="")

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
# Curated Mods
# ══════════════════════════════════════════════════════════════════════


class Mod(Base):
    __tablename__ = "mods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    slug = Column(String(120), unique=True, index=True, nullable=False)
    title = Column(String(160), nullable=False)
    author_name = Column(String(120), default="")
    summary = Column(String(280), default="")
    description = Column(Text, default="")
    category = Column(String(80), default="general")
    tags = Column(String(255), default="")
    version = Column(String(40), default="1.0")
    compatibility = Column(String(120), default="SWG Legends")
    install_instructions = Column(Text, default="")

    is_published = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="mods")
    files = relationship("ModFile", back_populates="mod", cascade="all, delete-orphan")
    screenshots = relationship("ModScreenshot", back_populates="mod", cascade="all, delete-orphan")


class ModFile(Base):
    __tablename__ = "mod_files"

    id = Column(Integer, primary_key=True, index=True)
    mod_id = Column(Integer, ForeignKey("mods.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(160), default="")
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, default=0)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    mod = relationship("Mod", back_populates="files")


class ModScreenshot(Base):
    __tablename__ = "mod_screenshots"

    id = Column(Integer, primary_key=True, index=True)
    mod_id = Column(Integer, ForeignKey("mods.id", ondelete="CASCADE"), nullable=False, index=True)
    caption = Column(String(200), default="")
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    sort_order = Column(Integer, default=0)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    mod = relationship("Mod", back_populates="screenshots")


# ══════════════════════════════════════════════════════════════════════
# Site Config
# ══════════════════════════════════════════════════════════════════════


class SiteConfig(Base):
    __tablename__ = "site_config"

    key = Column(String(100), primary_key=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ══════════════════════════════════════════════════════════════════════
# RE Tier Thresholds
# ══════════════════════════════════════════════════════════════════════


class TierThreshold(Base):
    __tablename__ = "tier_thresholds"

    comp_code = Column(String(3), primary_key=True)  # e.g. W8, A0, S6
    d_threshold = Column(Integer, nullable=False, default=0)
    c_threshold = Column(Integer, nullable=False, default=0)
    b_threshold = Column(Integer, nullable=False, default=0)
    a_threshold = Column(Integer, nullable=False, default=0)


# Thresholds parsed from STAJ.txt — "1 in X Odds" for each tier boundary
_TIER_SEED: dict[str, tuple[int, int, int, int]] = {
    # (d, c, b, a)
    # Weapons
    "W5": (69, 422, 4000, 63000),
    "W6": (348, 1000, 4000, 20000),
    "W7": (18, 74, 453, 4000),
    "W8": (28, 161, 2000, 28000),
    "W9": (518, 3000, 20000, 189000),
    "W0": (98, 625, 6000, 89000),
    # Armors
    "A1": (13, 172, 5000, 286000),
    "A2": (37, 123, 552, 4000),
    "A3": (109, 250, 632, 2000),
    "A4": (44, 101, 259, 754),
    "A5": (105, 327, 1000, 5000),
    "A6": (137, 806, 7000, 77000),
    "A7": (379, 1000, 4000, 14000),
    "A8": (509, 2000, 9000, 48000),
    "A9": (1000, 3000, 9000, 23000),
    "A0": (502, 2000, 13000, 34000),
    # Shields
    "S5": (1000, 3000, 8000, 23000),
    "S6": (79, 522, 6000, 103000),
    "S7": (431, 2000, 11000, 82000),
    "S8": (65, 286, 2000, 14000),
    "S0": (325, 1000, 7000, 43000),
    # Capacitors
    "C2": (33, 221, 5000, 581000),
    "C4": (200, 2000, 27000, 1000000),
    "C6": (2000, 4000, 9000, 24000),
    "C8": (3000, 13000, 63000, 304000),
    "C0": (544, 3000, 17000, 140000),
    # Engines
    "E4": (23, 112, 843, 10000),
    "E6": (1000, 7000, 57000, 642000),
    "E8": (440, 1000, 5000, 18000),
    "E0": (170, 873, 6000, 56000),
    # Reactors
    "R1": (18, 56, 213, 1000),
    "R2": (98, 518, 4000, 35000),
    "R3": (1000, 3000, 6000, 14000),
    "R4": (1000, 3000, 6000, 16000),
    "R5": (169, 730, 4000, 25000),
    "R6": (155, 619, 3000, 17000),
    "R7": (59, 214, 958, 5000),
    "R8": (2000, 8000, 36000, 177000),
    "R0": (4000, 9000, 20000, 48000),
}


# ══════════════════════════════════════════════════════════════════════
# Ent Buff Builds
# ══════════════════════════════════════════════════════════════════════


class EntBuffBuild(Base):
    __tablename__ = "ent_buff_builds"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    serialized = Column(String(500), nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="ent_buff_builds")

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_ent_buff_user_name"),)


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
    completed_collections = relationship(
        "CharacterCollection", back_populates="character", cascade="all, delete-orphan"
    )


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
    _run_migrations()


def _run_migrations():
    """Add columns that may be missing in existing databases."""
    db = SessionLocal()
    try:
        inspector = inspect(engine)

        tables = set(inspector.get_table_names())
        if "users" not in tables:
            db.commit()
            return

        user_cols = {c["name"] for c in inspector.get_columns("users")}

        if "role" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(30) DEFAULT 'user'"))
            db.execute(text("UPDATE users SET role = 'admin' WHERE is_admin = true"))

        if "discord_id" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN discord_id VARCHAR(40)"))
        if "discord_username" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN discord_username VARCHAR(100)"))
        if "discord_avatar" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN discord_avatar VARCHAR(255)"))
        if "auth_provider" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(30) DEFAULT 'local'"))
        if "password_reset_token_hash" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR(64)"))
        if "password_reset_expires_at" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP"))
        if "password_reset_sent_at" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN password_reset_sent_at TIMESTAMP"))

        db.execute(text("UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL OR auth_provider = ''"))
        db.execute(text("UPDATE users SET display_name = '' WHERE display_name IS NULL"))

        if "loadouts" in tables:
            loadout_cols = {c["name"] for c in inspector.get_columns("loadouts")}

            if "is_featured" not in loadout_cols:
                db.execute(text("ALTER TABLE loadouts ADD COLUMN is_featured BOOLEAN DEFAULT false"))
            if "is_starter" not in loadout_cols:
                db.execute(text("ALTER TABLE loadouts ADD COLUMN is_starter BOOLEAN DEFAULT false"))
            if "starter_description" not in loadout_cols:
                db.execute(text("ALTER TABLE loadouts ADD COLUMN starter_description TEXT DEFAULT ''"))
            if "starter_tags" not in loadout_cols:
                db.execute(text("ALTER TABLE loadouts ADD COLUMN starter_tags VARCHAR(255) DEFAULT ''"))

            db.execute(text("UPDATE loadouts SET is_featured = false WHERE is_featured IS NULL"))
            db.execute(text("UPDATE loadouts SET is_starter = false WHERE is_starter IS NULL"))
            db.execute(text("UPDATE loadouts SET starter_description = '' WHERE starter_description IS NULL"))
            db.execute(text("UPDATE loadouts SET starter_tags = '' WHERE starter_tags IS NULL"))

        if "mods" in tables:
            mod_cols = {c["name"] for c in inspector.get_columns("mods")}

            if "author_name" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN author_name VARCHAR(120) DEFAULT ''"))
            if "summary" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN summary VARCHAR(280) DEFAULT ''"))
            if "description" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN description TEXT DEFAULT ''"))
            if "category" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN category VARCHAR(80) DEFAULT 'general'"))
            if "tags" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN tags VARCHAR(255) DEFAULT ''"))
            if "version" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN version VARCHAR(40) DEFAULT '1.0'"))
            if "compatibility" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN compatibility VARCHAR(120) DEFAULT 'SWG Legends'"))
            if "install_instructions" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN install_instructions TEXT DEFAULT ''"))
            if "is_published" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN is_published BOOLEAN DEFAULT false"))
            if "is_featured" not in mod_cols:
                db.execute(text("ALTER TABLE mods ADD COLUMN is_featured BOOLEAN DEFAULT false"))

            db.execute(text("UPDATE mods SET author_name = '' WHERE author_name IS NULL"))
            db.execute(text("UPDATE mods SET summary = '' WHERE summary IS NULL"))
            db.execute(text("UPDATE mods SET description = '' WHERE description IS NULL"))
            db.execute(text("UPDATE mods SET category = 'general' WHERE category IS NULL"))
            db.execute(text("UPDATE mods SET tags = '' WHERE tags IS NULL"))
            db.execute(text("UPDATE mods SET version = '1.0' WHERE version IS NULL"))
            db.execute(text("UPDATE mods SET compatibility = 'SWG Legends' WHERE compatibility IS NULL"))
            db.execute(text("UPDATE mods SET install_instructions = '' WHERE install_instructions IS NULL"))
            db.execute(text("UPDATE mods SET is_published = false WHERE is_published IS NULL"))
            db.execute(text("UPDATE mods SET is_featured = false WHERE is_featured IS NULL"))

        if "site_config" not in tables:
            db.execute(
                text("""
                CREATE TABLE site_config (
                    key VARCHAR(100) PRIMARY KEY,
                    value TEXT NOT NULL DEFAULT '',
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """)
            )

        seed_count = db.execute(text("SELECT COUNT(*) FROM tier_thresholds")).scalar() or 0
        if seed_count == 0:
            for code, (d, c, b, a) in _TIER_SEED.items():
                db.execute(
                    text(
                        "INSERT INTO tier_thresholds (comp_code, d_threshold, c_threshold, b_threshold, a_threshold)"
                        " VALUES (:code, :d, :c, :b, :a)"
                        " ON CONFLICT (comp_code) DO NOTHING"
                    ),
                    {"code": code, "d": d, "c": c, "b": b, "a": a},
                )

        if "ent_buff_builds" not in tables:
            db.execute(
                text("""
                CREATE TABLE ent_buff_builds (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    serialized VARCHAR(500) NOT NULL DEFAULT '',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT uq_ent_buff_user_name UNIQUE (user_id, name)
                )
            """)
            )

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
