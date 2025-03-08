from django.contrib import admin
from django.urls import path
from experiments.views import HomeView, ExperimentListView, run_cursor_experiment

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', HomeView.as_view(), name='home'),
    path('experiments/', ExperimentListView.as_view(), name='experiment_list'),
    path('experiments/run/', run_cursor_experiment, name='run_experiment'),
] 