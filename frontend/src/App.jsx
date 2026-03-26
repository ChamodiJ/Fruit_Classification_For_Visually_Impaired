/**
 * FruitSense AI - React Frontend
 * Voice commands (activate mic button first):
 *   "open camera"  / "start camera"  -> start webcam
 *   "close camera" / "stop camera"   -> stop webcam
 *   "scan" / "capture" / "analyze"   -> capture and classify
 *   "repeat" / "say again"           -> replay last result
 *   "flip" / "switch camera"         -> toggle front/back
 *   "help"                           -> list commands
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

var FRUIT_EMOJIS = {
  apple:"🍎", banana:"🍌", mango:"🥭", orange:"🍊", grape:"🍇",
  strawberry:"🍓", pineapple:"🍍", watermelon:"🍉", lemon:"🍋",
  peach:"🍑", cherry:"🍒", pear:"🍐", kiwi:"🥝", avocado:"🥑",
  coconut:"🥥", pomegranate:"🍎", guava:"🍈", papaya:"🍈",
};

var COLOR_MAP = [
  ["red","#f87171"],["green","#4ade80"],["yellow","#fbbf24"],
  ["orange","#fb923c"],["purple","#c084fc"],["pink","#f472b6"],
  ["brown","#a78bfa"],["white","#e2e8f0"],["dark","#94a3b8"],
];

var FRESH_CFG = {
  Fresh:    { color:"#22c55e", glow:"rgba(34,197,94,0.35)",  score:94, icon:"✅", msg:"Great choice!" },
  Overripe: { color:"#f97316", glow:"rgba(249,115,22,0.35)", score:42, icon:"⚠️", msg:"Past peak ripeness." },
  Rotten:   { color:"#ef4444", glow:"rgba(239,68,68,0.35)",  score:8,  icon:"🚫", msg:"Not recommended." },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function speak(text, onEnd) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 1.0;
  u.pitch = 1.05;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

function getFruitEmoji(name) {
  if (!name) return "🍑";
  var l = name.toLowerCase();
  var keys = Object.keys(FRUIT_EMOJIS);
  for (var i = 0; i < keys.length; i++) {
    if (l.includes(keys[i])) return FRUIT_EMOJIS[keys[i]];
  }
  return "🍑";
}

function getColor(cls) {
  if (!cls) return { name:"Natural", hex:"#84cc16" };
  var l = cls.toLowerCase();
  for (var i = 0; i < COLOR_MAP.length; i++) {
    if (l.includes(COLOR_MAP[i][0])) {
      var k = COLOR_MAP[i][0];
      return { name: k.charAt(0).toUpperCase() + k.slice(1), hex: COLOR_MAP[i][1] };
    }
  }
  return { name:"Natural", hex:"#84cc16" };
}

function stripQuality(name) {
  if (!name) return "";
  return name.replace(/\b(fresh|rotten|overripe|old)\b\s*/gi, "").trim();
}

// ─── Ring Component ───────────────────────────────────────────────────────────

