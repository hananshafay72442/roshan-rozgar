import click
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.security import generate_password_hash

from .extensions import db
from .services.ai import AIServiceError, generate_text
from .services.verification import check_sms_service


def register_commands(app):
    @app.cli.command("init-marketplace")
    def init_marketplace():
        """Create or upgrade the marketplace schema and optionally install demo records."""
        from .account_schema import upgrade_account_email_schema
        from .services.marketplace import seed_catalog

        try:
            upgrade_account_email_schema()
            db.create_all()
            if app.config["SEED_SAMPLE_DATA"]:
                seed_catalog()
        except SQLAlchemyError:
            db.session.rollback()
            raise click.ClickException("Database initialization failed. Check the database credentials and permissions.") from None
        click.echo("Marketplace database is ready.")

    @app.cli.command("create-admin")
    @click.option("--email", prompt=True)
    @click.password_option()
    def create_admin(email, password):
        """Create a separate administrator account."""
        from .models import Account
        from .services.verification import normalize_email

        email = normalize_email(email)
        if not email or not 12 <= len(password) <= 128:
            raise click.ClickException("Use a valid email and a password between 12 and 128 characters.")
        db.session.add(Account(email=email, password_hash=generate_password_hash(password),
                               role="admin", verification="none"))
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise click.ClickException("An account with that email already exists.") from None
        click.echo("Administrator created. Sign in with the email and password.")

    @app.cli.command("check-db")
    def check_db():
        """Verify the configured database with a read-only SELECT 1."""
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
