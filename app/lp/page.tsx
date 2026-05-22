/* eslint-disable @next/next/no-img-element */

export const dynamic = "force-static";

export default function LandingPage() {
  return (
    <>
      {/* ─────────── NAV ─────────── */}
      <header className="nav">
        <div className="nav-inner">
          <a href="#" className="brand">
            <span className="brand-mark">
              <img src="/lp/logo.png" alt="AI PM" />
            </span>
            <span>AI PM</span>
            <span className="tag">BETA</span>
          </a>
          <nav className="nav-links">
            <a href="#about">特徴</a>
            <a href="#features">機能</a>
            <a href="#pricing">料金</a>
            <a href="#faq">よくある質問</a>
          </nav>
          <div className="nav-cta">
            <a href="/login" className="btn btn-ghost">
              ログイン
            </a>
            <a href="/login" className="btn btn-primary">
              無料ではじめる
            </a>
          </div>
        </div>
      </header>

      {/* ─────────── HERO ─────────── */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="pill">FREE</span>
              <span>ベータ期間中につき、主要機能を無料でご提供中</span>
            </div>
            <h1>
              <span className="line-1">AIと共に、</span>
              <br />
              <span className="line-2">誰もが</span>
              <br />
              <span className="line-3">
                プロジェクト
                <br />
                マネージャーに。
              </span>
            </h1>
            <p className="hero-lead">
              「計画を立てる」「会議をまとめる」「進捗を見る」——それでも、プロジェクト推進は難しい。AI
              PM は、そんな「やったことがない」人も「もう経験者」も、同じ位置からスタートできるよう設計されたプロジェクト
              OS です。AI が伴走し、ゲーム要素が背中を押す。
            </p>
            <div className="hero-ctas">
              <a href="/login" className="btn btn-primary">
                無料ではじめる
              </a>
              <a href="#features" className="btn btn-ghost">
                デモを見る ▶
              </a>
            </div>
            <div className="hero-meta">
              <span>クレジットカード不要</span>
              <span>主要機能を無料で提供中</span>
              <span>1分でセットアップ</span>
            </div>
          </div>

          <div className="hero-mock">
            <div className="macbook">
              <div className="macbook-screen">
                <div className="mock-window">
              <div className="mock-titlebar">
                <span className="mock-dot r"></span>
                <span className="mock-dot y"></span>
                <span className="mock-dot g"></span>
                <span className="mock-url">
                  app.ai-pm.jp / NEO福岡事務局 / ダッシュボード
                </span>
              </div>
              <img
                src="/lp/product-dashboard.png"
                alt="AI PM のプロジェクトダッシュボード画面"
                className="mock-image"
              />
                </div>
              </div>
              <div className="macbook-base"></div>
            </div>

            <div className="float-card">
              <div className="head">連続稼働ストリーク</div>
              <div className="num">
                <span className="fire">🔥</span>
                <span>21</span>
                <span className="lbl">日連続</span>
              </div>
              <span className="delta">↑ 過去最長更新中</span>
              <svg
                viewBox="0 0 200 36"
                preserveAspectRatio="none"
                style={{ marginTop: 6 }}
              >
                <path
                  d="M0,28 L20,26 L40,24 L60,20 L80,22 L100,16 L120,14 L140,10 L160,12 L180,6 L200,4"
                  stroke="var(--fire)"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M0,28 L20,26 L40,24 L60,20 L80,22 L100,16 L120,14 L140,10 L160,12 L180,6 L200,4 L200,36 L0,36 Z"
                  fill="var(--fire)"
                  opacity="0.12"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── About ─────────── */}
      <section className="about" id="about">
        <div className="container about-grid">
          <div className="about-text">
            <span className="eyebrow">ABOUT</span>
            <h2 className="section-title">
              「次は何から手をつければ
              <br />
              良いか分からない」を
              <br />
              無くすプロジェクト OS
            </h2>
            <p>
              AI PM
              は、プロジェクトの計画・進捗・会議・振り返り・チーム管理を 1
              つのワークスペースに集約する業務 OS です。AI
              が情報を整理し、「今日の優先タスク」と「次の一歩」を一緒に考えます。
            </p>
            <p>
              進捗・連続稼働・AI
              総合評価がチーム全員に見える化されるため、会議や報告のための仕事が減り、本来の業務に集中できます。
            </p>
            <a href="#features" className="btn-text">
              機能の詳細を見る
            </a>
          </div>
          <div className="about-mock">
            <div className="am-coach-card">
              <div className="am-coach-head">
                <div className="am-orb">✦</div>
                <div>
                  <div className="am-coach-name">
                    AI コーチ <span>MyCOO</span>
                  </div>
                  <div className="am-coach-time">月曜 8:00</div>
                </div>
              </div>
              <div className="am-coach-question">
                今週、<span>一番達成したいこと</span>は何ですか？
              </div>
              <div className="am-coach-options">
                <button className="am-opt active">
                  プロト案を 5/28 までに完成
                </button>
                <button className="am-opt">
                  事務局メンバーを 1 名増やす
                </button>
                <button className="am-opt">
                  課題管理表をクリーンに整える
                </button>
                <button className="am-opt am-opt-input">＋ 自分で書く</button>
              </div>
              <div className="am-coach-foot">
                <span className="am-foot-stat">🔥 21日連続</span>
                <span className="am-foot-stat">✨ AI 評価 60</span>
                <span className="am-foot-stat">🏅 11/11</span>
              </div>
            </div>
            <div className="am-tip">
              <div className="am-tip-bullet"></div>
              <div>
                <b>「次の一歩」を AI が一緒に考える</b>
                <br />
                <span>いつでも相談でき、週次の振り返りもサポート。</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Big Features ─────────── */}
      <section className="big-features" id="features">
        <div className="container">
          <div className="bf-head">
            <span className="eyebrow">FEATURES</span>
            <h2 className="section-title">
              主要 6 機能で、
              <br />
              プロジェクト推進を 1 つに。
            </h2>
            <p className="section-lead">
              計画から振り返り、AI
              コーチまで。必要な情報がワークスペース 1
              つで完結し、ツールを行き来する必要がありません。
            </p>
          </div>
          <div className="bf-grid">
            <article className="bf-card bf-accent">
              <div className="bf-label">ダッシュボード</div>
              <h3>
                プロジェクトの
                <br />
                「いま」が、一目で。
              </h3>
              <p>
                進行ステータス、AI
                総合評価、残り日数、連続稼働。チームの状態が、開いた瞬間に分かるダッシュボード。
              </p>
              <ul>
                <li>AI 総合評価で健康度を点数化</li>
                <li>残り日数・連続稼働・期間消化</li>
                <li>マイルストーン／タイムライン同居</li>
              </ul>
              <div className="bf-mock bf-mock-dash">
                <div className="bf-score">
                  <svg width="60" height="60" viewBox="0 0 60 60">
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      fill="none"
                      stroke="#eef2ff"
                      strokeWidth="5"
                    />
                    <circle
                      cx="30"
                      cy="30"
                      r="24"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray="151"
                      strokeDashoffset="60"
                      transform="rotate(-90 30 30)"
                    />
                  </svg>
                  <span className="bf-score-n">60</span>
                </div>
                <div className="bf-score-info">
                  <div className="bf-score-l">✨ AI 総合評価</div>
                  <div className="bf-score-grade">
                    グレード <b>B</b> ／+6 pt
                  </div>
                </div>
                <div className="bf-metrics">
                  <div>
                    <span>残り日数</span>
                    <b>43日</b>
                  </div>
                  <div>
                    <span>連続稼働</span>
                    <b style={{ color: "var(--fire)" }}>🔥 12日</b>
                  </div>
                  <div>
                    <span>期間消化</span>
                    <b>28%</b>
                  </div>
                </div>
              </div>
            </article>

            <article className="bf-card bf-info">
              <div className="bf-label">実行計画 / WBS</div>
              <h3>
                目的から逆算して、
                <br />
                タスクに分解。
              </h3>
              <p>
                目的や背景を入力すると、AI が実行計画（目的・ターゲット・打ち手）をドラフト。あとは
                WBS に落とし込み、かんばん／ガント／タイムラインで管理できます。
              </p>
              <ul>
                <li>実行計画(Why / Who / What・4P)を AI がドラフト</li>
                <li>マイルストーン・担当・期日を一画面で管理</li>
                <li>かんばん／ガント／タイムライン切替</li>
              </ul>
              <div className="bf-mock bf-mock-wbs">
                <div className="bf-wbs-row">
                  <span className="bf-tag bf-tag-mile">M1</span>
                  キックオフ＆体制構築
                </div>
                <div className="bf-wbs-row sub">
                  <span className="bf-tag">T1</span>役割／責任定義
                  <span className="bf-mini-bar">
                    <i style={{ width: "100%" }}></i>
                  </span>
                </div>
                <div className="bf-wbs-row sub">
                  <span className="bf-tag">T2</span>定例ルール設定
                  <span className="bf-mini-bar">
                    <i style={{ width: "100%" }}></i>
                  </span>
                </div>
                <div className="bf-wbs-row">
                  <span className="bf-tag bf-tag-mile">M2</span>仮説検証フェーズ
                </div>
                <div className="bf-wbs-row sub">
                  <span className="bf-tag">T3</span>ユーザーインタビュー
                  <span className="bf-mini-bar">
                    <i style={{ width: "65%" }}></i>
                  </span>
                </div>
                <div className="bf-wbs-row sub">
                  <span className="bf-tag">T4</span>プロト検証
                  <span className="bf-mini-bar">
                    <i style={{ width: "30%" }}></i>
                  </span>
                </div>
              </div>
            </article>

            <article className="bf-card bf-success">
              <div className="bf-label">会議 / 議事録</div>
              <h3>
                アジェンダから議事録、
                <br />
                決定からタスクまで。
              </h3>
              <p>
                定例会議のアジェンダ作成から、議事録の記録、決定事項の AI
                抽出、タスク化までを 1 本のテンプレで完結。
              </p>
              <ul>
                <li>アジェンダ→議事録→タスク化が地続き</li>
                <li>議事録テキストから決定事項を AI 抽出</li>
                <li>抽出した決定をワンタップでタスク化</li>
              </ul>
              <div className="bf-mock bf-mock-mtg">
                <div className="bf-mtg-head">
                  <span className="bf-tag bf-tag-mtg">会議</span>
                  <span>第8回 定例</span>
                  <span className="bf-mtg-time">5/21 14:00</span>
                </div>
                <div className="bf-mtg-section">アジェンダ</div>
                <div className="bf-mtg-li">
                  <b>1.</b>進捗共有
                </div>
                <div className="bf-mtg-li">
                  <b>2.</b>課題解決
                </div>
                <div className="bf-mtg-li">
                  <b>3.</b>来月計画
                </div>
                <div className="bf-mtg-divider"></div>
                <div className="bf-mtg-section pos">決定 → タスク化</div>
                <div className="bf-mtg-li done">
                  ✓ プロト案を 5/28 までに共有 — @三木
                </div>
              </div>
            </article>

            <article className="bf-card bf-warn">
              <div className="bf-label">
                コンペ機能<span className="bf-soon">追加予定</span>
              </div>
              <h3>
                テーマを出題し、
                <br />
                チームで競う。
              </h3>
              <p>
                事務局がテーマを出題し、複数チームが提案・投稿・審査されるコンペ型プロジェクト。オープンイノベーションやアイデアソンに。
              </p>
              <ul>
                <li>テーマ出題・応募・審査を一貫</li>
                <li>AI による提案評価・コメント生成</li>
                <li>Business プランで提供予定</li>
              </ul>
              <div className="bf-mock bf-mock-compe">
                <div className="bf-mtg-head">
                  <span className="bf-tag bf-tag-mtg">出題</span>
                  <span>高齢者ケアの新体験</span>
                  <span className="bf-mtg-time">12 提案</span>
                </div>
                <div className="bf-mtg-li">
                  <b>1.</b>シニアタッチ <span className="bf-cm-score">★ 4.8</span>
                </div>
                <div className="bf-mtg-li">
                  <b>2.</b>見るボット <span className="bf-cm-score">★ 4.5</span>
                </div>
                <div className="bf-mtg-li">
                  <b>3.</b>思い出ノート{" "}
                  <span className="bf-cm-score">★ 4.2</span>
                </div>
              </div>
            </article>

            <article className="bf-card bf-accent">
              <div className="bf-label">連続稼働 &amp; バッジ</div>
              <h3>
                続くほど、
                <br />
                楽しくなる。
              </h3>
              <p>
                毎日の小さなアクションを連続稼働として可視化。マイルストーン達成でバッジを獲得し、「続けるモチベーション」を仕組みで支えます。
              </p>
              <ul>
                <li>🔥 連続稼働日数のストリーク</li>
                <li>🏅 11 種のバッジコレクション</li>
                <li>達成間近のバッジを AI が提示</li>
              </ul>
              <div className="bf-mock bf-mock-streak">
                <div className="bf-streak-num">
                  <span className="bf-streak-fire">🔥</span>
                  <b>21</b>
                  <span className="bf-streak-l">日連続</span>
                </div>
                <div className="bf-streak-days">
                  <span className="d on">月</span>
                  <span className="d on">火</span>
                  <span className="d on">水</span>
                  <span className="d on">木</span>
                  <span className="d on">金</span>
                  <span className="d on">土</span>
                  <span className="d on">日</span>
                </div>
                <div className="bf-streak-badges">
                  <div className="bf-coin">🎤</div>
                  <div className="bf-coin">👥</div>
                  <div className="bf-coin">📅</div>
                  <div className="bf-coin">🏆</div>
                  <div className="bf-coin dim">🚀</div>
                </div>
              </div>
            </article>

            <article className="bf-card bf-dark">
              <div className="bf-label">AI コーチ MyCOO</div>
              <h3>
                AI が一緒に
                <br />
                「次の一歩」を考える。
              </h3>
              <p>
                議事録・タスク・会議の文脈を AI
                が横断的に読み、状況を整理。「軽く始められる」次のアクションを提案します。
              </p>
              <ul>
                <li>相談すると、いまやるべきことを整理</li>
                <li>AI 総合評価で停滞や課題を可視化</li>
                <li>週次の振り返りをサポート</li>
              </ul>
              <div className="bf-mock bf-mock-coach">
                <div className="bf-coach-msg">
                  <div className="bf-orb">✦</div>
                  <div>
                    今週の Why を 3分で整理しませんか？
                    <span className="bf-sparkle">✨</span>
                  </div>
                </div>
                <div className="bf-coach-actions">
                  <span>Why を書く</span>
                  <span>他の提案を見る</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ─────────── Small Features ─────────── */}
      <section className="small-features">
        <div className="container">
          <div className="sf-head">
            <h3>他にも使える便利機能</h3>
            <p>定型業務から協働まで、プロジェクト推進に必要なツールを網羅。</p>
          </div>
          <div className="sf-grid">
            <div className="sf-card">
              <div className="sf-icon">🏠</div>
              <span>ホーム</span>
            </div>
            <div className="sf-card">
              <div className="sf-icon">🚀</div>
              <span>ダッシュ</span>
            </div>
            <div className="sf-card">
              <div className="sf-icon">🎯</div>
              <span>実行計画</span>
            </div>
            <div className="sf-card">
              <div className="sf-icon">📋</div>
              <span>WBS</span>
            </div>
            <div className="sf-card">
              <div className="sf-icon">📅</div>
              <span>会議</span>
            </div>
            <div className="sf-card">
              <div className="sf-icon">💴</div>
              <span>収支</span>
            </div>
            <div className="sf-card">
              <div className="sf-icon">🏢</div>
              <span>チーム管理</span>
            </div>
            <div className="sf-card">
              <span className="sf-soon">連携予定</span>
              <div className="sf-icon">🏆</div>
              <span>コンペ機能</span>
            </div>
            <div className="sf-card">
              <div className="sf-icon">🎤</div>
              <span>議事録要約</span>
            </div>
            <div className="sf-card">
              <div className="sf-icon">🏅</div>
              <span>バッジ</span>
            </div>
            <div className="sf-card">
              <span className="sf-soon">連携予定</span>
              <div className="sf-icon">🔍</div>
              <span>横断検索</span>
            </div>
            <div className="sf-card">
              <span className="sf-soon">連携予定</span>
              <div className="sf-icon">🔌</div>
              <span>API連携</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Reasons ─────────── */}
      <section className="reasons">
        <div className="container">
          <div className="rs-head">
            <span className="eyebrow">WHY AI PM</span>
            <h2 className="section-title">
              AI PM が選ばれる
              <br />3 つの理由
            </h2>
          </div>
          <div className="rs-grid">
            <div className="rs-card">
              <span className="rs-num">
                01<small>POINT</small>
              </span>
              <h3>AI が「今日やること」を整える</h3>
              <p>
                議事録・会議・タスクを AI
                が横断的に読み、今日の優先タスクと次の一歩を整理。「迷う時間」が消えます。
              </p>
            </div>
            <div className="rs-card">
              <span className="rs-num">
                02<small>POINT</small>
              </span>
              <h3>業務情報が 1 つの画面に集約</h3>
              <p>
                計画・進捗・会議・収支・チーム管理を 1
                ワークスペースで。ツールを行き来する必要がありません。
              </p>
            </div>
            <div className="rs-card">
              <span className="rs-num">
                03<small>POINT</small>
              </span>
              <h3>チーム全員が同じ景色を見て働ける</h3>
              <p>
                進捗・AI
                評価・連続稼働が自動でチームに見える化。報告会議を減らし、判断のスピードが上がります。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Pricing ─────────── */}
      <section className="pricing" id="pricing">
        <div className="container">
          <div className="pricing-head">
            <span className="eyebrow">料金プラン</span>
            <h2 className="section-title">
              いま、
              <span style={{ color: "var(--accent-deep)" }}>主要機能が無料。</span>
            </h2>
            <p className="section-lead" style={{ margin: "0 auto" }}>
              AI PM
              は現在、ベータ期間中につき主要機能を無料でご提供しています。
            </p>
          </div>

          <div className="free-banner">
            <div className="fb-left">
              <span className="fb-pill">現在、無料公開中</span>
              <h3>
                主要機能を、クレジットカード登録なしでご利用いただけます。
              </h3>
              <p>
                「まず使ってみて、フィードバックを聞かせてほしい」——それが AI
                PM
                のいまのスタンスです。プロジェクト追加・コンペ機能など、一部のエンタープライズ向け機能は今後有料プランでの提供を予定しています。
              </p>
              <div className="fb-meta">
                <span className="fb-meta-item">
                  <b>✔</b> クレジットカード登録不要
                </span>
                <span className="fb-meta-item">
                  <b>✔</b> プロジェクト 1 つを無料で運用
                </span>
                <span className="fb-meta-item">
                  <b>✔</b> AI 議事録要約（月10回まで）
                </span>
              </div>
            </div>
            <div className="fb-right">
              <div className="fb-promise">
                <div className="fb-promise-head">
                  <span className="fb-icon">⚡</span>
                  <h4>有料化の際は、1ヶ月前にお知らせします</h4>
                </div>
                <p>
                  今後、一部機能を有料プランとして提供する可能性がありますが、その際は「必ず
                  1ヶ月以上前」にユーザーの皆様へメール及びダッシュボード上でご案内いたします。予告なしの代金請求はございませんので、安心して業務に組み込んでいただけます。
                </p>
                <ul className="fb-promise-list">
                  <li>メール・ダッシュボード・公式サイトで事前告知</li>
                  <li>有料プラン移行は任意。そのまま無料版を利用継続も可能</li>
                  <li>さかのぼりも、違約金も、一切なし</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="future-plans">
            <div className="fp-head">
              <span className="eyebrow">FUTURE PRICING (参考)</span>
              <h3>将来の有料プランのイメージ</h3>
              <p>
                今後ご提供を検討しているプランのイメージです。現時点では主要機能は無料でご利用いただけます。
              </p>
            </div>
            <div className="plans">
              <div className="plan">
                <div className="plan-name">Free</div>
                <div className="plan-desc">
                  個人PM・小さなチームから試したい方
                </div>
                <div className="plan-price">
                  <span className="num">0</span>
                  <span className="unit">／月</span>
                </div>
                <div className="plan-note">個人・小規模チーム向け</div>
                <ul>
                  <li>AI チャット</li>
                  <li>計画書・WBS ジェネレーター</li>
                  <li>かんばん・ガントビュー</li>
                  <li>議事録の自動要約</li>
                  <li className="off">プロジェクトの追加</li>
                  <li className="off">コンペ機能</li>
                </ul>
              </div>
              <div className="plan featured">
                <div className="plan-badge">将来の中心プラン</div>
                <div className="plan-name">Business</div>
                <div className="plan-desc">
                  本格的にPM業務を AI に任せたい組織向け
                </div>
                <div className="plan-price">
                  <span
                    className="num"
                    style={{ fontSize: 36, lineHeight: 1.2 }}
                  >
                    金額未定
                  </span>
                </div>
                <div className="plan-note">
                  ※今後正式リリース時に発表します
                </div>
                <ul>
                  <li>AI チャット 無制限</li>
                  <li>議事録自動要約 無制限</li>
                  <li>計画書 / 議事録 / KPI ダッシュボード 全機能</li>
                  <li>
                    <b>プロジェクトの追加</b>（プロジェクト数に応じた課金）
                  </li>
                  <li>
                    <b>コンペ機能</b>（テーマ出題・応募・審査）
                  </li>
                  <li>外部ツール連携（Slack 他）</li>
                  <li>役員向けレポート生成</li>
                </ul>
              </div>
              <div className="plan">
                <div className="plan-name">Enterprise</div>
                <div className="plan-desc">
                  大規模組織・セキュリティ要件のある企業
                </div>
                <div className="plan-price">
                  <span
                    className="num"
                    style={{ fontSize: 30, lineHeight: 1.4 }}
                  >
                    個別ご相談
                  </span>
                </div>
                <div className="plan-note">SLA・専任サポート付き</div>
                <ul>
                  <li>Business の全機能</li>
                  <li>シングルサインオン (SAML / OIDC)</li>
                  <li>監査ログ・データレジデンシー対応</li>
                  <li>専任カスタマーサクセス</li>
                  <li>オンプレ / VPC デプロイ可</li>
                </ul>
                <a href="/login" className="btn btn-ghost">
                  ご相談を事前予約
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── FAQ ─────────── */}
      <section className="faq" id="faq">
        <div className="container">
          <div className="faq-grid">
            <div>
              <span className="eyebrow">よくある質問</span>
              <h2 className="section-title">
                ご利用前のご質問にお答えします。
              </h2>
              <p className="section-lead">
                こちらにない質問は、お気軽にお問い合わせください。導入相談会も毎週開催中です。
              </p>
              <div style={{ marginTop: 24 }}>
                <a href="/login" className="btn btn-ghost">
                  サポートに問い合わせる
                </a>
              </div>
            </div>
            <div className="faq-list">
              <details className="faq-item" open>
                <summary className="faq-q">
                  いつまで無料で使えますか？途中で課金されることは？
                </summary>
                <div className="faq-a">
                  ベータ期間中は、主要機能を無料でご利用いただけます。プロジェクト追加・コンペ機能などの拡張機能は今後有料プランとして提供予定ですが、その際は{" "}
                  <strong>
                    必ず 1ヶ月以上前にメールとダッシュボード上ではっきりと告知いたします
                  </strong>
                  。予告なしの課金・代金請求は一切行いません。
                </div>
              </details>
              <details className="faq-item">
                <summary className="faq-q">
                  既存のプロジェクト管理ツールから移行できますか？
                </summary>
                <div className="faq-a">
                  主要ツール（Jira / Notion / Asana / Backlog / monday.com
                  など）からの自動インポート機能は現在開発中です。リリースまでの間は、サポートが移行のお手伝いをいたしますので、お気軽にご相談ください。
                </div>
              </details>
              <details className="faq-item">
                <summary className="faq-q">
                  社内ドキュメントを AI に学習させても安全ですか？
                </summary>
                <div className="faq-a">
                  ご利用企業のデータが、他社の AI
                  学習に使われることはありません。データは暗号化された通信・保管と適切なアクセス制御のもとで管理しています。第三者認証（SOC2
                  / ISO27001 等）の取得は今後対応を予定しています。
                </div>
              </details>
              <details className="faq-item">
                <summary className="faq-q">
                  PMがいないチームでも使えますか？
                </summary>
                <div className="faq-a">
                  はい。むしろ「PMが不在 / 兼任 /
                  1人」のチームに最も効果的です。AI PM
                  がPMの定型業務を担うことで、エンジニアやデザイナーが本来の仕事に集中できます。
                </div>
              </details>
              <details className="faq-item">
                <summary className="faq-q">
                  どんな業界・職種で使われていますか？
                </summary>
                <div className="faq-a">
                  SI・受託開発・金融・製造業・社内システム部門など幅広く導入されています。プロジェクトマネジメントが必要な領域なら、業種を問わずご利用いただけます。
                </div>
              </details>
              <details className="faq-item">
                <summary className="faq-q">
                  日本語以外のサポートはありますか？
                </summary>
                <div className="faq-a">
                  現在は日本語に対応しています。英語・中国語（簡体字）などの多言語対応は、今後のロードマップに含まれています。
                </div>
              </details>
              <details className="faq-item">
                <summary className="faq-q">解約はいつでもできますか？</summary>
                <div className="faq-a">
                  はい、いつでも管理画面から解約手続きが可能です。違約金等は発生しません。
                </div>
              </details>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Final CTA ─────────── */}
      <section className="cta" id="cta">
        <div className="cta-pattern"></div>
        <div className="container cta-inner">
          <h2>
            誰でも、PMになれる。
            <br />
            今、AI PM はすべて無料で使えます。
          </h2>
          <p>
            クレジットカード不要・1分でセットアップ完了。
            <br />
            有料化の際は、1ヶ月以上前にきちんとお知らせします。
          </p>
          <div className="cta-buttons">
            <a href="/login" className="btn btn-primary">
              無料ではじめる
            </a>
            <a href="/login" className="btn btn-ghost">
              資料をダウンロード
            </a>
          </div>
        </div>
      </section>

      {/* ─────────── Footer ─────────── */}
      <footer>
        <div className="container">
          <div className="f-grid">
            <div className="f-brand">
              <a href="#" className="brand">
                <span className="brand-mark">
                  <img src="/lp/logo.png" alt="AI PM" />
                </span>
                <span>AI PM</span>
                <span className="tag">BETA</span>
              </a>
              <p>
                プロジェクトマネジメントを、AIと一緒に。
                <br />
                AI PM
                は、プロジェクトマネージャーの右腕として、推進する時間を取り戻すサービスです。
              </p>
              <div className="f-socials">
                <a href="#" aria-label="X">
                  𝕏
                </a>
                <a href="#" aria-label="note">
                  n
                </a>
                <a href="#" aria-label="YouTube">
                  ▶
                </a>
                <a href="#" aria-label="LinkedIn">
                  in
                </a>
              </div>
            </div>
            <div className="f-col">
              <h5>製品</h5>
              <ul>
                <li>
                  <a href="#about">特徴</a>
                </li>
                <li>
                  <a href="#features">機能一覧</a>
                </li>
                <li>
                  <a href="#pricing">料金プラン</a>
                </li>
                <li>
                  <a href="#">セキュリティ</a>
                </li>
                <li>
                  <a href="#">API連携</a>
                </li>
              </ul>
            </div>
            <div className="f-col">
              <h5>導入</h5>
              <ul>
                <li>
                  <a href="#">3分で分かるツアー</a>
                </li>
                <li>
                  <a href="#">資料ダウンロード</a>
                </li>
                <li>
                  <a href="#">無料デモ予約</a>
                </li>
              </ul>
            </div>
            <div className="f-col">
              <h5>リソース</h5>
              <ul>
                <li>
                  <a href="#">ヘルプセンター</a>
                </li>
                <li>
                  <a href="#">PM Blog</a>
                </li>
                <li>
                  <a href="#">ウェビナー</a>
                </li>
                <li>
                  <a href="#">開発者向け</a>
                </li>
              </ul>
            </div>
            <div className="f-col">
              <h5>会社</h5>
              <ul>
                <li>
                  <a href="#">会社概要</a>
                </li>
                <li>
                  <a href="#">採用情報</a>
                </li>
                <li>
                  <a href="#">プレスリリース</a>
                </li>
                <li>
                  <a href="#">お問い合わせ</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="f-bot">
            <div>© 2026 AI PM, Inc. All rights reserved.</div>
            <div style={{ display: "flex", gap: 16 }}>
              <a href="#">利用規約</a>
              <a href="#">プライバシーポリシー</a>
              <a href="#">セキュリティ</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
