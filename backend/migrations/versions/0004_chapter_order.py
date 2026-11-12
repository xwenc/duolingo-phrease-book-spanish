"""Persist chapter order while preserving the previous order in each book."""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('chapters', sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False))
    chapters = sa.table('chapters', sa.column('id', sa.String), sa.column('book_id', sa.String), sa.column('sort_order', sa.Integer))
    bind = op.get_bind()
    counts = {}
    for id, book_id in bind.execute(sa.select(chapters.c.id, chapters.c.book_id).order_by(chapters.c.book_id, chapters.c.id)).all():
        position = counts.get(book_id, 0)
        bind.execute(chapters.update().where(chapters.c.id == id).values(sort_order=position))
        counts[book_id] = position + 1
    op.create_index('ix_chapters_book_order', 'chapters', ['book_id', 'sort_order'])


def downgrade():
    op.drop_index('ix_chapters_book_order', table_name='chapters')
    op.drop_column('chapters', 'sort_order')
