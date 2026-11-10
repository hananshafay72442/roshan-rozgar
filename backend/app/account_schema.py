"""Upgrade the account table without replacing existing accounts."""

from sqlalchemy import inspect

from .extensions import db


def upgrade_account_email_schema():
    with db.engine.connect() as connection:
        inspector = inspect(connection)
        if not inspector.has_table("account"):
            return

        # MySQL DDL commits each step. Inspect the schema so an interrupted
        # upgrade can resume without replacing accounts or changing their IDs.
        columns = {column["name"]: column for column in inspector.get_columns("account")}
        if "email" not in columns:
            connection.exec_driver_sql("ALTER TABLE account ADD COLUMN email VARCHAR(254) NULL")
        indexes = inspector.get_indexes("account")
        if not any(index["unique"] and index["column_names"] == ["email"] for index in indexes):
            connection.exec_driver_sql("CREATE UNIQUE INDEX uq_account_email ON account (email)")
        if not columns["phone"]["nullable"]:
            connection.exec_driver_sql("ALTER TABLE account MODIFY COLUMN phone VARCHAR(16) NULL")
        if "password_hash" not in columns:
            connection.exec_driver_sql("ALTER TABLE account ADD COLUMN password_hash VARCHAR(255) NULL")
        connection.commit()
