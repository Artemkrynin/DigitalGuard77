# DigitalGuard

Полноценный учебный веб-проект по цифровой безопасности.

## Стек
Frontend: React + JavaScript + Vite + Recharts
Backend: Python + FastAPI
Database: SQLite
Авторизация: JWT

## Запуск

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
В другом терминале:
```bash
cd frontend
npm install
npm run dev
```

Открой адрес, который покажет Vite, обычно http://localhost:5173.

Проект учебный. Не вводи реальные пароли и персональные данные.
