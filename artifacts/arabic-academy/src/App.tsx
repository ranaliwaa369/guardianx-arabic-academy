import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Compass, Flame, Headphones, Layers3, LockKeyhole, LogOut,
  Menu, Search, Sun, Volume2, X,
} from 'lucide-react';
import {
  getGetAcademyDashboardQueryKey, getListAcademyFlashcardsQueryKey,
  getListInstructorReviewItemsQueryKey, getListLessonProgressQueryKey,
  useGetAcademyDashboard, useGetAcademyUnit, useListAcademyFlashcards,
  useListInstructorReviewItems, useListLessonProgress, useReviewAcademyFlashcard,
  useSaveLessonProgress, useSubmitActivityAnswer, useUpdateInstructorReviewItem,
} from '@workspace/api-client-react';
import type { AcademyActivity, AcademyFlashcard, AcademyLesson, InstructorReviewItem } from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#20584d',
    colorForeground: '#193b35',
    colorMutedForeground: '#657a72',
    colorDanger: '#b6483e',
    colorBackground: '#fffdf8',
    colorInput: '#fffdf8',
    colorInputForeground: '#193b35',
    colorNeutral: '#ded8ca',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] rounded-[24px] w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#193b35] font-semibold tracking-tight',
    headerSubtitle: 'text-[#657a72]',
    socialButtonsBlockButtonText: 'text-[#193b35] font-medium',
    formFieldLabel: 'text-[#254840] font-medium',
    footerActionLink: 'text-[#20584d] font-semibold',
    footerActionText: 'text-[#657a72]',
    dividerText: 'text-[#657a72]',
    identityPreviewEditButton: 'text-[#20584d]',
    formFieldSuccessText: 'text-[#20584d]',
    alertText: 'text-[#8f342e]',
    logoBox: 'mb-3',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-[#ded8ca] bg-[#fffdf8] rounded-xl hover:bg-[#f5f1e7]',
    formButtonPrimary: 'bg-[#20584d] hover:bg-[#17473e] rounded-xl',
    formFieldInput: 'border-[#ded8ca] bg-[#fffdf8] text-[#193b35] rounded-xl',
    footerAction: 'mt-5',
    dividerLine: 'bg-[#ded8ca]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'border-[#ded8ca] bg-[#fffdf8] text-[#193b35] rounded-lg',
    formFieldRow: 'mb-4',
    main: 'gap-4',
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={cx('brand', inverse && 'brand-inverse')} data-testid="link-brand-home">
    <span className="brand-mark"><span className="arabic">ض</span></span>
    <span className="brand-copy"><b>Bayt al-Lugha</b><small>THE ARABIC LEARNING HOUSE</small></span>
  </Link>;
}

function Button({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cx('button', className)} {...props}>{children}</button>;
}

function TopNav() {
  const [open, setOpen] = useState(false);
  return <header className="top-nav">
    <Brand />
    <nav className={cx('public-nav-links', open && 'nav-open')}>
      <a href="#approach" onClick={() => setOpen(false)}>Our approach</a>
      <a href="#preview" onClick={() => setOpen(false)}>Course preview</a>
      <Link href="/sign-in" onClick={() => setOpen(false)}>Sign in</Link>
      <Link href="/sign-up" className="nav-cta" onClick={() => setOpen(false)}>Begin learning <ArrowRight size={15} /></Link>
    </nav>
    <button className="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)} data-testid="button-mobile-menu">{open ? <X /> : <Menu />}</button>
  </header>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="page-loading"><div className="loading-mark arabic">ض</div><span>Opening your study room…</span></div>;
  return isSignedIn ? <Redirect to="/dashboard" /> : <LandingPage />;
}

function LandingPage() {
  return <main className="landing">
    <TopNav />
    <section className="hero-wrap">
      <div className="hero-copy fade-up">
        <p className="eyebrow"><span className="eyebrow-dot" /> A thoughtful first step into Arabic</p>
        <h1 className="display">A new language.<br /><em>A wider world.</em></h1>
        <p className="hero-lede">Learn to greet, understand, and connect in Modern Standard Arabic — one useful phrase at a time.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/sign-up">Start your first lesson <ArrowRight size={17} /></Link>
          <Link className="text-link" href="/sign-in">I already have an account <ArrowUpRight size={15} /></Link>
        </div>
        <div className="hero-proof"><div className="proof-avatars"><span>م</span><span>ن</span><span>ل</span></div><p><b>Made for complete beginners</b><br />No prior Arabic needed</p></div>
      </div>
      <div className="hero-art fade-up delay-2">
        <div className="art-stamp">UNIT 01 <span>·</span> BEGIN HERE</div>
        <div className="art-card">
          <div className="art-ornament" aria-hidden="true">✧</div>
          <p className="art-label">YOUR FIRST WORD</p>
          <div className="art-arabic arabic" dir="rtl">السَّلَامُ عَلَيْكُمْ</div>
          <div className="art-rule"><span /></div>
          <p className="art-translit">as-salāmu ʿalaykum</p>
          <p className="art-translation">Peace be upon you</p>
          <span className="art-note">A greeting that carries a wish for peace.</span>
        </div>
        <div className="floating-note note-top"><span className="note-icon"><Volume2 size={16} /></span><span><b>Follow each sound</b><small>Written pronunciation cues</small></span></div>
        <div className="floating-note note-bottom"><span className="note-check"><Check size={15} /></span><span><b>Say it with confidence</b><small>Practice, then remember</small></span></div>
        <div className="art-grid" />
      </div>
      <div className="hero-foot"><span>01 / 03</span><span className="hero-foot-line" /><span>THE BEGINNER'S PATH</span></div>
    </section>
    <section className="approach-section" id="approach">
      <div className="section-side"><span className="section-number">01</span><span className="vertical-label">THE METHOD</span></div>
      <div className="approach-main">
        <p className="eyebrow">Language for real life</p>
        <h2 className="display">Understand the shape<br />of a conversation.</h2>
        <p className="section-intro">Arabic becomes less mysterious when every new script, sound, and meaning is introduced together. Our lessons take you there in small, satisfying steps.</p>
        <div className="method-list">
          <div className="method-row"><span className="method-index">01</span><div className="method-icon arabic">ب</div><div><h3>Read what you hear</h3><p>Meet the Arabic script alongside an approachable transliteration and a clear English meaning.</p></div><ArrowDownLeft className="method-arrow" size={18} /></div>
          <div className="method-row"><span className="method-index">02</span><div className="method-icon"><Headphones size={19} /></div><div><h3>Notice each sound</h3><p>Written pronunciation guidance helps you slow down and attend to each sound. Recorded audio is not set up yet.</p></div><ArrowDownLeft className="method-arrow" size={18} /></div>
          <div className="method-row"><span className="method-index">03</span><div className="method-icon"><CheckCircle2 size={19} /></div><div><h3>Try it right away</h3><p>Practice with one question at a time, then get useful feedback before moving on.</p></div><ArrowDownLeft className="method-arrow" size={18} /></div>
        </div>
      </div>
      <aside className="aside-quote"><span className="quote-mark">“</span><p>Language is not just words. It is an invitation to understand one another.</p><span>THE SPIRIT OF THE COURSE</span></aside>
    </section>
    <section className="preview-section" id="preview">
      <div className="preview-heading">
        <div><p className="eyebrow">A small look inside</p><h2 className="display">Your first five minutes.</h2></div>
        <Link className="text-link" href="/sign-up">Explore the full course <ArrowRight size={15} /></Link>
      </div>
      <div className="preview-grid">
        <article className="preview-step step-arabic"><span className="preview-step-no">01 / NOTICE</span><span className="arabic preview-large" dir="rtl">مَرْحَبًا</span><p>Start with one welcoming word.</p><span className="preview-mini">marḥaban · hello</span></article>
        <article className="preview-step step-pronounce"><span className="preview-step-no">02 / UNDERSTAND</span><span className="phonetic">mar · ḥa · ban</span><p>Let the sounds take their time.</p><div className="sound-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></article>
        <article className="preview-step step-practice"><span className="preview-step-no">03 / PRACTICE</span><span className="practice-prompt">How do you say “hello”?</span><span className="answer-chip"><span>مَرْحَبًا</span><Check size={15} /></span><p>Choose, check, and learn.</p></article>
      </div>
    </section>
    <section className="closing-band"><div className="closing-mark arabic">أهلاً</div><div><p className="eyebrow">Your place is ready</p><h2 className="display">Begin with a greeting.</h2></div><Link className="button button-light" href="/sign-up">Create your free account <ArrowRight size={17} /></Link></section>
    <footer className="site-footer"><Brand inverse /><p>Carefully guided Arabic, from the very first word.</p><span>© BAYT AL-LUGHA · ACADEMY</span></footer>
  </main>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) client.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function AuthPage({ mode }: { mode: 'in' | 'up' }) {
  return <main className="auth-page">
    <div className="auth-aside"><Brand inverse /><div className="auth-art"><span className="auth-overline">A LANGUAGE, LEARNED WITH CARE</span><div className="arabic auth-arabic" dir="rtl">أهلاً وسهلاً</div><p>Welcome, and may you find ease here.</p><span className="auth-art-rule" /></div><span className="auth-aside-foot">MODERN STANDARD ARABIC · BEGINNER COURSE</span></div>
    <div className="auth-content"><Link href="/" className="auth-back"><ArrowLeft size={15} /> Back to the academy</Link><div className="auth-form-wrap">{mode === 'in'
      ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}
      <p className="auth-support">A calm place to begin. Your progress stays with you.</p></div></div>
  </main>;
}

function ProtectedRoute({ children, instructor = false }: { children: ReactNode; instructor?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const dashboard = useGetAcademyDashboard({ query: { enabled: !!isSignedIn, queryKey: getGetAcademyDashboardQueryKey(), retry: false } });
  if (!isLoaded) return <LoadingPage />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (dashboard.isLoading) return <LoadingPage />;
  if (dashboard.isError) return <ErrorPage retry={() => dashboard.refetch()} title="We couldn't load your study space" />;
  if (instructor && dashboard.data?.role !== 'instructor' && dashboard.data?.role !== 'admin') return <AccessDenied />;
  return <>{children}</>;
}

function LoadingPage() {
  return <div className="page-loading"><div className="loading-mark arabic">ض</div><div className="skeleton-line" /><div className="skeleton-line short" /><span>Gathering your lesson…</span></div>;
}

function ErrorPage({ retry, title }: { retry: () => void; title: string }) {
  return <div className="status-page"><div className="status-symbol"><CircleHelp /></div><h1>{title}</h1><p>Your saved learning is safe. Please try again in a moment.</p><Button className="button-primary" onClick={retry} data-testid="button-retry">Try again <ArrowRight size={16} /></Button></div>;
}

function AccessDenied() {
  return <main className="status-page"><div className="status-symbol"><LockKeyhole /></div><h1>Instructor access required</h1><p>This review space is only available to instructor accounts.</p><Link href="/dashboard" className="button button-primary">Return to your dashboard <ArrowRight size={16} /></Link></main>;
}

function AppShell({ children, active }: { children: ReactNode; active: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const dash = useGetAcademyDashboard();
  const isStaff = dash.data?.role === 'admin' || dash.data?.role === 'instructor';
  const name = dash.data?.displayName || user?.firstName || 'Learner';
  const nav = <><div className="sidebar-head"><Brand inverse /><button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button></div>
    <div className="nav-section-label">YOUR LEARNING</div>
    <Link href="/dashboard" className={cx('side-link', active === 'dashboard' && 'selected')} onClick={() => setMobileOpen(false)}><Compass size={18} /> Overview</Link>
    <Link href="/unit/greetings" className={cx('side-link', active === 'unit' && 'selected')} onClick={() => setMobileOpen(false)}><BookOpen size={18} /> Learning path</Link>
    <Link href="/flashcards" className={cx('side-link', active === 'flashcards' && 'selected')} onClick={() => setMobileOpen(false)}><Layers3 size={18} /> Vocabulary</Link>
    {isStaff && <><div className="nav-section-label nav-spaced">TEACHING</div><Link href="/instructor/review" className={cx('side-link', active === 'review' && 'selected')} onClick={() => setMobileOpen(false)}><CheckCircle2 size={18} /> Review queue</Link></>}
    <div className="sidebar-bottom"><div className="sidebar-tip"><span>ص</span><p><b>Take it one phrase at a time.</b><small>Little and often goes a long way.</small></p></div><div className="profile-row"><div className="profile-avatar">{name.slice(0, 1).toUpperCase()}</div><div className="profile-name"><b>{name}</b><small>{dash.data?.role ?? 'student'} account</small></div><button aria-label="Sign out" className="icon-button sidebar-logout" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={17} /></button></div></div></>;
  return <div className="app-shell">
    <aside className={cx('sidebar', mobileOpen && 'sidebar-mobile-open')}>{nav}</aside>
    {mobileOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <div className="app-main"><header className="app-topbar"><button className="mobile-menu app-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></button><div className="crumb">Academy <span>/</span> <b>{active === 'dashboard' ? 'Overview' : active === 'unit' ? 'Learning path' : active === 'flashcards' ? 'Vocabulary' : active === 'review' ? 'Review queue' : 'Lesson'}</b></div><div className="topbar-right"><span className="topbar-label">MODERN STANDARD ARABIC</span><span className="topbar-seal arabic">ع</span></div></header><div className="content-wrap">{children}</div></div>
  </div>;
}

function DashboardPage() {
  const dashboard = useGetAcademyDashboard();
  const unit = useGetAcademyUnit();
  const progress = useListLessonProgress();
  if (dashboard.isLoading || unit.isLoading || progress.isLoading) return <LoadingPage />;
  if (dashboard.isError || unit.isError || progress.isError || !dashboard.data || !unit.data) return <ErrorPage title="Your learning overview is taking a moment" retry={() => { void dashboard.refetch(); void unit.refetch(); void progress.refetch(); }} />;
  const lesson = unit.data.lessons.find((item) => item.id === dashboard.data.nextLessonId) ?? unit.data.lessons[0];
  const completed = progress.data?.filter((p) => p.completed).length ?? dashboard.data.completedLessons;
  return <AppShell active="dashboard"><div className="dashboard-page">
    <div className="welcome-row fade-up"><div><p className="eyebrow">YOUR STUDY ROOM <span className="eyebrow-line" /></p><h1 className="display">Ahlan, {dashboard.data.displayName || 'learner'}.</h1><p className="welcome-sub">A little Arabic today goes a long way.</p></div><div className="date-badge"><span className="date-sun"><Sun size={17} /></span><span><b>{dashboard.data.currentStreakDays} day{dashboard.data.currentStreakDays === 1 ? '' : 's'}</b><small>current streak</small></span></div></div>
    <section className="dashboard-feature fade-up delay-1"><div className="feature-copy"><div className="feature-topline"><span className="pill">YOUR NEXT STEP</span><span className="feature-unit">UNIT 01 <span>·</span> {unit.data.level}</span></div><h2 className="display">{lesson?.title ?? 'Your first greeting'}</h2><p>{lesson?.description ?? unit.data.description}</p><div className="feature-meta"><span><Clock3 size={15} /> {lesson?.durationMinutes ?? 8} min</span><span><BookOpen size={15} /> {lesson?.activities.length ?? 0} practice moments</span></div><Link className="button button-light" href={lesson ? `/lesson/${lesson.id}` : '/unit/greetings'}>{completed ? 'Continue learning' : 'Begin lesson'} <ArrowRight size={16} /></Link></div><div className="feature-art"><span className="feature-lesson-num">01</span><span className="arabic feature-arabic" dir="rtl">السَّلَامُ عَلَيْكُمْ</span><span className="feature-translit">as-salāmu ʿalaykum</span><span className="feature-divider" /><span className="feature-english">A peaceful hello</span><div className="feature-art-ring" /></div></section>
    <div className="overview-grid"><section className="progress-card"><div className="card-heading"><div><p className="eyebrow">THE BEGINNER'S PATH</p><h3>Your progress</h3></div><span className="progress-fraction">{completed} <i>/</i> {dashboard.data.totalLessons}</span></div><div className="progress-track"><span style={{ width: `${Math.max(dashboard.data.progressPercent, 2)}%` }} /></div><div className="progress-bottom"><span>{dashboard.data.progressPercent}% complete</span><span>{dashboard.data.totalLessons - completed} lessons to go</span></div><div className="mini-lesson-list">{unit.data.lessons.slice(0, 4).map((item, i) => {
      const p = progress.data?.find((entry) => entry.lessonId === item.id);
      return <Link href={`/lesson/${item.id}`} className="mini-lesson" key={item.id} data-testid={`link-lesson-${item.id}`}><span className={cx('mini-lesson-status', p?.completed && 'done')}>{p?.completed ? <Check size={13} /> : String(i + 1).padStart(2, '0')}</span><span><b>{item.title}</b><small>{item.durationMinutes} min · {item.section}</small></span><ArrowRight size={15} /></Link>;
    })}</div><Link href="/unit/greetings" className="card-foot-link">View the whole learning path <ArrowRight size={15} /></Link></section>
    <aside className="dashboard-side"><div className="streak-card"><span className="streak-icon"><Flame size={20} /></span><div><span className="eyebrow">SHOWING UP MATTERS</span><h3>{dashboard.data.currentStreakDays} days</h3><p>Your learning rhythm is building.</p></div><span className="streak-dash" /></div><Link href="/flashcards" className="review-card"><span className="review-icon"><Layers3 size={18} /></span><span className="review-text"><b>Vocabulary review</b><small>{dashboard.data.dueReviews} cards ready when you are</small></span><ArrowRight size={17} /></Link><div className="daily-note"><Sun size={17} className="note-sun" /><div><span className="eyebrow">A NOTE ON GREETINGS</span><p>In Arabic, a greeting is more than hello — it is a wish for peace.</p></div><span className="arabic note-ar" dir="rtl">سلام</span></div></aside></div>
  </div></AppShell>;
}

function UnitPage() {
  const unit = useGetAcademyUnit();
  const progress = useListLessonProgress();
  if (unit.isLoading || progress.isLoading) return <LoadingPage />;
  if (unit.isError || progress.isError || !unit.data) return <ErrorPage title="The learning path isn't available right now" retry={() => { void unit.refetch(); void progress.refetch(); }} />;
  return <AppShell active="unit"><main className="unit-page">
    <div className="page-intro fade-up"><p className="eyebrow">YOUR LEARNING PATH <span className="eyebrow-line" /></p><h1 className="display">{unit.data.title}</h1><p>{unit.data.description}</p><div className="unit-meta"><span className="pill">{unit.data.level}</span><span>{unit.data.lessons.length} short lessons</span><span>·</span><span>Beginner</span></div></div>
    <div className="unit-layout"><section className="lesson-path">{unit.data.lessons.map((lesson, index) => {
      const entry = progress.data?.find((p) => p.lessonId === lesson.id);
      const isNext = lesson.id === (progress.data?.find((p) => !p.completed)?.lessonId ?? unit.data?.lessons[0]?.id);
      return <Link href={`/lesson/${lesson.id}`} key={lesson.id} className={cx('path-lesson', isNext && 'path-current', entry?.completed && 'path-done')} data-testid={`link-path-lesson-${lesson.id}`}><div className="path-node">{entry?.completed ? <Check size={16} /> : <span>{String(index + 1).padStart(2, '0')}</span>}</div><div className="path-lesson-copy"><div className="path-label">{lesson.section} <span>·</span> LESSON {String(index + 1).padStart(2, '0')}</div><h2>{lesson.title}</h2><p>{lesson.description}</p><div className="path-submeta"><span><Clock3 size={13} /> {lesson.durationMinutes} min</span><span>{lesson.activities.length} practice items</span></div></div><ArrowRight className="path-arrow" size={17} /></Link>;
    })}</section><aside className="unit-aside"><div className="unit-aside-card"><span className="eyebrow">A LITTLE CONTEXT</span><span className="arabic cultural-arabic" dir="rtl">السَّلَامُ عَلَيْكُمْ</span><h3>A greeting with a wish inside.</h3><p>{unit.data.culturalNote}</p></div><div className="unit-aside-foot"><span className="arabic">ع</span><p>Each lesson introduces a phrase you can actually use.</p></div></aside></div>
  </main></AppShell>;
}

const stepOrder = ['learn', 'listen', 'understand', 'practice', 'review', 'quiz', 'feedback', 'mastery'] as const;

function LessonPage() {
  const { lessonId = '' } = useParams<{ lessonId: string }>();
  const unit = useGetAcademyUnit();
  const progress = useListLessonProgress();
  const save = useSaveLessonProgress();
  const answerMutation = useSubmitActivityAnswer();
  const [activityIndex, setActivityIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof answerMutation.mutateAsync>> | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const lesson = unit.data?.lessons.find((item) => item.id === lessonId);
  const currentProgress = progress.data?.find((item) => item.lessonId === lessonId);
  useEffect(() => { setActivityIndex(0); setAnswer(''); setResult(null); setReviewMode(false); }, [lessonId]);
  if (unit.isLoading || progress.isLoading) return <LoadingPage />;
  if (unit.isError || progress.isError || !unit.data || !lesson) return <ErrorPage title="We couldn't find that lesson" retry={() => { void unit.refetch(); void progress.refetch(); }} />;
  const activeActivity = lesson.activities[activityIndex];
  const step = currentProgress?.currentStep ?? 'learn';
  const index = Math.max(0, stepOrder.indexOf(step));
  const previous = unit.data.lessons[lesson.sequence - 2] ?? null;
  const next = unit.data.lessons[lesson.sequence] ?? null;
  const saveStep = (currentStep: typeof step, completed = false, score?: number) => save.mutate({ lessonId, data: { currentStep, completed, ...(score !== undefined ? { latestScore: score } : {}) } }, {
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListLessonProgressQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetAcademyDashboardQueryKey() }); },
  });
  const moveActivity = (direction: 1 | -1) => {
    const nextIndex = Math.min(Math.max(activityIndex + direction, 0), lesson.activities.length - 1);
    setActivityIndex(nextIndex); setAnswer(''); setResult(null);
    saveStep('practice');
  };
  const checkAnswer = () => {
    if (!activeActivity || !answer.trim()) return;
    answerMutation.mutate({ data: { activityId: activeActivity.id, answer: answer.trim() } }, { onSuccess: setResult });
  };
  const goComplete = () => {
    saveStep('mastery', true, result?.score ?? currentProgress?.latestScore ?? 100);
  };
  return <AppShell active="lesson"><main className="lesson-page">
    <div className="lesson-back-row"><Link href="/unit/greetings" className="back-link"><ArrowLeft size={15} /> {unit.data.title}</Link><span className="lesson-counter">LESSON {String(lesson.sequence).padStart(2, '0')} <i>/</i> {unit.data.lessons.length}</span></div>
    <div className="lesson-head"><div><p className="eyebrow">{lesson.section} <span className="eyebrow-line" /></p><h1 className="display">{lesson.title}</h1><p className="lesson-description">{lesson.description}</p></div><span className="lesson-time"><Clock3 size={15} /> {lesson.durationMinutes} min</span></div>
    <div className="lesson-progress-row"><div className="lesson-progress-track">{stepOrder.map((item, i) => <span key={item} className={i <= index ? 'active' : ''} />)}</div><span>{step.replace(/^\w/, (x) => x.toUpperCase())}</span></div>
    <div className="lesson-layout"><section className="lesson-main-card">
      {(step === 'mastery' || currentProgress?.completed) && !reviewMode ? <div className="lesson-complete"><div className="complete-seal"><Check size={29} /></div><p className="eyebrow">A STEP WELL TAKEN</p><h2 className="display">You completed this lesson.</h2><p>Every phrase you meet is another way into the language.</p><div className="complete-actions"><Button className="button-secondary" onClick={() => { setReviewMode(true); setActivityIndex(0); setAnswer(''); setResult(null); }} data-testid="button-review-answers">Review answers <ArrowRight size={16} /></Button>{previous && <Link className="button button-secondary" href={`/lesson/${previous.id}`}><ArrowLeft size={16} /> Previous lesson</Link>}{next ? <Link className="button button-primary" href={`/lesson/${next.id}`}>Next lesson <ArrowRight size={16} /></Link> : <Link className="button button-primary" href="/unit/greetings">Back to your path <ArrowRight size={16} /></Link>}</div></div>
      : !activeActivity || step === 'learn' || step === 'listen' || step === 'understand' ? <div className="lesson-learn">
        <span className="pill">{step === 'learn' ? 'FIRST, THE MEANING' : step === 'listen' ? 'NOTICE THE SOUND' : 'SEE HOW IT FITS'}</span><div className="learn-arabic arabic" dir="rtl">{activeActivity?.arabicPrompt || 'السَّلَامُ عَلَيْكُمْ'}</div><h2 className="learn-heading">{lesson.content}</h2>{lesson.transliteration && <p className="learn-translit">{lesson.transliteration}</p>}{activeActivity?.audioAvailable === false && <div className="audio-notice"><span className="audio-icon"><Volume2 size={18} /></span><p><b>Audio is not available yet</b><span>{activeActivity.audioNotice || 'Recorded pronunciation is being prepared. For now, follow the written transliteration and take your time with each sound.'}</span></p><span className="audio-status">SETUP<br />IN PROGRESS</span></div>}<div className="learn-footer"><span>{step.toUpperCase()} · {String(index + 1).padStart(2, '0')}</span><Button className="button-primary" onClick={() => {
          if (step === 'learn') saveStep('listen');
          else if (step === 'listen') saveStep('understand');
          else { saveStep('practice'); setActivityIndex(0); }
        }} data-testid="button-start-practice">{step === 'learn' ? 'Continue to pronunciation' : step === 'listen' ? 'I understand the sounds' : 'I’m ready to practice'} <ArrowRight size={16} /></Button></div>
      </div>
       : activeActivity ? <ActivityPractice key={activeActivity.id} activity={activeActivity} activityIndex={activityIndex} total={lesson.activities.length} answer={answer} setAnswer={setAnswer} result={result} busy={answerMutation.isPending} onCheck={checkAnswer} onRetry={() => { setAnswer(''); setResult(null); }} onNext={() => activityIndex < lesson.activities.length - 1 ? moveActivity(1) : goComplete()} onPrevious={() => moveActivity(-1)} completed={currentProgress?.completed ?? false} /> : <div className="lesson-empty">There are no practice activities in this lesson yet.</div>}
      {save.isPending && <div className="save-status">Saving your progress…</div>}
    </section><aside className="lesson-aside"><span className="eyebrow">LESSON NOTES</span><div className="lesson-aside-line" /><div className="lesson-aside-note"><span className="arabic" dir="rtl">مرحبا</span><h3>Let meaning lead.</h3><p>Notice the whole phrase before you try to break it into sounds.</p></div><div className="lesson-aside-bottom"><Sun size={13} className="tiny-sun" /><p>Progress saves as you go.</p></div></aside></div>
     <div className="lesson-nav-row"><Link href={previous ? `/lesson/${previous.id}` : '/unit/greetings'} className="lesson-nav-link"><ArrowLeft size={15} /><span><small>PREVIOUS</small><b>{previous?.title ?? 'Learning path'}</b></span></Link><Button className="button-secondary" onClick={() => saveStep(step, currentProgress?.completed ?? false, currentProgress?.latestScore ?? undefined)} disabled={save.isPending} data-testid="button-save-progress">{save.isPending ? 'Saving…' : 'Save progress'}</Button><Link href={next ? `/lesson/${next.id}` : '/unit/greetings'} className="lesson-nav-link next"><span><small>NEXT LESSON</small><b>{next?.title ?? 'Unit overview'}</b></span><ArrowRight size={15} /></Link></div>
  </main></AppShell>;
}

