"""baseline_engine_tables

Revision ID: 1a2b3c4d5e6f
Revises: 
Create Date: 2026-05-17 05:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use inspector to safely check if the tables already exist (baseline check)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # We assume 'subjects' and 'materials' tables are already managed by core Node.js migrations.
    # We only manage the engine-owned tables 'documents' and 'chunks'.
    
    if "documents" not in tables:
        op.create_table(
            'documents',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('subject_id', sa.UUID(), nullable=False),
            sa.Column('material_id', sa.UUID(), nullable=True),
            sa.Column('filename', sa.String(), nullable=False),
            sa.Column('file_path', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_documents_material_id'), 'documents', ['material_id'], unique=False)
        op.create_index(op.f('ix_documents_subject_id'), 'documents', ['subject_id'], unique=False)

    if "chunks" not in tables:
        op.create_table(
            'chunks',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('document_id', sa.Integer(), nullable=False),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('embedding', Vector(768), nullable=True),
            sa.Column('chunk_index', sa.Integer(), nullable=True),
            sa.Column('page_number', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_chunks_document_id'), 'chunks', ['document_id'], unique=False)
        
        # Create HNSW index using raw SQL to ensure exact pgvector options match
        op.execute("""
            CREATE INDEX IF NOT EXISTS ix_chunks_embedding_hnsw 
            ON chunks USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
        """)


def downgrade() -> None:
    # Use inspector to safely check if the tables exist before dropping
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "chunks" in tables:
        op.drop_index(op.f('ix_chunks_document_id'), table_name='chunks')
        op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw;")
        op.drop_table('chunks')
        
    if "documents" in tables:
        op.drop_index(op.f('ix_documents_subject_id'), table_name='documents')
        op.drop_index(op.f('ix_documents_material_id'), table_name='documents')
        op.drop_table('documents')
