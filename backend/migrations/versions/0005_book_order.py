"""Keep newly created/imported books at the bottom of the library."""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('books', sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False))
    books = sa.table('books', sa.column('id', sa.String), sa.column('sort_order', sa.Integer))
    bind = op.get_bind()
    for position, id in enumerate(bind.execute(sa.select(books.c.id).order_by(books.c.id)).scalars().all()):
        bind.execute(books.update().where(books.c.id == id).values(sort_order=position))
    op.create_index('ix_books_order', 'books', ['sort_order'])


def downgrade():
    op.drop_index('ix_books_order', table_name='books')
    op.drop_column('books', 'sort_order')
