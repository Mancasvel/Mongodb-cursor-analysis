from django.test import TestCase, Client
from django.urls import reverse
from .models import ExperimentResult

class ExperimentTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.home_url = reverse('home')
        self.experiment_list_url = reverse('experiment_list')
        self.run_experiment_url = reverse('run_experiment')
        
    def test_home_page_loads(self):
        response = self.client.get(self.home_url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'experiments/home.html')
        
    def test_experiment_list_page_loads(self):
        response = self.client.get(self.experiment_list_url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'experiments/experiment_list.html')
        
    def test_experiment_result_model(self):
        experiment = ExperimentResult.objects.create(
            experiment_name='Test Experiment',
            cursor_type='no_cursor',
            query_pattern='find()',
            document_count=100,
            execution_time=1.5,
            memory_usage=0.0
        )
        self.assertEqual(str(experiment), 'Test Experiment - no_cursor')
        self.assertEqual(experiment.document_count, 100)
        self.assertEqual(experiment.cursor_type, 'no_cursor') 