import { useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Route, Router as WouterRouter, Switch, useLocation, Redirect } from "wouter";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import { Calendar } from "@/pages/Calendar";
import { Dashboard } from "@/pages/Dashboard";
import { Analytics } from "@/pages/Analytics";
import { Home } from "@/pages/Home";
import { Settings } from "@/pages/Settings";
import { Sprint } from "@/pages/Sprint";
import { Wellness } from "@/pages/Wellness";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment.");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#1E3A8A",
    colorForeground: "#14264A",
    colorMutedForeground: "#64748B",
    colorDanger: "#B42318",
    colorBackground: "#FFFFFF",
    colorInput: "#F8FAFC",
    colorInputForeground: "#14264A",
    colorNeutral: "#DCE3EC",
    fontFamily: "DM Sans",
    borderRadius: "0.8rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-900 font-bold",
    headerSubtitle: "text-slate-600",
    socialButtonsBlockButtonText: "text-slate-800 font-semibold",
    formFieldLabel: "text-slate-700 font-semibold",
    footerActionLink: "text-blue-900 font-semibold",
    footerActionText: "text-slate-600",
    dividerText: "text-slate-500",
    identityPreviewEditButton: "text-blue-900",
    formFieldSuccessText: "text-emerald-800",
    alertText: "text-rose-800",
    logoBox: "mb-3",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border-slate-200 bg-white hover:bg-slate-50",
    formButtonPrimary: "bg-blue-900 hover:bg-blue-950 text-white",
    formFieldInput: "border-slate-200 bg-slate-50 text-slate-900",
    footerAction: "border-0",
    dividerLine: "bg-slate-200",
    alert: "border-rose-200 bg-rose-50",
    otpCodeFieldInput: "border-slate-300",
    formFieldRow: "mb-3",
    main: "gap-4",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        client.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function HomeRoute() {
  return <><Show when="signed-in"><Redirect to="/dashboard"/></Show><Show when="signed-out"><Home/></Show></>;
}

function SignInPage() {
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#F8FAFC] px-4 py-10"><div className="w-full max-w-[440px]"><div className="mb-5 text-center"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-amber-700">UPSC Command Center</p><h1 className="mt-2 font-serif text-2xl font-extrabold text-[#14264A]">Your next chapter starts here.</h1></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/></div></div>;
}

function SignUpPage() {
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[#F8FAFC] px-4 py-10"><div className="w-full max-w-[440px]"><div className="mb-5 text-center"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-amber-700">UPSC Command Center</p><h1 className="mt-2 font-serif text-2xl font-extrabold text-[#14264A]">Set up your private workspace.</h1></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/></div></div>;
}

function AccessDenied() {
  const { signOut } = useClerk();
  return <div className="grid min-h-[100dvh] place-items-center bg-[#F8FAFC] px-5"><div className="max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xl shadow-blue-950/5"><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-amber-700">Private workspace</p><h1 className="mt-4 font-serif text-3xl font-extrabold text-[#14264A]">This account does not have access.</h1><p className="mt-3 text-sm leading-6 text-slate-600">The signed-in primary email is not on the workspace allowlist. Study and integration data has not been loaded.</p><button className="mt-6 rounded-xl bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white" onClick={() => signOut({ redirectUrl: basePath || "/" })} data-testid="button-denied-signout">Sign out</button></div></div>;
}

function SignedInPortal({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [location] = useLocation();
  const allowedEmails = (import.meta.env.VITE_UPSC_ALLOWED_EMAIL || "").split(",").map((email: string) => email.trim().toLowerCase()).filter(Boolean);
  if (!isLoaded) return <div className="min-h-[100dvh] animate-pulse bg-[#F8FAFC]" data-testid="status-auth-loading"/>;
  if (!isSignedIn) return <Redirect to="/"/>;
  const primaryEmail = user.primaryEmailAddress?.emailAddress?.trim().toLowerCase() || "";
  if (!primaryEmail || !allowedEmails.includes(primaryEmail)) return <AccessDenied/>;
  return <ErrorBoundary resetKey={location}><AppShell>{children}</AppShell></ErrorBoundary>;
}

function Portal({ page }: { page: ReactNode }) {
  return <><Show when="signed-in"><SignedInPortal>{page}</SignedInPortal></Show><Show when="signed-out"><Redirect to="/"/></Show></>;
}

function SignInOrHome() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={HomeRoute}/>
    <Route path="/sign-in/*?" component={SignInPage}/>
    <Route path="/sign-up/*?" component={SignUpPage}/>
    <Route path="/dashboard"><Portal page={<Dashboard/>}/></Route>
    <Route path="/sprint"><Portal page={<Sprint/>}/></Route>
    <Route path="/analytics"><Portal page={<Analytics/>}/></Route>
    <Route path="/calendar"><Portal page={<Calendar/>}/></Route>
    <Route path="/wellness"><Portal page={<Wellness/>}/></Route>
    <Route path="/settings"><Portal page={<Settings/>}/></Route>
    <Route component={NotFound}/>
  </Switch></ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: "Welcome back", subtitle: "Return to your preparation space." } },
      signUp: { start: { title: "Build your command center", subtitle: "A private workspace for your next chapter." } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator/>
      <TooltipProvider><SignInOrHome/><Toaster/></TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes/></WouterRouter>;
}

export default App;
