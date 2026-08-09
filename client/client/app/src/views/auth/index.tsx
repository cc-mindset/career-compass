import React, { useEffect } from 'react';
import { Brand } from '../../components/layout';
import { useClarity } from '../../state/contexts/ClarityContext';
import type { EntryPoint, Tool } from '../../types';

const TOOLS: Tool[] = ['pivot', 'job', 'market'];

const isTool = (value: string): value is Tool => TOOLS.includes(value as Tool);

const guestEntryPoint = (tool: Tool): EntryPoint => `guest-${tool}`;

const GUEST_LABELS: Record<Tool, string> = {
  job: 'job analysis',
  pivot: 'career pivot preview',
  market: 'Market Report overview',
};

export const SignInView: React.FC = () => {
  const { state, patch, navigate, toast } = useClarity();

  const signInUser = () => {
    if (state.pendingGuest === 'market') {
      const destination = state.postAuthRoute || 'market-workspace-result';
      patch({
        registered: true,
        entryPoint: 'guest-market',
        workState: 'unfinished',
        marketHasReports: true,
        marketGuestReady: true,
        marketGuestSaved: true,
        postAuthRoute: null,
      });
      navigate(destination);
      return;
    }
    if (state.pendingGuest) {
      patch({
        registered: true,
        entryPoint: guestEntryPoint(state.pendingGuest),
        workState: 'unfinished',
      });
      navigate(`dashboard-${state.pendingGuest}`);
      return;
    }
    patch({ registered: true, entryPoint: 'signin', workState: 'unfinished' });
    navigate('dashboard-returning');
  };

  return (
    <main className="authwrap">
      <section className="authstory">
        <Brand />
        <div>
          <div className="eyebrow" style={{ color: '#8ebaff' }}>
            Welcome back
          </div>
          <h2>Continue where you left off.</h2>
          <p>
            Return to your saved analyses, career profile and personalized action plans.
          </p>
          <div className="savedbox">
            <b>Your work stays connected</b>
            <p>Career Pivot · Job Analyzer · Market Report · Skills Match</p>
          </div>
        </div>
        <p>Your provider password is handled only by the selected provider.</p>
      </section>
      <section className="authform">
        <div className="authcard">
          <div className="eyebrow">Sign in</div>
          <h2>Good to see you again</h2>
          <p className="lead" style={{ fontSize: 14 }}>
            Choose the same method you used when creating your account.
          </p>
          <div className="providers">
            <button type="button" onClick={signInUser}>
              <span className="providerIcon">G</span>Continue with Google
            </button>
            <button type="button" onClick={signInUser}>
              <span className="providerIcon">in</span>Continue with LinkedIn
            </button>
            <button type="button" onClick={signInUser}>
              <span className="providerIcon">f</span>Continue with Facebook
            </button>
          </div>
          <div className="divider">or sign in with email</div>
          <div className="field">
            <label>Email address</label>
            <input className="input" type="email" placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" placeholder="Enter your password" />
          </div>
          <div className="forgotrow">
            <a onClick={() => toast('Password reset link requested')}>
              Forgot your password?
            </a>
          </div>
          <button type="button" className="btn primary full" onClick={signInUser}>
            Sign in →
          </button>
          <p className="authswitch">
            New to Clarity Coach?{' '}
            <a
              href="#signup"
              onClick={(event) => {
                event.preventDefault();
                navigate('signup');
              }}
            >
              Create a free account
            </a>
          </p>
          <p style={{ textAlign: 'center', fontSize: 12 }}>
            <a
              className="textlink"
              href="#landing"
              onClick={(event) => {
                event.preventDefault();
                navigate('landing');
              }}
            >
              Return to landing page
            </a>
          </p>
        </div>
      </section>
    </main>
  );
};

