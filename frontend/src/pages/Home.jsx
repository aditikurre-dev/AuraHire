import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const FAQS = [
  {
    q: "What file formats can I upload?",
    a: "A single .zip file containing your candidates' resumes. Inside it, .pdf, .docx, and .txt files are all supported — mix and match as needed.",
  },
  {
    q: "How does AuraHire actually score a candidate?",
    a: "Each resume is read in full and compared against the required skills, preferred skills, and minimum experience you set for the job. You get a score, which skills matched or were missing, and a short note on strengths and concerns — not just a number.",
  },
  {
    q: "Does AuraHire replace my judgment as an HR?",
    a: "No — it replaces the slow part. AuraHire narrows thousands of resumes down to a ranked shortlist with reasons attached, so you spend your time reviewing strong candidates instead of skimming everyone.",
  },
  {
    q: "What if the required skills change after I've uploaded resumes?",
    a: "Each job posting scores resumes against the skill list and experience you set for that posting. If requirements change, post a new job with the updated list and upload the resumes again.",
  },
  {
    q: "Do I need any technical setup to use this?",
    a: "No. Create an account, post a job with the role details, upload a zip of resumes, and the ranked shortlist comes back automatically.",
  },
  {
    q: "How does AuraHire avoid inflating a candidate's experience?",
    a: "It only counts professional experience as relevant if the role actually used the required tech stack — a Salesforce or SAP background isn't treated as relevant experience for a MERN role just because it's technical work. Unrelated experience is reported separately, and a duration is never guessed: if the resume doesn't state how long someone spent in a role, that's reported as 0 rather than an estimate.",
  },
];