function Ring(props) {
  var size  = props.size || 108;
  var r     = (size - 12) / 2;
  var circ  = 2 * Math.PI * r;
  var pct   = Math.min(props.value || 0, 100);
  var offset = circ - (pct / 100) * circ;
  var glowFilter = "drop-shadow(0 0 6px " + (props.glow || props.color) + ")";

  return (
    <div style={{ position:"relative", width:size, height:size, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <svg width={size} height={size} style={{ position:"absolute", top:0, left:0, transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={props.color} strokeWidth={9}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)", filter:glowFilter }}
        />
      </svg>
      <div style={{ textAlign:"center", zIndex:1 }}>
        <div style={{ fontSize:17, fontWeight:900, color:props.color, fontFamily:"'Syne',sans-serif", lineHeight:1 }}>
          {props.topLabel}
        </div>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", marginTop:3, letterSpacing:1, textTransform:"uppercase" }}>
          {props.bottomLabel}
        </div>
      </div>
    </div>
  );
}

// ─── MicBtn ───────────────────────────────────────────────────────────────────

function MicBtn(props) {
  var bg     = props.active ? "rgba(239,68,68,0.2)"             : "rgba(255,255,255,0.07)";
  var border = props.active ? "1.5px solid rgba(239,68,68,0.6)" : "1.5px solid rgba(255,255,255,0.12)";
  return (
    <button onClick={props.onClick} style={{
      position:"relative", width:46, height:46, borderRadius:"50%",
      background:bg, border:border,
      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:19, transition:"all 0.25s",
    }}>
      {props.active && (
        <>
          <span style={{ position:"absolute", width:60, height:60, borderRadius:"50%",
            border:"1.5px solid rgba(239,68,68,0.35)", animation:"micRing 1.3s ease-out infinite" }} />
          <span style={{ position:"absolute", width:78, height:78, borderRadius:"50%",
            border:"1.5px solid rgba(239,68,68,0.15)", animation:"micRing 1.3s ease-out 0.35s infinite" }} />
        </>
      )}
      🎤
    </button>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip(props) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      background:props.color + "1a", color:props.color,
      border:"1px solid " + props.color + "33",
      borderRadius:20, padding:"3px 11px", fontSize:11.5, fontWeight:600,
    }}>
      {props.children}
    </span>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function Placeholder() {
  return (
    <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:12 }}>
      <div style={{ width:96, height:96, borderRadius:"50%",
        border:"2px dashed rgba(255,255,255,0.08)",
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:46 }}>
        🍎
      </div>
      <div style={{ fontSize:17, fontWeight:700, color:"rgba(255,255,255,0.18)" }}>Camera Off</div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.12)" }}>
        Say <em style={{ color:"rgba(0,229,255,0.5)", fontStyle:"italic" }}>open camera</em> or tap Start
      </div>
    </div>
  );
}

// ─── PredRow ──────────────────────────────────────────────────────────────────

function PredRow(props) {
  var barBg = props.first
    ? "linear-gradient(90deg,#00e5ff,#22c55e)"
    : "rgba(255,255,255,0.18)";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9 }}>
      <span style={{ width:22, fontSize:11, fontWeight:700,
        color: props.first ? "#00e5ff" : "rgba(255,255,255,0.28)" }}>
        #{props.rank}
      </span>
      <span style={{ width:155, fontSize:12.5, color:"rgba(255,255,255,0.78)",
        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
        {props.name}
      </span>
      <div style={{ flex:1, height:6, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:3, width:props.conf + "%", background:barBg,
          transition:"width 1.2s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <span style={{ width:44, textAlign:"right", fontSize:12, color:"rgba(255,255,255,0.4)" }}>
        {props.conf.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard(props) {
  var result   = props.result;
  var top      = result.top_prediction;
  var freshCfg = result.freshCfg;
  var color    = result.color;

  return (
    <div style={S.resultCard}>
      <div style={S.resultHeader}>
        <span style={{ fontSize:58, lineHeight:1, filter:"drop-shadow(0 6px 14px rgba(0,0,0,0.5))" }}>
          {result.emoji}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={S.fruitName}>{result.fruitName}</div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginTop:7 }}>
            <Chip color={freshCfg.color}>{freshCfg.icon} {top.freshness}</Chip>
            <Chip color={color.hex}>
              <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%",
                background:color.hex, marginRight:5, verticalAlign:"middle" }} />
              {color.name}
            </Chip>
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:6 }}>
            {freshCfg.msg}
          </div>
        </div>
      </div>

      <div style={S.rings}>
        <Ring value={top.confidence}   color="#00e5ff"        glow="rgba(0,229,255,0.4)"
              topLabel={top.confidence.toFixed(0) + "%"}   bottomLabel="ACCURACY" />
        <Ring value={freshCfg.score}   color={freshCfg.color} glow={freshCfg.glow}
              topLabel={freshCfg.score + "%"}              bottomLabel="FRESHNESS" />
        <Ring value={82}               color={color.hex}       glow={color.hex + "66"}
              topLabel={color.name.slice(0,4).toUpperCase()} bottomLabel="COLOR" />
      </div>

      <div style={S.predsTitle}>TOP PREDICTIONS</div>
      {result.all_predictions.map(function(p, i) {
        return (
          <PredRow key={i} rank={i + 1} name={p.formatted_name}
            conf={p.confidence} first={i === 0} />
        );
      })}

      <button style={S.repeatBtn} onClick={props.onRepeat}>
        🔊 Hear Result Again
      </button>
    </div>
  );
}