export const SignUpView: React.FC<{ mode: string }> = ({ mode }) => {
  const { state, patch, navigate, toast } = useClarity();
  const guestTool = isTool(mode) ? mode : null;
  const marketGuest = guestTool === 'market';

  const savedSummary = (): string => {
    if (!guestTool) return 'Career Pivot · Job Analyzer · Market Report';
    if (guestTool === 'job') return 'Senior Product Manager · Hidden expectation preview';
    if (guestTool === 'pivot') return '3 pivot paths · Transferable skills preview';
    return `${state.market.role} · ${state.market.level} · ${state.market.location}`;
  };

  useEffect(() => {
    if (guestTool) {
      patch({
        tool: guestTool,
        pendingGuest: guestTool,
        entryPoint: guestEntryPoint(guestTool),
      });
      return;
    }
    patch({ pendingGuest: null, entryPoint: 'direct-signup' });
  }, [guestTool, patch]);

  const completeSignup = () => {
    const finish = async () => {
      if (guestTool === 'job' && state.jobLiveAnalysis) {
        try {
          const { saveJobAnalysis } = await import('../../services/jobAnalyzer/api');
          const { getClarityUserId } = await import('../../lib/clarityUserId');
          await saveJobAnalysis({
            userId: getClarityUserId(),
            analysisId: state.jobLiveAnalysis.analysisId,
            title: state.job.title,
            company: state.job.company,
            location: state.job.location,
            postingText: state.jobPostingText,
            result: state.jobLiveAnalysis.result,
            metadata: state.jobLiveAnalysis.metadata,
            source: state.jobLiveAnalysis.metadata.source,
          });
          patch({
            registered: true,
            workState: 'unfinished',
            jobHasAnalyses: true,
            jobLiveAnalysis: { ...state.jobLiveAnalysis, saved: true },
            postAuthRoute: null,
          });
        } catch {
          patch({
            registered: true,
            workState: 'unfinished',
            postAuthRoute: null,
          });
        }
      } else {
        patch({
          registered: true,
          workState: guestTool ? 'unfinished' : 'none',
          ...(marketGuest
            ? {
                marketHasReports: true,
                marketGuestReady: true,
                marketGuestSaved: true,
                postAuthRoute: null,
              }
            : {}),
        });
      }

      toast('Account created. Confirmation email sent.');
      const destination = !guestTool
        ? 'dashboard-new'
        : guestTool === 'job'
          ? state.postAuthRoute || 'job-workspace-result'
          : marketGuest
            ? state.postAuthRoute || 'market-workspace-result'
            : `dashboard-${guestTool}`;
      window.setTimeout(() => navigate(destination), 500);
    };

    void finish();
  };

  return (
    <main className="authwrap">
      <section className="authstory">
        <Brand />
        <div>
          <div className="eyebrow" style={{ color: '#75aaff' }}>
            {guestTool ? 'Your progress is ready' : 'Your career workspace'}
          </div>
          <h2>
            {guestTool
              ? 'Keep the work you already completed.'
              : 'Start with the career question that matters now.'}
          </h2>
          <p>
            {guestTool
              ? `Create an account and your ${GUEST_LABELS[guestTool]} will open in the dashboard—no repeated questions.`
              : 'Create a free account, choose a starting point and build your career profile only when it improves your result.'}
          </p>
          <div className="savedbox">
            <b>{guestTool ? 'Saved from your guest session' : 'Included with your account'}</b>
            <p>{savedSummary()}</p>
          </div>
        </div>
        <p>
          Clarity Coach uses your information to provide career guidance. Review the
          Privacy Policy for retention and deletion details.
        </p>
      </section>
      <section className="authform">
        <div className="authcard">
          <div className="eyebrow">Create your account</div>
          <h2>{guestTool ? 'Save and continue' : 'Welcome to Clarity Coach'}</h2>
          <p className="lead" style={{ fontSize: 14 }}>
            {guestTool
              ? 'Your guest result will be attached automatically.'
              : 'No payment details required. Start with the tool you need today.'}
          </p>
          <div className="providers">
            <button type="button" onClick={completeSignup}>
              <span className="providerIcon">G</span>Continue with Google
            </button>
            <button type="button" onClick={completeSignup}>
              <span className="providerIcon">in</span>Continue with LinkedIn
            </button>
            <button type="button" onClick={completeSignup}>
              <span className="providerIcon">f</span>Continue with Facebook
            </button>
          </div>
          <div className="divider">or create an account with email</div>
          <div className="field">
            <label>Email address</label>
            <input className="input" type="email" defaultValue="alex@example.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="password" defaultValue="password123" />
          </div>
          <button type="button" className="btn primary full" onClick={completeSignup}>
            {guestTool ? 'Create account and open my result' : 'Create my free account'} →
          </button>
          <p className="terms">
            By clicking “Create account,” you agree to our Terms of Use and Privacy
            Policy. If you choose to receive marketing emails, you can unsubscribe at any
            time. Product and account emails may still be sent where required to provide
            the service.
          </p>
          <p className="authswitch">
            Already have an account?{' '}
            <a
              href="#signin"
              onClick={(event) => {
                event.preventDefault();
                navigate('signin');
              }}
            >
              Sign in
            </a>
          </p>
        </div>
      </section>
    </main>
  );
};