function ActivityPractice({ activity, activityIndex, total, answer, setAnswer, result, busy, onCheck, onRetry, onNext, onPrevious, completed }: {
  activity: AcademyActivity; activityIndex: number; total: number; answer: string; setAnswer: (value: string) => void;
  result: { correct: boolean; score: number; feedback: string; correctAnswer: string; explanation: string; attemptNumber: number } | null;
  busy: boolean; onCheck: () => void; onRetry: () => void; onNext: () => void; onPrevious: () => void; completed: boolean;
}) {
  const selectable = activity.choices.length > 0;
  let selectedMatches: Record<string, string> = {};
  if (answer && activity.type === 'matching') {
    try { selectedMatches = JSON.parse(answer) as Record<string, string>; } catch { selectedMatches = {}; }
  }
  const answerReady = activity.type === 'matching'
    ? activity.leftOptions.length > 0 && activity.leftOptions.every((option) => !!selectedMatches[option])
    : !!answer.trim();
  return <div className="practice-panel">
    <div className="practice-top"><span className="pill">PRACTICE · {String(activityIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span><span className="activity-type">{activity.type.replace(/[A-Z]/g, (x) => ` ${x}`).toUpperCase()}</span></div>
    <h2>{activity.prompt}</h2><p className="practice-instruction">{activity.instructions}</p>
    {activity.arabicPrompt && <div className="prompt-arabic arabic" dir="rtl">{activity.arabicPrompt}</div>}
    {activity.type === 'matching' ? <div className="matching-list">{activity.leftOptions.map((left, index) => <label className="matching-row" key={`${left}-${index}`}><span className={/[\u0600-\u06FF]/.test(left) ? 'arabic' : ''} dir="auto">{left}</span><select aria-label={`Meaning for ${left}`} value={selectedMatches[left] ?? ''} disabled={!!result} onChange={(event) => setAnswer(JSON.stringify({ ...selectedMatches, [left]: event.target.value }))} data-testid={`select-match-${index}`}><option value="">Choose a meaning</option>{activity.rightOptions.map((right) => <option value={right} key={right}>{right}</option>)}</select></label>)}</div>
      : selectable ? <div className="choice-list">{activity.choices.map((choice, i) => <button key={`${choice}-${i}`} className={cx('choice-option', answer === choice && 'choice-selected', result && choice === result.correctAnswer && 'choice-correct', result && answer === choice && !result.correct && 'choice-incorrect')} onClick={() => { if (!result) setAnswer(choice); }} disabled={!!result} data-testid={`button-choice-${i}`}><span className="choice-key">{String.fromCharCode(65 + i)}</span><span className={/[\u0600-\u06FF]/.test(choice) ? 'arabic' : ''}>{choice}</span>{result && choice === result.correctAnswer && <Check size={16} />}</button>)}</div>
      : activity.wordBank.length ? <><div className="answer-composer" dir="auto">{answer || <span>Choose the words below…</span>}</div><div className="word-bank">{activity.wordBank.map((word, i) => <button key={`${word}-${i}`} className="word-chip" disabled={!!result || answer.includes(word)} onClick={() => setAnswer([answer, word].filter(Boolean).join(' '))} data-testid={`button-word-${i}`}>{word}</button>)}{answer && !result && <button className="clear-answer" onClick={() => setAnswer('')}>Clear</button>}</div></>
      : <input className="answer-input" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onCheck(); }} placeholder="Type your answer…" dir="auto" aria-label="Your answer" data-testid="input-activity-answer" />}
    {result && <div className={cx('answer-feedback', result.correct ? 'feedback-correct' : 'feedback-try')}><div className="feedback-icon">{result.correct ? <Check size={18} /> : <ArrowRight size={18} />}</div><div><b>{result.feedback || (result.correct ? 'That’s right.' : 'Not quite yet.')}</b><p>{result.explanation}</p>{!result.correct && <p className="correct-answer">A good answer: <strong>{result.correctAnswer}</strong></p>}</div></div>}
     <div className="practice-footer"><button className="practice-back" onClick={onPrevious} disabled={activityIndex === 0}><ArrowLeft size={15} /> Previous</button>{result?.correct ? <Button className="button-primary" onClick={onNext} data-testid="button-next-question">{activityIndex + 1 < total ? 'Next question' : 'Complete lesson'} <ArrowRight size={16} /></Button> : result ? <Button className="button-primary" onClick={onRetry} data-testid="button-retry-answer">Retry <ArrowRight size={16} /></Button> : <Button className="button-primary" onClick={onCheck} disabled={!answerReady || busy} data-testid="button-check-answer">{busy ? 'Checking…' : 'Submit answer'} {busy ? null : <Check size={16} />}</Button>}</div>
     {completed && <p className="practice-already-complete">This lesson is complete. You can still submit answers to review each question.</p>}
  </div>;
}

