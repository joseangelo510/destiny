import type { Metadata } from "next";

import "./home.css";

export const metadata: Metadata = {
  title: "Rebound SEO — SEO momentum for founders",
  description: "Turn an expert SEO playbook into a focused three-month plan and one clear weekly action.",
};

export default function HomePage() {
  return (
    <div className="lp-root">
      <header className="site">
        <div className="wrap nav">
          <a className="logo" href="#">
            <span className="logo-mark">R</span>Rebound SEO
          </a>
          <nav className="nav-links" aria-label="Primary">
            <a href="#different">Why Rebound SEO</a>
            <a href="#how">How it works</a>
            <a href="#tools">Tools</a>
            <a href="#who">Who it&apos;s for</a>
            <a href="#plan">Pricing</a>
          </nav>
          <div className="nav-right">
            <a className="quiet" href="/login?next=%2Fapp">Open demo</a>
            <a className="btn btn-forest btn-sm" href="#plan">Analyze a website</a>
          </div>
        </div>
      </header>

      {/* 1 · HERO */}
      <div className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">Guided SEO execution for founders</span>
            <h1 className="display">
              You built something worth finding. Now <em>get found.</em>
            </h1>
            <p className="lede">
              Most tools stop at publish. Rebound SEO takes you the extra mile, sharing your content where it matters:
              Reddit, LinkedIn, creators, Product Hunt, and that&apos;s just the start.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-forest" href="/onboarding">Analyze my website</a>
              <a className="btn btn-outline" href="#how">See how it works</a>
            </div>
            <div className="hero-notes">
              <span>Your voice, not generic AI</span>
              <span>You approve every move</span>
              <span>No retainers</span>
            </div>
          </div>

          <div
            className="app-shot"
            role="img"
            aria-label="The Rebound SEO workspace showing this week's distribution tasks: Reddit and Quora replies, LinkedIn and X shares, niche creators, and directory reviews"
          >
            <div className="app-topbar">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="crumb">brightpath-example.com · Week 1</span>
              <span className="streak">4 distribution tasks</span>
            </div>
            <div className="app-body">
              <div className="app-week">This week</div>
              <div className="app-week-sub">Four kinds of work build your visibility. This is the one everyone else skips.</div>
              <div className="loop-tabs">
                <div className="loop-tab"><span className="loop-ico ico-sage">⌕</span><b>Research &amp; strategy</b><span>1 task</span></div>
                <div className="loop-tab"><span className="loop-ico ico-lime">✎</span><b>Content creation</b><span>1 task</span></div>
                <div className="loop-tab active"><span className="loop-ico ico-cream">↗</span><b>Distribution</b><span>4 tasks</span></div>
                <div className="loop-tab"><span className="loop-ico ico-mist">#</span><b>Technical SEO</b><span>2 tasks</span></div>
              </div>
              <div className="move-panel">
                <span className="audit-pill"><i></i>Guided action</span>
                <div className="move-eyebrow">Your clearest next move</div>
                <h3>Reply where your buyers are already asking.</h3>
                <p>
                  Three Reddit and Quora discussions match your priority topics this week. Join them as yourself, with
                  Rebound SEO&apos;s guidance on what to say.
                </p>
                <span className="btn btn-lime btn-sm">Open guided step</span>
              </div>
              <div className="dlist" style={{ marginTop: "12px" }}>
                <div className="dtask">
                  <span className="task-num">2</span>
                  <div className="dt-body">
                    <b>Share this week&apos;s approved article on LinkedIn and X</b>
                    <span>15 min · This moves you toward → Build visibility</span>
                  </div>
                  <span className="dt-chip">Ready to start</span>
                </div>
                <div className="dtask">
                  <span className="task-num">3</span>
                  <div className="dt-body">
                    <b>Review three niche creators covering your priority topics</b>
                    <span>30 min · Your confirmation required</span>
                  </div>
                  <span className="dt-chip">Ready to start</span>
                </div>
                <div className="dtask">
                  <span className="task-num">4</span>
                  <div className="dt-body">
                    <b>Complete one directory profile or request three reviews</b>
                    <span>25 min · This moves you toward → Grow what works</span>
                  </div>
                  <span className="dt-chip">Ready to start</span>
                </div>
              </div>
              <div className="noticed">
                <span className="check">✓</span>
                <div>
                  <b>Last week&apos;s article was shared.</b> <span>LinkedIn and X, saved to your record.</span>
                </div>
                <span className="verify">Verified by Rebound SEO</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2 · THE PROBLEM */}
      <section className="band sec-tight">
        <div className="wrap">
          <div className="problem-grid">
            <div className="problem">
              <span className="eyebrow">The problem</span>
              <h2 className="display">
                99 founder problems and SEO <em>ain&apos;t one.</em>
              </h2>
              <p>
                You&apos;ve got a product to build, customers to serve, and a business to run. Rebound SEO handles the
                fundamentals of <b>technical SEO, keywords strategy, and content creation</b>, then becomes your{" "}
                <b>distribution superpower</b>: a moat your competitors can&apos;t copy and the next Google update
                can&apos;t break.
              </p>
            </div>
            <div className="plate" role="img" aria-label="A founder's plate of responsibilities with SEO crossed off, handled by Rebound SEO">
              <div className="plate-card">
                <div className="plate-label">Your plate this week</div>
                <div className="chips">
                  <span className="p-chip">Ship v2</span>
                  <span className="p-chip">Customer calls</span>
                  <span className="p-chip">Hiring</span>
                  <span className="p-chip">Cash flow</span>
                  <span className="p-chip">Support tickets</span>
                  <span className="p-chip">Investor update</span>
                  <span className="p-chip">Partnerships</span>
                  <span className="p-chip">Payroll</span>
                  <span className="p-chip gone">SEO</span>
                </div>
              </div>
              <div className="handled">
                <div className="h-label">Off your plate · On your plan</div>
                <ul>
                  <li><span className="hk">✓</span>Technical SEO <span>· audited, fixes guided</span></li>
                  <li><span className="hk">✓</span>Keyword strategy <span>· researched, you approve</span></li>
                  <li><span className="hk">✓</span>Content creation <span>· drafted in your voice</span></li>
                  <li><span className="hk">✓</span>Distribution <span>· planned into every week</span></li>
                </ul>
                <div className="moat">
                  <b>The moat:</b> the extra mile your competitors skip and the next update can&apos;t break.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 · WHAT MAKES DESTINY DIFFERENT */}
      <section id="different">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Why Rebound SEO</span>
            <h2 className="display">
              Every SEO tool gives you data. Rebound SEO gives you <em>execution.</em>
            </h2>
            <p>
              The thousand tools out there were built for SEO managers with dashboards to read and teams to delegate to.
              Rebound SEO was built for the founder doing it alone.
            </p>
          </div>
          <div className="compare">
            <div className="compare-head"><div className="them">Every other tool</div><div className="us">Rebound SEO</div></div>
            <div className="compare-row"><div className="them">Hands you 500 keywords.</div><div className="us">Hands you this week&apos;s move.</div></div>
            <div className="compare-row"><div className="them">Stops at publish.</div><div className="us">Distributes: Reddit, LinkedIn, creators, and beyond.</div></div>
            <div className="compare-row"><div className="them">Sells shortcuts that die in the next update.</div><div className="us">Only builds what lasts.</div></div>
            <div className="compare-row"><div className="them">Chases enterprise.</div><div className="us">Built for you.</div></div>
          </div>
        </div>
      </section>

      {/* 4 · HOW IT WORKS */}
      <section className="band" id="how">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">How it works</span>
            <h2 className="display">
              Tell Rebound SEO your story. Get your <em>game plan.</em>
            </h2>
            <p>A short interview plus a live audit of your site becomes your three month plan. Then, one week at a time, you execute.</p>
          </div>
          <div className="loop-grid">
            <div className="loop-card">
              <span className="loop-step">1</span>
              <h3>Tell your story</h3>
              <p>
                A guided interview captures your business, your customers, your competitors, and what makes you
                different. Then Rebound SEO audits your website live and finds the gaps.
              </p>
              <span className="chip cream">About 20 minutes, once</span>
            </div>
            <div className="loop-card">
              <span className="loop-step">2</span>
              <h3>Get your game plan</h3>
              <p>
                The interview and audit become a three month plan across research, content, distribution, and technical
                SEO, with one clearest next move always on top. You approve the direction before anything starts.
              </p>
              <span className="chip">Your confirmation required</span>
            </div>
            <div className="loop-card">
              <span className="loop-step">3</span>
              <h3>Do this week. Just this week.</h3>
              <p>
                Every task shows how long it takes, why it matters, and what done looks like. Finish, and it lands in
                your record, verified against real data. Next week, the plan updates.
              </p>
              <span className="chip">20 minutes and up, weekly</span>
            </div>
          </div>
          <div className="loop-note">
            <span className="mini">✓</span>
            <div>Never wonder what to do next. Too much this week? One tap trims the plan down to what matters most.</div>
          </div>
        </div>
      </section>

      {/* 5 · YOUR VOICE + THE HABIT */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">The important difference</span>
            <h2 className="display">
              Most tools produce more content. Rebound SEO produces more of <em>you.</em>
            </h2>
            <p>
              Your opinions, lessons, and real language become the raw material. A weekly rhythm keeps it coming, twenty
              minutes at a time.
            </p>
          </div>
          <div className="twoup">
            <div className="twoup-card">
              <span className="eyebrow">Your voice</span>
              <h3>Content that sounds like you. Because it came from you.</h3>
              <p>
                Short interviews turn your stories into articles generic AI can&apos;t fake. You review every draft and
                approve every word before anything moves.
              </p>
              <div className="voice-vs">
                <div className="vq generic">
                  <b>Generic AI</b>
                  Work with a knowledgeable real estate agent who understands the local market and can help you find the
                  right home.
                </div>
                <div className="vq yours">
                  <b>Rebound SEO · Maya&apos;s voice</b>
                  &quot;A San Francisco home is more than square footage. The block, the light, the inspection, and the
                  life your family will build there can change the entire decision.&quot;
                  <span className="vtag">Agent interview · client informed</span>
                </div>
              </div>
            </div>
            <div className="twoup-card">
              <span className="eyebrow">The habit</span>
              <h3>Twenty minutes a week. Compounding for years.</h3>
              <p>
                SEO rewards showing up, so Rebound SEO is built like a streak: finish this week&apos;s tasks, earn your
                Perfect Week, and watch the record of everything you&apos;ve shipped grow.
              </p>
              <div className="habit-board" aria-label="A twelve week streak, five weeks complete">
                <div className="habit-top">
                  <span className="streak-pill">5-week streak</span>
                  <span className="pw">Perfect Week ×2</span>
                  <span className="ovr">♡ I&apos;m overwhelmed</span>
                </div>
                <div className="streak-strip" aria-hidden="true">
                  <i className="on">✓</i><i className="on">✓</i><i className="on">✓</i><i className="on">✓</i><i className="on">✓</i><i>6</i><i>7</i><i>8</i><i>9</i><i>10</i><i>11</i><i>12</i>
                </div>
                <div className="habit-cap"><span>Week 1</span><span>Small weeks stack into rankings that stay.</span><span>Week 12</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6 · CAPABILITIES */}
      <section className="band" id="tools">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">The toolkit</span>
            <h2 className="display">
              The fundamentals, handled. The extra mile, <em>included.</em>
            </h2>
            <p>Eleven tools in one workspace. They stay out of the way until the task in front of you needs them.</p>
          </div>

          <div className="group-label first">The fundamentals</div>
          <div className="cap-grid">
            <div className="cap"><span className="cap-ico ico-sage">✓</span><h3>Website audits</h3><p>Find crawlability, indexing, and speed issues, then turn the clearest fix into a guided task.</p></div>
            <div className="cap"><span className="cap-ico ico-sage">⌕</span><h3>Keyword strategy &amp; research</h3><p>Live demand, intent, and difficulty, turned into a direction you approve or decline.</p></div>
            <div className="cap"><span className="cap-ico ico-lime">✎</span><h3>Content studio</h3><p>Three articles a week, built from your strategy and your voice, reviewed by you before delivery.</p></div>
            <div className="cap"><span className="cap-ico ico-mist">#</span><h3>Guided technical fixes</h3><p>Plain English steps for every issue, sized so you or your developer can knock them out.</p></div>
          </div>

          <div className="group-label"><span className="accent">The extra mile</span></div>
          <div className="cap-grid">
            <div className="cap"><span className="cap-ico ico-cream">↗</span><h3>Distribution</h3><p>Reddit and Quora conversations, LinkedIn shares, creators in your space, and directory listings, planned into every week.</p></div>
            <div className="cap"><span className="cap-ico ico-sage">☆</span><h3>Reviews</h3><p>Grow reviews across the directories where customers compare you.</p></div>
            <div className="cap"><span className="cap-ico ico-mist">⤴</span><h3>Backlink analytics</h3><p>See who links to you, who links to competitors, and where honest opportunities are.</p></div>
            <div className="cap"><span className="cap-ico ico-mist">▤</span><h3>Rank tracker</h3><p>Watch your positions move as the weeks stack up.</p></div>
            <div className="cap"><span className="cap-ico ico-lime">◈</span><h3>LLM visibility</h3><p>See how you show up where AI answers, not just where Google ranks.</p></div>
            <div className="cap"><span className="cap-ico ico-cream">⇄</span><h3>Connections</h3><p>Link Search Console, Analytics, Business Profile, and YouTube so results get verified with your own data. WordPress drafting included, more destinations coming.</p></div>
          </div>
        </div>
      </section>

      {/* 7 · WHO THIS IS FOR + PROBLEMS */}
      <section id="who">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Who this is for</span>
            <h2 className="display">
              Built for the founder doing <em>everything.</em>
            </h2>
            <p>If you can give SEO twenty minutes a week, consistently, you&apos;re exactly who this was built for.</p>
          </div>
          <div className="persona-grid">
            <div className="persona"><h3>The bootstrapped founder</h3><p>Every dollar counts. You need agency level strategy at a price that doesn&apos;t touch payroll.</p></div>
            <div className="persona"><h3>The solo operator</h3><p>You wear ten hats. You need SEO to be one task at a time, not a second job.</p></div>
            <div className="persona"><h3>The long term player</h3><p>You&apos;re building a real business. You need rankings that survive every update, not spikes that vanish.</p></div>
          </div>
          <div className="honest-note">
            <b>Not for you</b> if you want overnight rankings or someone to do it all without you. SEO compounds through
            your consistency, and Rebound SEO is how you keep it.
          </div>

          <div className="prob-list">
            <div className="prob-row"><div className="q">&quot;I don&apos;t know where to start.&quot;</div><div className="a"><b>One clearest next move,</b> always on top of your plan.</div></div>
            <div className="prob-row"><div className="q">&quot;I don&apos;t have time.&quot;</div><div className="a"><b>Tasks sized to your week,</b> twenty minutes and up.</div></div>
            <div className="prob-row"><div className="q">&quot;I published content and nothing happened.&quot;</div><div className="a"><b>Distribution built into every week,</b> so your work actually gets seen.</div></div>
            <div className="prob-row"><div className="q">&quot;I can&apos;t tell good advice from gaslighting.&quot;</div><div className="a"><b>Fifteen years of practice</b> behind every recommendation, and nothing that risks a penalty.</div></div>
            <div className="prob-row"><div className="q">&quot;I can&apos;t keep it up.&quot;</div><div className="a"><b>Streaks, a trimmable weekly plan,</b> and a visible record of everything you&apos;ve shipped.</div></div>
          </div>
        </div>
      </section>

      {/* 8 · OUTCOMES */}
      <section className="band">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Outcomes</span>
            <h2 className="display">
              What changes when you <em>stick with it.</em>
            </h2>
          </div>
          <div className="timeline">
            <div className="tl-card">
              <div className="when">Week 1</div>
              <h3>Your audit becomes a plan</h3>
              <p>Your site&apos;s gaps are found, your strategy is drafted, and you make your first move.</p>
            </div>
            <div className="tl-card">
              <div className="when">Month 1</div>
              <h3>The fundamentals are moving</h3>
              <p>Your biggest site issues are fixed, your keyword direction is approved, and your first articles are live and shared.</p>
            </div>
            <div className="tl-card">
              <div className="when">Month 3</div>
              <h3>A full cycle, complete</h3>
              <p>Content published and distributed, listings and reviews growing, and your rank tracker showing what your consistency earned.</p>
            </div>
          </div>
          <div className="verify-line">
            <span className="verify">Verified by Rebound SEO</span>
            Every result verified against your own Search Console and Analytics, not our word for it. SEO takes months.
            Rebound SEO makes sure the months add up.
          </div>
        </div>
      </section>

      {/* 9 · TRUST */}
      <section className="honest">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Why trust us</span>
            <h2 className="display">
              15 years of SEO. Zero <em>shortcuts.</em>
            </h2>
            <p>
              Rebound SEO was built by SEOs who&apos;ve done this through every Google update since 2010. No bought
              backlinks, no tricks that get you penalized, no advice you&apos;ll have to undo. And it doesn&apos;t just
              claim progress: your work gets verified against real data from your own Search Console and Analytics.
            </p>
          </div>
        </div>
      </section>

      {/* 10 · PRICING */}
      <section id="plan">
        <div className="wrap">
          <div className="plan">
            <div>
              <div className="plan-label">Founding plan</div>
              <div className="price">
                $39.99<small>/month</small>
              </div>
            </div>
            <div>
              <h2>Everything an agency does. None of the retainers.</h2>
              <p>
                The full system: your three month strategy, your weekly plan, content creation, distribution, and every
                tool included. Agencies charge $1,500 a month for less involvement than this.
              </p>
            </div>
            <a className="btn btn-forest" href="/onboarding">Start getting found</a>
          </div>
        </div>
      </section>

      {/* 11 · CLOSER */}
      <div className="closer">
        <div className="wrap">
          <h2 className="display">
            Being found is the next thing you <em>build.</em>
          </h2>
        </div>
      </div>

      <footer>
        <div className="wrap foot">
          <span className="logo">
            <span className="logo-mark" style={{ width: "22px", height: "22px", fontSize: "12px" }}>R</span>Rebound SEO
          </span>
          <span>Expert SEO, made accessible to founders.</span>
          <span className="right">Live SEO analysis connected · Google account and sending integrations require owner authorization.</span>
        </div>
      </footer>
    </div>
  );
}
