import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app import create_app
from test_configuration import config_for


class NearbyProfileTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(config_for())
        from app.services.marketplace import nearby_distance
        self.nearby_distance = nearby_distance
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        with self.client.session_transaction() as session:
            session['csrf_token'] = 'test-csrf'
        self.headers = {'X-CSRF-Token': 'test-csrf'}
        self.location = SimpleNamespace(city='Islamabad', area='G-10')

    def test_distance_rejects_distant_neighbourhoods_and_other_cities(self):
        self.assertEqual(self.nearby_distance(self.location, self.location), 0)
        self.assertIsNotNone(self.nearby_distance(self.location, SimpleNamespace(city='Islamabad', area='G-9')))
        self.assertIsNone(self.nearby_distance(self.location, SimpleNamespace(city='Islamabad', area='I-8')))
        self.assertIsNone(self.nearby_distance(self.location, SimpleNamespace(city='Rawalpindi', area='Saddar')))

    def test_guests_cannot_read_worker_catalog_or_edit_profiles(self):
        self.assertEqual(self.client.get('/api/workers').status_code, 401)
        self.assertEqual(self.client.get('/api/account/profile').status_code, 401)
        self.assertEqual(self.client.patch('/api/profile', json={}, headers=self.headers).status_code, 401)

    def test_customer_catalog_ignores_forged_location_and_filters_by_saved_area(self):
        near = SimpleNamespace(id=1, city='Islamabad', area='G-10')
        far = SimpleNamespace(id=2, city='Islamabad', area='I-8')
        other = SimpleNamespace(id=3, city='Rawalpindi', area='Saddar')
        with patch('app.main.routes.current_account') as account, \
             patch('app.main.routes.customer_location', return_value=self.location), \
             patch('app.main.routes.db.session.execute', return_value=[(near, 'sms'), (far, 'sms'), (other, 'sms')]), \
             patch('app.main.routes.rating_summary', return_value={}), \
             patch('app.main.routes.worker_data', side_effect=lambda p, r, d, v: {'id': p.id, 'available': True, 'distance_km': d}):
            response = self.client.get('/api/workers?city=Rawalpindi&area=Saddar&radius=9999')
        account.assert_called_once_with('customer')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['id'] for row in response.json['workers']], [1])
        self.assertEqual(response.json['radius_km'], 5)

    def test_direct_request_cannot_bypass_distance_restriction(self):
        worker = SimpleNamespace(city='Rawalpindi', area='Saddar', seed_key=None, moderation='approved')
        with patch('app.main.jobs.current_account'), \
             patch('app.main.jobs.db.session.get', return_value=worker), \
             patch('app.main.jobs.customer_location', return_value=self.location), \
             patch('app.main.jobs.db.session.add') as add:
            response = self.client.post('/api/jobs', json={'worker_id': 1, 'text': 'Repair'}, headers=self.headers)
        self.assertEqual(response.status_code, 403)
        add.assert_not_called()

    def test_worker_edit_changes_only_public_profile_fields(self):
        profile = SimpleNamespace(user_id=7, active_booking_id=99, taking_work=False, name='Original Worker',
                                  city='Islamabad', area='G-10', service_id='electrician', experience_years=10,
                                  moderation='approved')
        values = {'name': 'Updated Worker', 'city': 'Islamabad', 'area': 'G-9', 'service_id': 'electrician', 'experience_years': 10,
                  'user_id': 123, 'active_booking_id': None, 'taking_work': True}
        with patch('app.main.routes.current_account'), patch('app.main.routes.profile_for', return_value=profile), \
             patch('app.main.routes.db.session.commit'), patch('app.main.auth.session_data', return_value={'saved': True}):
            response = self.client.patch('/api/profile', json=values, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(profile.name, 'Updated Worker')
        self.assertEqual(profile.moderation, 'pending')
        self.assertEqual((profile.user_id, profile.active_booking_id, profile.taking_work), (7, 99, False))

    def test_invalid_customer_location_is_not_saved(self):
        with patch('app.main.routes.current_account'), patch('app.main.routes.db.session.commit') as commit:
            response = self.client.patch('/api/account/profile', json={'name': 'Customer', 'city': 'Islamabad', 'area': 'Saddar'}, headers=self.headers)
        self.assertEqual(response.status_code, 400)
        commit.assert_not_called()