function FlashcardsPage() {
  const [search, setSearch] = useState('');
  const params = search.trim() ? { q: search.trim() } : undefined;
  const cards = useListAcademyFlashcards(params, { query: { queryKey: getListAcademyFlashcardsQueryKey(params) } });
  const review = useReviewAcademyFlashcard();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, string>>({});
  const submitReview = (card: AcademyFlashcard, remembered: boolean) => review.mutate({ flashcardId: card.id, data: { remembered } }, {
    onSuccess: (response) => {
      setReviewed((prev) => ({ ...prev, [card.id]: response.known ? 'known' : 'again' }));
      void queryClient.invalidateQueries({ queryKey: getListAcademyFlashcardsQueryKey(params) });
    },
  });
  return <AppShell active="flashcards"><main className="flashcards-page">
    <div className="page-intro fade-up"><p className="eyebrow">WORDS WORTH KEEPING <span className="eyebrow-line" /></p><h1 className="display">Vocabulary, made familiar.</h1><p>Search the words you have met, then mark what you remember.</p></div>
    <div className="vocab-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Arabic, transliteration, or meaning" aria-label="Search vocabulary" data-testid="input-search-vocabulary" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}</label><span className="vocab-count">{cards.data?.length ?? '—'} WORDS</span></div>
    {cards.isLoading ? <div className="flashcard-grid">{[1, 2, 3].map((n) => <div className="flashcard-skeleton" key={n}><div /><div /><div /></div>)}</div>
      : cards.isError ? <ErrorPage title="Your vocabulary isn't available right now" retry={() => void cards.refetch()} />
      : cards.data?.length ? <div className="flashcard-grid">{cards.data.map((card, i) => <Flashcard key={card.id} card={card} number={i + 1} revealed={revealed === card.id} setRevealed={() => setRevealed(revealed === card.id ? null : card.id)} status={reviewed[card.id]} isPending={review.isPending && review.variables?.flashcardId === card.id} review={(remembered) => submitReview(card, remembered)} />)}</div>
      : <div className="empty-vocab"><span className="empty-vocab-icon"><Search size={22} /></span><h2>No words found</h2><p>Try a different search, or explore the lessons to meet new vocabulary.</p><Link href="/unit/greetings" className="text-link">Browse your learning path <ArrowRight size={15} /></Link></div>}
  </main></AppShell>;
}

