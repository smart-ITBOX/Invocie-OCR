# Here are your Instructions

Step 1: Go to backend folder
cd backend

Step 2: Create virtual environment (do this once)
python3 -m venv venv

Step 3: Activate virtual environment

source venv/bin/activate

If activated correctly, you’ll see (venv) in terminal.

Step 4: Install dependencies
pip install -r requirements.txt

Step 5: Run backend server

uvicorn server:app --reload
