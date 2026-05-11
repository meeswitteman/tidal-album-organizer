from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Table, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

album_tags = Table(
    "album_tags",
    Base.metadata,
    Column("album_id", String, ForeignKey("albums.id")),
    Column("tag_id", Integer, ForeignKey("tags.id")),
)


class Album(Base):
    __tablename__ = "albums"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    artist = Column(String)
    year = Column(Integer)
    cover_url = Column(String)
    num_tracks = Column(Integer)
    duration = Column(Integer)
    tidal_url = Column(String)
    genres = Column(JSON, nullable=True)
    audio_modes = Column(JSON, nullable=True)
    mbid = Column(String, nullable=True)
    review_links = Column(JSON, nullable=True)
    notes = Column(Text, default="")
    added_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime)

    tags = relationship("Tag", secondary=album_tags, back_populates="albums")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    color = Column(String, default="#6ee7b7")

    albums = relationship("Album", secondary=album_tags, back_populates="tags")


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    track_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    tidal_url = Column(String)


class AlbumList(Base):
    __tablename__ = "album_lists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship(
        "AlbumListItem",
        back_populates="album_list",
        order_by="AlbumListItem.position",
        cascade="all, delete-orphan",
    )


class AlbumListItem(Base):
    __tablename__ = "album_list_items"
    __table_args__ = (UniqueConstraint("album_list_id", "album_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    album_list_id = Column(Integer, ForeignKey("album_lists.id", ondelete="CASCADE"), nullable=False)
    album_id = Column(String, ForeignKey("albums.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, default=0)
    added_at = Column(DateTime, default=datetime.utcnow)

    album_list = relationship("AlbumList", back_populates="items")
    album = relationship("Album")
