from django.db import models

class ExperimentResult(models.Model):
    experiment_name = models.CharField(max_length=100)
    cursor_type = models.CharField(max_length=50)
    query_pattern = models.CharField(max_length=100)
    document_count = models.IntegerField()
    execution_time = models.FloatField()
    memory_usage = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.experiment_name} - {self.cursor_type}" 