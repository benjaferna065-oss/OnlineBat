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
  const [isFocused, setIsFocused] = useState(false);
  
  const bottomRef = useRef(null);
  const intervalRef = useRef(null);
  const heartbeatRef = useRef(null);

  const userColor = hashColor(userId);

  // Scroll automático quando novas mensagens chegam
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Heartbeat (Presença Online)
  useEffect(() => {
    if (!room || screen !== "chat") return;
    const sendHeart = async () => {
      try {
        await window.storage.set(
          `presence:${room.code}:${userId}`,
          JSON.stringify({ name, color: userColor, ts: Date.now() }),
          true
        );
      } catch(e) { console.error("Erro no heartbeat:", e); }
    };
    sendHeart();
    heartbeatRef.current = setInterval(sendHeart, 5000);
    return () => clearInterval(heartbeatRef.current);
  }, [room, screen, userId, name, userColor]);

  // Polling de Mensagens e Usuários
  useEffect(() => {
    if (!room || screen !== "chat") return;
    const poll = async () => {
      try {
        const msgKeys = await window.storage.list(`msg:${room.code}:`, true);
        if (msgKeys?.keys) {
          const msgs = [];
          for (const key of msgKeys.keys.slice(-100)) {
            const r = await window.storage.get(key, true);
            if (r) msgs.push(JSON.parse(r.value));
          }
          msgs.sort((a,b) => a.ts - b.ts);
          setMessages(prev => JSON.stringify(prev) !== JSON.stringify(msgs) ? msgs : prev);
        }

        const presKeys = await window.storage.list(`presence:${room.code}:`, true);
        if (presKeys?.keys) {
          const users = [];
          const now = Date.now();
          for (const key of presKeys.keys) {
            const r = await window.storage.get(key, true);
            if (r) {
              const u = JSON.parse(r.value);
              if (now - u.ts < 15000) users.push(u);
            }
          }
          setOnlineUsers(users);
        }
      } catch(e) { console.error("Erro no polling:", e); }
    };
    poll();
    intervalRef.current = setInterval(poll, 2500);
    return () => clearInterval(intervalRef.current);
  }, [room, screen]);

  const handleAge = () => {
    const n = parseInt(age);
    if (isNaN(n) || n < 12) {
      setAgeError("Você precisa ter 12 anos ou mais.");
      return;
    }
    setScreen("login");
  };

  const handleCreateRoom = async () => {
    const code = generateRoomCode();
    const newRoom = { code, name: `Sala de ${name}`, createdBy: userId };
    await window.storage.set(`room:${code}`, JSON.stringify(newRoom), true);
    setRoom(newRoom);
    setScreen("chat");
  };

  const handleJoinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    const r = await window.storage.get(`room:${code}`, true);
    if (!r) { setJoinError("Código inválido."); return; }
    setRoom(JSON.parse(r.value));
    setScreen("chat");
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
    await window.storage.set(`msg:${room.code}:${msg.ts}:${msg.id}`, JSON.stringify(msg), true);
  };

  const s = {
    app: { minHeight:"100vh", background:"#080810", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif", color:"#fff", position:"relative", overflow:"hidden" },
    bg: { position:"fixed", inset:0, zIndex:0, background:"radial-gradient(circle at 20% 30%, #1a0533 0%, transparent 50%), radial-gradient(circle at 80% 70%, #001f3f 0%, transparent 50%)" },
    card: { position:"relative", zIndex:1, background:"rgba(255,255,255,0.03)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:24, padding:40, width:"100%", maxWidth:400 },
    input: (focus) => ({ 
        width:"100%", padding:14, borderRadius:12, border:"1px solid", 
        borderColor: focus ? "#7c3aed" : "rgba(255,255,255,0.1)", 
        background:"rgba(255,255,255,0.05)", color:"#fff", fontSize:16, outline:"none", marginBottom:15,
        boxShadow: focus ? "0 0 15px rgba(124,58,237,0.2)" : "none", transition:"all 0.3s"
    }),
    btn: { width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#7c3aed,#2563eb)", color:"#fff", fontWeight:800, cursor:"pointer", marginBottom:10 }
  };

  if (screen === "age") return (
    <div style={s.app}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet"/>
      <div style={s.bg}/>
      <div style={s.card}>
        <h1 style={{fontSize:28, fontWeight:800}}>Sua idade? 🎂</h1>
        <p style={{color:"#888", marginBottom:25}}>O ChatVibe é para maiores de 12 anos.</p>
        <input style={s.input(false)} type="number" placeholder="Ex: 15" value={age} onChange={e => setAge(e.target.value)} />
        {ageError && <div style={{color:"#ff6b6b", marginBottom:10}}>{ageError}</div>}
        <button style={s.btn} onClick={handleAge}>Continuar</button>
      </div>
    </div>
  );

  if (screen === "login") return (
    <div style={s.app}>
      <div style={s.bg}/>
      <div style={s.card}>
        <h1 style={{fontSize:28, fontWeight:800}}>Qual seu nome?</h1>
        <input style={s.input(false)} maxLength={15} placeholder="Apelido..." value={name} onChange={e => setName(e.target.value)} />
        <button style={s.btn} onClick={() => name.trim() && setScreen("lobby")}>Entrar no Lobby</button>
      </div>
    </div>
  );

  if (screen === "lobby") return (
    <div style={s.app}>
      <div style={s.bg}/>
      <div style={s.card}>
        <h1 style={{fontSize:24, fontWeight:800}}>Olá, {name}!</h1>
        <button style={s.btn} onClick={handleCreateRoom}>+ Criar Nova Sala</button>
        <div style={{textAlign:"center", margin:"10px 0", color:"#444"}}>ou</div>
        <input style={s.input(false)} placeholder="Código da Sala" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} />
        {joinError && <div style={{color:"#ff6b6b", marginBottom:10}}>{joinError}</div>}
        <button style={{...s.btn, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)"}} onClick={handleJoinRoom}>Entrar</button>
      </div>
    </div>
  );

  // Tela de Chat
  return (
    <div style={{height:"100vh", background:"#080810", display:"flex", flexDirection:"column", fontFamily:"'Syne', sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet"/>
      
      {/* Header */}
      <div style={{padding:20, borderBottom:"1px solid #1a1a2e", display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(8,8,16,0.8)", backdropFilter:"blur(10px)", zIndex:10}}>
        <div>
          <div style={{fontWeight:800}}>{room?.name}</div>
          <div style={{fontSize:12, color:"#22c55e"}}>{onlineUsers.length} online</div>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(()=>setCopied(false), 2000); }} 
                style={{padding:"8px 12px", borderRadius:8, background:"#1a1a2e", border:"1px solid #333", color:"#eee", cursor:"pointer"}}>
          {copied ? "Copiado!" : `ID: ${room?.code}`}
        </button>
      </div>

      {/* Lista de Mensagens */}
      <div style={{flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:5}}>
        {messages.map((msg, i) => {
          const isMe = msg.userId === userId;
          const showName = i === 0 || messages[i-1].userId !== msg.userId;
          return (
            <div key={msg.id} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth:"80%", marginTop: showName ? 10 : 0 }}>
              {showName && !isMe && <div style={{fontSize:11, color:msg.color, fontWeight:800, marginBottom:2, marginLeft:5}}>{msg.name}</div>}
              <div style={{ 
                padding:"10px 16px", borderRadius:15, fontSize:14, 
                background: isMe ? "linear-gradient(135deg,#7c3aed,#2563eb)" : "rgba(255,255,255,0.06)",
                color: "#fff", borderBottomRightRadius: isMe ? 2 : 15, borderBottomLeftRadius: isMe ? 15 : 2
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input de Mensagem */}
      <div style={{padding:20, background:"#080810", borderTop:"1px solid #1a1a2e"}}>
        <div style={{display:"flex", gap:10}}>
          <input 
            style={s.input(isFocused)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Escreva algo..." 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage} style={{...s.btn, width:60, height:48}}>➤</button>
        </div>
      </div>
    </div>
  );
}