function Flashcard({ card, number, revealed, setRevealed, status, isPending, review }: {
  card: AcademyFlashcard; number: number; revealed: boolean; setRevealed: () => void; status?: string; isPending: boolean; review: (known: boolean) => void;
}) {
  return <article className={cx('vocab-card', revealed && 'vocab-revealed')} data-testid={`card-vocabulary-${card.id}`}>
    <div className="vocab-card-top"><span className="vocab-number">{String(number).padStart(2, '0')}</span><span className={cx('vocab-state', card.due && 'is-due')}>{status ? status === 'known' ? 'REVIEWED' : 'TRY AGAIN' : card.due ? 'DUE TO REVIEW' : card.known ? 'FAMILIAR' : 'NEW'}</span></div>
    <button className="vocab-word" onClick={setRevealed} aria-label={revealed ? 'Hide vocabulary details' : 'Reveal vocabulary details'} data-testid={`button-reveal-${card.id}`}><span className="arabic vocab-arabic" dir="rtl">{card.arabic}</span><span className="vocab-translit">{card.transliteration}</span><span className="vocab-meaning">{revealed ? card.english : 'Tap to reveal meaning'}</span></button>
    {revealed && <div className="vocab-extra"><p>{card.example}</p><span>{card.reviewCount} reviews so far</span><div className="vocab-review-actions"><button className="review-again" onClick={() => review(false)} disabled={isPending} data-testid={`button-review-again-${card.id}`}>{isPending ? 'Saving…' : 'Practice again'}</button><button className="review-known" onClick={() => review(true)} disabled={isPending} data-testid={`button-review-known-${card.id}`}>I know this <Check size={14} /></button></div></div>}
    {!revealed && <button className="reveal-action" onClick={setRevealed}>Reveal meaning <ChevronDown size={15} /></button>}
  </article>;
}

