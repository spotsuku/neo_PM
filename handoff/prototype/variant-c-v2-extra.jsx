/* C v2 — extra screens (loaded alongside variant-c-v2.jsx)
   Cv2_Wbs · Cv2_Budget · Cv2_Fund · Cv2_Diag
   All four use the same glass tokens as variant-c-v2.jsx.
*/

const C2X_glass = {
  background:'rgba(255,255,255,.7)',
  backdropFilter:'blur(22px) saturate(1.4)',
  WebkitBackdropFilter:'blur(22px) saturate(1.4)',
  border:'1px solid rgba(255,255,255,.85)',
  boxShadow:'0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18)',
};
const C2X_btn       = {border:0,background:'#0a0a0a',color:'#fff',padding:'5px 11px',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'};
const C2X_btnGhost  = {border:'1px solid rgba(150,170,200,.35)',background:'rgba(255,255,255,.6)',color:'#3c4760',padding:'5px 11px',borderRadius:8,fontSize:11,cursor:'pointer',fontFamily:'inherit'};

// ────────────────────────────────────────────────────────────────────────────
//   1. WBS / Gantt
// ────────────────────────────────────────────────────────────────────────────
function Cv2_Wbs({proj}){
  const groups = [
    { id:'g1', title:'1. 課題発見・リサーチ', owner:'美咲', start:0, span:8, pct:100, color:'#0a8754', children:[
      { id:'t1', title:'高校生インタビュー × 20名', owner:'美咲', start:0, span:5, pct:100 },
      { id:'t2', title:'通学路フィールドワーク', owner:'蓮',   start:3, span:4, pct:100 },
      { id:'t3', title:'インサイト整理 & 仮説立案', owner:'千夏', start:6, span:3, pct:100 },
    ]},
    { id:'g2', title:'2. プロトタイプ検証', owner:'千夏', start:7, span:8, pct:88, color:'var(--c-accent)', children:[
      { id:'t4', title:'バス停寄り道スポット試作', owner:'颯',   start:7, span:5, pct:100 },
      { id:'t5', title:'高校生10名 ユーザーテスト', owner:'結',   start:10, span:3, pct:100 },
      { id:'t6', title:'改善版 v2 設計', owner:'千夏', start:12, span:4, pct:60 },
    ]},
    { id:'g3', title:'3. 実証準備 — マッチデイ', owner:'蓮',   start:13, span:10, pct:52, color:'var(--c-accent)', current:true, children:[
      { id:'t7', title:'西鉄バス・地域商店 巻き込み', owner:'美咲', start:13, span:6, pct:78 },
      { id:'t8', title:'NEO基金 中間報告 提出', owner:'千夏', start:15, span:2, pct:100, milestone:true },
      { id:'t9', title:'当日運営マニュアル & リハ', owner:'結',   start:17, span:5, pct:30 },
      { id:'t10', title:'マッチデイ実証 @ 2/9', owner:'全員', start:21, span:1, pct:0, milestone:true },
    ]},
    { id:'g4', title:'4. 振り返り・次期構想', owner:'森本', start:21, span:6, pct:0, color:'#9aa4bb', children:[
      { id:'t11', title:'参加者 + パートナー インタビュー', owner:'美咲', start:22, span:3, pct:0 },
      { id:'t12', title:'完了報告 & 採択再申請', owner:'千夏', start:24, span:3, pct:0 },
    ]},
  ];
  const [open, setOpen] = React.useState({g1:false,g2:true,g3:true,g4:false});
  const weeks = 28;
  const weekW = 24;
  const todayCol = 16; // 1月第3週付近

  const Row = ({t,nested}) => {
    const left  = t.start * weekW;
    const width = Math.max(t.span * weekW, t.milestone? 14: weekW);
    const color = t.milestone? 'var(--c-accent)' : (nested? 'rgba(150,170,200,.5)':'var(--c-accent)');
    return (
      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',alignItems:'center',borderBottom:'1px solid rgba(150,170,200,.18)',minHeight:30,position:'relative'}}>
        <div style={{padding:'6px 12px 6px '+(nested?28:12)+'px',display:'flex',alignItems:'center',gap:8,fontSize:12}}>
          {!nested && (
            <button onClick={()=>setOpen({...open,[t.id]:!open[t.id]})} style={{background:'transparent',border:0,fontSize:10,color:'#6b7a92',width:14,padding:0,cursor:'pointer'}}>{open[t.id]?'▾':'▸'}</button>
          )}
          <span style={{fontWeight:nested?500:700,letterSpacing:'-.01em',color:nested?'#3c4760':'#0a0a0a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.title}</span>
          <span style={{flex:1}}/>
          <span style={{fontSize:10,color:'#9aa4bb'}}>{t.owner}</span>
          <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:t.pct===100?'#0a8754':'#3c4760',minWidth:30,textAlign:'right'}}>{t.pct}%</span>
        </div>
        <div style={{position:'relative',height:30}}>
          {/* week separators */}
          {Array.from({length:weeks+1}).map((_,i)=>(
            <div key={i} style={{position:'absolute',left:i*weekW,top:0,bottom:0,width:1,background:i===todayCol?'var(--c-accent)':'rgba(150,170,200,.12)',opacity:i===todayCol?.6:1}}/>
          ))}
          {/* bar */}
          {t.milestone ? (
            <div style={{position:'absolute',left:left-7,top:'50%',transform:'translateY(-50%) rotate(45deg)',width:14,height:14,background:'var(--c-accent)',border:'2px solid #fff',boxShadow:'0 2px 6px rgba(40,70,140,.3)'}}/>
          ) : (
            <div style={{position:'absolute',left,top:8,height:14,width,borderRadius:7,background:'rgba(150,170,200,.2)',overflow:'hidden'}}>
              <div style={{height:'100%',width:t.pct+'%',background:color,borderRadius:7}}/>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{height:'100%',overflow:'auto',padding:'20px 28px 28px'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:12,marginBottom:14}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,letterSpacing:'-.02em'}}>📋 WBS / ガントチャート</h2>
        <span style={{fontSize:11,color:'#6b7a92'}}>{proj.name} · 4 フェーズ · 12 タスク</span>
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:4,padding:3,borderRadius:99,...C2X_glass}}>
          {['ガント','ツリー','カンバン'].map((x,i)=>(
            <button key={x} style={{border:0,background:i===0?'#0a0a0a':'transparent',color:i===0?'#fff':'#3c4760',padding:'4px 10px',borderRadius:99,fontSize:11,fontWeight:i===0?700:500,cursor:'pointer',fontFamily:'inherit'}}>{x}</button>
          ))}
        </div>
        <button style={C2X_btnGhost}>📅 期間: 全体</button>
        <button style={C2X_btn}>＋ 新規タスク</button>
      </div>

      <div style={{...C2X_glass,borderRadius:14,overflow:'hidden'}}>
        {/* week header */}
        <div style={{display:'grid',gridTemplateColumns:'320px 1fr',borderBottom:'1px solid rgba(150,170,200,.25)',background:'rgba(255,255,255,.5)'}}>
          <div style={{padding:'10px 12px',fontSize:11,fontWeight:700,color:'#3c4760'}}>タスク</div>
          <div style={{display:'flex',position:'relative',height:34}}>
            {['9月','10月','11月','12月','1月','2月','3月'].map((m,i)=>(
              <div key={m} style={{flex:1,padding:'10px 0',fontSize:10,letterSpacing:'.05em',color:'#6b7a92',textAlign:'center',borderLeft:i?'1px solid rgba(150,170,200,.18)':0,position:'relative'}}>{m}</div>
            ))}
            <div style={{position:'absolute',left:todayCol*weekW,top:0,bottom:0,width:2,background:'var(--c-accent)'}}>
              <div style={{position:'absolute',top:-2,left:-14,fontSize:9,color:'var(--c-accent)',fontWeight:700,whiteSpace:'nowrap',background:'rgba(255,255,255,.9)',padding:'1px 5px',borderRadius:99}}>Today</div>
            </div>
          </div>
        </div>
        {/* rows */}
        {groups.map(g=>(
          <React.Fragment key={g.id}>
            <Row t={g}/>
            {open[g.id] && g.children.map(c=>(
              <Row key={c.id} t={c} nested/>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginTop:14}}>
        {[
          ['完了タスク', '7 / 12', '+3 先週'],
          ['進行中', '3 タスク', '今週 8 アクション'],
          ['期限超過', '0', '🎉 オンスケ'],
        ].map(([l,v,sub])=>(
          <div key={l} style={{...C2X_glass,borderRadius:12,padding:'12px 14px'}}>
            <div style={{fontSize:10,color:'#6b7a92'}}>{l}</div>
            <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:20,fontWeight:700,marginTop:3,letterSpacing:'-.03em'}}>{v}</div>
            <div style={{fontSize:10,color:'#9aa4bb',marginTop:3}}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//   2. Budget (収支計画)
// ────────────────────────────────────────────────────────────────────────────
function Cv2_Budget({proj}){
  const rows = [
    { kind:'income', cat:'NEO基金',           items:[
      { name:'採択基金',                 plan:300000, actual:300000 },
      { name:'中間報告 加算',             plan: 50000, actual:  0,   pending:true },
    ]},
    { kind:'income', cat:'パートナー協賛',    items:[
      { name:'西鉄バス',                 plan:100000, actual: 80000 },
      { name:'地域商店連合',              plan: 50000, actual: 20000 },
    ]},
    { kind:'income', cat:'自己資金 / 売上',   items:[
      { name:'グッズ販売',                plan: 80000, actual: 42000 },
    ]},
    { kind:'expense', cat:'会場・設営',       items:[
      { name:'会場使用料 (体育館)',       plan: 80000, actual: 75000 },
      { name:'設営機材レンタル',           plan: 60000, actual: 58000 },
    ]},
    { kind:'expense', cat:'制作・印刷',       items:[
      { name:'チラシ・ポスター',           plan: 40000, actual: 36000 },
      { name:'記念グッズ',                plan: 50000, actual: 48000 },
    ]},
    { kind:'expense', cat:'交通・その他',     items:[
      { name:'高校生交通費補助',           plan: 50000, actual: 28000 },
      { name:'予備費',                    plan: 30000, actual:  0    },
    ]},
  ];
  const fmt = (n)=> (n>=0?'+':'') + (n/1000).toFixed(0) + 'k';
  const fmtRaw = (n)=> '¥' + n.toLocaleString();

  const sums = rows.reduce((a,g)=>{
    g.items.forEach(it=>{
      if(g.kind==='income'){ a.incomePlan+=it.plan; a.incomeAct+=it.actual; }
      else                 { a.expensePlan+=it.plan; a.expenseAct+=it.actual; }
    });
    return a;
  }, {incomePlan:0,incomeAct:0,expensePlan:0,expenseAct:0});
  const profitPlan = sums.incomePlan - sums.expensePlan;
  const profitAct  = sums.incomeAct  - sums.expenseAct;

  return (
    <div style={{height:'100%',overflow:'auto',padding:'20px 28px 28px'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:12,marginBottom:14}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,letterSpacing:'-.02em'}}>💴 収支計画</h2>
        <span style={{fontSize:11,color:'#6b7a92'}}>{proj.name} · 9月〜2月の累計</span>
        <div style={{flex:1}}/>
        <button style={C2X_btnGhost}>📤 CSV</button>
        <button style={C2X_btn}>＋ 項目追加</button>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:18}}>
        {[
          { l:'収入 計画',    v:fmtRaw(sums.incomePlan),  sub:'4 カテゴリ',     c:'#0a8754' },
          { l:'収入 実績',    v:fmtRaw(sums.incomeAct),    sub:`進捗 ${Math.round(sums.incomeAct/sums.incomePlan*100)}%`,c:'#0a8754' },
          { l:'支出 実績',    v:fmtRaw(sums.expenseAct),  sub:`計画比 ${Math.round(sums.expenseAct/sums.expensePlan*100)}%`,c:'#3c4760' },
          { l:'差引 (利益)',  v:(profitAct>=0?'+':'')+fmtRaw(profitAct), sub:`計画 ${(profitPlan>=0?'+':'')+fmtRaw(profitPlan)}`,c:profitAct>=0?'var(--c-accent)':'#b8860b' },
        ].map((x,i)=>(
          <div key={i} style={{...C2X_glass,borderRadius:14,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:'#6b7a92',letterSpacing:'.05em'}}>{x.l}</div>
            <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:22,fontWeight:800,letterSpacing:'-.03em',color:x.c,marginTop:4}}>{x.v}</div>
            <div style={{fontSize:10,color:'#9aa4bb',marginTop:3}}>{x.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column: table + chart */}
      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:14}}>
        <div style={{...C2X_glass,borderRadius:14,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'1.5fr 90px 90px 70px 60px',padding:'10px 14px',borderBottom:'1px solid rgba(150,170,200,.25)',fontSize:10,fontWeight:700,color:'#3c4760',letterSpacing:'.05em',background:'rgba(255,255,255,.5)'}}>
            <span>項目</span><span style={{textAlign:'right'}}>計画</span><span style={{textAlign:'right'}}>実績</span><span style={{textAlign:'right'}}>差異</span><span style={{textAlign:'right'}}>%</span>
          </div>
          {rows.map(g=>{
            const isIncome = g.kind==='income';
            return (
              <div key={g.cat}>
                <div style={{display:'grid',gridTemplateColumns:'1.5fr 90px 90px 70px 60px',padding:'8px 14px',background:'rgba('+(isIncome?'180,220,200':'220,200,200')+',.25)',fontSize:11,fontWeight:700,letterSpacing:'-.01em'}}>
                  <span><span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:isIncome?'#0a8754':'#b8860b',marginRight:8,verticalAlign:'middle'}}/>{g.cat}</span>
                </div>
                {g.items.map((it,i)=>{
                  const diff = it.actual - it.plan;
                  const pct  = it.plan? Math.round(it.actual/it.plan*100):0;
                  return (
                    <div key={i} style={{display:'grid',gridTemplateColumns:'1.5fr 90px 90px 70px 60px',padding:'7px 14px',borderBottom:'1px solid rgba(150,170,200,.15)',fontSize:11,alignItems:'center'}}>
                      <span style={{paddingLeft:18,color:'#3c4760'}}>{it.name}{it.pending && <span style={{fontSize:9,marginLeft:6,padding:'1px 5px',borderRadius:3,background:'var(--c-accent-soft)',color:'var(--c-accent-deep)',fontWeight:700}}>未確定</span>}</span>
                      <span style={{textAlign:'right',fontFamily:'JetBrains Mono,monospace',color:'#9aa4bb'}}>{fmtRaw(it.plan)}</span>
                      <span style={{textAlign:'right',fontFamily:'JetBrains Mono,monospace',fontWeight:600}}>{fmtRaw(it.actual)}</span>
                      <span style={{textAlign:'right',fontFamily:'JetBrains Mono,monospace',color:diff>=0?'#0a8754':'#b8860b',fontWeight:600}}>{fmt(diff)}</span>
                      <span style={{textAlign:'right',fontFamily:'JetBrains Mono,monospace',color:pct>=80?'#0a8754':pct>=50?'#b8860b':'#9aa4bb'}}>{pct}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{...C2X_glass,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>📊 月次推移</div>
            <svg viewBox="0 0 240 130" style={{width:'100%',height:130}}>
              {/* grid */}
              {[0,1,2,3].map(i=>(<line key={i} x1="0" x2="240" y1={20+i*30} y2={20+i*30} stroke="rgba(150,170,200,.2)"/>))}
              {/* bars */}
              {[['9月',60,40],['10月',80,55],['11月',100,75],['12月',120,90],['1月',180,110],['2月予測',200,130]].map(([m,inc,exp],i)=>{
                const x = 20 + i*36;
                return (
                  <g key={m}>
                    <rect x={x-9} y={120-inc*.5} width="8" height={inc*.5} fill="var(--c-accent)" rx="1"/>
                    <rect x={x+1} y={120-exp*.5} width="8" height={exp*.5} fill="#b8860b" rx="1" opacity={i===5?.5:1}/>
                    <text x={x} y="128" textAnchor="middle" fontSize="7" fill="#6b7a92" fontFamily="Noto Sans JP">{m}</text>
                  </g>
                );
              })}
              <line x1="0" x2="240" y1="120" y2="120" stroke="#3c4760"/>
            </svg>
            <div style={{display:'flex',gap:10,fontSize:10,color:'#6b7a92',marginTop:4}}>
              <span><span style={{display:'inline-block',width:8,height:8,background:'var(--c-accent)',borderRadius:1,verticalAlign:'middle',marginRight:4}}/>収入</span>
              <span><span style={{display:'inline-block',width:8,height:8,background:'#b8860b',borderRadius:1,verticalAlign:'middle',marginRight:4}}/>支出</span>
            </div>
          </div>

          <div style={{...C2X_glass,borderRadius:14,padding:16,borderLeft:'3px solid var(--c-accent)'}}>
            <div style={{fontSize:10,color:'var(--c-accent-deep)',fontWeight:700,letterSpacing:'.05em',marginBottom:4}}>✦ NEO.ai からの観察</div>
            <div style={{fontSize:12,lineHeight:1.65}}>地域商店連合の協賛が <b>計画比 40%</b> で停滞しています。3 社へのアプローチを今週中にやりませんか？ AI が依頼文ドラフトを用意できます。</div>
            <div style={{display:'flex',gap:6,marginTop:10}}>
              <button style={C2X_btn}>✓ ドラフト依頼</button>
              <button style={C2X_btnGhost}>後で</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//   3. NEO 基金 申請 (Fund Application)
// ────────────────────────────────────────────────────────────────────────────
function Cv2_Fund({proj}){
  const steps = [
    { k:'下書き',     done:true,  date:'1/8 完了' },
    { k:'一次審査',   done:true,  date:'1/12 通過' },
    { k:'二次審査',   current:true, date:'1/20 締切' },
    { k:'承認・送金', date:'2/5 予定' },
  ];
  const purposes = [
    { item:'マッチデイ会場費',       amount:80000, ratio:32 },
    { item:'高校生交通費 (50名分)', amount:75000, ratio:30 },
    { item:'パートナー連携・取材',    amount:45000, ratio:18 },
    { item:'記念冊子 印刷',          amount:30000, ratio:12 },
    { item:'予備費',                amount:20000, ratio: 8 },
  ];
  const total = purposes.reduce((a,p)=>a+p.amount,0);

  return (
    <div style={{height:'100%',overflow:'auto',padding:'20px 28px 28px'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:12,marginBottom:14}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,letterSpacing:'-.02em'}}>📨 NEO 基金 申請</h2>
        <span style={{fontSize:11,padding:'2px 9px',borderRadius:99,background:'var(--c-accent-soft)',color:'var(--c-accent-deep)',fontWeight:700}}>● 二次審査中</span>
        <div style={{flex:1}}/>
        <span style={{fontSize:11,color:'#0a8754',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#0a8754'}}/>自動保存</span>
        <button style={C2X_btnGhost}>📋 履歴</button>
        <button style={C2X_btn}>📤 提出 →</button>
      </div>

      {/* Pipeline */}
      <div style={{...C2X_glass,borderRadius:14,padding:'14px 20px',marginBottom:14,display:'flex',alignItems:'center',gap:10,overflow:'hidden'}}>
        {steps.map((st,i)=>(
          <React.Fragment key={st.k}>
            <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
              <div style={{width:st.current?32:28,height:st.current?32:28,borderRadius:'50%',background:st.done?'#0a0a0a':st.current?'var(--c-accent)':'rgba(150,170,200,.3)',color:st.done||st.current?'#fff':'#3c4760',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,boxShadow:st.current?'0 0 0 5px var(--c-accent-soft)':'none',flexShrink:0}}>
                {st.done?'✓':st.current?(i+1):(i+1)}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:st.current?700:600,fontSize:12,color:st.current?'var(--c-accent-deep)':'#0a0a0a'}}>{st.k}</div>
                <div style={{fontSize:10,color:'#9aa4bb',marginTop:1}}>{st.date}</div>
              </div>
            </div>
            {i<steps.length-1 && <div style={{flex:'0 0 30px',height:2,background:st.done?'#0a0a0a':'rgba(150,170,200,.25)',borderRadius:1}}/>}
          </React.Fragment>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:14}}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{...C2X_glass,borderRadius:14,padding:18}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:12}}>📝 申請内容</div>
            <div style={{display:'grid',gridTemplateColumns:'120px 1fr',rowGap:14,fontSize:12,alignItems:'center'}}>
              <span style={{color:'#6b7a92'}}>申請額</span>
              <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                <span style={{fontFamily:'JetBrains Mono,monospace',fontWeight:800,fontSize:22,letterSpacing:'-.03em'}}>¥{total.toLocaleString()}</span>
                <span style={{fontSize:10,padding:'2px 7px',background:'var(--c-accent-soft)',color:'var(--c-accent-deep)',borderRadius:99,fontWeight:700}}>中間報告 加算分</span>
              </div>
              <span style={{color:'#6b7a92'}}>申請プロジェクト</span>
              <div style={{fontWeight:600}}>{proj.name}</div>
              <span style={{color:'#6b7a92'}}>申請理由</span>
              <textarea readOnly value={'マッチデイ実証実験(2/9)を実施するにあたり、会場費・交通費補助・パートナー連携を中心に追加支援を申請します。プロトタイプ検証で得た「高校生の移動課題」のインサイトを実地で検証し、継続運営に向けた一次データを取得します。'} style={{width:'100%',minHeight:80,padding:'10px 12px',border:'1px solid rgba(150,170,200,.35)',borderRadius:8,fontFamily:'inherit',fontSize:11,lineHeight:1.65,resize:'none',background:'rgba(255,255,255,.85)',color:'#0a0a0a'}}/>
              <span style={{color:'#6b7a92'}}>添付資料</span>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {['実行計画 v3.pdf','プロト検証レポート.pdf','現場写真 24枚.zip'].map(f=>(
                  <span key={f} style={{padding:'4px 10px',borderRadius:99,background:'rgba(255,255,255,.6)',border:'1px solid rgba(150,170,200,.35)',fontSize:10,fontFamily:'JetBrains Mono,monospace',color:'#3c4760'}}>📎 {f}</span>
                ))}
                <button style={{...C2X_btnGhost,padding:'4px 10px',fontSize:10,borderRadius:99}}>＋ 追加</button>
              </div>
            </div>
          </div>

          <div style={{...C2X_glass,borderRadius:14,padding:18}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:12}}>💴 用途内訳</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {purposes.map(p=>(
                <div key={p.item} style={{display:'grid',gridTemplateColumns:'1fr 100px 60px',gap:10,alignItems:'center',padding:'7px 10px',background:'rgba(255,255,255,.5)',borderRadius:8,fontSize:12}}>
                  <span>{p.item}</span>
                  <div style={{position:'relative',height:6,background:'rgba(150,170,200,.18)',borderRadius:3}}>
                    <div style={{position:'absolute',inset:0,width:p.ratio+'%',background:'linear-gradient(90deg,var(--c-accent),var(--c-accent-deep))',borderRadius:3}}/>
                  </div>
                  <span style={{textAlign:'right',fontFamily:'JetBrains Mono,monospace',fontWeight:600}}>¥{(p.amount/1000).toFixed(0)}k</span>
                </div>
              ))}
              <div style={{display:'grid',gridTemplateColumns:'1fr 100px 60px',padding:'10px 10px 4px',borderTop:'2px solid #0a0a0a',marginTop:4,fontSize:13,fontWeight:700,alignItems:'center'}}>
                <span>合計</span>
                <span></span>
                <span style={{textAlign:'right',fontFamily:'JetBrains Mono,monospace'}}>¥{(total/1000).toFixed(0)}k</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {/* AI suggestions */}
          <div className="glass-dark" style={{borderRadius:14,padding:18,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-30,right:-30,width:140,height:140,borderRadius:'50%',background:'radial-gradient(circle,rgba(91,141,239,.5),transparent 70%)',pointerEvents:'none'}}/>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,position:'relative'}}>
              <span style={{fontSize:18}}>✦</span>
              <div style={{fontSize:13,fontWeight:700}}>NEO.ai が申請文を分析しました</div>
            </div>
            <div style={{fontSize:11,opacity:.7,marginBottom:14,position:'relative'}}>"通る申請" の3要素：① 課題解像度 ② 学びの可視化 ③ 継続意志</div>
            {[
              ['1','"高校生の移動課題" を具体的な数値で', '50% → 87% へ改善余地','warn'],
              ['2','プロト検証で得た学びを 1 段落追加', '+ 提案あり','ok'],
              ['3','継続運営のシナリオを 3 行で示す', 'まだ書かれていない','warn'],
            ].map(([n,t,sub,kind])=>(
              <div key={n} style={{display:'grid',gridTemplateColumns:'24px 1fr 18px',gap:8,padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,.1)',alignItems:'flex-start',position:'relative'}}>
                <div style={{width:20,height:20,borderRadius:'50%',background:kind==='ok'?'#0a8754':'var(--c-accent)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700}}>{n}</div>
                <div>
                  <div style={{fontSize:12,fontWeight:600}}>{t}</div>
                  <div style={{fontSize:10,opacity:.6,marginTop:2}}>{sub}</div>
                </div>
                <span style={{fontSize:14,opacity:.5}}>›</span>
              </div>
            ))}
            <button style={{marginTop:10,width:'100%',background:'var(--c-accent)',color:'#fff',border:0,borderRadius:10,padding:'9px 0',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>✦ 改善案をまとめて適用</button>
          </div>

          <div style={{...C2X_glass,borderRadius:14,padding:16}}>
            <div style={{fontSize:11,color:'#6b7a92',marginBottom:6}}>📋 過去の申請</div>
            {[
              ['初期申請','¥300,000','9/15','承認','#0a8754'],
              ['中間報告','¥125,000','11/30','承認','#0a8754'],
              ['今回 (二次)','¥250,000','1/20','審査中','var(--c-accent)'],
            ].map(([k,a,d,s,c])=>(
              <div key={k} style={{display:'grid',gridTemplateColumns:'1fr 80px 50px 50px',gap:8,padding:'8px 0',borderBottom:'1px solid rgba(150,170,200,.18)',fontSize:11,alignItems:'center'}}>
                <span style={{fontWeight:600}}>{k}</span>
                <span style={{textAlign:'right',fontFamily:'JetBrains Mono,monospace'}}>{a}</span>
                <span style={{textAlign:'right',color:'#9aa4bb',fontSize:10}}>{d}</span>
                <span style={{fontSize:9,padding:'2px 6px',borderRadius:3,background:c+'18',color:c,fontWeight:700,textAlign:'center'}}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//   4. Diagnosis Report (詳細診断 14 項目)
// ────────────────────────────────────────────────────────────────────────────
function Cv2_Diag({proj}){
  const trends = {
    '目標設定':[2,2,3,3], '戦略力':[2,2,2,3], '役割分担':[1,2,2,2], '進捗管理':[2,3,3,3],
    'チームワーク':[2,2,3,3], '決断力':[1,1,2,2], '推進力':[2,2,3,3], '改善力':[1,2,2,2],
    '衝突力':[0,1,1,1], '楽しみ力':[2,3,3,3], '巻き込み力':[2,3,3,3], '現場力':[2,3,3,3],
    'リスク管理':[1,1,2,2], 'やり切り':[1,1,2,2]
  };
  const data = window.NEO.radar.map(r=>({...r,t:trends[r.k]||[r.v,r.v,r.v,r.v]}));
  const score = data.reduce((a,b)=>a+b.v,0);
  const tier  = score>=35?'★★★ ベテラン伴走':score>=24?'★★ 順調':'★ 育成期';
  const comments = {
    high:'チームの強みが伸びています。次の挑戦のための余白を作りましょう。',
    mid: '安定しています。1段階上げるなら、AIに具体的アクションを聞いてみてください。',
    low: '要支援。1つだけでもよいので、来週中に着手する小さなアクションを決めましょう。',
  };

  const HexRadar = ({size=260,thick=false})=>{
    const cx=size/2,cy=size/2,N=data.length,max=3;
    const ang = (i)=> -Math.PI/2 + (i*2*Math.PI/N);
    const pt = (i,v)=>{ const r=(v/max)*(size*0.38); return [cx+r*Math.cos(ang(i)),cy+r*Math.sin(ang(i))]; };
    return (
      <svg width={size} height={size}>
        {[1,2,3].map(L=> <polygon key={L} points={data.map((_,i)=>pt(i,L).join(',')).join(' ')} fill="none" stroke="rgba(150,170,200,.25)"/>)}
        {data.map((_,i)=>{const[x,y]=pt(i,max);return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(150,170,200,.18)"/>;})}
        <polygon points={data.map((d,i)=>pt(i,d.v).join(',')).join(' ')} fill="rgba(91,141,239,.12)" style={{stroke:'var(--c-accent)'}} strokeWidth={thick?2.5:2} strokeLinejoin="round"/>
        {data.map((d,i)=>{const[x,y]=pt(i,d.v);return <circle key={i} cx={x} cy={y} r="3.5" fill="#0a0a0a" stroke="#fff" strokeWidth="2"/>;})}
        {data.map((d,i)=>{const[x,y]=pt(i,max+.36);return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill="#0a0a0a" fontFamily="Noto Sans JP">{d.k}</text>;})}
      </svg>
    );
  };
  const Spark = ({arr})=>{
    const max=3, w=60, h=18;
    const pts = arr.map((v,i)=>`${(i/(arr.length-1))*w},${h-(v/max)*h}`).join(' ');
    return (
      <svg width={w} height={h} style={{display:'block'}}>
        <polyline points={pts} fill="none" style={{stroke:'var(--c-accent)'}} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx={w} cy={h-(arr[arr.length-1]/max)*h} r="2" fill="var(--c-accent)"/>
      </svg>
    );
  };
  const score3 = (v)=> v===3?{l:'○',c:'#0a8754'}: v===2?{l:'△',c:'#b8860b'}: {l:'×',c:'var(--c-accent)'};

  return (
    <div style={{height:'100%',overflow:'auto',padding:'20px 28px 28px'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:12,marginBottom:14}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,letterSpacing:'-.02em'}}>🔍 プロジェクト診断レポート</h2>
        <span style={{fontSize:11,color:'#6b7a92'}}>{proj.name} · 14 項目 · 週次トラッキング</span>
        <div style={{flex:1}}/>
        <button style={C2X_btnGhost}>🖨 PDF 書き出し</button>
        <button style={C2X_btnGhost}>📤 NEO事務局へ共有</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1.1fr 1fr',gap:14,marginBottom:14}}>
        <div style={{...C2X_glass,borderRadius:14,padding:'20px 24px',display:'flex',gap:18,alignItems:'center'}}>
          <HexRadar/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:10,letterSpacing:'.18em',color:'#6b7a92',marginBottom:4}}>TOTAL SCORE</div>
            <div style={{fontFamily:'JetBrains Mono,monospace',fontWeight:800,fontSize:46,letterSpacing:'-.04em',lineHeight:1}}>{score}<span style={{fontSize:18,color:'#9aa4bb'}}> / 42</span></div>
            <div style={{marginTop:10,display:'inline-block',padding:'4px 12px',background:'#0a0a0a',color:'#fff',borderRadius:99,fontSize:11,fontWeight:700}}>{tier}</div>
            <div style={{display:'flex',gap:10,marginTop:14,fontSize:10,color:'#6b7a92'}}>
              <span><span style={{display:'inline-block',width:8,height:8,background:'var(--c-accent)',borderRadius:'50%',verticalAlign:'middle',marginRight:4}}/>現在</span>
              <span>○ 強み 8 ・ △ 注意 5 ・ × 要支援 1</span>
            </div>
            <div style={{marginTop:14,padding:'10px 12px',background:'rgba(255,255,255,.55)',borderRadius:10,border:'1px solid rgba(150,170,200,.25)',fontSize:11,lineHeight:1.65,color:'#3c4760'}}>
              <b style={{color:'var(--c-accent-deep)'}}>✦ 総評</b><br/>過去 4 週で <b>＋6 ポイント</b>。「楽しみ力」「現場力」「巻き込み力」の3軸が支えています。次は「衝突力」を一段。
            </div>
          </div>
        </div>

        <div style={{...C2X_glass,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:12}}>📈 総合スコア推移 — 過去 4 週</div>
          <svg viewBox="0 0 240 130" style={{width:'100%',height:130}}>
            {[0,1,2,3].map(i=>(<line key={i} x1="20" x2="230" y1={20+i*28} y2={20+i*28} stroke="rgba(150,170,200,.2)"/>))}
            {(()=>{
              const series=[18,21,24,27,score];
              const max=42;
              const pts = series.map((v,i)=>`${20+i*52},${110-(v/max)*84}`).join(' ');
              return <>
                <polyline points={pts} fill="none" style={{stroke:'var(--c-accent)'}} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                {series.map((v,i)=>{const x=20+i*52,y=110-(v/max)*84;return (<g key={i}>
                  <circle cx={x} cy={y} r="4" fill="#fff" style={{stroke:'var(--c-accent)'}} strokeWidth="2"/>
                  <text x={x} y={y-10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0a0a0a" fontFamily="Noto Sans JP">{v}</text>
                </g>);})}
                {['4週前','3週前','2週前','先週','今週'].map((m,i)=>(<text key={m} x={20+i*52} y="124" textAnchor="middle" fontSize="9" fill="#6b7a92" fontFamily="Noto Sans JP">{m}</text>))}
              </>;
            })()}
          </svg>
          <div style={{display:'flex',gap:6,marginTop:8,fontSize:10,color:'#6b7a92'}}>
            <span style={{padding:'2px 7px',borderRadius:99,background:'#0a8754',color:'#fff',fontWeight:700}}>＋9 4週累計</span>
            <span style={{padding:'2px 7px',borderRadius:99,background:'rgba(150,170,200,.2)'}}>目標 32 まで残 5</span>
          </div>
        </div>
      </div>

      {/* 14-item drill-down */}
      <div style={{...C2X_glass,borderRadius:14,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'140px 70px 70px 1fr 100px',padding:'10px 16px',borderBottom:'1px solid rgba(150,170,200,.25)',fontSize:10,fontWeight:700,letterSpacing:'.05em',color:'#3c4760',background:'rgba(255,255,255,.5)'}}>
          <span>項目</span><span style={{textAlign:'center'}}>評価</span><span style={{textAlign:'center'}}>推移</span><span>AI コメント</span><span style={{textAlign:'right'}}>推奨アクション</span>
        </div>
        {data.map(d=>{
          const s = score3(d.v);
          const delta = d.t[d.t.length-1]-d.t[0];
          const ck = d.v===3?'high':d.v===2?'mid':'low';
          return (
            <div key={d.k} style={{display:'grid',gridTemplateColumns:'140px 70px 70px 1fr 100px',padding:'9px 16px',borderBottom:'1px solid rgba(150,170,200,.15)',fontSize:11,alignItems:'center'}}>
              <span style={{fontWeight:600}}>{d.k}</span>
              <span style={{textAlign:'center'}}><span style={{display:'inline-block',width:24,height:24,borderRadius:'50%',background:s.c,color:'#fff',fontWeight:800,lineHeight:'24px',fontSize:13}}>{s.l}</span></span>
              <span style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center'}}>
                <Spark arr={d.t}/>
                <span style={{fontSize:9,color:delta>0?'#0a8754':delta<0?'var(--c-accent)':'#9aa4bb',fontWeight:700}}>{delta>0?'+':''}{delta}</span>
              </span>
              <span style={{color:'#3c4760',lineHeight:1.5,paddingRight:12}}>{comments[ck]}</span>
              <span style={{textAlign:'right'}}>
                <button style={{...C2X_btnGhost,padding:'4px 10px',fontSize:10}}>✦ アクション提案</button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Cv2_Wbs, Cv2_Budget, Cv2_Fund, Cv2_Diag });
