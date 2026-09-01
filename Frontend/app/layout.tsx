import { Geist_Mono, Urbanist, Manrope } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/hooks/useAuth"
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/I18nProvider";
import { WebSocketProvider } from "@/components/WebSocketProvider";
import { BrowserErrorGuard } from "@/components/BrowserErrorGuard";

import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "GRID CPMS - Enterprise EV Charging",
  description: "Enterprise EV Charging, Smart Energy Flexibility, Roaming & Driver Companion",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/icon.svg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GRID CPMS",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e2228",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, urbanist.variable, manrope.variable, "font-sans")}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var isIgnored = function(msg, stack, source) {
                    msg = msg || '';
                    stack = stack || '';
                    source = source || '';
                    return (
                      (msg.indexOf('Cannot read properties of undefined') !== -1 && msg.indexOf('startTime') !== -1) ||
                      msg.indexOf("reading 'startTime'") !== -1 ||
                      stack.indexOf('reportAllChanges') !== -1 ||
                      (source.indexOf('VM') !== -1 && (stack.indexOf('startTime') !== -1 || msg.indexOf('startTime') !== -1)) ||
                      (msg.indexOf('should be greater than 0') !== -1 && (msg.indexOf('width(') !== -1 || msg.indexOf('height(') !== -1))
                    );
                  };
                  window.addEventListener('error', function(e) {
                    var msg = e.message || '';
                    var stack = (e.error && e.error.stack) || '';
                    var source = e.filename || '';
                    if (isIgnored(msg, stack, source)) {
                      e.preventDefault();
                      e.stopImmediatePropagation();
                    }
                  }, true);
                  window.addEventListener('unhandledrejection', function(e) {
                    var r = e.reason;
                    var msg = (r && (r.message || String(r))) || '';
                    var stack = (r && r.stack) || '';
                    var source = (r && r.fileName) || '';
                    if (isIgnored(msg, stack, source)) {
                      e.preventDefault();
                    }
                  }, true);
                  var origWarn = console.warn;
                  console.warn = function() {
                    var s = Array.prototype.slice.call(arguments).join(' ');
                    if (s.indexOf('should be greater than 0') !== -1 && (s.indexOf('width(') !== -1 || s.indexOf('height(') !== -1)) {
                      return;
                    }
                    origWarn.apply(console, arguments);
                  };
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <BrowserErrorGuard />
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <WebSocketProvider>
                {children}
              </WebSocketProvider>
            </AuthProvider>
          </I18nProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
