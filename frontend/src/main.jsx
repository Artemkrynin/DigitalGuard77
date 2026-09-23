import React, {useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid} from "recharts";
import "./styles.css";

const API=(import.meta.env.VITE_API_URL || "/api").replace(/\/$/,"");
const getToken=()=>localStorage.getItem("dg_token");

async function api(path, options={}) {
  const headers={"Content-Type":"application/json",...(options.headers||{})};
  if(getToken()) headers.Authorization=`Bearer ${getToken()}`;
  const r=await fetch(API+path,{...options,headers});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.detail||"Ошибка запроса");
  return d;
}

function Auth({onLogin}) {
  const [mode,setMode]=useState("login"),[u,setU]=useState(""),[p,setP]=useState(""),[err,setErr]=useState("");
  async function submit(e){
    e.preventDefault();setErr("");
    try{
      const d=await api(mode==="login"?"/login":"/register",{method:"POST",body:JSON.stringify({username:u,password:p})});
      localStorage.setItem("dg_token",d.token);localStorage.setItem("dg_user",d.username);onLogin(d.username);
    }catch(e){setErr(e.message)}
  }
  return <div className="auth"><div className="auth-card">
    <div className="logo-big">🛡️</div><small>DIGITALGUARD</small>
    <h1>{mode==="login"?"С возвращением":"Создать аккаунт"}</h1>
    <p>Учебная система цифровой безопасности.</p>
    <form onSubmit={submit}>
      <label>Логин</label><input value={u} onChange={e=>setU(e.target.value)} minLength="3" required/>
      <label>Пароль</label><input type="password" value={p} onChange={e=>setP(e.target.value)} minLength="6" required/>
      {err&&<div className="error">{err}</div>}
      <button className="primary">{mode==="login"?"Войти":"Зарегистрироваться"}</button>
    </form>
    <button className="switch" onClick={()=>setMode(mode==="login"?"register":"login")}>
      {mode==="login"?"Нет аккаунта? Создать":"Уже есть аккаунт? Войти"}
    </button>
  </div></div>
}

function App(){
  const [user,setUser]=useState(localStorage.getItem("dg_user"));
  const [page,setPage]=useState("home"),[questions,setQuestions]=useState([]),[results,setResults]=useState([]);
  useEffect(()=>{api("/questions").then(setQuestions).catch(()=>{})},[]);
  async function load(){if(getToken()) setResults(await api("/results").catch(()=>[]))}
  useEffect(()=>{load()},[user]);
  if(!user)return <Auth onLogin={setUser}/>;
  function logout(){localStorage.clear();setUser(null)}
  return <div className="app">
    <aside>
      <div className="brand"><b>🛡️ DigitalGuard</b><small>digital security</small></div>
      {[
        ["home","⌂","Главная"],["test","◈","Тест"],["profile","◎","Профиль"],
        ["analytics","▥","Аналитика"],["about","ⓘ","О проекте"]
      ].map(x=><button className={page===x[0]?"active":""} onClick={()=>setPage(x[0])} key={x[0]}><span>{x[1]}</span>{x[2]}</button>)}
      <button className="logout" onClick={logout}>↪ Выйти</button>
    </aside>
    <main>
      <header><div><small>DIGITAL SECURITY / DASHBOARD</small><h1>{page==="home"?"Панель безопасности":page==="test"?"Тест безопасности":page==="analytics"?"Аналитика":"DigitalGuard"}</h1></div><div className="user">👤 {user}</div></header>
      {page==="home"&&<Home latest={results[0]} start={()=>setPage("test")}/>}
      {page==="test"&&<Test questions={questions} done={async a=>{await api("/results",{method:"POST",body:JSON.stringify({answers:a})});await load();setPage("analytics")}}/>}
      {page==="analytics"&&<Analytics results={results}/>}
      {page==="profile"&&<Profile user={user} latest={results[0]}/>}
      {page==="about"&&<About/>}
    </main>
  </div>
}

function Home({latest,start}){
  const score=latest?.score??42;
  return <div className="stack">
    <section className="hero"><div><small>PERSONAL SECURITY CHECK</small><h2>Проверь, насколько<br/><em>ты в безопасности</em> в сети.</h2><p>Пройди тест и узнай, какие цифровые привычки требуют внимания.</p><button className="primary" onClick={start}>Начать тест →</button></div><div className="hero-art">◉</div></section>
    <div className="metrics"><div><small>Индекс безопасности</small><strong>{score}/100</strong><span>{score>=70?"Хороший уровень":score>=40?"Есть зоны риска":"Высокий риск"}</span></div><div><small>Пройдено тестов</small><strong>{latest?"1+":"0"}</strong><span>результаты сохраняются</span></div><div><small>Категории</small><strong>4</strong><span>пароли · соцсети · данные</span></div></div>
    <div className="cols"><section className="panel"><h3>Что анализирует DigitalGuard</h3><div className="features">{[["🔐","Пароли"],["👥","Соцсети"],["📍","Геолокация"],["📄","Личные данные"]].map(x=><div className="feature" key={x[1]}><b>{x[0]}</b><span>{x[1]}</span></div>)}</div></section><section className="panel"><h3>Главная идея</h3><p>Совокупность открытых данных может составить подробный цифровой профиль человека. Проект показывает это на безопасном учебном примере.</p></section></div>
  </div>
}

