/* Variant C — Gamified White
   Soft white surfaces, animated progress rings, badges, XP bars,
   hexagonal radar, milestone confetti. */

function VariantCv2({tweaks, initialScreen}){
  const tw = tweaks || {mood:'cool',frost:'frosted',fun:'balanced'};
  const [s, setS] = React.useState(initialScreen || 'home');
  const [picked, setPicked] = React.useState('p3');
  const [aiOpen, setAiOpen] = React.useState(false);
  const proj = window.NEO.projects.find(p=>p.id===picked) || window.NEO.projects[0];
  const Tab = ({k,emo,label})=>(
    <button onClick={()=>setS(k)} style={{
      display:'flex',alignItems:'center',gap:5,padding:'6px 11px',border:0,borderRadius:99,fontSize:11,fontFamily:'inherit',whiteSpace:'nowrap',
      background:s===k?'#0a0a0a':'#fff',color:s===k?'#fff':'#6b6b6b',cursor:'pointer',
      boxShadow:s===k?'0 2px 12px rgba(10,10,10,.18)':'0 1px 0 #f1f1f1',fontWeight:s===k?600:500
    }}><span style={{fontSize:12}}>{emo}</span>{label}</button>
  );
  const Tab2 = Tab;
  return (
    <div className="ab mesh-blue" data-c-mood={tw.mood} data-c-frost={tw.frost} data-c-fun={tw.fun} style={{fontFamily:"'Noto Sans JP',system-ui,sans-serif"}}>
      <header className="glass-strong" style={{padding:'18px 28px 14px',display:'flex',alignItems:'center',gap:14,borderBottom:'1px solid rgba(255,255,255,.6)',borderRadius:0,position:'relative',zIndex:3}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:32,height:32,borderRadius:10,background:'conic-gradient(from 210deg,var(--c-accent),#0a0a0a,var(--c-accent))',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:14,boxShadow:'0 4px 12px rgba(225,29,72,.25)'}}>N</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,letterSpacing:'-.02em'}}>NEO PM</div>
            <div style={{fontSize:10,color:'#9a9a9a'}}>Project Companion</div>
          </div>
        </div>
        <div style={{display:'flex',gap:4,marginLeft:14,flexWrap:'wrap',rowGap:4}}>
          <Tab k="home" emo="🏆" label="ランキング"/>
          <Tab k="dash" emo="🚀" label="ダッシュ"/>
          <Tab k="plan" emo="🎯" label="実行計画"/>
          <Tab k="wbs"  emo="📋" label="WBS"/>
          <Tab k="budget" emo="💴" label="収支"/>
          <Tab k="diag" emo="🔍" label="診断"/>
          <Tab k="fund" emo="📨" label="基金申請"/>
          <Tab k="ai"   emo="✨" label="AI伴走"/>
          <Tab k="theme" emo="📣" label="テーマ出題"/>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div data-c-fun="playful" style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:99,background:'#fff4d6',border:'1px solid #f0e2a8'}}>
            <span style={{fontSize:14}}>🔥</span>
            <span style={{fontWeight:700,fontSize:12,color:'#7a5a00'}}>21 日連続</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--c-accent),var(--c-accent-deep))',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12}}>千</div>
            <div style={{fontSize:11}}><div style={{fontWeight:600}}>森本 千夏</div><div style={{color:'#9a9a9a',fontSize:9}}>Lv.7 · NEW LINE</div></div>
          </div>
        </div>
      </header>

      <div style={{height:'calc(100% - 74px)',overflow:'hidden',position:'relative'}}>
        {s==='home'   && <Cv2_Home setPicked={(id)=>{setPicked(id);setS('dash')}}/>}
        {s==='dash'   && <Cv2_Dash proj={proj}/>}
        {s==='plan'   && <Cv2_Plan proj={proj}/>}
        {s==='wbs'    && <Cv2_Wbs proj={proj}/>}
        {s==='budget' && <Cv2_Budget proj={proj}/>}
        {s==='diag'   && <Cv2_Diag proj={proj}/>}
        {s==='fund'   && <Cv2_Fund proj={proj}/>}
        {s==='ai'     && <Cv2_AI proj={proj}/>}
        {s==='theme'  && <Cv2_Theme/>}

        {/* Floating AI companion — present on every screen */}
        <button onClick={()=>setAiOpen(v=>!v)} aria-label="AI伴走者を開く" style={{
          position:'absolute',right:22,bottom:22,width:60,height:60,borderRadius:'50%',
          border:'2px solid rgba(255,255,255,.85)',cursor:'pointer',zIndex:30,padding:0,
          background:'linear-gradient(160deg,#1a2540 0%,var(--c-accent-deep) 60%,var(--c-accent) 100%)',color:'#fff',
          boxShadow:'0 14px 36px -8px rgba(40,80,180,.55), 0 0 0 6px rgba(91,141,239,.12), inset 0 1px 0 rgba(255,255,255,.35)',
          display:'flex',alignItems:'center',justifyContent:'center'
        }}>
          <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:26,lineHeight:1,animation:'sparkle 3s ease-in-out infinite'}} data-c-fun="sparkle">✦</div>
            {!aiOpen && (
              <span style={{position:'absolute',top:-8,right:-12,minWidth:18,height:18,padding:'0 4px',borderRadius:99,background:'#fff',color:'var(--c-accent-deep)',fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 10px rgba(40,80,180,.4)'}}>3</span>
            )}
          </div>
        </button>
        {!aiOpen && (
          <div data-c-fun="playful" className="glass-dark" style={{position:'absolute',right:92,bottom:34,padding:'10px 14px 12px',borderRadius:'14px 14px 0 14px',fontSize:12,lineHeight:1.55,maxWidth:260,zIndex:29,animation:'risein .6s ease-out'}}>
            <div style={{fontSize:9,letterSpacing:'.15em',opacity:.7,marginBottom:3}}>NEO.ai · 伴走者</div>
            今週の <b style={{color:'var(--c-accent-bright)'}}>Why</b> を3分で整理しませんか？✨
            <div style={{position:'absolute',right:-8,bottom:0,width:0,height:0,borderLeft:'10px solid rgba(15,22,46,.92)',borderTop:'10px solid transparent',borderBottom:'4px solid transparent'}}/>
          </div>
        )}
        {aiOpen && <Cv2_FloatingAI proj={proj} onClose={()=>setAiOpen(false)} onOpenFull={()=>{setAiOpen(false); setS('ai');}}/>}
      </div>
    </div>
  );
}

