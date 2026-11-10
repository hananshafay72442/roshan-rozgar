import click
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .extensions import db
from .services.ai import AIServiceError, generate_text
from .services.verification import check_sms_service


def register_commands(app):
    @app.cli.command("init-marketplace")
    def init_marketplace():
        """Create the marketplace schema and optionally install demo records."""
        from .services.marketplace import seed_catalog

        try:
            db.create_all()
            if app.config["SEED_SAMPLE_DATA"]:
                seed_catalog()
        except SQLAlchemyError:
            db.session.rollback()
            raise click.ClickException("Database initialization failed. Check the database credentials and permissions.") from None
        click.echo("Marketplace database is ready.")

    @app.cli.command("check-db")
    def check_db():
        """Verify the configured database with a read-only SELECT 1."""
        if app.config.get("DB_HOST", "").endswith(".tidbcloud.com") and not app.config.get("DB_PASSWORD"):
            raise click.ClickException("DB_PASSWORD is empty. Set the TiDB password in backend/.env first.")
        try:
            with db.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError:
            raise click.ClickException(
                "Database connection failed. Check DB_HOST, DB_PORT, DB_NAME, "
                "DB_USER, DB_PASSWORD, and the TLS certificate."
            ) from None
        click.echo("Database connection succeeded.")

    @app.cli.command("check-ai")
    def check_ai():
        """Send one minimal test request to the configured Gemini model."""
        try:
            generate_text("Reply with the single word OK.")
        except AIServiceError as error:
            raise click.ClickException(str(error)) from None
        click.echo(f"Gemini connection succeeded ({app.config['GEMINI_MODEL']}).")

    @app.cli.command("check-sms")
    def check_sms():
        """Check Twilio Verify service access without sending an SMS."""
        try:
            check_sms_service()
        except RuntimeError as error:
            raise click.ClickException(str(error)) from None
        click.echo("Twilio Verify service is reachable and uses six-digit codes.")
