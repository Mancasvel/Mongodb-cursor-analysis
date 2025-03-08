# MongoDB Cursor Analysis

This project is a web-based application for analyzing and comparing different MongoDB cursor operations and their performance implications. Built with Django and PyMongo, it provides interactive visualizations and comparisons of various query patterns and cursor behaviors.

## Features
- Different cursor operation analysis
- Performance metrics visualization
- Query pattern comparisons
- Interactive data generation
- Real-time performance monitoring

## Project Overview

The application allows you to:
- Run different cursor experiments
- Specify the number of documents to test with
- View execution times in real-time
- Compare performance between different cursor types
- Track historical results

### Cursor Types Available
1. No cursor (direct list)
2. Batch size cursor
3. Limit cursor
4. Skip + Limit cursor

## Project Structure
- `cursor_analysis/`: Main Django project directory
- `experiments/`: Django app for cursor experiments
- `templates/`: HTML templates
- `static/`: Static files (CSS, JS, etc.)

## Dependencies
- Django 5.0.2
- PyMongo 4.6.1
- Python-dotenv 1.0.1
- Django-crispy-forms 2.1
- Crispy-bootstrap4 2023.1
- Pandas 2.2.0
- Matplotlib 3.8.2

## Setup Instructions

1. Make sure MongoDB is running locally on your machine

2. Clone the repository:
```bash
git clone https://github.com/Mancasvel/Mongodb-cursor-analysis
cd mongodb-cursor-analysis
```

3. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create a `.env` file in the root directory with your MongoDB connection string and Django secret key:
```
MONGODB_URI=mongodb://localhost:27017/
DJANGO_SECRET_KEY=your-secret-key-here
```

6. Run migrations:
```bash
python manage.py makemigrations
python manage.py migrate
```

7. Start the development server:
```bash
python manage.py runserver
```

Visit http://localhost:8000 to access the application.

## Using the Application

1. Home Page:
   - Select a cursor type from the dropdown menu
   - Specify the number of documents to test with
   - Click "Run Experiment" to start the test
   - View real-time results in the chart

2. Results Page:
   - Access historical results of all experiments
   - View detailed metrics in the table
   - Compare performance across different cursor types
   - Analyze execution times through the bar chart visualization

## Features in Detail

### Cursor Types
- **No Cursor (Direct List)**: Directly converts the cursor to a list
- **Batch Size**: Uses cursor with specified batch size (100 documents)
- **Limit**: Applies a limit to the number of documents retrieved
- **Skip + Limit**: Demonstrates cursor behavior with skip and limit operations

### Performance Metrics
- Execution time
- Document count
- Query pattern
- Timestamp of experiment

### Visualizations
- Real-time bar charts for individual experiments
- Comparative bar charts for historical results
- Detailed tabular view of all experiments

## Security Notes
- Never commit your `.env` file with sensitive information
- Update the Django secret key in production
- Configure MongoDB security settings appropriately

## Troubleshooting

1. MongoDB Connection Issues:
   - Ensure MongoDB is running locally
   - Verify the connection string in `.env`
   - Check MongoDB port availability

2. Django Setup Issues:
   - Ensure all migrations are applied
   - Check for proper virtual environment activation
   - Verify all dependencies are installed

3. Data Generation:
   - The application automatically generates test data if needed
   - You can modify the document structure in `experiments/views.py`

## Contributing
Feel free to contribute to this project by:
- Submitting bug reports
- Proposing new features
- Creating pull requests
- Improving documentation

## License
This project is licensed under the terms specified in the LICENSE file.