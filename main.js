import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = ["#FF6B6B","#4ECDC4","#FFE66D","#A8E6CF","#FF8B94","#C7CEEA","#FFDAC1","#B5EAD7","#FF9AA2","#85C1E9"];

function generateId() {
  return Math.random().toString(36).substr(2,9).toUpperCase();
}
function generateRoomCode() {
  return Math.random().toString(36).substr(2,6).toUpperCase();
}
function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function ChatApp() {
  const [screen, setScreen] = useState("age");
  const [age, setAge] = useState("");
  const [name, setName] = useState("");
  const [userId] = useState(() => generateId());
  const [room, setRoom] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [ageError, setAgeError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef(null);
  const intervalRef = useRef(null);
  const heartbeatRef = useRef(null);

  const userColor = hashColor(userId);

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => {
    if (!room || screen !== "chat") return;
    const sendHeart = async () => {
      try {
        await window.storage.set(
          `presence:${room.code}:${userId}`,
          JSON.stringify({ name, color: userColor, ts: Date.now() }),
          true
        );
      } catch(e){}
    };
    sendHeart();
    heartbeatRef.current = setInterval(sendHeart, 5000);
    return () => clearInterval(heartbeatRef.current);
  }, [room, screen, userId, name, userColor]);

  useEffect(() => {
    if (!room || screen !== "chat") return;
    const poll = async () => {
      try {
        const msgKeys = await window.storage.list(`msg:${room.code}:`, true);
        if (msgKeys?.keys) {
          const msgs = [];
          for (const key of msgKeys.keys.slice(-100)) {
            try {
              const r = await window.storage.get(key, true);
              if (r) msgs.push(JSON.parse(r.value));
            } catch(e){}
          }
          msgs.sort((a,b) => a.ts - b.ts);
          setMessages(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(msgs)) {
              scrollBottom();
              return msgs;
            }
            return prev;
          });
        }
        const presKeys = await window.storage.list(`presence:${room.code}:`, true);
        if (presKeys?.keys) {
          const users = [];
          const now = Date.now();
          for (const key of presKeys.keys) {
            try {
              const r = await window.storage.get(key, true);
              if (r) {
                const u = JSON.parse(r.value);
                if (now - u.ts < 15000) users.push(u);
              }
            } catch(e){}
          }
          setOnlineUsers(users);
        }
      } catch(e){}
    };
    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current);
  }, [room, screen, scrollBottom]);

  const handleAge = () => {
    const n = parseInt(age);
    if (isNaN(n) || n < 12) {
      setAgeError("Você precisa ter 12 anos ou mais para participar.");
      return;
    }
    setAgeError("");
    setScreen("login");
  };

  const handleLogin = () => {
    if (!name.trim()) return;
    setScreen("lobby");
  };

  const handleCreateRoom = async () => {
    const code = generateRoomCode();
    const newRoom = { code, name: `Sala de ${name}`, createdBy: userId };
    try {
      await window.storage.set(`room:${code}`, JSON.stringify(newRoom), true);
    } catch(e){}
    setRoom(newRoom);
    setScreen("chat");
  };

  const handleJoinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await window.storage.get(`room:${code}`, true);
      if (!r) { setJoinError("Sala não encontrada. Verifique o código."); return; }
      setRoom(JSON.parse(r.value));
      setJoinCode("");
      setJoinError("");
      setScreen("chat");
    } catch(e) {
      setJoinError("Sala não encontrada. Verifique o código.");
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const msg = {
      id: generateId(),
      userId,
      name,
      color: userColor,
      text: input.trim(),
      ts: Date.now(),
    };
    setInput("");
    try {
      await window.storage.set(`msg:${room.code}:${msg.ts}:${msg.id}`, JSON.stringify(msg), true);
    } catch(e){}
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(room?.code || "").catch(()=>{});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveRoom = async () => {
    try { await window.storage.delete(`presence:${room.code}:${userId}`, true); } catch(e){}
    clearInterval(intervalRef.current);
    clearInterval(heartbeatRef.current);
    setRoom(null);
    setMessages([]);
    setOnlineUsers([]);
    setScreen("lobby");
  };

  const s = {
    app: {
      minHeight:"100vh", background:"#080810",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Syne',sans-serif", color:"#fff",
      position:"relative", overflow:"hidden",
    },
    bg: {
      position:"fixed", inset:0, zIndex:0,
      background:"radial-gradient(ellipse at 20% 50%,#1a053340 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,#001f3f30 0%,transparent 60%)",
    },
    card: {
      position:"relative", zIndex:1,
      background:"rgba(255,255,255,0.04)",
      backdropFilter:"blur(24px)",
      border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:24, padding:"44px 40px",
      width:"100%", maxWidth:420,
      boxShadow:"0 32px 80px rgba(0,0,0,0.6)",
    },
    logo: {
      fontSize:11, fontWeight:800, letterSpacing:"0.3em",
      color:"rgba(255,255,255,0.25)", marginBottom:28, textTransform:"uppercase",
    },
    h1: { fontSize:30, fontWeight:800, lineHeight:1.15, marginBottom:8, margin:"0 0 8px" },
    sub: { color:"rgba(255,255,255,0.4)", fontSize:14, marginBottom:28, lineHeight:1.6 },
    label: {
      fontSize:10, fontWeight:800, letterSpacing:"0.2em",
      color:"rgba(255,255,255,0.3)", textTransform:"uppercase",
      display:"block", marginBottom:8,
    },
    input: {
      width:"100%", padding:"13px 16px", borderRadius:12,
      border:"1px solid rgba(255,255,255,0.08)",
      background:"rgba(255,255,255,0.05)", color:"#fff",
      fontSize:16, outline:"none", boxSizing:"border-box",
      marginBottom:18, fontFamily:"'Syne',sans-serif",
      transition:"border-color 0.2s",
    },
    btn: {
      width:"100%", padding:"14px", borderRadius:12, border:"none",
      background:"linear-gradient(135deg,#7c3aed,#2563eb)",
      color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer",
      letterSpacing:"0.06em", marginBottom:10,
      fontFamily:"'Syne',sans-serif",
    },
    btnSec: {
      width:"100%", padding:"13px", borderRadius:12,
      border:"1px solid rgba(255,255,255,0.1)",
      background:"transparent", color:"rgba(255,255,255,0.6)",
      fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:10,
      fontFamily:"'Syne',sans-serif",
    },
    error: { color:"#ff6b6b", fontSize:12, marginBottom:12 },
  };

  if (screen === "age") return (
    <div style={s.app}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet"/>
      <div style={s.bg}/>
      <div style={s.card}>
        <div style={s.logo}>✦ ChatVibe</div>
        <h1 style={s.h1}>Quantos anos<br/>você tem? 🎂</h1>
        <p style={s.sub}>Apenas pessoas com 12 anos ou mais podem usar o ChatVibe.</p>
        <label style={s.label}>Sua idade</label>
        <input style={s.input} type="number" placeholder="Ex: 15" min="0" max="120"
          value={age} onChange={e => setAge(e.target.value)}
          onKeyDown={e => e.key==="Enter" && handleAge()}
        />
        {ageError && <div style={s.error}>⚠ {ageError}</div>}
        <button style={s.btn} onClick={handleAge}>Confirmar →</button>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.18)",textAlign:"center",margin:0,lineHeight:1.6}}>
          Plataforma segura · Sem coleta de dados pessoais
        </p>
      </div>
    </div>
  );

  if (screen === "login") return (
    <div style={s.app}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet"/>
      <div style={s.bg}/>
      <div style={s.card}>
        <div style={s.logo}>✦ ChatVibe</div>
        <h1 style={s.h1}>Como quer<br/>ser chamado?</h1>
        <p style={s.sub}>Sem senha, sem e-mail. Só seu nome e você já está dentro.</p>
        <label style={s.label}>Seu apelido</label>
        <input style={s.input} placeholder="Ex: Pedro, Luna, Flash99..."
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key==="Enter" && handleLogin()}
          maxLength={20}
        />
        <div style={{marginBottom:20}}>
          <label style={s.label}>Seu ID de reconhecimento</label>
          <div style={{
            padding:"10px 14px", borderRadius:10,
            background:"rgba(255,255,255,0.03)",
            border:"1px solid rgba(255,255,255,0.07)",
            fontSize:13, fontFamily:"monospace",
            color:"rgba(255,255,255,0.4)", letterSpacing:"0.15em",
            display:"flex", alignItems:"center", gap:8
          }}>
            <span style={{
              width:8,height:8,borderRadius:"50%",
              background:userColor, flexShrink:0
            }}/>
            {userId}
          </div>
        </div>
        <button style={{...s.btn,opacity:name.trim()?1:0.4}} onClick={handleLogin}>
          Entrar no Chat ✦
        </button>
      </div>
    </div>
  );

  if (screen === "lobby") return (
    <div style={s.app}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet"/>
      <div style={s.bg}/>
      <div style={s.card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
          <div style={s.logo}>✦ ChatVibe</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e"}}/>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{name}</span>
          </div>
        </div>
        <h1 style={{...s.h1,fontSize:24}}>Oi, {name}! 👋</h1>
        <p style={s.sub}>Crie uma sala nova ou entre com o código de um amigo.</p>

        <button style={s.btn} onClick={handleCreateRoom}>✦ Criar Nova Sala</button>

        <div style={{
          display:"flex",alignItems:"center",gap:12,margin:"4px 0 16px"
        }}>
          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.07)"}}/>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>ou</span>
          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.07)"}}/>
        </div>

        <label style={s.label}>Código da sala</label>
        <input style={s.input} placeholder="Cole o código aqui..."
          value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key==="Enter" && handleJoinRoom()}
          maxLength={6}
        />
        {joinError && <div style={s.error}>⚠ {joinError}</div>}
        <button style={s.btnSec} onClick={handleJoinRoom}>Entrar na Sala</button>

        <div style={{
          marginTop:8,padding:"10px 14px",borderRadius:10,
          background:"rgba(124,58,237,0.07)",
          border:"1px solid rgba(124,58,237,0.15)",
          fontSize:11,color:"rgba(255,255,255,0.3)",lineHeight:1.6
        }}>
          🔐 ID: <span style={{fontFamily:"monospace",color:"rgba(255,255,255,0.45)",letterSpacing:"0.1em"}}>{userId}</span>
        </div>
      </div>
    </div>
  );

  // Chat
  return (
    <div style={{fontFamily:"'Syne',sans-serif",background:"#080810",minHeight:"100vh"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet"/>
      <div style={{
        position:"fixed",inset:0,display:"flex",flexDirection:"column",
        background:"#080810",color:"#fff"
      }}>
        {/* Header */}
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",
          background:"rgba(255,255,255,0.02)", backdropFilter:"blur(12px)",
          flexShrink:0
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{
              width:34,height:34,borderRadius:10,
              background:"linear-gradient(135deg,#7c3aed,#2563eb)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:15
            }}>💬</div>
            <div>
              <div style={{fontSize:13,fontWeight:800}}>{room?.name}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{onlineUsers.length} online agora</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={copyInvite} style={{
              padding:"7px 13px",borderRadius:9,
              border:"1px solid rgba(255,255,255,0.1)",
              background:copied?"rgba(34,197,94,0.12)":"rgba(255,255,255,0.05)",
              color:copied?"#22c55e":"rgba(255,255,255,0.55)",
              fontSize:11,fontWeight:800,cursor:"pointer",
              fontFamily:"'Syne',sans-serif",letterSpacing:"0.05em",
              transition:"all 0.2s"
            }}>
              {copied?"✓ Copiado!":"🔗 "+room?.code}
            </button>
            <button onClick={leaveRoom} style={{
              padding:"7px 11px",borderRadius:9,
              border:"1px solid rgba(255,80,80,0.15)",
              background:"rgba(255,80,80,0.06)",
              color:"rgba(255,100,100,0.6)",
              fontSize:11,cursor:"pointer",fontFamily:"'Syne',sans-serif"
            }}>Sair</button>
          </div>
        </div>

        {/* Online users */}
        <div style={{
          padding:"8px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",
          display:"flex",gap:6,alignItems:"center",overflowX:"auto",flexShrink:0
        }}>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.18)",fontWeight:800,letterSpacing:"0.2em",whiteSpace:"nowrap"}}>ONLINE:</span>
          {onlineUsers.length === 0 && <span style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>carregando...</span>}
          {onlineUsers.map((u,i) => (
            <div key={i} style={{
              padding:"2px 9px",borderRadius:20,
              background:`${u.color}18`,border:`1px solid ${u.color}40`,
              color:u.color,fontSize:10,fontWeight:800,whiteSpace:"nowrap"
            }}>{u.name}{u.name===name?" (você)":""}</div>
          ))}
        </div>

        {/* Messages */}
        <div style={{
          flex:1,overflowY:"auto",padding:"16px",
          display:"flex",flexDirection:"column",gap:8
        }}>
          {messages.length === 0 && (
            <div style={{
              flex:1,display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",
              color:"rgba(255,255,255,0.15)",textAlign:"center",padding:"40px 20px"
            }}>
              <div style={{fontSize:48,marginBottom:12}}>💬</div>
              <div style={{fontSize:14,fontWeight:700}}>Nenhuma mensagem ainda</div>
              <div style={{fontSize:12,marginTop:6,lineHeight:1.6}}>
                Compartilhe o código <span style={{
                  fontFamily:"monospace",
                  color:"rgba(255,255,255,0.35)",
                  padding:"2px 8px",borderRadius:6,
                  background:"rgba(255,255,255,0.05)"
                }}>{room?.code}</span><br/>com seus amigos!
              </div>
            </div>
          )}
          {messages.map(msg => {
            const isMe = msg.userId === userId;
            return (
              <div key={msg.id} style={{
                display:"flex",flexDirection:"column",
                alignItems:isMe?"flex-end":"flex-start"
              }}>
                {!isMe && (
                  <div style={{fontSize:10,fontWeight:800,color:msg.color,marginBottom:3,marginLeft:4}}>
                    {msg.name}
                  </div>
                )}
                <div style={{
                  maxWidth:"72%",padding:"10px 14px",
                  borderRadius:14,
                  borderBottomRightRadius:isMe?3:14,
                  borderBottomLeftRadius:isMe?14:3,
                  background:isMe
                    ?"linear-gradient(135deg,#7c3aed,#2563eb)"
                    :"rgba(255,255,255,0.07)",
                  fontSize:14,lineHeight:1.5,wordBreak:"break-word",
                  color:"#fff"
                }}>{msg.text}</div>
                <div style={{
                  fontSize:9,color:"rgba(255,255,255,0.2)",
                  marginTop:3,marginLeft:4,marginRight:4
                }}>
                  {new Date(msg.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{
          display:"flex",gap:10,padding:"14px 16px",
          borderTop:"1px solid rgba(255,255,255,0.06)",
          background:"rgba(255,255,255,0.02)",flexShrink:0
        }}>
          <input
            style={{
              flex:1,padding:"12px 16px",borderRadius:12,
              border:"1px solid rgba(255,255,255,0.08)",
              background:"rgba(255,255,255,0.06)",color:"#fff",
              fontSize:14,outline:"none",fontFamily:"'Syne',sans-serif"
            }}
            placeholder="Digite uma mensagem..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            style={{
              padding:"12px 18px",borderRadius:12,border:"none",
              background:"linear-gradient(135deg,#7c3aed,#2563eb)",
              color:"#fff",fontSize:16,cursor:"pointer"
            }}
          >➤</button>
        </div>
      </div>
    </div>
  );
}
