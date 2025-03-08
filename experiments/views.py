from django.shortcuts import render
from django.http import JsonResponse
from django.views.generic import TemplateView, ListView
from pymongo import MongoClient
import time
import os
from .models import ExperimentResult
from dotenv import load_dotenv

load_dotenv()

class HomeView(TemplateView):
    template_name = 'experiments/home.html'

class ExperimentListView(ListView):
    model = ExperimentResult
    template_name = 'experiments/experiment_list.html'
    context_object_name = 'experiments'
    ordering = ['-timestamp']

def run_cursor_experiment(request):
    client = MongoClient(os.getenv('MONGODB_URI'))
    db = client['cursor_analysis']
    collection = db['test_data']
    
    cursor_type = request.GET.get('cursor_type', 'default')
    doc_count = int(request.GET.get('doc_count', 1000))
    
    # Generate test data if needed
    if collection.count_documents({}) < doc_count:
        test_data = [{'index': i, 'data': f'test_data_{i}'} for i in range(doc_count)]
        collection.insert_many(test_data)
    
    start_time = time.time()
    
    # Different cursor patterns
    if cursor_type == 'no_cursor':
        results = list(collection.find().limit(doc_count))
    elif cursor_type == 'batch_size':
        cursor = collection.find().batch_size(100)
        results = list(cursor)
    elif cursor_type == 'limit':
        cursor = collection.find().limit(doc_count)
        results = list(cursor)
    elif cursor_type == 'skip':
        cursor = collection.find().skip(10).limit(doc_count)
        results = list(cursor)
    
    execution_time = time.time() - start_time
    
    # Save experiment result
    ExperimentResult.objects.create(
        experiment_name=f'Cursor Test - {doc_count} documents',
        cursor_type=cursor_type,
        query_pattern='find()',
        document_count=doc_count,
        execution_time=execution_time,
        memory_usage=0.0  # In a real app, you'd measure actual memory usage
    )
    
    return JsonResponse({
        'success': True,
        'execution_time': execution_time,
        'cursor_type': cursor_type,
        'doc_count': doc_count
    }) 