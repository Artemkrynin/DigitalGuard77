import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

DB = Path(os.getenv("DIGITALGUARD_DB", str(Path(__file__).parent / "digitalguard.db")))
SECRET = os.getenv("DIGITALGUARD_SECRET", "digitalguard-demo-change-me")
app = FastAPI(title="DigitalGuard API")
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

QUESTIONS = [
    {"id": 1, "category": "passwords", "question": "Используешь ли ты один пароль на нескольких сайтах?", "answers": ["Да, почти везде", "Иногда", "Нет, у меня разные пароли"]},
    {"id": 2, "category": "social", "question": "Открыт ли твой профиль в социальных сетях?", "answers": ["Да, полностью открыт", "Частично", "Нет, профиль закрыт"]},
    {"id": 3, "category": "location", "question": "Публикуешь ли ты фотографии с геолокацией?", "answers": ["Часто", "Иногда", "Никогда"]},
    {"id": 4, "category": "social", "question": "Принимаешь ли ты заявки от незнакомых людей?", "answers": ["Да", "Иногда", "Нет"]},
    {"id": 5, "category": "passwords", "question": "Используешь ли ты двухфакторную аутентификацию?", "answers": ["Нет", "Только на некоторых аккаунтах", "Да, практически везде"]},
    {"id": 6, "category": "social", "question": "Открываешь ли ты ссылки от незнакомых людей?", "answers": ["Да", "Иногда", "Нет"]},
    {"id": 7, "category": "personal", "question": "Указываешь ли ты номер телефона в открытом профиле?", "answers": ["Да", "Иногда", "Нет"]},
    {"id": 8, "category": "personal", "question": "Проверяешь ли ты настройки приватности?", "answers": ["Никогда", "Иногда", "Регулярно"]},
]

class Auth(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=6, max_length=100)

class TestData(BaseModel):
    answers: list[int] = Field(min_length=8, max_length=8)

def connect():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def init():
    c = connect()
    c.execute("""CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS results(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        score INTEGER NOT NULL,
        passwords INTEGER NOT NULL,
        social INTEGER NOT NULL,
        location INTEGER NOT NULL,
        personal INTEGER NOT NULL,
        created_at TEXT NOT NULL
    )""")
    c.commit()
    c.close()

init()

def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt.encode(), n=2**14, r=8, p=1).hex()

def token(user_id, username):
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12)
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")

def user_from_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        p = jwt.decode(credentials.credentials, SECRET, algorithms=["HS256"])
        return {"id": int(p["sub"]), "username": p["username"]}
    except Exception:
        raise HTTPException(401, "Недействительная авторизация")

@app.get("/api/questions")
def questions():
    return QUESTIONS

@app.post("/api/register")
def register(data: Auth):
    c = connect()
    if c.execute("SELECT id FROM users WHERE username=?", (data.username,)).fetchone():
        c.close()
        raise HTTPException(409, "Такой пользователь уже существует")
    salt = secrets.token_hex(16)
    h = password_hash(data.password, salt)
    cur = c.execute(
        "INSERT INTO users(username,password_hash,salt,created_at) VALUES(?,?,?,?)",
        (data.username, h, salt, datetime.now(timezone.utc).isoformat())
    )
    c.commit()
    uid = cur.lastrowid
    c.close()
    return {"token": token(uid, data.username), "username": data.username}

@app.post("/api/login")
def login(data: Auth):
    c = connect()
    u = c.execute("SELECT * FROM users WHERE username=?", (data.username,)).fetchone()
    c.close()
    if not u or password_hash(data.password, u["salt"]) != u["password_hash"]:
        raise HTTPException(401, "Неверный логин или пароль")
    return {"token": token(u["id"], u["username"]), "username": u["username"]}

@app.get("/api/me")
def me(user=Depends(user_from_token)):
    return user

@app.post("/api/results")
def save_result(data: TestData, user=Depends(user_from_token)):
    if any(x not in [0,1,2] for x in data.answers):
        raise HTTPException(400, "Некорректные ответы")

    score = round(sum(data.answers) / 16 * 100)
    groups = {
        "passwords": [data.answers[0], data.answers[4]],
        "social": [data.answers[1], data.answers[3], data.answers[5]],
        "location": [data.answers[2]],
        "personal": [data.answers[6], data.answers[7]]
    }
    cat = {k: round(sum(v)/(len(v)*2)*100) for k,v in groups.items()}

    c = connect()
    c.execute(
        """INSERT INTO results(user_id,score,passwords,social,location,personal,created_at)
           VALUES(?,?,?,?,?,?,?)""",
        (user["id"], score, cat["passwords"], cat["social"], cat["location"],
         cat["personal"], datetime.now(timezone.utc).isoformat())
    )
    c.commit()
    c.close()
    return {"score": score, "categories": cat}

@app.get("/api/results")
def results(user=Depends(user_from_token)):
    c = connect()
    rows = c.execute(
        """SELECT id,score,passwords,social,location,personal,created_at
           FROM results WHERE user_id=? ORDER BY id DESC LIMIT 30""",
        (user["id"],)
    ).fetchall()
    c.close()
    return [dict(r) for r in rows]


# Serve the built React frontend when deployed as a single public web service.
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
