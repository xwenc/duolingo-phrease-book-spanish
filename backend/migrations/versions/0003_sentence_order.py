"""Persist sentence ordering, preserving the existing order within each chapter."""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('exercises', sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False))
    exercises = sa.table('exercises', sa.column('id', sa.String), sa.column('chapter_id', sa.String), sa.column('sort_order', sa.Integer))
    bind = op.get_bind()
    counts = {}
    for id, chapter_id in bind.execute(sa.select(exercises.c.id, exercises.c.chapter_id).order_by(exercises.c.chapter_id, exercises.c.id)).all():
        position = counts.get(chapter_id, 0)
        bind.execute(exercises.update().where(exercises.c.id == id).values(sort_order=position))
        counts[chapter_id] = position + 1
    op.create_index('ix_exercises_chapter_order', 'exercises', ['chapter_id', 'sort_order'])


def downgrade():
    op.drop_index('ix_exercises_chapter_order', table_name='exercises')
    op.drop_column('exercises', 'sort_order')