function InstructorPage() {
  const items = useListInstructorReviewItems();
  const update = useUpdateInstructorReviewItem();
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { content: string; tags: string; mergeId: string }>>({});
  const active = items.data?.find((item) => item.id === selected) ?? items.data?.[0];
  const readDraft = (item: InstructorReviewItem) => drafts[item.id] ?? { content: item.draftContent, tags: item.tags.join(', '), mergeId: '' };
  const patchDraft = (item: InstructorReviewItem, key: 'content' | 'tags' | 'mergeId', value: string) => setDrafts((prev) => ({ ...prev, [item.id]: { ...readDraft(item), [key]: value } }));
  const execute = (item: InstructorReviewItem, action: 'edit' | 'approve' | 'reject' | 'merge') => {
    const draft = readDraft(item);
    update.mutate({ reviewItemId: item.id, data: { action, draftContent: draft.content, tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean), mergeIntoId: action === 'merge' ? draft.mergeId || null : null } }, {
      onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListInstructorReviewItemsQueryKey() }); },
    });
  };
  return <AppShell active="review"><main className="instructor-page">
    <div className="page-intro fade-up"><p className="eyebrow">ACADEMY OPERATIONS <span className="eyebrow-line" /></p><h1 className="display">Review with care.</h1><p>Shape community contributions before they find a home in the course.</p></div>
    {items.isLoading ? <div className="review-loading"><div /><div /></div> : items.isError ? <ErrorPage title="The review queue couldn't be loaded" retry={() => void items.refetch()} /> : !items.data?.length ? <div className="empty-review"><span className="empty-vocab-icon"><CheckCircle2 size={22} /></span><h2>All clear for now.</h2><p>New contributions will appear here when they are ready for your review.</p></div> : <div className="review-workspace">
      <aside className="queue-list"><div className="queue-heading"><span>INCOMING DRAFTS</span><b>{items.data.length}</b></div>{items.data.map((item, i) => <button className={cx('queue-item', active?.id === item.id && 'queue-selected')} key={item.id} onClick={() => setSelected(item.id)} data-testid={`button-review-item-${item.id}`}><span className="queue-number">{String(i + 1).padStart(2, '0')}</span><span className="queue-item-copy"><b>{item.title}</b><small>{item.contentType} · {item.sourceNoteTitle}</small></span><ArrowRight size={14} /></button>)}</aside>
      {active && <section className="review-editor"><div className="review-editor-head"><div><span className="pill">PENDING REVIEW</span><h2>{active.title}</h2><span className="review-source">From: {active.sourceNoteTitle}</span></div><span className="review-type">{active.contentType}</span></div><blockquote className="source-excerpt">“{active.sourceExcerpt}”</blockquote>
        <label className="field-label" htmlFor="draft-content">Draft content</label><textarea id="draft-content" className="draft-textarea" value={readDraft(active).content} onChange={(e) => patchDraft(active, 'content', e.target.value)} rows={8} data-testid="input-review-draft" />
        <label className="field-label" htmlFor="draft-tags">Tags <span>Separate with commas</span></label><input id="draft-tags" className="draft-tags" value={readDraft(active).tags} onChange={(e) => patchDraft(active, 'tags', e.target.value)} placeholder="greetings, beginner, phrase" data-testid="input-review-tags" /><div className="tag-preview">{readDraft(active).tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</div>
        {items.data.length > 1 && <div className="merge-row"><label className="field-label" htmlFor="merge-target">Merge into another draft</label><select id="merge-target" value={readDraft(active).mergeId} onChange={(e) => patchDraft(active, 'mergeId', e.target.value)} className="draft-tags" data-testid="select-merge-target"><option value="">Choose a review item</option>{items.data.filter((item) => item.id !== active.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><Button className="button-secondary" onClick={() => execute(active, 'merge')} disabled={!readDraft(active).mergeId || update.isPending} data-testid="button-merge-review">Merge drafts <Layers3 size={15} /></Button></div>}
        <div className="review-actions"><Button className="button-secondary" onClick={() => execute(active, 'edit')} disabled={update.isPending} data-testid="button-save-draft">{update.isPending ? 'Saving…' : 'Save draft'} <Check size={15} /></Button><div className="review-actions-right"><Button className="button-reject" onClick={() => execute(active, 'reject')} disabled={update.isPending} data-testid="button-reject-review">Reject</Button><Button className="button-primary" onClick={() => execute(active, 'approve')} disabled={update.isPending} data-testid="button-approve-review">Approve <Check size={15} /></Button></div></div>
      </section>}
    </div>}
  </main></AppShell>;
}

function Router() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Your next Arabic phrase is waiting.' } },
      signUp: { start: { title: 'Ahlan — welcome', subtitle: 'Begin your Arabic learning journey.' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <ClerkQueryClientCacheInvalidator />
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={() => <AuthPage mode="in" />} />
      <Route path="/sign-up/*?" component={() => <AuthPage mode="up" />} />
      <Route path="/dashboard">{() => <ProtectedRoute><DashboardPage /></ProtectedRoute>}</Route>
      <Route path="/unit/greetings">{() => <ProtectedRoute><UnitPage /></ProtectedRoute>}</Route>
      <Route path="/lesson/:lessonId">{() => <ProtectedRoute><LessonPage /></ProtectedRoute>}</Route>
      <Route path="/flashcards">{() => <ProtectedRoute><FlashcardsPage /></ProtectedRoute>}</Route>
      <Route path="/instructor/review">{() => <ProtectedRoute instructor><InstructorPage /></ProtectedRoute>}</Route>
      <Route component={NotFound} />
    </Switch>
  </ClerkProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;