// ─── VoiceGuide ───────────────────────────────────────────────────────────────

function VoiceGuide(props) {
  var [open, setOpen] = useState(false);
  var cmds = [
    ["open camera",  "Turn camera on"],
    ["close camera", "Turn camera off"],
    ["scan",         "Capture and analyze"],
    ["repeat",       "Hear result again"],
    ["flip",         "Switch camera"],
    ["help",         "List commands"],
  ];
  return (
    <div style={{ marginTop:14 }}>
      <button onClick={function() { setOpen(function(o) { return !o; }); }} style={{
        width:"100%", padding:"10px 14px",
        background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:12, color:"rgba(255,255,255,0.4)", fontSize:12, fontWeight:600,
        cursor:"pointer", fontFamily:"inherit", display:"flex", justifyContent:"space-between",
      }}>
        <span>🎤 Voice Commands</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ marginTop:8, background:"rgba(255,255,255,0.02)",
          border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, overflow:"hidden" }}>
          {cmds.map(function(item, i) {
            return (
              <div key={i} style={{
                display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"9px 14px",
                borderBottom: i < cmds.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <code style={{ fontSize:12, color:"#00e5ff", background:"rgba(0,229,255,0.07)",
                  padding:"2px 8px", borderRadius:6 }}>
                  {item[0]}
                </code>
                <span style={{ fontSize:11.5, color:"rgba(255,255,255,0.35)" }}>{item[1]}</span>
              </div>
            );
          })}
          {!props.micOn && (
            <div style={{ padding:"10px 14px", fontSize:11, color:"rgba(255,165,0,0.7)",
              borderTop:"1px solid rgba(255,255,255,0.04)" }}>
              Tap the 🎤 button to activate voice control first.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  var videoRef  = useRef(null);
  var canvasRef = useRef(null);
  var streamRef = useRef(null);
  var recognRef = useRef(null);
  var lastVoice = useRef("");

  var [camOn,    setCamOn]    = useState(false);
  var [facing,   setFacing]   = useState("environment");
  var [captured, setCaptured] = useState(null);
  var [result,   setResult]   = useState(null);
  var [loading,  setLoading]  = useState(false);
  var [error,    setError]    = useState(null);
  var [micOn,    setMicOn]    = useState(false);
  var [heard,    setHeard]    = useState("");
  var [status,   setStatus]   = useState("Say 'open camera' or tap Start");
  var [flash,    setFlash]    = useState(false);
  var [toast,    setToast]    = useState(null);

  var showToast = useCallback(function(msg, type) {
    setToast({ msg:msg, type:type || "info" });
    setTimeout(function() { setToast(null); }, 3000);
  }, []);

  var startCamera = useCallback(async function(f) {
    var faceMode = f || facing;
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop(); });
      var stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:faceMode, width:{ ideal:1280 }, height:{ ideal:720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true); setCaptured(null); setResult(null); setError(null);
      setStatus("Camera on - say 'scan' or tap Scan Fruit");
      speak("Camera is on. Point at a fruit and say scan, or tap the scan button.");
    } catch (err) {
      setError("Camera access denied. Please allow camera permissions in your browser.");
      speak("Could not access camera. Please allow camera permissions.");
    }
  }, [facing]);

  var stopCamera = useCallback(function() {
    if (streamRef.current) streamRef.current.getTracks().forEach(function(t) { t.stop(); });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false); setCaptured(null); setResult(null);
    setStatus("Camera off. Say 'open camera' or tap Start.");
    speak("Camera closed.");
  }, []);

  useEffect(function() {
    return function() { stopCamera(); };
  }, []);

  var classify = useCallback(async function() {
    if (!camOn || !videoRef.current || !canvasRef.current) return;
    setFlash(true);
    setTimeout(function() { setFlash(false); }, 450);
    setLoading(true); setError(null); setResult(null);
    setStatus("Analyzing...");

    var vid = videoRef.current;
    var cnv = canvasRef.current;
    cnv.width  = vid.videoWidth;
    cnv.height = vid.videoHeight;
    cnv.getContext("2d").drawImage(vid, 0, 0);
    var dataUrl = cnv.toDataURL("image/jpeg", 0.92);
    setCaptured(dataUrl);
    speak("Analyzing. Please hold still.");

    try {
      var res  = await fetch("/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: dataUrl }),
      });
      var data = await res.json();
      if (!data.success) throw new Error(data.error || "Classification failed");

      var top       = data.top_prediction;
      var freshCfg  = FRESH_CFG[top.freshness] || FRESH_CFG.Fresh;
      var color     = getColor(top.class);
      var fruitName = stripQuality(top.formatted_name);
      var emoji     = getFruitEmoji(top.formatted_name);

      setResult(Object.assign({}, data, {
        freshCfg:freshCfg, color:color, fruitName:fruitName, emoji:emoji,
      }));

      var voice = top.formatted_name + ". " + top.freshness + " fruit. Confidence " +
                  top.confidence.toFixed(0) + " percent. Color: " + color.name + ". " + freshCfg.msg;
      lastVoice.current = voice;
      speak(voice);
      setStatus("Done - say 'scan' for another or 'repeat' to hear again");
    } catch (e) {
      var msg = e.message || "Server error. Make sure the Flask backend is running.";
      setError(msg);
      speak("Analysis failed. " + msg);
      setStatus("Error - try again");
    } finally {
      setLoading(false);
    }
  }, [camOn]);

  var handleCommand = useCallback(function(raw) {
    var cmd = raw.toLowerCase().trim();
    setHeard(raw);
    setTimeout(function() { setHeard(""); }, 4000);

    if (/open camera|start camera|camera on|turn on/.test(cmd)) {
      showToast("🎙 Opening camera...", "cmd");
      startCamera();
    } else if (/close camera|stop camera|camera off|turn off/.test(cmd)) {
      showToast("🎙 Closing camera", "cmd");
      stopCamera();
    } else if (/scan|capture|take photo|photograph|analyze|identify|check fruit/.test(cmd)) {
      if (camOn) { showToast("🎙 Scanning...", "cmd"); classify(); }
      else { speak("Camera is off. Say open camera first."); showToast("Camera is off - open it first", "warn"); }
    } else if (/repeat|say again|tell me again|what was/.test(cmd)) {
      if (lastVoice.current) { speak(lastVoice.current); showToast("🎙 Repeating result", "cmd"); }
      else { speak("No result yet. Please scan a fruit first."); }
    } else if (/flip|switch camera|front camera|back camera/.test(cmd)) {
      var f = facing === "environment" ? "user" : "environment";
      setFacing(f); showToast("🎙 Switching camera", "cmd"); startCamera(f);
    } else if (/help|commands|what can you/.test(cmd)) {
      speak("Commands: open camera, close camera, scan, repeat, flip camera, help.");
      showToast("🎙 Help - see voice commands below", "cmd");
    } else {
      showToast("Not recognised: " + raw + ". Say help.", "warn");
    }
  }, [camOn, classify, startCamera, stopCamera, facing, showToast]);

  var toggleMic = useCallback(function() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      speak("Speech recognition not supported. Please use Chrome or Edge.");
      return;
    }
    if (recognRef.current) {
      recognRef.current.abort();
      recognRef.current = null;
      setMicOn(false);
      speak("Voice assistant off.");
      return;
    }
    var r = new SR();
    r.continuous = true; r.interimResults = false; r.lang = "en-US";
    r.onstart  = function() { setMicOn(true); };
    r.onresult = function(e) {
      var t = Array.from(e.results).map(function(x) { return x[0].transcript; }).join(" ").trim();
      if (t) handleCommand(t);
    };
    r.onerror = function() { setMicOn(false); recognRef.current = null; };
    r.onend   = function() { setMicOn(false); recognRef.current = null; };
    recognRef.current = r;
    r.start();
    speak("Voice assistant on. I am listening. Say open camera to start.");
  }, [handleCommand]);

  function retake() {
    setCaptured(null); setResult(null); setError(null);
    setStatus("Camera ready - say 'scan' or tap Scan Fruit");
  }

  var toastBg     = "rgba(255,255,255,0.08)";
  var toastBorder = "rgba(255,255,255,0.12)";
  if (toast && toast.type === "cmd")  { toastBg = "rgba(0,229,255,0.13)";  toastBorder = "rgba(0,229,255,0.25)"; }
  if (toast && toast.type === "warn") { toastBg = "rgba(251,146,60,0.13)"; toastBorder = "rgba(251,146,60,0.25)"; }

  return (
    <div style={S.root}>
      <GlobalStyles />
      <div style={S.bgMesh} />
      <div style={S.bgGrid} />

      {toast && (
        <div style={Object.assign({}, S.toast, { background:toastBg, borderColor:toastBorder })}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.brand}>
          <div style={{ fontSize:28, lineHeight:1 }}>🍃</div>
          <div>
            <div style={S.brandTitle}>FruitSense AI</div>
            <div style={S.brandSub}>Voice-Powered Scanner</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {camOn && (
            <button style={S.iconBtn} title="Flip camera" onClick={function() {
              var f = facing === "environment" ? "user" : "environment";
              setFacing(f); startCamera(f);
            }}>🔄</button>
          )}
          <MicBtn active={micOn} onClick={toggleMic} />
        </div>
      </header>

      {/* STATUS */}
      <div style={S.statusBar}>
        <span style={Object.assign({}, S.dot, {
          background: camOn ? "#22c55e" : "rgba(255,255,255,0.18)",
          boxShadow:  camOn ? "0 0 8px #22c55e" : "none",
        })} />
        <span style={S.statusText}>{status}</span>
      </div>

      {heard && (
        <div style={{ padding:"6px 16px", textAlign:"center" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6,
            background:"rgba(0,229,255,0.08)", border:"1px solid rgba(0,229,255,0.18)",
            borderRadius:20, padding:"4px 14px", fontSize:12, color:"rgba(0,229,255,0.85)",
            fontStyle:"italic", animation:"fadeUp 0.3s ease" }}>
            <span style={{ opacity:0.5, fontSize:11 }}>heard:</span>
            {heard}
          </div>
        </div>
      )}

      <main style={S.main}>

        {/* Viewfinder */}
        <div style={S.viewBox}>
          {flash && <div style={S.flash} />}

          {captured
            ? <img src={captured} alt="captured" style={S.frame} />
            : <video ref={videoRef}
                style={Object.assign({}, S.frame, { display: camOn ? "block" : "none" })}
                playsInline muted />
          }

          {!camOn && !captured && <Placeholder />}

          {camOn && !captured && !loading && (
            <>
              <span style={Object.assign({}, S.corner, { top:14, left:14 })} />
              <span style={Object.assign({}, S.corner, { top:14, right:14, transform:"scaleX(-1)" })} />
              <span style={Object.assign({}, S.corner, { bottom:14, left:14, transform:"scaleY(-1)" })} />
              <span style={Object.assign({}, S.corner, { bottom:14, right:14, transform:"scale(-1,-1)" })} />
              <div style={S.scanLine} />
            </>
          )}

          {loading && (
            <div style={S.loadOverlay}>
              <div style={S.spinner} />
              <div style={{ color:"#00e5ff", fontSize:12, fontWeight:700, letterSpacing:2, marginTop:12 }}>
                ANALYZING
              </div>
              <div style={{ color:"rgba(255,255,255,0.35)", fontSize:11, marginTop:4 }}>
                please hold still...
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display:"none" }} />
        </div>

        {/* Controls */}
        <div style={{ marginBottom:10 }}>
          {!camOn ? (
            <button style={S.btnPrimary} onClick={function() { startCamera(); }}>
              <span style={{ fontSize:18 }}>📷</span> Start Camera
            </button>
          ) : captured ? (
            <div style={S.row}>
              <button style={S.btnSecondary} onClick={retake}>↩ Retake</button>
              <button style={Object.assign({}, S.btnPrimary, { flex:2 })} onClick={classify}>
                🔍 Scan Again
              </button>
            </div>
          ) : (
            <div style={S.row}>
              <button style={S.btnDanger} onClick={stopCamera}>■ Stop</button>
              <button style={Object.assign({}, S.btnPrimary, { flex:2 })} onClick={classify} disabled={loading}>
                {loading ? "⏳ Scanning..." : "⚡ Scan Fruit"}
              </button>
            </div>
          )}
        </div>

        {/* Voice hint */}
        <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center", marginBottom:12 }}>
          <span style={{ opacity:0.4 }}>🎤</span>
          <span style={{ color:"rgba(255,255,255,0.3)", fontSize:11.5 }}>
            {micOn
              ? "Listening... try: open camera, scan, repeat, flip, help"
              : "Tap 🎤 to activate voice control"}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={S.errorCard}>
            <span style={{ fontSize:18 }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        {result && (
          <ResultCard
            result={result}
            onRepeat={function() { if (lastVoice.current) speak(lastVoice.current); }}
          />
        )}

        <VoiceGuide micOn={micOn} />
      </main>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

var S = {
  root:        { minHeight:"100vh", background:"#060c16", fontFamily:"'DM Sans',sans-serif", color:"#fff", position:"relative", overflowX:"hidden" },
  bgMesh:      { position:"fixed", inset:0, zIndex:0, background:"radial-gradient(ellipse at 12% 8%, #0b2217 0%, transparent 50%), radial-gradient(ellipse at 88% 92%, #0a1928 0%, transparent 50%)" },
  bgGrid:      { position:"fixed", inset:0, zIndex:0, backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize:"40px 40px", pointerEvents:"none" },
  toast:       { position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", backdropFilter:"blur(14px)", border:"1px solid", borderRadius:24, padding:"9px 20px", fontSize:12.5, fontWeight:600, zIndex:200, whiteSpace:"nowrap", animation:"fadeUp 0.3s ease", maxWidth:"90vw" },
  header:      { position:"relative", zIndex:10, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 18px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)" },
  brand:       { display:"flex", alignItems:"center", gap:12 },
  brandTitle:  { fontFamily:"'Syne',sans-serif", fontSize:21, fontWeight:900, letterSpacing:"-0.5px" },
  brandSub:    { fontSize:10.5, color:"rgba(255,255,255,0.35)", marginTop:-1 },
  iconBtn:     { width:46, height:46, borderRadius:12, background:"rgba(255,255,255,0.07)", border:"1.5px solid rgba(255,255,255,0.12)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:"#fff", transition:"all 0.2s" },
  statusBar:   { position:"relative", zIndex:10, display:"flex", alignItems:"center", gap:9, padding:"7px 18px", background:"rgba(0,0,0,0.2)", borderBottom:"1px solid rgba(255,255,255,0.05)" },
  dot:         { width:7, height:7, borderRadius:"50%", flexShrink:0, transition:"all 0.4s", display:"inline-block" },
  statusText:  { fontSize:11.5, color:"rgba(255,255,255,0.4)", letterSpacing:0.2 },
  main:        { position:"relative", zIndex:10, maxWidth:500, margin:"0 auto", padding:"14px 14px 64px" },
  viewBox:     { position:"relative", width:"100%", aspectRatio:"4/3", borderRadius:22, overflow:"hidden", background:"#0a1520", border:"1px solid rgba(255,255,255,0.07)", marginBottom:12 },
  frame:       { width:"100%", height:"100%", objectFit:"cover" },
  flash:       { position:"absolute", inset:0, background:"rgba(255,255,255,0.88)", zIndex:30, animation:"flashOut 0.45s ease-out forwards" },
  corner:      { position:"absolute", width:22, height:22, borderTop:"2.5px solid #00e5ff", borderLeft:"2.5px solid #00e5ff", borderRadius:"4px 0 0 0", zIndex:8, display:"inline-block" },
  scanLine:    { position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg, transparent, rgba(0,229,255,0.6), #00e5ff, rgba(0,229,255,0.6), transparent)", animation:"scanAnim 2.6s ease-in-out infinite", boxShadow:"0 0 16px rgba(0,229,255,0.5)", zIndex:8 },
  loadOverlay: { position:"absolute", inset:0, background:"rgba(6,12,22,0.82)", backdropFilter:"blur(6px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:20 },
  spinner:     { width:48, height:48, border:"3px solid rgba(255,255,255,0.07)", borderTop:"3px solid #00e5ff", borderRadius:"50%", animation:"spin 0.75s linear infinite" },
  row:         { display:"flex", gap:10 },
  btnPrimary:  { flex:1, padding:"14px 18px", background:"linear-gradient(135deg,#16a34a,#00e5ff)", border:"none", borderRadius:14, color:"#000", fontWeight:700, fontSize:14.5, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:"inherit", boxShadow:"0 4px 22px rgba(0,229,255,0.22)", transition:"opacity 0.2s" },
  btnSecondary:{ flex:1, padding:"14px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, color:"#fff", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" },
  btnDanger:   { flex:1, padding:"14px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.28)", borderRadius:14, color:"#f87171", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" },
  errorCard:   { background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)", borderRadius:14, padding:"13px 16px", fontSize:13, color:"#fca5a5", display:"flex", gap:10, alignItems:"flex-start", marginBottom:12, animation:"fadeUp 0.35s ease" },
  resultCard:  { background:"rgba(255,255,255,0.035)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:22, padding:20, animation:"fadeUp 0.5s ease", marginBottom:12 },
  resultHeader:{ display:"flex", alignItems:"flex-start", gap:16, marginBottom:20 },
  fruitName:   { fontFamily:"'Syne',sans-serif", fontSize:27, fontWeight:900, letterSpacing:"-0.5px", lineHeight:1.1 },
  rings:       { display:"flex", justifyContent:"space-around", marginBottom:20 },
  predsTitle:  { fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.28)", letterSpacing:2.5, textTransform:"uppercase", marginBottom:11 },
  repeatBtn:   { width:"100%", marginTop:14, padding:"12px", background:"rgba(0,229,255,0.07)", border:"1px solid rgba(0,229,255,0.18)", borderRadius:13, color:"#00e5ff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"background 0.2s" },
};

// ─── Global CSS ───────────────────────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style>{[
      "* { box-sizing: border-box; margin: 0; padding: 0; }",
      "body { background: #060c16; }",
      "button:disabled { opacity: 0.45; cursor: not-allowed; }",
      "button:hover:not(:disabled) { filter: brightness(1.12); }",
      "@keyframes scanAnim { 0% { top: 8%; } 50% { top: 88%; } 100% { top: 8%; } }",
      "@keyframes spin { to { transform: rotate(360deg); } }",
      "@keyframes flashOut { 0% { opacity: 0.88; } 100% { opacity: 0; } }",
      "@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }",
      "@keyframes micRing { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.4); opacity: 0; } }",
    ].join(" ")}</style>
  );
}