function Test({questions,done}){
  const [i,setI]=useState(0),[a,setA]=useState([]);
  if(!questions.length)return <section className="panel">Загрузка вопросов...</section>;
  const q=questions[i];
  function next(){if(a[i]===undefined)return alert("Выбери ответ");i===questions.length-1?done(a):setI(i+1)}
  return <section className="panel test"><small>ВОПРОС {i+1} / {questions.length}</small><div className="progress"><i style={{width:`${(i+1)/questions.length*100}%`}}/></div><h2>{q.question}</h2><div className="answers">{q.answers.map((x,n)=><button className={a[i]===n?"selected":""} onClick={()=>{let c=[...a];c[i]=n;setA(c)}} key={x}>{String.fromCharCode(65+n)} {x}</button>)}</div><div className="test-actions"><button className="secondary" disabled={!i} onClick={()=>setI(i-1)}>← Назад</button><button className="primary" onClick={next}>{i===questions.length-1?"Завершить":"Далее →"}</button></div></section>
}

function Analytics({results}){
  const data=[...results].reverse().map((x,i)=>({name:`Тест ${i+1}`,score:x.score}));
  const r=results[0];
  const cats=r?[["Пароли",r.passwords],["Соцсети",r.social],["Геолокация",r.location],["Личные данные",r.personal]]:[["Пароли",80],["Соцсети",55],["Геолокация",75],["Личные данные",20]];
  return <div className="stack"><div className="cols"><section className="panel chart"><h3>История индекса</h3>{data.length?<ResponsiveContainer width="100%" height={300}><LineChart data={data}><CartesianGrid stroke="#1d3047"/><XAxis dataKey="name" stroke="#73849c"/><YAxis domain={[0,100]} stroke="#73849c"/><Tooltip contentStyle={{background:"#0c1b2d",border:"1px solid #29415e"}}/><Line type="monotone" dataKey="score" stroke="#4b91ff" strokeWidth={3}/></LineChart></ResponsiveContainer>:<div className="empty">Пройди тест, чтобы увидеть график.</div>}</section><section className="panel"><h3>Категории риска</h3>{cats.map(x=><div className="bar-row" key={x[0]}><div><span>{x[0]}</span><b>{x[1]}%</b></div><div className="bar"><i style={{width:x[1]+"%"}}/></div></div>)}</section></div><section className="panel"><h3>Рекомендации</h3><div className="recommendations">{["Используй разные пароли для разных сервисов.","Включи двухфакторную аутентификацию.","Проверь настройки приватности социальных сетей.","Не открывай подозрительные ссылки."].map(x=><div className="rec" key={x}>✓ <span>{x}</span></div>)}</div></section></div>
}

function Profile({user,latest}){
  const cats=latest?[["🔐","Пароли",latest.passwords],["👥","Соцсети",latest.social],["📍","Геолокация",latest.location],["📄","Личные данные",latest.personal]]:[["🔐","Пароли","—"],["👥","Соцсети","—"],["📍","Геолокация","—"],["📄","Личные данные","—"]];
  return <div className="stack"><section className="panel profile-head"><div className="avatar">👤</div><div><small>DIGITAL IDENTITY</small><h2>{user}</h2><p>Учебный цифровой профиль</p></div><strong>{latest?.score??"—"}</strong></section><div className="profile-grid">{cats.map(x=><section className="panel profile-card" key={x[1]}><b>{x[0]}</b><span>{x[1]}</span><strong>{x[2]}{typeof x[2]==="number"?"%":""}</strong></section>)}</div></div>
}

function About(){return <div className="cols"><section className="panel"><small>SCHOOL PROJECT / GRADE 10</small><h2>DigitalGuard</h2><p>Информационная система для оценки цифровой безопасности пользователя.</p><div className="tech"><span>React</span><span>JavaScript</span><span>Vite</span><span>FastAPI</span><span>SQLite</span><span>JWT</span></div></section><section className="panel"><h3>Как работает проект</h3><p>React отвечает за интерфейс, FastAPI — за серверную логику, SQLite — за хранение пользователей и результатов, а Recharts — за визуализацию истории.</p></section></div>}

createRoot(document.getElementById("root")).render(<App/>);
