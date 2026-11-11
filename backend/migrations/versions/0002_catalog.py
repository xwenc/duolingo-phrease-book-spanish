"""Persist books and chapters, and attach the existing question bank."""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('books', sa.Column('id', sa.String(64), primary_key=True), sa.Column('name', sa.String(200), nullable=False), sa.Column('description', sa.Text(), nullable=False), sa.Column('thumbnail', sa.String(2048), nullable=False))
    op.create_table('chapters', sa.Column('id', sa.String(64), primary_key=True), sa.Column('book_id', sa.String(64), sa.ForeignKey('books.id'), nullable=False), sa.Column('name', sa.String(200), nullable=False), sa.Column('description', sa.Text(), nullable=False), sa.Column('icon', sa.String(32), nullable=False))
    op.create_index('ix_chapters_book_id', 'chapters', ['book_id'])
    with op.batch_alter_table('exercises') as batch:
        batch.add_column(sa.Column('chapter_id', sa.String(64), nullable=True))
        batch.create_foreign_key('fk_exercises_chapter_id', 'chapters', ['chapter_id'], ['id'])
        batch.create_index('ix_exercises_chapter_id', ['chapter_id'])
    bind = op.get_bind()
    books = sa.table('books', sa.column('id', sa.String), sa.column('name', sa.String), sa.column('description', sa.Text), sa.column('thumbnail', sa.String))
    chapters = sa.table('chapters', sa.column('id', sa.String), sa.column('book_id', sa.String), sa.column('name', sa.String), sa.column('description', sa.Text), sa.column('icon', sa.String))
    exercises = sa.table('exercises', sa.column('id', sa.String), sa.column('data', sa.JSON), sa.column('chapter_id', sa.String))
    seen_books, seen_chapters = set(), set()
    for row in bind.execute(sa.select(exercises.c.id, exercises.c.data)).all():
        data = row.data
        imported = row.id.startswith('book-')
        book_id = data.get('bookId') or ('textbook' if imported else 'everyday')
        if book_id not in seen_books:
            bind.execute(books.insert().values(id=book_id, name=data.get('bookTitle') or ('西班牙语教材 · 基础用语' if imported else '西班牙语 · 日常口语'), description='', thumbnail=''))
            seen_books.add(book_id)
        chapter_id = data['unitId']
        if chapter_id not in seen_chapters:
            bind.execute(chapters.insert().values(id=chapter_id, book_id=book_id, name=data['unitName'], description='', icon='📖'))
            seen_chapters.add(chapter_id)
        bind.execute(exercises.update().where(exercises.c.id == row.id).values(chapter_id=chapter_id))


def downgrade():
    with op.batch_alter_table('exercises') as batch:
        batch.drop_index('ix_exercises_chapter_id')
        batch.drop_constraint('fk_exercises_chapter_id', type_='foreignkey')
        batch.drop_column('chapter_id')
    op.drop_index('ix_chapters_book_id', table_name='chapters')
    op.drop_table('chapters')
    op.drop_table('books')
