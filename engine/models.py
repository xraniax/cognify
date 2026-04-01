from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

try:
    from database import Base
except ImportError:
    from .database import Base


class Document(Base):
    """Physical file metadata for the processor; links to app `subjects` (UUID)."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chunks = relationship("Chunk", back_populates="document")

class Chunk(Base):
    """Chunk text + pgvector embedding (768 dims for nomic-embed-text)."""
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=True)
    chunk_index = Column(Integer, nullable=True)
    page_number = Column(Integer, nullable=True)
    chunk_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="chunks")

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(UUID(as_uuid=True), primary_key=True)
    is_ready = Column(Boolean, default=False, server_default='false') # Flag for generation
    last_processed_at = Column(DateTime(timezone=True), nullable=True)