export default function Home() {
  const { company } = useAuth();
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-blobs" aria-hidden="true">
          <span className="blob blob-coral" />
          <span className="blob blob-mint" />
          <span className="blob blob-violet" />
        </div>

        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Resume screening, reimagined</span>
            <h1>
              Stop reading
              <br />
              every <span className="text-coral">resume.</span>
            </h1>
            <p className="hero-subtitle">
              AuraHire opens every file, checks it against your job's exact skills and
              experience, and sends back a ranked shortlist — so the candidate worth your time
              is the one that rises to the top.
            </p>
            <div className="hero-cta">
              {company ? (
                <Link to="/create-job" className="btn btn-primary">
                  Post a Job
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary">
                    Get Started — It's Free
                  </Link>
                  <Link to="/login" className="btn btn-secondary">
                    Sign In
                  </Link>
                </>
              )}
            </div>

            <div className="claim-chips">
              <span className="chip chip-coral">One zip file</span>
              <span className="chip chip-mint">Every skill checked</span>
              <span className="chip chip-tangerine">Ranked in minutes</span>
              <span className="chip chip-violet">PDF · DOCX · TXT</span>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="mockup-card">
              <div className="mockup-header">
                <span className="mockup-dot mockup-dot-coral" />
                <span className="mockup-dot mockup-dot-tangerine" />
                <span className="mockup-dot mockup-dot-mint" />
                <span className="mockup-title">Ranked Candidates</span>
              </div>

              <div className="mockup-row">
                <span className="mockup-avatar mockup-avatar-coral" />
                <div className="mockup-lines">
                  <span className="mockup-line" style={{ width: "72%" }} />
                  <span className="mockup-line mockup-line-faint" style={{ width: "46%" }} />
                </div>
                <span className="badge badge-mint">94</span>
              </div>

              <div className="mockup-row">
                <span className="mockup-avatar mockup-avatar-violet" />
                <div className="mockup-lines">
                  <span className="mockup-line" style={{ width: "60%" }} />
                  <span className="mockup-line mockup-line-faint" style={{ width: "38%" }} />
                </div>
                <span className="badge badge-tangerine">81</span>
              </div>

              <div className="mockup-row">
                <span className="mockup-avatar mockup-avatar-mint" />
                <div className="mockup-lines">
                  <span className="mockup-line" style={{ width: "50%" }} />
                  <span className="mockup-line mockup-line-faint" style={{ width: "30%" }} />
                </div>
                <span className="badge badge-coral">63</span>
              </div>
            </div>

            <span className="floating-badge floating-badge-1">✓ Node.js matched</span>
            <span className="floating-badge floating-badge-2">⭐ Top pick</span>
          </div>
        </div>
      </section>

      <section className="category-row">
        <span className="eyebrow eyebrow-center">What's inside every scan</span>
        <h2>Three files, one verdict</h2>
        <div className="category-grid">
          <div className="category-card category-coral">
            <span className="category-icon">01</span>
            <h3>Skill match, checked line by line</h3>
            <p>
              Every resume is compared against your required and preferred skills — no
              skimming, no keyword guesswork.
            </p>
          </div>
          <div className="category-card category-mint">
            <span className="category-icon">02</span>
            <h3>One zip in, every candidate read</h3>
            <p>
              Drop in a zip of resumes. AuraHire opens each file, extracts the content, and
              gets to work in the background.
            </p>
          </div>
          <div className="category-card category-violet">
            <span className="category-icon">03</span>
            <h3>A shortlist, not a spreadsheet</h3>
            <p>
              Candidates come back scored and ranked, with strengths and concerns spelled out
              plainly for each one.
            </p>
          </div>
          <div className="category-card category-tangerine">
            <span className="category-icon">04</span>
            <h3>Doesn't inflate what isn't there</h3>
            <p>
              Experience in a different field or tech stack — like a Salesforce role on a MERN
              application — is flagged as irrelevant instead of counted toward the years
              required, and a duration is never guessed if the resume doesn't state one.
            </p>
          </div>
        </div>
      </section>

      <section className="compare">
        <span className="eyebrow eyebrow-center">Why teams switch</span>
        <h2>The old way, versus this way</h2>

        <div className="compare-grid">
          <div className="compare-card compare-card-old">
            <h3>Reading resumes one by one</h3>
            <ul className="compare-list">
              <li>
                <span className="compare-mark compare-mark-no">✕</span>
                Hours spent opening every single file
              </li>
              <li>
                <span className="compare-mark compare-mark-no">✕</span>
                Skills buried in paragraphs, easy to miss
              </li>
              <li>
                <span className="compare-mark compare-mark-no">✕</span>
                Gut-feel scoring that's hard to explain later
              </li>
              <li>
                <span className="compare-mark compare-mark-no">✕</span>
                The same pile re-read by every reviewer
              </li>
            </ul>
          </div>

          <div className="compare-card compare-card-new">
            <h3>Screening with AuraHire</h3>
            <ul className="compare-list">
              <li>
                <span className="compare-mark compare-mark-yes">✓</span>
                Every resume opened and read automatically
              </li>
              <li>
                <span className="compare-mark compare-mark-yes">✓</span>
                Skills matched against your exact list
              </li>
              <li>
                <span className="compare-mark compare-mark-yes">✓</span>
                A score and a stated reason for every candidate
              </li>
              <li>
                <span className="compare-mark compare-mark-yes">✓</span>
                One ranked list the whole team can work from
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="flow-row">
        <span className="eyebrow eyebrow-center">See it in action</span>
        <h2>From application to shortlist</h2>
        <p className="flow-intro">
          Watch a resume travel through AuraHire — the ones that fit the role make the
          shortlist, the ones that don't get filtered out automatically.
        </p>
        <div className="flow-scene">
          <svg viewBox="0 0 1200 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animation of a resume being submitted by a candidate, filtered by AuraHire, and landing on an HR shortlist">
            <defs>
              <linearGradient id="flowMachineGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--coral)" />
                <stop offset="100%" stopColor="var(--mint)" />
              </linearGradient>
            </defs>

            {/* connective flow lines */}
            <path className="flow-connector" d="M255,262 C 360,220 470,220 513,203" />
            <path className="flow-connector" d="M690,188 C 800,148 900,150 998,236" />

            {/* ---------------- Candidate ---------------- */}
            <g>
              <rect className="flow-desk" x="60" y="290" width="190" height="14" rx="4" />
              <path className="flow-laptop-base" d="M100,286 L230,286 L242,300 L88,300 Z" />
              <rect className="flow-laptop-screen" x="108" y="222" width="114" height="66" rx="8" />
              <polygon
                className="flow-mini-star"
                points="165,236 168.5,247 180,247 170.7,253.6 174.2,264.6 165,258 155.8,264.6 159.3,253.6 150,247 161.5,247"
              />
              <path className="flow-hair" d="M143,180 Q165,148 187,180 Q165,163 143,180 Z" />
              <circle className="flow-skin" cx="165" cy="185" r="22" />
              <rect className="flow-skin" x="157" y="200" width="16" height="12" />
              <rect className="flow-torso flow-torso-coral" x="131" y="205" width="68" height="72" rx="22" />
            </g>

            {/* ---------------- AuraHire filter machine ---------------- */}
            <circle className="flow-gear-ring" cx="600" cy="195" r="100" />
            <rect className="flow-machine-body" x="520" y="115" width="160" height="160" rx="28" />
            <rect className="flow-slot" x="510" y="180" width="16" height="26" rx="6" />
            <rect className="flow-slot" x="674" y="170" width="16" height="26" rx="6" />
            <polygon
              className="flow-star"
              points="600,161 607.6,184.5 632.3,184.5 612.4,199 620,222.5 600,208 580,222.5 587.6,199 567.7,184.5 592.4,184.5"
            />

            {/* rejected resume falls here */}
            <g className="reject-tray">
              <rect className="flow-tray-rim" x="568" y="326" width="64" height="6" rx="3" />
              <path className="flow-tray-body" d="M572,332 L628,332 L618,362 L582,362 Z" />
            </g>

            {/* traveling resumes — drawn above the machine/tray so the flight stays visible */}
            <g className="paper paper-a">
              <rect x="150" y="200" width="30" height="38" rx="4" />
              <rect className="paper-line" x="156" y="210" width="18" height="3" rx="1.5" />
              <rect className="paper-line" x="156" y="218" width="18" height="3" rx="1.5" />
              <rect className="paper-line" x="156" y="226" width="14" height="3" rx="1.5" />
            </g>
            <g className="paper paper-b">
              <rect x="150" y="206" width="30" height="38" rx="4" />
              <rect className="paper-line" x="156" y="216" width="18" height="3" rx="1.5" />
              <rect className="paper-line" x="156" y="224" width="18" height="3" rx="1.5" />
              <rect className="paper-line" x="156" y="232" width="14" height="3" rx="1.5" />
            </g>

            {/* ---------------- HR ---------------- */}
            <g>
              <rect className="flow-desk" x="980" y="290" width="190" height="14" rx="4" />
              <rect className="flow-clipboard" x="1000" y="210" width="100" height="118" rx="12" />
              <rect className="flow-clip-tab" x="1032" y="200" width="36" height="16" rx="6" />
              <rect className="flow-row-line" x="1014" y="228" width="54" height="8" rx="4" />
              <rect className="flow-row-line" x="1014" y="254" width="54" height="8" rx="4" />
              <rect className="flow-row-line" x="1014" y="280" width="54" height="8" rx="4" />
              <circle className="flow-badge flow-badge-mint" cx="1082" cy="232" r="9" />
              <circle className="flow-badge flow-badge-violet" cx="1082" cy="258" r="9" />
              <circle className="flow-badge flow-badge-gold badge-pop" cx="1082" cy="284" r="9" />
              <circle className="sparkle sparkle-1" cx="1082" cy="284" r="3" />
              <circle className="sparkle sparkle-2" cx="1082" cy="284" r="3" />
              <circle className="sparkle sparkle-3" cx="1082" cy="284" r="3" />
              <g className="hr-head-group">
                <path className="flow-hair" d="M1013,180 Q1035,148 1057,180 Q1035,163 1013,180 Z" />
                <circle className="flow-skin" cx="1035" cy="185" r="22" />
                <rect className="flow-skin" x="1027" y="200" width="16" height="12" />
              </g>
              <rect className="flow-torso flow-torso-mint" x="1001" y="205" width="68" height="72" rx="22" />
            </g>
          </svg>
        </div>
      </section>

      <section className="how-it-works">
        <span className="eyebrow eyebrow-center">The process</span>
        <h2>From job post to shortlist</h2>
        <ol className="steps">
          <li>
            <span className="step-tab step-tab-coral">01</span>
            <div>
              <strong>Create your account</strong>
              <p>Free, and takes under a minute.</p>
            </div>
          </li>
          <li>
            <span className="step-tab step-tab-tangerine">02</span>
            <div>
              <strong>Post a job</strong>
              <p>Describe the role and list required and preferred skills.</p>
            </div>
          </li>
          <li>
            <span className="step-tab step-tab-mint">03</span>
            <div>
              <strong>Upload resumes</strong>
              <p>A single .zip file is all it takes.</p>
            </div>
          </li>
          <li>
            <span className="step-tab step-tab-violet">04</span>
            <div>
              <strong>Review your shortlist</strong>
              <p>Scored, ranked, and ready to act on.</p>
            </div>
          </li>
        </ol>

        {!company && (
          <div className="how-it-works-cta">
            <Link to="/register" className="btn btn-primary">
              Get Started — It's Free
            </Link>
          </div>
        )}
      </section>

      <section className="faq">
        <span className="eyebrow eyebrow-center">Good to know</span>
        <h2>Frequently Asked Question</h2>

        <div className="faq-list">
          {FAQS.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={item.q} className={"faq-item" + (isOpen ? " faq-item-open" : "")}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <span className="faq-toggle">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && <p className="faq-answer">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} AuraHire. Built for hiring teams who move fast.</p>
      </footer>
    </div>
  );
}
