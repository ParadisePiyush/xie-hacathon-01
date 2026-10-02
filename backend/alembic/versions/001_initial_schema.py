"""initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-02 10:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Depots
    op.create_table(
        'depots',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Zones
    op.create_table(
        'zones',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('color', sa.String(length=20), nullable=True),
        sa.Column('boundary_coordinates', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Teams
    op.create_table(
        'teams',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('depot_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['depot_id'], ['depots.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Users
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('team_id', sa.String(length=36), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Vehicles
    op.create_table(
        'vehicles',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('team_id', sa.String(length=36), nullable=True),
        sa.Column('plate', sa.String(length=50), nullable=False),
        sa.Column('capacity_units', sa.Integer(), nullable=False),
        sa.Column('shift_start', sa.String(length=10), nullable=False),
        sa.Column('shift_end', sa.String(length=10), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Pickup Requests
    op.create_table(
        'pickup_requests',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('reporter_id', sa.String(length=100), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('waste_type', sa.String(length=50), nullable=False),
        sa.Column('volume', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('photo_url', sa.String(length=1000), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('priority_score', sa.Float(), nullable=False),
        sa.Column('priority_band', sa.String(length=20), nullable=False),
        sa.Column('zone_id', sa.String(length=36), nullable=True),
        sa.Column('duplicate_of', sa.String(length=36), nullable=True),
        sa.Column('repeat_count', sa.Integer(), nullable=False),
        sa.Column('sla_due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['duplicate_of'], ['pickup_requests.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['zone_id'], ['zones.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_pickup_requests_created_at'), 'pickup_requests', ['created_at'], unique=False)
    op.create_index(op.f('ix_pickup_requests_latitude'), 'pickup_requests', ['latitude'], unique=False)
    op.create_index(op.f('ix_pickup_requests_longitude'), 'pickup_requests', ['longitude'], unique=False)
    op.create_index(op.f('ix_pickup_requests_priority_band'), 'pickup_requests', ['priority_band'], unique=False)
    op.create_index(op.f('ix_pickup_requests_priority_score'), 'pickup_requests', ['priority_score'], unique=False)
    op.create_index(op.f('ix_pickup_requests_sla_due_at'), 'pickup_requests', ['sla_due_at'], unique=False)
    op.create_index(op.f('ix_pickup_requests_status'), 'pickup_requests', ['status'], unique=False)
    op.create_index(op.f('ix_pickup_requests_waste_type'), 'pickup_requests', ['waste_type'], unique=False)

    # Request Status History
    op.create_table(
        'request_status_history',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('request_id', sa.String(length=36), nullable=False),
        sa.Column('from_status', sa.String(length=50), nullable=True),
        sa.Column('to_status', sa.String(length=50), nullable=False),
        sa.Column('actor_id', sa.String(length=100), nullable=True),
        sa.Column('note', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['request_id'], ['pickup_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_request_status_history_request_id'), 'request_status_history', ['request_id'], unique=False)

    # Plans
    op.create_table(
        'plans',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('plan_date', sa.Date(), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('total_distance_m', sa.Float(), nullable=False),
        sa.Column('total_duration_s', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_plans_plan_date'), 'plans', ['plan_date'], unique=False)

    # Routes
    op.create_table(
        'routes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('plan_id', sa.String(length=36), nullable=False),
        sa.Column('vehicle_id', sa.String(length=36), nullable=False),
        sa.Column('distance_m', sa.Float(), nullable=False),
        sa.Column('duration_s', sa.Float(), nullable=False),
        sa.Column('polyline', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Route Stops
    op.create_table(
        'route_stops',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('route_id', sa.String(length=36), nullable=False),
        sa.Column('request_id', sa.String(length=36), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('eta', sa.DateTime(timezone=True), nullable=True),
        sa.Column('outcome', sa.String(length=50), nullable=True),
        sa.Column('outcome_reason', sa.String(length=500), nullable=True),
        sa.Column('proof_photo_url', sa.String(length=1000), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['request_id'], ['pickup_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['route_id'], ['routes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Config
    op.create_table(
        'config',
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )

    # Audit Log
    op.create_table(
        'audit_log',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=100), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('entity', sa.String(length=100), nullable=False),
        sa.Column('entity_id', sa.String(length=100), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_audit_log_created_at'), 'audit_log', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('audit_log')
    op.drop_table('config')
    op.drop_table('route_stops')
    op.drop_table('routes')
    op.drop_table('plans')
    op.drop_table('request_status_history')
    op.drop_table('pickup_requests')
    op.drop_table('vehicles')
    op.drop_table('users')
    op.drop_table('teams')
    op.drop_table('zones')
    op.drop_table('depots')
