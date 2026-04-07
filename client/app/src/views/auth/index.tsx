import React from "react";
import { SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import AnimatedLoader from "../../ui-kit/atom/animated-loader";

const AuthPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md">
        <SignedIn>
          <AnimatedLoader />
        </SignedIn>
        <SignedOut>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Welcome to CareerCompass
            </h1>
            <p className="text-slate-600">
              Sign in to access your career insights
            </p>
          </div>
        </SignedOut>

        <SignIn
          fallback={<AnimatedLoader />}
          appearance={{
            elements: {
              formButtonPrimary:
                "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl w-full transition-colors",
              formButtonSecondary:
                "bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-6 rounded-xl w-full transition-colors",
              card: "shadow-none border-none p-4",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl w-full transition-all",
              socialButtonsBlockButtonText: "text-slate-700",
              formFieldInput:
                "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/30 transition-all",
              formFieldLabel: "text-sm font-semibold text-slate-700 mb-2 block",
              dividerLine: "bg-slate-200",
              dividerText: "text-slate-500 text-sm font-medium",
              footerActionText: "text-slate-600",
              footerActionLink:
                "text-indigo-600 hover:text-indigo-700 font-semibold",
              alert:
                "bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm",
            },
            layout: {
              socialButtonsPlacement: "bottom",
              socialButtonsVariant: "blockButton",
            },
          }}
        />
      </div>
    </div>
  );
};

export default AuthPage;
