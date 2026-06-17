@echo off
set "ROOT=%~dp0"
set "PYTHON=%ROOT%venv\Scripts\python.exe"

if not exist "%PYTHON%" (
  echo Python virtual environment not found at "%PYTHON%"
  echo Please create or adjust the path to your venv.
  pause
  exit /b 1
)

start "Backend" cmd /k "cd /d "%ROOT%backend" && "%PYTHON%" -m uvicorn app:app --reload --host 127.0.0.1 --port 8000"
start "Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"
echo Started backend and frontend in separate windows.
pause
