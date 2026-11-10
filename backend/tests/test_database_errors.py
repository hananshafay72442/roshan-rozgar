import unittest
from unittest.mock import patch

from sqlalchemy.exc import OperationalError

from app import create_app
from test_configuration import config_for


class DatabaseErrorTests(unittest.TestCase):
    def test_connection_failure_is_retryable_without_replaying_or_exposing_query(self):
        app = create_app(config_for())
        attempts = []

        @app.post('/test-database-interruption')
        def fail():
            attempts.append(1)
            raise OperationalError('private query', {'password': 'private'}, Exception('private connection'))

        with patch('app.db.session.rollback') as rollback:
            response = app.test_client().post('/test-database-interruption')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers['Retry-After'], '3')
        self.assertNotIn('private', response.get_data(as_text=True))
        self.assertEqual(attempts, [1])
        rollback.assert_called_once()