// ─── Floating AI panel (compact overlay, shown anywhere via the bubble) ───
function Cv2_FloatingAI({proj, onClose, onOpenFull}){
  const [props_, setProps] = React.useState(window.NEO.proposals);
  const set = (id,k)=>setProps(props_.map(p=>p.id===id?{...p,status:k}:p));
  const pending = props_.filter(p=>p.status==='pending').length;
  return (
    <div className="glass-strong" style={{
      position:'absolute',right:22,bottom:96,width:420,maxHeight:'calc(100% - 130px)',
      borderRadius:18,display:'flex',flexDirection:'column',overflow:'hidden',zIndex:31,
      animation:'risein .28s ease-out'
    }}>
      {/* Header — character avatar */}
      <header className="glass-dark" style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:10,borderRadius:0,borderBottom:0}}>
        <div style={{position:'relative',width:38,height:38,flexShrink:0}}>
          <div style={{position:'absolute',inset:0,borderRadius:12,background:'conic-gradient(from 0deg,var(--c-accent),var(--c-accent-bright),var(--c-accent-deep),var(--c-accent))',padding:2,animation:'sparkle 3.4s ease-in-out infinite'}}>
            <div style={{width:'100%',height:'100%',borderRadius:10,background:'linear-gradient(160deg,#1a2540,#0e1428)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>✦</div>
          </div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13,letterSpacing:'-.01em'}}>NEO.ai · あなたの伴走者</div>
          <div style={{fontSize:10,opacity:.7,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{proj.name} · ホバーで提案、✓で反映</div>
        </div>
        <button onClick={onOpenFull} title="全画面で開く" style={{background:'rgba(255,255,255,.12)',color:'#fff',border:'1px solid rgba(255,255,255,.18)',borderRadius:8,padding:'4px 9px',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>⤢</button>
        <button onClick={onClose} title="閉じる" style={{background:'transparent',color:'#fff',border:0,fontSize:16,cursor:'pointer',padding:'4px 6px',marginLeft:2}}>✕</button>
      </header>

      {/* Chat */}
      <div style={{flex:1,overflowY:'auto',padding:'14px 14px 4px',background:'transparent'}}>
        {[
          {who:'ai',  body:'こんにちは、千夏さん！🌱 計画を見ていたら、Why に複数の課題が混ざっているように見えました。一番大事にしたいのは、誰のどんな課題？'},
          {who:'you', body:'通学路で疲れている高校生。塾と部活で帰りが遅い子。'},
          {who:'ai',  body:'いいね。"地域の交通弱者の通学" にギュッと絞る案、出します。WBSの重複もまとめて整理しちゃいます 📝'},
        ].map((m,i)=>(
          <div key={i} style={{display:'flex',gap:8,marginBottom:10,flexDirection:m.who==='you'?'row-reverse':'row',alignItems:'flex-end'}}>
            {m.who==='ai' && <div style={{width:24,height:24,borderRadius:8,background:'linear-gradient(160deg,#1a2540,var(--c-accent-deep))',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>✦</div>}
            <div style={{
              maxWidth:'78%',padding:'8px 12px',fontSize:12,lineHeight:1.55,
              background:m.who==='ai'?'rgba(255,255,255,.82)':'#0a0a0a',
              color:m.who==='ai'?'#0a0a0a':'#fff',
              border:m.who==='ai'?'1px solid rgba(150,170,200,.25)':'1px solid #0a0a0a',
              borderRadius:m.who==='ai'?'12px 12px 12px 4px':'12px 12px 4px 12px',
              boxShadow:m.who==='ai'?'0 1px 0 rgba(255,255,255,.9) inset':'none'
            }}>{m.body}</div>
            {m.who==='you' && <div style={{width:24,height:24,borderRadius:8,background:'linear-gradient(135deg,var(--c-accent),var(--c-accent-deep))',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>千</div>}
          </div>
        ))}

        {/* Proposal cards */}
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'10px 2px 6px'}}>
          <span style={{fontSize:9,letterSpacing:'.18em',color:'#6b7a92',fontWeight:700}}>💡 提案カード</span>
          <span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--c-accent)',color:'#fff',fontWeight:700}}>{pending}</span>
          <div style={{flex:1}}/>
          <button style={{background:'transparent',border:0,fontSize:10,color:'var(--c-accent-deep)',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>✓ すべて承認</button>
        </div>
        {props_.map(p=>(
          <div key={p.id} style={{
            background:p.status==='approved'?'rgba(208,240,224,.55)':'rgba(255,255,255,.78)',
            backdropFilter:'blur(14px) saturate(1.3)',WebkitBackdropFilter:'blur(14px) saturate(1.3)',
            border:'1px solid '+(p.status==='approved'?'rgba(10,135,84,.35)':'rgba(150,170,200,.3)'),
            borderRadius:12,padding:'10px 12px',marginBottom:6,opacity:p.status==='rejected'?.4:1,
            boxShadow:'0 1px 0 rgba(255,255,255,.9) inset'
          }}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
              <span style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:'#0a0a0a',color:'#fff',fontWeight:700,letterSpacing:'.05em'}}>{p.kind}</span>
              {p.status==='approved' && <span style={{fontSize:9,color:'#0a8754',fontWeight:700}}>✓ 反映済み</span>}
              <div style={{flex:1}}/>
              <span style={{fontSize:9,color:'#9aa4bb'}}>2分前</span>
            </div>
            <div style={{fontSize:11,lineHeight:1.55,marginBottom:p.status==='pending'?8:0,color:'#1a2540'}}>{p.summary}</div>
            {p.status==='pending' && (
              <div style={{display:'flex',gap:5}}>
                <button onClick={()=>set(p.id,'approved')} style={{background:'#0a0a0a',color:'#fff',border:0,borderRadius:6,padding:'5px 12px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>✓ 承認</button>
                <button onClick={()=>set(p.id,'rejected')} style={{background:'rgba(255,255,255,.7)',color:'#3c4760',border:'1px solid rgba(150,170,200,.4)',borderRadius:6,padding:'5px 12px',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>却下</button>
                <button style={{background:'rgba(255,255,255,.7)',color:'#3c4760',border:'1px solid rgba(150,170,200,.4)',borderRadius:6,padding:'5px 10px',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>↻ 別案</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Composer */}
      <div style={{padding:'10px 12px',borderTop:'1px solid rgba(150,170,200,.25)',background:'rgba(255,255,255,.55)',display:'flex',gap:6,alignItems:'center'}}>
        <input placeholder="気づき・質問を入力…" style={{flex:1,border:'1px solid rgba(150,170,200,.35)',borderRadius:8,padding:'7px 10px',fontSize:11,fontFamily:'inherit',outline:'none',background:'rgba(255,255,255,.85)'}}/>
        <button style={{background:'#0a0a0a',color:'#fff',border:0,borderRadius:8,padding:'7px 12px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>送信</button>
      </div>
    </div>
  );
}

// Progress ring
function RingV2({size=72,stroke=7,value=0,color='#0a0a0a',track='#f1f1f1',label}){
  const r = (size-stroke)/2;
  const c = 2*Math.PI*r;
  return (
    <div style={{position:'relative',width:size,height:size,display:'inline-block'}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-value/100)} style={{transition:'stroke-dashoffset .6s ease'}}/>
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontFamily:'JetBrains Mono,monospace',fontWeight:700,fontSize:size/4,letterSpacing:'-.04em'}}>{value}</div>
        {label && <div style={{fontSize:size/9,color:'#9a9a9a'}}>{label}</div>}
      </div>
    </div>
  );
}

function Cv2_Home({setPicked}){
  // Sort active by progress, then synthesize a few non-ranked (paused/completed/archived) entries
  // to show what happens to projects outside the ranking.
  const active = [...window.NEO.projects].sort((a,b)=>b.progress-a.progress);
  const offline = [
    { id:'pp1', name:'部活マネジメント支援アプリ',     team:'青チャ',     state:'paused',    note:'リーダー受験のため 2/末まで一時休止' },
    { id:'pc1', name:'高校生×離島留学 PR キャラバン',   team:'OCEAN',      state:'completed', note:'2025/12 完了 · 振り返り提出済み' },
    { id:'pc2', name:'天神イルミ × 学生写真展',        team:'HIKARI',     state:'completed', note:'2025/11 完了 · 採択再申請中' },
    { id:'pa1', name:'制服リユース・マーケット',         team:'RE:制服',    state:'archived',  note:'2024 開催 · アーカイブ' },
  ];
  const stateMeta = {
    active   : { label:'進行中',  color:'var(--c-accent)', dotBg:'var(--c-accent)' },
    paused   : { label:'休止中',  color:'#b8860b', dotBg:'#b8860b' },
    completed: { label:'完了',    color:'#0a8754', dotBg:'#0a8754' },
    archived : { label:'アーカイブ', color:'#9a9a9a', dotBg:'#9a9a9a' },
  };
  const cardGlass = {
    background:'rgba(255,255,255,.7)',
    backdropFilter:'blur(22px) saturate(1.4)',
    WebkitBackdropFilter:'blur(22px) saturate(1.4)',
    border:'1px solid rgba(255,255,255,.85)',
    boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',
  };

  return (
    <div style={{height:'100%',overflow:'auto',padding:'22px 28px 28px'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:14}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,letterSpacing:'-.02em'}}>🏆 プロジェクト進捗</h2>
        <span style={{fontSize:11,color:'#6b7a92'}}>進行中 {active.length} ・ 休止 1 ・ 完了 2 ・ アーカイブ 1</span>
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:4,padding:3,borderRadius:99,...cardGlass}}>
          {['進行中','休止','完了','すべて'].map((x,i)=>(
            <button key={x} style={{border:0,background:i===0?'#0a0a0a':'transparent',color:i===0?'#fff':'#3c4760',padding:'4px 12px',borderRadius:99,fontSize:11,fontFamily:'inherit',cursor:'pointer',fontWeight:i===0?700:500}}>{x}</button>
          ))}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1.7fr 1fr',gap:18}}>
        <div>
          {/* Active projects — uniform glass cards, top-3 marked with medal inline */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {active.map((p,i)=>{
              const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':null;
              const rankColor = i===0?'var(--c-accent)':'#0a0a0a';
              return (
                <div key={p.id} onClick={()=>setPicked(p.id)} style={{...cardGlass,borderRadius:14,padding:'14px 16px',cursor:'pointer',display:'flex',gap:14,alignItems:'center',position:'relative'}}>
                  <div style={{position:'relative',flexShrink:0}}>
                    <RingV2 size={56} stroke={6} value={p.progress} color={rankColor}/>
                    {medal && <div data-c-fun="playful" style={{position:'absolute',top:-4,right:-4,width:22,height:22,borderRadius:'50%',background:'#fff',border:'1px solid rgba(255,255,255,.9)',boxShadow:'0 4px 10px rgba(40,70,140,.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>{medal}</div>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                      <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:'#9aa4bb',fontWeight:600}}>#{i+1}</span>
                      <span style={{fontSize:10,color:'#6b7a92'}}>{p.team}</span>
                      {p.badges[0] && <span style={{fontSize:9,padding:'1px 6px',background:'var(--c-accent-soft)',color:'var(--c-accent-deep)',borderRadius:99,fontWeight:700,marginLeft:'auto'}}>🎖 {p.badges[0]}</span>}
                    </div>
                    <div style={{fontWeight:700,fontSize:13,lineHeight:1.35,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginBottom:5}}>{p.name}</div>
                    <div style={{display:'flex',alignItems:'center',gap:8,fontSize:10,color:'#6b7a92'}}>
                      <span>🔥 {p.streak}</span>
                      <span>✓ {p.tasks.done}/{p.tasks.total}</span>
                      <span style={{marginLeft:'auto',color:'#9aa4bb'}}>次：{p.milestone}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Library — non-active projects */}
          <div style={{marginTop:18}}>
            <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:8}}>
              <h3 style={{margin:0,fontSize:13,fontWeight:700}}>📚 プロジェクトライブラリ</h3>
              <span style={{fontSize:10,color:'#9aa4bb'}}>休止中・完了済み・アーカイブから、いつでも続きを始められます</span>
            </div>
            <div style={{...cardGlass,borderRadius:12,overflow:'hidden'}}>
              {offline.map((p,i)=>{
                const m = stateMeta[p.state];
                return (
                  <div key={p.id} style={{display:'grid',gridTemplateColumns:'10px 1fr 90px 110px',gap:12,padding:'10px 14px',borderBottom:i<offline.length-1?'1px solid rgba(150,170,200,.18)':0,alignItems:'center',fontSize:12}}>
                    <span style={{width:7,height:7,borderRadius:'50%',background:m.dotBg,opacity:p.state==='archived'?.4:1}}/>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:p.state==='archived'?'#6b7a92':'#0a0a0a'}}>{p.name}</div>
                      <div style={{fontSize:10,color:'#9aa4bb',marginTop:2}}>{p.team} · {p.note}</div>
                    </div>
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:m.color+'18',color:m.color,fontWeight:700,textAlign:'center',justifySelf:'start'}}>● {m.label}</span>
                    <div style={{display:'flex',gap:5,justifyContent:'flex-end'}}>
                      {p.state==='paused'     && <button style={miniBtn}>▶ 再開</button>}
                      {p.state==='completed'  && <button style={miniBtn}>📋 振り返り</button>}
                      {p.state==='archived'   && <button style={miniBtnGhost}>↻ 復元</button>}
                      <button style={miniBtnGhost}>···</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{...cardGlass,borderRadius:14,padding:18}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10,display:'flex',alignItems:'center',gap:6}}>📋 テーマ出題のポイント<span style={{fontSize:10,color:'#9aa4bb',fontWeight:400}}>· ホバーで解説</span></div>
            {[
              ['①','地域のためのテーマ','自社利益だけが目的ではない'],
              ['②','既存サービスは「手段」','「目的」ではなく課題解決の道具'],
              ['③','若者の当事者性','関われる余地があること'],
            ].map(([n,t,d])=>(
              <div key={n} title={d} style={{display:'grid',gridTemplateColumns:'28px 1fr',gap:10,padding:'8px 0',borderBottom:'1px dashed rgba(150,170,200,.25)',cursor:'help'}}>
                <div style={{width:24,height:24,borderRadius:'50%',background:'#0a0a0a',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11}}>{n}</div>
                <div>
                  <div style={{fontWeight:600,fontSize:12}}>{t}</div>
                  <div style={{fontSize:10,color:'#9aa4bb',marginTop:2}}>{d}</div>
                </div>
              </div>
            ))}
          </div>
          <div data-c-fun="playful" className="glass-dark" style={{borderRadius:14,padding:18,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-20,right:-20,width:120,height:120,borderRadius:'50%',background:'radial-gradient(circle,rgba(91,141,239,.5),transparent 70%)',pointerEvents:'none'}}/>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,position:'relative'}}>
              <span style={{fontSize:16}}>✨</span>
              <span style={{fontWeight:700,fontSize:13}}>今週のクエスト</span>
            </div>
            <div style={{fontSize:12,lineHeight:1.6,opacity:.85,marginBottom:12,position:'relative'}}>「現場に行った気づき」を3回投稿すると、<b style={{color:'var(--c-accent-bright)'}}>"現場主義"</b> バッジが咲きます。</div>
            <div style={{display:'flex',gap:4,marginBottom:8,position:'relative'}}>
              {[1,1,0].map((d,i)=><div key={i} style={{flex:1,height:6,borderRadius:3,background:d?'var(--c-accent)':'rgba(255,255,255,.18)'}}/>)}
            </div>
            <div style={{fontSize:10,opacity:.7,position:'relative'}}>進捗 2/3 · 残り 4日</div>
          </div>
        </div>
      </div>
    </div>
  );
}
const miniBtn      = {border:0,background:'#0a0a0a',color:'#fff',padding:'4px 9px',borderRadius:6,fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:'inherit'};
const miniBtnGhost = {border:'1px solid rgba(150,170,200,.35)',background:'rgba(255,255,255,.6)',color:'#3c4760',padding:'4px 9px',borderRadius:6,fontSize:10,cursor:'pointer',fontFamily:'inherit'};

function Cv2_Dash({proj}){
  const [confetti, setConfetti] = React.useState(false);
  React.useEffect(()=>{ setConfetti(true); const t=setTimeout(()=>setConfetti(false),1600); return ()=>clearTimeout(t); },[proj.id]);
  return (
    <div style={{height:'100%',overflow:'auto',padding:'22px 28px 28px',position:'relative'}}>
      {confetti && (
        <div data-c-fun="playful" style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>
          {Array.from({length:24}).map((_,i)=>(
            <span key={i} style={{position:'absolute',top:0,left:(i*4.2)+'%',width:6,height:10,background:['var(--c-accent)','#0a0a0a','#b8860b','#0a8754'][i%4],animation:`confetti 1.4s ${(i*40)}ms ease-out forwards`,borderRadius:1}}/>
          ))}
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
        <div style={{width:48,height:48,borderRadius:14,background:'#0a0a0a',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:20,letterSpacing:'-.04em'}}>{proj.name.slice(0,2)}</div>
        <div>
          <div style={{fontSize:11,color:'#9a9a9a',letterSpacing:'.05em'}}>{proj.team} · Lv.7 ・ {proj.members}名</div>
          <h2 style={{margin:'2px 0 0',fontSize:22,fontWeight:800,letterSpacing:'-.02em'}}>{proj.name}</h2>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:6}}>
          {proj.badges.map(b=>(
            <div key={b} style={{padding:'4px 10px',background:'var(--c-accent-soft)',color:'var(--c-accent)',borderRadius:99,fontSize:10,fontWeight:700,animation:'badgePop .6s ease-out'}}>🎖 {b}</div>
          ))}
        </div>
      </div>

      {/* Stats with rings */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          ['全体進捗',proj.progress,'var(--c-accent)','78% で マイルストーン解放', 'すごい!'],
          ['タスク',Math.round(proj.tasks.done/proj.tasks.total*100),'#0a0a0a',proj.tasks.done+'/'+proj.tasks.total+' タスク', '快調'],
          ['NEO診断',76,'#b8860b','+8 先週比', 'Lv.UP間近'],
          ['チームXP',62,'#0a8754','3,720 / 6,000 pt', '次レベル'],
        ].map(([l,v,c,sub,tag],i)=>(
          <div key={i} style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:14,padding:14,display:'flex',alignItems:'center',gap:14,boxShadow:'0 1px 0 #eef2fa'}}>
            <RingV2 size={66} value={v} color={c}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:'#9a9a9a'}}>{l}</div>
              <div style={{fontWeight:700,fontSize:13,marginTop:3}}>{sub}</div>
              <div style={{marginTop:4,display:'inline-block',padding:'2px 8px',background:c+'18',color:c,borderRadius:99,fontSize:9,fontWeight:700,letterSpacing:'.05em'}}>{tag}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:18}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:700}}>🏁 マイルストーン</h3>
            <span style={{fontSize:10,padding:'2px 7px',background:'var(--c-accent-soft)',color:'var(--c-accent)',borderRadius:99,fontWeight:700}}>3 / 6 達成</span>
            <div style={{flex:1}}/>
            <span style={{fontSize:11,color:'#9a9a9a'}}>スケジュール →</span>
          </div>
          <div style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:14,padding:'18px 20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',position:'relative'}}>
              <div style={{position:'absolute',top:14,left:14,right:14,height:3,background:'#f1f1f1',borderRadius:2,zIndex:0}}/>
              <div style={{position:'absolute',top:14,left:14,width:'52%',height:3,background:'linear-gradient(90deg,#0a0a0a,var(--c-accent))',borderRadius:2,zIndex:1}}/>
              {window.NEO.milestones.map(m=>(
                <div key={m.id} style={{flex:1,textAlign:'center',position:'relative',zIndex:2}}>
                  <div style={{width:m.current?32:28,height:m.current?32:28,borderRadius:'50%',background:m.done?'#0a0a0a':m.current?'var(--c-accent)':'#fff',color:m.done||m.current?'#fff':'#9a9a9a',border:'2px solid '+(m.done?'#0a0a0a':m.current?'var(--c-accent)':'#e8e8e8'),margin:'0 auto 8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,boxShadow:m.current?'0 0 0 6px var(--c-accent-soft)':'none'}}>
                    {m.done?'✓':m.current?'★':''}
                  </div>
                  <div style={{fontSize:10,color:'#9a9a9a'}}>{m.date.slice(5)}</div>
                  <div style={{fontSize:10,fontWeight:m.current?700:500,marginTop:2,color:m.current?'var(--c-accent)':m.done?'#0a0a0a':'#6b6b6b',lineHeight:1.3,padding:'0 4px'}}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:8,margin:'18px 0 10px'}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:700}}>📋 進行中のタスク</h3>
            <span style={{fontSize:10,color:'#9a9a9a'}}>+5 完了でレベルアップ</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {window.NEO.tasks.map(t=>(
              <div key={t.id} style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:10,padding:'10px 14px',display:'grid',gridTemplateColumns:'18px 1fr 50px 60px 70px',gap:10,alignItems:'center',fontSize:12,opacity:t.status==='done'?.5:1}}>
                <span style={{width:14,height:14,borderRadius:'50%',border:'2px solid '+(t.status==='done'?'#0a8754':t.status==='review'?'#b8860b':t.status==='doing'?'var(--c-accent)':'#9a9a9a'),background:t.status==='done'?'#0a8754':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>{t.status==='done'&&<span style={{color:'#fff',fontSize:9}}>✓</span>}</span>
                <span style={{fontWeight:600,textDecoration:t.status==='done'?'line-through':'none'}}>{t.title}</span>
                <span style={{fontSize:10,color:'#9a9a9a'}}>{t.owner}</span>
                <span style={{fontSize:10,fontFamily:'JetBrains Mono,monospace',color:'#9a9a9a'}}>{t.due}</span>
                <span style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:'#eef2fa',color:'#6b6b6b',fontWeight:600,textAlign:'center'}}>{t.tag}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{margin:'0 0 10px',fontSize:14,fontWeight:700}}>🎖️ バッジコレクション</h3>
          <div style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:14,padding:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
            {window.NEO.badges.map(b=>(
              <div key={b.k} style={{textAlign:'center',padding:'12px 8px',background:'linear-gradient(180deg,#fff,#f5f8ff)',border:'1px solid #f1f1f1',borderRadius:12,position:'relative'}}>
                <div style={{width:42,height:42,margin:'0 auto 8px',borderRadius:'50%',background:'conic-gradient(from 0deg,#0a0a0a,var(--c-accent),#0a0a0a)',padding:3,position:'relative'}}>
                  <div style={{width:'100%',height:'100%',borderRadius:'50%',background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Noto Serif JP',serif",fontSize:18,fontWeight:800}}>{b.icon}</div>
                </div>
                <div style={{fontWeight:700,fontSize:11}}>{b.k}</div>
                <div style={{fontSize:9,color:'#9a9a9a',marginTop:2}}>{b.sub}</div>
              </div>
            ))}
            {/* Locked */}
            {['??','??'].map((b,i)=>(
              <div key={i} style={{textAlign:'center',padding:'12px 8px',background:'#f5f8ff',border:'1px dashed #e8e8e8',borderRadius:12,opacity:.6}}>
                <div style={{width:42,height:42,margin:'0 auto 8px',borderRadius:'50%',background:'#f1f1f1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'#9a9a9a'}}>🔒</div>
                <div style={{fontWeight:700,fontSize:11,color:'#9a9a9a'}}>?????</div>
                <div style={{fontSize:9,color:'#9a9a9a',marginTop:2}}>未解放</div>
              </div>
            ))}
          </div>

          <h3 style={{margin:'0 0 10px',fontSize:14,fontWeight:700}}>📅 直近イベント</h3>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {window.NEO.events.map((e,i)=>(
              <div key={i} style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{textAlign:'center',minWidth:42}}>
                  <div style={{fontWeight:800,fontSize:15,letterSpacing:'-.04em'}}>{e.d}</div>
                  <div style={{fontSize:9,color:'#9a9a9a'}}>{e.t}</div>
                </div>
                <div style={{flex:1,fontSize:12}}>{e.label}</div>
                <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,fontWeight:700,background:e.kind==='本番'?'var(--c-accent)':e.kind==='公式'?'#0a0a0a':'#eef2fa',color:e.kind==='本番'||e.kind==='公式'?'#fff':'#6b6b6b'}}>{e.kind}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Hexagonal radar
function HexRadarV2({data,size=320}){
  const cx=size/2,cy=size/2;
  const N = data.length;
  const max = 3;
  const layers = [1,2,3];
  const angle = (i)=> -Math.PI/2 + (i*2*Math.PI/N);
  const pt = (i,v)=>{ const r = (v/max)*(size*0.38); return [cx + r*Math.cos(angle(i)), cy + r*Math.sin(angle(i))]; };
  const poly = data.map((d,i)=>pt(i,d.v).join(',')).join(' ');
  return (
    <svg width={size} height={size} style={{display:'block'}}>
      {layers.map((L,li)=>(
        <polygon key={L} points={data.map((_,i)=>pt(i,L).join(',')).join(' ')} fill="none" stroke="#e8e8e8" strokeWidth="1"/>
      ))}
      {data.map((_,i)=>{
        const [x,y] = pt(i,max);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#f1f1f1"/>;
      })}
      <polygon points={poly} fill="rgba(91,141,239,.12)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" style={{color:'var(--c-accent)'}}/>
      {data.map((d,i)=>{ const [x,y]=pt(i,d.v); return <circle key={i} cx={x} cy={y} r="4" fill="#0a0a0a" stroke="#fff" strokeWidth="2"/>; })}
      {data.map((d,i)=>{
        const [x,y]=pt(i,max+0.4);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="600" fill="#0a0a0a" fontFamily="Noto Sans JP">{d.k}</text>;
      })}
    </svg>
  );
}

function Cv2_Plan({proj}){
  const cards = [
    { k:'Why',  emo:'🔥', body:'地域の交通弱者の通学を、若者の手で“移動以上の体験”に変える。', score:88 },
    { k:'Who',  emo:'👥', body:'糸島市・福岡市西部の高校生（特に部活終了後の保護者送迎依存層）。', score:74 },
    { k:'What', emo:'💎', body:'通学路を「学びと出会いのトレイル」に。歩く・乗る・寄り道。', score:82 },
    { k:'How',  emo:'⚙️', body:'西鉄バス × 地域商店 × 部活OB会の三者連携。', score:60 },
  ];
  const p4 = [
    ['Product',  '🛍','制服のまま立ち寄れる「30分滞在スポット」× AI キュレーション'],
    ['Price',    '💴','基本無料／高校生スタンプで割引・特典開放'],
    ['Place',    '📍','西鉄バス停半径 200m × 地域協賛店 30 舗'],
    ['Promotion','📢','高校生インスタ → 保護者 LINE → 学校公式の三層導線'],
  ];
  const kpis = [['延べ参加','200名',62],['寄り道稼働率','70%',55],['継続率','40%',38]];
  return (
    <div style={{height:'100%',overflow:'auto',padding:'22px 28px 28px'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,letterSpacing:'-.02em'}}>🎯 実行計画 — Why / Who / What / How</h2>
        <span style={{fontSize:11,color:'#6b7a92'}}>{proj.name}</span>
        <div style={{flex:1}}/>
        <span style={{fontSize:11,color:'#0a8754',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#0a8754'}}/>自動保存</span>
        <button style={{...C2X_btn}}>💾 一括保存</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:18}}>
        <div>
          {cards.map(c=>(
            <div key={c.k} style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:14,padding:'14px 16px',marginBottom:10,display:'grid',gridTemplateColumns:'56px 1fr 70px',gap:14,alignItems:'center'}}>
              <div style={{width:48,height:48,borderRadius:14,background:'#0a0a0a',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14}}>{c.k}</div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <span style={{fontSize:16}}>{c.emo}</span>
                  <span style={{fontSize:11,color:'#9a9a9a'}}>{window.NEO.framework[c.k].title}</span>
                  <span title={window.NEO.framework[c.k].tip} style={{fontSize:9,padding:'1px 6px',borderRadius:99,background:'#f5f8ff',border:'1px solid #f1f1f1',color:'#6b6b6b',cursor:'help'}}>?</span>
                </div>
                <div style={{fontSize:13,lineHeight:1.55}}>{c.body}</div>
              </div>
              <div style={{textAlign:'center'}}>
                <RingV2 size={48} value={c.score} color={c.score>80?'#0a8754':c.score>65?'#b8860b':'var(--c-accent)'} stroke={5}/>
                <div style={{fontSize:9,color:'#9a9a9a',marginTop:3}}>AI評価</div>
              </div>
            </div>
          ))}

          <div className="glass-dark" style={{borderRadius:14,padding:16,marginTop:8,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-30,right:-30,width:120,height:120,borderRadius:'50%',background:'radial-gradient(circle,rgba(91,141,239,.5),transparent 70%)',pointerEvents:'none'}}/>
            <div style={{fontSize:11,letterSpacing:'.15em',opacity:.7,marginBottom:6,position:'relative'}}>✦ NEO.ai HINT</div>
            <div style={{fontSize:13,lineHeight:1.6,position:'relative'}}>How の解像度が低めです。「誰が・誰と・どのタイミングで」を具体化すると、AI評価が <b style={{color:'var(--c-accent-bright)'}}>+15</b> 上がります。</div>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:14,padding:18}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <h3 style={{margin:0,fontSize:14,fontWeight:800}}>📦 4P マーケティングミックス</h3>
              <span title="Product / Price / Place / Promotion" style={{fontSize:9,padding:'2px 6px',borderRadius:99,background:'#f5f8ff',color:'#6b6b6b',cursor:'help'}}>?</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {p4.map(([k,emo,v])=>(
                <div key={k} style={{padding:'10px 12px',background:'rgba(255,255,255,.5)',borderRadius:10}}>
                  <div style={{fontSize:11,fontWeight:700,marginBottom:3}}><span style={{fontSize:14,marginRight:6}}>{emo}</span>{k}</div>
                  <div style={{fontSize:11,color:'#3c4760',lineHeight:1.5}}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:14,padding:18}}>
            <h3 style={{margin:'0 0 10px',fontSize:14,fontWeight:800}}>🎯 目標</h3>
            <div style={{padding:'10px 12px',background:'rgba(255,255,255,.5)',borderRadius:10,marginBottom:10}}>
              <div style={{fontSize:10,color:'#6b7a92'}}>定性</div>
              <div style={{fontSize:12,lineHeight:1.65,marginTop:3}}>「通学時間が、未来の自分と出会う時間になった」と一人でも語ってもらう。</div>
            </div>
            <div style={{fontSize:10,color:'#6b7a92',marginBottom:6}}>定量 KPI</div>
            {kpis.map(([k,v,p])=>(
              <div key={k} style={{display:'grid',gridTemplateColumns:'90px 1fr 60px',gap:10,alignItems:'center',padding:'5px 0',fontSize:11}}>
                <span>{k}</span>
                <div style={{height:5,background:'rgba(150,170,200,.2)',borderRadius:3}}><div style={{height:'100%',width:p+'%',background:'var(--c-accent)',borderRadius:3}}/></div>
                <span style={{textAlign:'right',fontFamily:'JetBrains Mono,monospace',fontWeight:700}}>{v}</span>
              </div>
            ))}
            <div style={{marginTop:10,padding:'8px 10px',background:'rgba(255,255,255,.5)',borderRadius:10,fontSize:10,color:'#6b7a92',lineHeight:1.5}}>
              💡 詳細な進捗・週次評価は <b style={{color:'var(--c-accent-deep)'}}>🔍 診断</b> タブで確認できます。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cv2_AI({proj}){
  const [props_, setProps] = React.useState(window.NEO.proposals);
  const set = (id,k)=>setProps(props_.map(p=>p.id===id?{...p,status:k}:p));
  return (
    <div style={{height:'100%',display:'grid',gridTemplateColumns:'1.2fr 1fr',overflow:'hidden'}}>
      <div style={{padding:'20px 26px',display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          {/* AI character */}
          <div style={{position:'relative',width:48,height:48}}>
            <div style={{position:'absolute',inset:0,borderRadius:14,background:'conic-gradient(from 0deg,#0a0a0a,var(--c-accent),#0a0a0a)',padding:3,animation:'sparkle 3s ease-in-out infinite'}}>
              <div style={{width:'100%',height:'100%',borderRadius:11,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>✦</div>
            </div>
          </div>
          <div>
            <div style={{fontSize:18,fontWeight:800,letterSpacing:'-.02em'}}>あなたの伴走者 — NEO.ai</div>
            <div style={{fontSize:11,color:'#9a9a9a'}}>「一緒に考える」会話パートナー · {proj.name}</div>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'4px 4px',display:'flex',flexDirection:'column',gap:12}}>
          {[
            { who:'ai',  body:'こんにちは、千夏さん！今週もお疲れさま 🌱 計画を見ていたら、Why に複数の課題が混ざっているように見えました。一番大事にしたいのは、誰のどんな課題ですか？' },
            { who:'you', body:'通学路で疲れている高校生かな。塾と部活で帰りが遅い子たち。' },
            { who:'ai',  body:'素敵な答え。"地域の交通弱者の通学" にギュッと絞ると、Why の解像度が一気に上がりそうです。WBSの重複も整理する案を出しますね 📝' },
            { who:'you', body:'お願い！' },
            { who:'ai',  body:'4枚の提案カードを右に置きました。✓ を押すと、各画面にそのまま反映されます。', highlight:true },
          ].map((m,i)=>(
            <div key={i} style={{display:'flex',gap:10,flexDirection:m.who==='you'?'row-reverse':'row',alignItems:'flex-end'}}>
              {m.who==='ai' && (
                <div style={{width:30,height:30,borderRadius:10,background:'#fff',border:'1px solid #f1f1f1',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,boxShadow:'0 2px 8px rgba(0,0,0,.04)'}}>✦</div>
              )}
              <div style={{maxWidth:'78%',background:m.who==='ai'?'#fff':'#0a0a0a',color:m.who==='ai'?'#0a0a0a':'#fff',border:m.who==='ai'?'1px solid #f1f1f1':'1px solid #0a0a0a',borderRadius:m.who==='ai'?'14px 14px 14px 4px':'14px 14px 4px 14px',padding:'10px 14px',fontSize:13,lineHeight:1.6,boxShadow:m.who==='ai'?'0 2px 8px rgba(0,0,0,.04)':'none',position:'relative'}}>
                {m.body}
                {m.highlight && <div style={{position:'absolute',top:-6,right:-6,width:20,height:20,borderRadius:'50%',background:'var(--c-accent)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,animation:'sparkle 1.4s ease-in-out infinite'}}>4</div>}
              </div>
              {m.who==='you' && <div style={{width:30,height:30,borderRadius:10,background:'linear-gradient(135deg,var(--c-accent),var(--c-accent-deep))',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11}}>千</div>}
            </div>
          ))}
        </div>

        <div style={{marginTop:10,background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:14,padding:'10px 12px',display:'flex',gap:8,alignItems:'center'}}>
          <input placeholder="気づき・質問を書いてみよう…" style={{flex:1,border:0,outline:'none',fontSize:13,fontFamily:'inherit',background:'transparent'}}/>
          <button style={{background:'#0a0a0a',color:'#fff',border:0,borderRadius:10,padding:'8px 14px',fontSize:12,fontFamily:'inherit',fontWeight:600,cursor:'pointer'}}>送信</button>
        </div>
      </div>

      <div style={{borderLeft:'1px solid #f1f1f1',background:'#f5f8ff',padding:'20px 24px',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <h3 style={{margin:0,fontSize:14,fontWeight:800}}>💡 提案カード</h3>
          <span style={{fontSize:11,padding:'2px 8px',background:'var(--c-accent)',color:'#fff',borderRadius:99,fontWeight:700}}>{props_.filter(p=>p.status==='pending').length}</span>
          <div style={{flex:1}}/>
          <label style={{fontSize:11,color:'#6b6b6b',display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>AIに任せる
            <span style={{width:26,height:14,background:'#0a0a0a',borderRadius:99,position:'relative',display:'inline-block'}}><span style={{position:'absolute',right:1,top:1,width:12,height:12,background:'#fff',borderRadius:'50%'}}/></span>
          </label>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {props_.map(p=>(
            <div key={p.id} style={{background:'#fff',border:'1px solid '+(p.status==='approved'?'#d0f0e0':'#f1f1f1'),borderRadius:14,padding:'14px 16px',marginBottom:10,opacity:p.status==='rejected'?.4:1,boxShadow:'0 1px 0 #eef2fa',animation:'risein .35s ease-out'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:'#0a0a0a',color:'#fff',fontWeight:700,letterSpacing:'.05em'}}>{p.kind}</span>
                {p.status==='approved' && <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:'#0a8754',color:'#fff',fontWeight:700}}>✓ 反映済み</span>}
                <div style={{flex:1}}/>
                <span style={{fontSize:9,color:'#9a9a9a'}}>2分前</span>
              </div>
              <div style={{fontSize:13,lineHeight:1.55,marginBottom:p.status==='pending'?12:0}}>{p.summary}</div>
              {p.status==='pending' && (
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>set(p.id,'approved')} style={{flex:1,background:'#0a0a0a',color:'#fff',border:0,borderRadius:8,padding:'8px 0',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>✓ 承認</button>
                  <button onClick={()=>set(p.id,'rejected')} style={{background:'#fff',color:'#6b6b6b',border:'1px solid #e8e8e8',borderRadius:8,padding:'8px 14px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>却下</button>
                  <button style={{background:'#fff',color:'#6b6b6b',border:'1px solid #e8e8e8',borderRadius:8,padding:'8px 14px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>↻</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cv2_Theme(){
  const [picked,setPicked] = React.useState('t1');
  const t = window.NEO.themes.find(x=>x.id===picked);
  return (
    <div style={{height:'100%',overflow:'auto',padding:'22px 28px 28px'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:14}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:800,letterSpacing:'-.02em'}}>📣 出題テーマ</h2>
        <span style={{fontSize:11,color:'#9a9a9a'}}>地域の挑戦者を募るカードを作りましょう</span>
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:6}}>
          {[['公開中',3,'#0a8754'],['下書き',1,'#9a9a9a'],['終了',1,'#6b6b6b']].map(([l,n,c])=>(
            <span key={l} style={{padding:'4px 10px',borderRadius:99,background:'#fff',border:'1px solid #f1f1f1',fontSize:11}}>{l} <b style={{color:c}}>{n}</b></span>
          ))}
          <button style={{background:'#0a0a0a',color:'#fff',border:0,borderRadius:99,padding:'6px 14px',fontSize:11,fontFamily:'inherit',fontWeight:600,cursor:'pointer'}}>＋ 新規テーマ</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:18}}>
        {window.NEO.themes.slice(0,3).map(th=>(
          <div key={th.id} onClick={()=>setPicked(th.id)} style={{background:'#fff',border:'1px solid '+(picked===th.id?'#0a0a0a':'#f1f1f1'),borderRadius:14,padding:16,cursor:'pointer',position:'relative',transform:picked===th.id?'translateY(-2px)':'none',transition:'all .2s',boxShadow:picked===th.id?'0 8px 24px rgba(0,0,0,.08)':'0 1px 0 #eef2fa'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
              <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:'#9a9a9a'}}>{th.code}</span>
              <span style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:th.status==='open'?'var(--c-accent-soft)':'#eef2fa',color:th.status==='open'?'var(--c-accent)':'#6b6b6b',fontWeight:700}}>{th.status==='open'?'🟢 公開中':th.status==='draft'?'📝 下書き':'🚫 終了'}</span>
              <div style={{flex:1}}/>
              <span style={{fontSize:9,color:'#9a9a9a'}}>{th.tag}</span>
            </div>
            <div style={{fontSize:14,fontWeight:700,lineHeight:1.45,marginBottom:8}}>{th.title}</div>
            <div style={{fontSize:11,color:'#6b6b6b',marginBottom:10}}>主催 · {th.sponsor}</div>
            <div style={{display:'flex',gap:14,fontSize:11,color:'#9a9a9a'}}>
              <span>📅 {th.deadline}</span>
              <span>👥 {th.applicants}</span>
              <span>★ {th.picked}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:700}}>📝 テーマ詳細</h3>
            <span style={{fontSize:10,color:'#0a8754',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#0a8754'}}/>自動保存</span>
          </div>
          <div style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(22px) saturate(1.4)',WebkitBackdropFilter:'blur(22px) saturate(1.4)',border:'1px solid rgba(255,255,255,.85)',boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',borderRadius:14,padding:16}}>
            <div style={{fontSize:10,color:'#9a9a9a',marginBottom:4}}>タイトル</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>{t.title}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
              <div><div style={{fontSize:10,color:'#9a9a9a',marginBottom:4}}>主催企業</div><div style={{fontSize:13,fontWeight:600}}>{t.sponsor}</div></div>
              <div><div style={{fontSize:10,color:'#9a9a9a',marginBottom:4}}>カテゴリ</div><div style={{fontSize:13,fontWeight:600}}>{t.tag}</div></div>
              <div><div style={{fontSize:10,color:'#9a9a9a',marginBottom:4}}>応募締切</div><div style={{fontSize:13,fontWeight:600}}>{t.deadline}</div></div>
              <div><div style={{fontSize:10,color:'#9a9a9a',marginBottom:4}}>採択特典</div><div style={{fontSize:13,fontWeight:600}}>{t.prize}</div></div>
            </div>
            <div style={{padding:'10px 12px',background:'#f5f8ff',borderRadius:10,fontSize:11,color:'#6b6b6b',lineHeight:1.65}}>
              💡 <b>出題のチェック：</b>このテーマは「地域のため」「手段としての企業課題」「若者の当事者性」の3条件を満たしています。
            </div>
          </div>
        </div>

        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:700}}>🌐 公開プレビュー</h3>
            <span style={{fontSize:10,color:'#9a9a9a'}}>応募者の見え方</span>
          </div>
          <div style={{background:'linear-gradient(160deg,#1a2540,#0e1428)',color:'#fff',borderRadius:14,padding:'22px 22px 24px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-30,right:-30,width:140,height:140,borderRadius:'50%',background:'radial-gradient(circle,var(--c-accent) 0%,transparent 70%)',opacity:.35}}/>
            <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,opacity:.7,letterSpacing:'.2em'}}>{t.code} · NEO CHALLENGE</div>
            <div style={{fontSize:11,marginTop:8,opacity:.7}}>主催 {t.sponsor}</div>
            <div style={{fontSize:20,fontWeight:800,lineHeight:1.4,marginTop:8,letterSpacing:'-.02em',position:'relative'}}>{t.title}</div>
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <div style={{padding:'4px 10px',background:'rgba(255,255,255,.1)',borderRadius:99,fontSize:10,fontWeight:600}}>📅 締切 {t.deadline}</div>
              <div style={{padding:'4px 10px',background:'var(--c-accent)',borderRadius:99,fontSize:10,fontWeight:700}}>🏆 {t.prize}</div>
            </div>
            <button style={{marginTop:18,width:'100%',background:'#fff',color:'#0a0a0a',border:0,borderRadius:10,padding:'10px 0',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>同意して応募 →</button>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,opacity:.7,marginTop:10}}>
              <span>応募 {t.applicants} チーム</span>
              <span>採択 {t.picked} チーム</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.VariantCv2 = VariantCv2;
