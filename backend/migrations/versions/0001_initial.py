"""Initial account, exercise, session, favorite and attempt schema."""
from alembic import op
import sqlalchemy as sa
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('users', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('email', sa.String(254), nullable=False, unique=True), sa.Column('password', sa.String(255), nullable=False), sa.Column('hearts', sa.Integer(), nullable=False), sa.Column('xp', sa.Integer(), nullable=False), sa.Column('gems', sa.Integer(), nullable=False), sa.Column('streak', sa.Integer(), nullable=False), sa.Column('last_practice', sa.String(10)))
    op.create_table('exercises', sa.Column('id', sa.String(64), primary_key=True), sa.Column('data', sa.JSON(), nullable=False))
    op.create_table('sessions', sa.Column('token_hash', sa.String(64), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False), sa.Column('expires', sa.DateTime(), nullable=False))
    op.create_table('stars', sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True), sa.Column('exercise_id', sa.String(64), sa.ForeignKey('exercises.id'), primary_key=True))
    op.create_table('attempts', sa.Column('id', sa.Integer(), primary_key=True), sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False), sa.Column('exercise_id', sa.String(64), sa.ForeignKey('exercises.id'), nullable=False), sa.Column('request_id', sa.String(36), nullable=False), sa.Column('result', sa.JSON(), nullable=False), sa.Column('created_at', sa.DateTime(), nullable=False), sa.UniqueConstraint('user_id', 'request_id'))
    op.create_index('ix_attempts_user_exercise', 'attempts', ['user_id', 'exercise_id'])
    op.create_index('ix_sessions_expires', 'sessions', ['expires'])

def downgrade():
    for name in ('attempts', 'stars', 'sessions', 'exercises', 'users'):
        op.drop_table(name)
