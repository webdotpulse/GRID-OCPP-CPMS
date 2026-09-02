"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Search,
  ShieldCheck,
  User,
  ExternalLink,
  Copy,
  Check,
  Download,
  Terminal,
  Zap,
  Cpu,
  Layers,
  FileText,
  HelpCircle,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle2,
  Lock,
  Globe,
  Wallet,
  Settings,
  RefreshCw,
  Server,
  Car,
  CreditCard,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  CalendarClock,
  Radio,
  Sliders,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

// Type definitions for Documentation Articles
interface DocSection {
  id: string;
  heading: string;
  body: string | React.ReactNode;
  codeSnippet?: {
    language: string;
    code: string;
  };
  callout?: {
    type: 'info' | 'warning' | 'security' | 'tip';
    title: string;
    message: string;
  };
}

interface DocArticle {
  id: string;
  title: string;
  category: string;
  audience: 'admin' | 'user';
  readTime: string;
  summary: string;
  appUrl?: string;
  appUrlLabel?: string;
  tags: string[];
  sections: DocSection[];
}

export default function DocumentationPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeAudienceFilter, setActiveAudienceFilter] = useState<'all' | 'admin' | 'user'>(
    isAdmin ? 'all' : 'user'
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedArticleId, setSelectedArticleId] = useState<string>('getting-started');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Copy code helper
  const handleCopyCode = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Raw Documentation Database
  const allArticles: DocArticle[] = useMemo(
    () => [
      // ==========================================
      // USER / OPERATOR DOCUMENTATION ARTICLES
      // ==========================================
      {
        id: 'getting-started',
        title: 'Getting Started & Account Security',
        category: 'Getting Started',
        audience: 'user',
        readTime: '4 min',
        summary: 'Platform overview, logging in, setting up Two-Factor Authentication (2FA TOTP), and managing your driver or operator profile.',
        appUrl: '/settings',
        appUrlLabel: 'Open Profile Settings',
        tags: ['login', '2fa', 'password', 'totp', 'authentication', 'account', 'profile'],
        sections: [
          {
            id: 'auth-overview',
            heading: '1. Accessing the CPMS Platform',
            body: (
              <div className="space-y-3">
                <p>
                  The Charge Point Management System (CPMS) is an enterprise-grade cloud management suite for EV charging stations, active charging transactions, dynamic smart pricing, and driver accounts.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Lock className="size-3.5" /> Secure Authentication
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Bcrypt password encryption with email verification and multi-tenant domain scoping.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5" /> 2FA Protection
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Time-based One-Time Passwords (TOTP) supported via Google Authenticator, Authy, and 1Password.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                      <Zap className="size-3.5" /> Real-Time Telemetry
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Instant live WebSocket streaming of active sessions, power draw (kW), and meter values.
                    </p>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: '2fa-setup',
            heading: '2. Setting Up Two-Factor Authentication (2FA)',
            body: (
              <div className="space-y-3">
                <p>To enhance account security, you can enable 2FA TOTP:</p>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/90">
                  <li>Navigate to <strong>Settings → Account Security</strong>.</li>
                  <li>Click <strong>Enable Two-Factor Authentication</strong> to generate a unique QR code secret.</li>
                  <li>Scan the QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, or Authy).</li>
                  <li>Enter the generated 6-digit confirmation code to activate 2FA protection.</li>
                </ol>
              </div>
            ),
            callout: {
              type: 'tip',
              title: 'Backup Recovery Keys',
              message: 'Store your 2FA recovery backup codes in a secure password manager. If you lose your phone, backup codes allow one-time access to recover your profile.',
            },
          },
        ],
      },
      {
        id: 'dashboard-guide',
        title: 'Executive Dashboard & Live Fleet KPIs',
        category: 'Core Operations',
        audience: 'user',
        readTime: '5 min',
        summary: 'Understanding network overview statistics, active session power streams, live station maps, and 24-hour fleet load curves.',
        appUrl: '/dashboard',
        appUrlLabel: 'Go to Dashboard',
        tags: ['dashboard', 'kpi', 'map', 'active sessions', 'power', 'telemetry', 'energy'],
        sections: [
          {
            id: 'kpi-overview',
            heading: '1. Executive KPI Cards',
            body: (
              <div className="space-y-3">
                <p>The top metric cards give an instantaneous view of fleet health and throughput:</p>
                <ul className="space-y-2 text-sm text-foreground/90">
                  <li className="flex items-start gap-2">
                    <span className="size-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <div><strong>Total Energy Delivered (kWh):</strong> Cumulative energy imported by vehicles across all connected chargers today or within the selected billing period.</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div><strong>Active Charging Sessions:</strong> Real-time count of vehicles currently drawing power across your bays.</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="size-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <div><strong>Fleet Online Connectivity:</strong> Ratio of online OCPP charge points currently maintaining heartbeat communication.</div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="size-2 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                    <div><strong>Revenue / Cost Accumulation:</strong> Real-time financial estimation based on active dynamic or fixed tariffs.</div>
                  </li>
                </ul>
              </div>
            ),
          },
          {
            id: 'map-live-stream',
            heading: '2. Geospatial Map & Active Session Stream',
            body: (
              <div className="space-y-3">
                <p>
                  The interactive Leaflet map displays station locations with color-coded pins: 
                  <span className="text-emerald-400 font-semibold ml-1">Green (Available)</span>, 
                  <span className="text-blue-400 font-semibold ml-1">Blue (Charging)</span>, 
                  <span className="text-amber-400 font-semibold ml-1">Orange (Suspended / Preparing)</span>, and 
                  <span className="text-rose-400 font-semibold ml-1">Red (Faulted / Offline)</span>.
                </p>
                <p>
                  The live session panel on the dashboard updates in sub-second intervals via WebSockets whenever meter values are broadcasted by the EVSE.
                </p>
              </div>
            ),
          },
        ],
      },
      {
        id: 'stations-groundplan',
        title: 'Charging Stations & 2D Ground Plan Canvas',
        category: 'Infrastructure',
        audience: 'user',
        readTime: '6 min',
        summary: 'Station locations, physical bays layout, 2D drag-and-drop ground plan builder, and live occupancy monitor.',
        appUrl: '/stations',
        appUrlLabel: 'View Charging Stations',
        tags: ['stations', 'ground plan', 'locations', 'canvas', 'parking bays', 'map', '2d'],
        sections: [
          {
            id: 'station-management',
            heading: '1. Station Hierarchy & Setup',
            body: (
              <div className="space-y-3">
                <p>
                  A <strong>Station</strong> represents a physical facility or parking depot hosting one or more physical chargers. Each station contains GPS coordinates, physical address, maximum grid connection capacity (kW), and opening hours.
                </p>
              </div>
            ),
          },
          {
            id: 'ground-plan-builder',
            heading: '2. Interactive 2D Ground Plan Canvas',
            body: (
              <div className="space-y-3">
                <p>
                  Stations with <strong>Ground Plan Enabled</strong> provide an architectural 2D canvas:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Parking Bay Placement:</strong> Position and rotate bays (0°, 45°, 90°, 135°) to match real-world parking lots.</li>
                  <li><strong>Connector Mapping:</strong> Link specific physical charger plugs (EVSE 1, EVSE 2) to designated parking slots.</li>
                  <li><strong>Walkways & Infrastructure:</strong> Draw pedestrian zebra paths, transformer rooms, canopy shelters, and safety bollards.</li>
                  <li><strong>Live Floor Monitor (`/stations/[id]/live`):</strong> Provides security guards and drivers with a glowing real-time occupancy map showing active charging power and driver identification.</li>
                </ul>
              </div>
            ),
            callout: {
              type: 'info',
              title: 'Driver Live View',
              message: 'Non-admin users can access the Live Floor Monitor directly from the sidebar if enabled for their assigned corporate location.',
            },
          },
        ],
      },
      {
        id: 'chargers-fleet',
        title: 'Chargers, Connectors & Remote Operations',
        category: 'Infrastructure',
        audience: 'user',
        readTime: '6 min',
        summary: 'Fleet directory, connector statuses, remote start/stop, plug unlock, reset commands, and connector modes.',
        appUrl: '/chargers',
        appUrlLabel: 'Open Chargers Fleet',
        tags: ['chargers', 'connectors', 'remote start', 'unlock', 'reset', 'type2', 'ccs2', 'evse'],
        sections: [
          {
            id: 'charger-statuses',
            heading: '1. EVSE Connector Statuses (OCPP Standard)',
            body: (
              <div className="space-y-3">
                <p>The system adheres to standard OCPP 1.6-J and 2.0.1 connector states:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse border border-border/80 rounded-lg">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-2.5 border-b border-border/80">Status</th>
                        <th className="p-2.5 border-b border-border/80">Description</th>
                        <th className="p-2.5 border-b border-border/80">Next Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      <tr>
                        <td className="p-2.5 font-bold text-emerald-400">Available</td>
                        <td className="p-2.5">EVSE is idle and ready for a new charging session.</td>
                        <td className="p-2.5">Plug in cable / swipe RFID tag.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-amber-400">Preparing</td>
                        <td className="p-2.5">Cable is connected to vehicle; waiting for RFID authorization.</td>
                        <td className="p-2.5">Authorize via RFID or App.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-primary">Charging</td>
                        <td className="p-2.5">Power is actively flowing into the EV traction battery.</td>
                        <td className="p-2.5">Monitor kW power telemetry.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-sky-400">SuspendedEV</td>
                        <td className="p-2.5">Vehicle reached 100% SoC or paused charging internally.</td>
                        <td className="p-2.5">Ready to disconnect.</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-rose-400">Faulted</td>
                        <td className="p-2.5">Hardware ground fault, emergency stop engaged, or communication error.</td>
                        <td className="p-2.5">Perform Soft/Hard reset.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
          {
            id: 'remote-controls',
            heading: '2. Remote Control Operations',
            body: (
              <div className="space-y-3">
                <p>Authorized operators can execute real-time RPC commands directly on the charger detail view:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Remote Start:</strong> Initiate a charging session remotely on a specific connector with an RFID card or virtual tag.</li>
                  <li><strong>Remote Stop:</strong> Gracefully conclude an active session and open the contactors.</li>
                  <li><strong>Unlock Connector:</strong> Release a cable mechanically locked in the EVSE socket (useful when a vehicle finishes charging).</li>
                  <li><strong>Soft / Hard Reset:</strong> Soft resets restart the OCPP application; Hard resets power-cycle the controller hardware.</li>
                </ul>
              </div>
            ),
          },
          {
            id: 'connecting-charger-url',
            heading: '3. Connecting a New Charger (WebSocket Backend URL)',
            body: (
              <div className="space-y-3">
                <p>
                  To point any EV charger to the CPMS, configure the following endpoint parameters in your hardware configuration app (e.g. Alfen ACE Service Installer, EVBox Connect, Smappee Dashboard, Easee Installer, ABB Terra Config):
                </p>
                <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-2 font-mono text-xs">
                  <div className="text-primary font-bold">Unified Central System URL (Recommended):</div>
                  <div className="p-2 rounded bg-background text-foreground select-all">wss://ocpp.thechargegrid.com/OCPP/</div>
                  <div className="text-muted-foreground pt-1">
                    Enter the charger identity (e.g. <code>MP100220</code>) in the Charge Point ID field. The charger will automatically connect to <code>wss://ocpp.thechargegrid.com/OCPP/MP100220</code>.
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-2 font-mono text-xs">
                  <div className="text-emerald-400 font-bold">Complete WebSocket URL (For Single-Field Apps):</div>
                  <div className="p-2 rounded bg-background text-foreground select-all">wss://ocpp.thechargegrid.com/OCPP/MP100220</div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The backend automatically handles <strong>OCPP 1.6-J</strong>, <strong>2.0.1</strong>, and <strong>2.1</strong> via standard <code>Sec-WebSocket-Protocol</code> negotiation. You do not need separate URLs for different versions.
                </p>
              </div>
            ),
            callout: {
              type: 'info',
              title: 'Unrecognized Connection Queue',
              message: 'If a newly connected charger is not yet registered in the system, it will appear in the Unrecognized Queue (/chargers) where an administrator can assign and approve it in one click.',
            },
          },
        ],
      },
      {
        id: 'sessions-transactions',
        title: 'Active Sessions & Transaction History',
        category: 'Sessions & Billing',
        audience: 'user',
        readTime: '5 min',
        summary: 'Tracking charging sessions, live energy import, duration, meter start/stop readings, and downloading session receipts.',
        appUrl: '/transactions',
        appUrlLabel: 'View Transactions',
        tags: ['transactions', 'sessions', 'meter values', 'kwh', 'receipts', 'billing'],
        sections: [
          {
            id: 'session-telemetry',
            heading: '1. Ingesting Real-Time Meter Telemetry',
            body: (
              <div className="space-y-3">
                <p>
                  During an active session, the charger sends periodic <code>MeterValues</code> frames containing:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Instantaneous Power (kW):</strong> Active power delivered across Phase 1, Phase 2, and Phase 3.</li>
                  <li><strong>Active Energy Register (Wh / kWh):</strong> Certified financial meter reading.</li>
                  <li><strong>State of Charge (SoC %):</strong> Real-time battery charge percentage reported via ISO 15118 or DC fast-charging CAN/PLC.</li>
                  <li><strong>Voltage & Current:</strong> Line-to-neutral voltages and amperes per phase.</li>
                </ul>
              </div>
            ),
          },
          {
            id: 'session-costing',
            heading: '2. Financial Calculation & Receipt Export',
            body: (
              <div className="space-y-3">
                <p>
                  When a session concludes (<code>StopTransaction</code>), the dynamic pricing service calculates the total cost according to the assigned tariff matrix:
                </p>
                <div className="p-3 rounded-xl bg-card border border-border/70 text-xs font-mono text-muted-foreground">
                  Total Cost (€) = Connection Fee + (Energy Consumed kWh × Energy Rate) + (Duration Minutes × Time Fee) + (Idle Minutes × Idle Fee)
                </div>
                <p className="text-sm">
                  Users can export PDF receipts or CSV data directly from the transaction detail modal.
                </p>
              </div>
            ),
          },
        ],
      },
      {
        id: 'rfid-vehicle-identity',
        title: 'RFID Tags & Vehicle Identity Management',
        category: 'Fleet & Access',
        audience: 'user',
        readTime: '4 min',
        summary: 'Managing physical RFID cards, whitelists, ISO 15118 Plug & Charge digital contracts (EMAID), and vehicle energy profiles.',
        appUrl: '/rfid',
        appUrlLabel: 'Manage RFID Cards',
        tags: ['rfid', 'idtag', 'plug and charge', 'iso15118', 'vehicles', 'cards', 'whitelist'],
        sections: [
          {
            id: 'rfid-cards',
            heading: '1. RFID Card Whitelisting',
            body: (
              <div className="space-y-3">
                <p>
                  Physical RFID tags (Mifare Classic, DESFire EV1/EV2/EV3) are mapped to users in the <strong>RFID Tags</strong> directory (`/rfid`).
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Tag UID (`idTag`):</strong> Hexadecimal identifier stored on the card chip.</li>
                  <li><strong>Status:</strong> `Accepted`, `Blocked`, `Expired`.</li>
                  <li><strong>Expiry Date:</strong> Set automatic card deactivation dates for temporary contractors or rental drivers.</li>
                </ul>
              </div>
            ),
          },
          {
            id: 'iso15118-pnc',
            heading: '2. ISO 15118 Plug & Charge (Vehicle Identity)',
            body: (
              <div className="space-y-3">
                <p>
                  For compatible electric vehicles, <strong>Plug & Charge</strong> enables automatic session authorization as soon as the charging cable is inserted. The vehicle transmits its unique <strong>e-Mobility Account Identifier (EMAID)</strong> and signed contract certificate, eliminating the need for physical RFID cards or mobile apps.
                </p>
              </div>
            ),
          },
        ],
      },
      {
        id: 'reimbursements-guide',
        title: 'Employee Home Charging Reimbursements',
        category: 'Sessions & Billing',
        audience: 'user',
        readTime: '5 min',
        summary: 'Automatic split-billing for company EV drivers charging at their private home chargers with monthly SEPA compensation.',
        appUrl: '/reimbursements',
        appUrlLabel: 'View Reimbursements',
        tags: ['reimbursements', 'home charging', 'split billing', 'sepa', 'compensation', 'expenses'],
        sections: [
          {
            id: 'home-charging-concept',
            heading: '1. Home Charger Reimbursement Ledger',
            body: (
              <div className="space-y-3">
                <p>
                  Employees with company EVs who charge at home can link their private home charge point to the CPMS. The system records all kilowatt-hours consumed for corporate charging and compiles monthly reimbursement ledgers.
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Contract Setup:</strong> Specify the employee&apos;s residential electricity tariff rate (€/kWh) or dynamic EPEX contract link.</li>
                  <li><strong>Automated Ingestion:</strong> Home sessions are tagged with the employee&apos;s corporate vehicle profile.</li>
                  <li><strong>Monthly Settlement:</strong> At the end of each month, the employer generates a SEPA XML payment file (<code>pain.001</code>) to automatically reimburse electricity costs directly to the employee&apos;s IBAN.</li>
                </ol>
              </div>
            ),
          },
        ],
      },
      {
        id: 'mobile-app-guide',
        title: 'Mobile Driver Companion Web App',
        category: 'Driver Essentials',
        audience: 'user',
        readTime: '3 min',
        summary: 'Using the Progressive Web App (PWA) on smartphones to locate stations, start charging via QR code, and track battery SoC.',
        appUrl: '/mobile',
        appUrlLabel: 'Open Mobile Companion',
        tags: ['mobile', 'pwa', 'driver', 'smartphone', 'qr code', 'adhoc', 'ios', 'android'],
        sections: [
          {
            id: 'mobile-pwa',
            heading: '1. Accessing the Mobile Web App (`/mobile`)',
            body: (
              <div className="space-y-3">
                <p>
                  The CPMS includes a tailored, lightweight mobile interface optimized for mobile browsers on iOS and Android:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Station Finder:</strong> Instant GPS geolocation showing the closest available charging points.</li>
                  <li><strong>Live Bay Availability:</strong> Real-time plug availability indicator before arriving at the station.</li>
                  <li><strong>QR Code Scanner:</strong> Scan the QR code sticker on the charger to immediately launch checkout or remote session start.</li>
                  <li><strong>Live Battery Progress:</strong> Watch real-time charging speed, state of charge (%), elapsed minutes, and cost estimate.</li>
                </ul>
              </div>
            ),
          },
        ],
      },
      {
        id: 'faq-troubleshooting',
        title: 'Troubleshooting & Driver FAQ',
        category: 'Driver Essentials',
        audience: 'user',
        readTime: '4 min',
        summary: 'Solutions to common charging issues: cable stuck in socket, card unauthorized, slow charging speed, and error codes.',
        tags: ['faq', 'troubleshooting', 'cable stuck', 'unlock', 'unauthorized', 'error'],
        sections: [
          {
            id: 'cable-stuck',
            heading: '1. What to do if the charging cable is stuck?',
            body: (
              <div className="space-y-3">
                <p>If the mechanical lock on the EVSE or vehicle socket does not release:</p>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/90">
                  <li>Ensure the session is stopped from the vehicle dashboard or app.</li>
                  <li>Unlock your car doors twice with the key fob (many EVs unlock the inlet when unlocking doors).</li>
                  <li>In the CPMS, open the Charger detail view and click <strong>Unlock Connector</strong>.</li>
                  <li>Gently push the connector plug inward slightly to relieve lock pin tension, then pull straight out.</li>
                </ol>
              </div>
            ),
          },
          {
            id: 'slow-charging',
            heading: '2. Why is my charging speed slower than expected?',
            body: (
              <div className="space-y-3">
                <p>Charging speed depends on several dynamic factors:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Vehicle On-Board Charger (OBC):</strong> AC charging is limited by the vehicle&apos;s internal converter (e.g. 11 kW or 22 kW).</li>
                  <li><strong>Dynamic Load Management (LMS):</strong> If multiple cars charge simultaneously, the site load balancer may temporarily limit current to avoid grid overload.</li>
                  <li><strong>Battery Temperature & Cold Weather:</strong> Cold lithium batteries throttle DC charging until battery pre-conditioning warms the cells.</li>
                </ul>
              </div>
            ),
          },
        ],
      },

      // ==========================================
      // ADMINISTRATOR DOCUMENTATION ARTICLES
      // ==========================================
      {
        id: 'multi-tenancy-admin',
        title: 'Multi-Tenant Architecture & Corporate B2B Clients',
        category: 'System Architecture',
        audience: 'admin',
        readTime: '7 min',
        summary: 'Multi-tenant corporate hierarchy, database partitioning rules, B2B billing entities, and company asset assignments.',
        appUrl: '/users',
        appUrlLabel: 'Manage Corporate Accounts',
        tags: ['multi-tenant', 'corporate', 'companies', 'isolation', 'b2b', 'rbac', 'superadmin'],
        sections: [
          {
            id: 'multi-tenant-model',
            heading: '1. Multi-Tenant Corporate Structure',
            body: (
              <div className="space-y-3">
                <p>
                  The CPMS provides strict multi-tenant isolation, allowing enterprise operators to host multiple independent corporate clients (fleets, commercial properties, municipalities) on a single platform instance.
                </p>
                <div className="p-4 rounded-xl bg-[#171a1f] border border-white/10 font-mono text-xs text-[#aab0bc] space-y-2">
                  <div className="text-emerald-400 font-bold">👑 Superadmin Platform Domain</div>
                  <div className="pl-4 border-l border-white/20 space-y-2">
                    <div>├── 🏢 Company A (Alpha Logistics B.V. - KvK: 84920192)</div>
                    <div className="pl-6 text-muted-foreground">├── 👤 Fleet Manager Admin</div>
                    <div className="pl-6 text-muted-foreground">├── ⚡ Assigned Stations & Chargers (Bays 1-12)</div>
                    <div className="pl-6 text-muted-foreground">└── 💶 Consolidated Monthly SEPA Invoices</div>
                    <div>└── 🏢 Company B (Beta Fleet Services N.V. - BCE: 0712345678)</div>
                    <div className="pl-6 text-muted-foreground">├── 👤 Client Operations Admin</div>
                    <div className="pl-6 text-muted-foreground">└── ⚡ Assigned Stations & Chargers (Depot 3)</div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: 'tenant-rules',
            heading: '2. Multi-Tenant Scoping Rules',
            body: (
              <div className="space-y-3">
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Data Scoping:</strong> All database queries for non-superadmins are automatically scoped by <code>companyId</code> / <code>owner_id</code>.</li>
                  <li><strong>Asset Encapsulation:</strong> Corporate Client Admins can only view and manage chargers, RFID tags, and sessions belonging to their company.</li>
                  <li><strong>Superadmin Global Override:</strong> Superadmin roles have global multi-tenant visibility for system-wide auditing, roaming routing, and billing runs.</li>
                </ul>
              </div>
            ),
            callout: {
              type: 'security',
              title: 'API Security Notice',
              message: 'All REST API endpoints enforce authenticateToken and requireAdmin middleware with strict tenant boundary checks. Cross-tenant leakage is prevented at the database ORM layer.',
            },
          },
        ],
      },
      {
        id: 'security-pki-admin',
        title: 'Security Profiles & PKI / TLS Certificates',
        category: 'Security & PKI',
        audience: 'admin',
        readTime: '8 min',
        summary: 'OCPP 1.6 Security Profiles 1, 2, and 3, mTLS mutual authentication, CSMS certificates, and ISO 15118 PKI Root/Sub-CA management.',
        appUrl: '/settings/security',
        appUrlLabel: 'Security & PKI Settings',
        tags: ['security', 'pki', 'tls', 'mtls', 'certificates', 'ocpp security', 'iso15118', 'ca'],
        sections: [
          {
            id: 'ocpp-security-profiles',
            heading: '1. OCPP 1.6 Security Profiles Matrix',
            body: (
              <div className="space-y-3">
                <p>The system supports full compliance with the <strong>OCPP 1.6 Security Whitepaper (Edition 3)</strong>:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <Badge variant="outline" className="text-amber-400 border-amber-400/30">Profile 1</Badge>
                    <h5 className="font-bold text-xs">Unsecured Transport</h5>
                    <p className="text-xs text-muted-foreground">HTTP WebSocket (<code>ws://</code>) with HTTP Basic Authentication credentials.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <Badge variant="outline" className="text-primary border-primary/30">Profile 2</Badge>
                    <h5 className="font-bold text-xs">TLS with Basic Auth</h5>
                    <p className="text-xs text-muted-foreground">Encrypted Transport (<code>wss://</code>) with server TLS certificate and client Basic Auth credentials.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-1.5">
                    <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Profile 3</Badge>
                    <h5 className="font-bold text-xs">mTLS Client Certs</h5>
                    <p className="text-xs text-muted-foreground">Mutual TLS authentication (<code>wss://</code>) with X.509 client certificates issued by trusted CPO Sub-CA.</p>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: 'pki-hierarchy',
            heading: '2. ISO 15118 & V2G PKI Trust Chain',
            body: (
              <div className="space-y-3">
                <p>For ISO 15118 Plug & Charge, the PKI hierarchy is structured as follows:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Root CA:</strong> Self-signed master certificate with 20-year validity.</li>
                  <li><strong>Sub-CA (CSMS):</strong> Intermediate CA used to issue server TLS certificates and sign EVSE certificates.</li>
                  <li><strong>V2G Root CA:</strong> Dedicated Certificate Authority validating vehicle contract certificates (EMAID).</li>
                </ul>
              </div>
            ),
            codeSnippet: {
              language: 'bash',
              code: `# Verify CSMS TLS Certificate Expiration
openssl x509 -in /etc/ssl/certs/csms-server.crt -noout -enddate -issuer`,
            },
          },
        ],
      },
      {
        id: 'dynamic-epex-tariffs-admin',
        title: 'Dynamic EPEX Spot Tariffs & Spot Price Feeds',
        category: 'Tariffs & Roaming',
        audience: 'admin',
        readTime: '7 min',
        summary: 'Configuring dynamic hourly day-ahead spot pricing, margin markups, price caps, and automatic ENTSO-E price feeds.',
        appUrl: '/tariffs',
        appUrlLabel: 'Manage Dynamic Tariffs',
        tags: ['tariffs', 'epex spot', 'dynamic pricing', 'entso-e', 'day ahead', 'energy fees', 'margins'],
        sections: [
          {
            id: 'epex-concept',
            heading: '1. EPEX Spot Price Integration',
            body: (
              <div className="space-y-3">
                <p>
                  The dynamic pricing engine synchronizes daily at 13:00 CET with the European Power Exchange (EPEX Spot / ENTSO-E Transparency Platform) to fetch 24-hour Day-Ahead wholesale electricity rates.
                </p>
                <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-2">
                  <span className="text-xs font-bold text-primary">Dynamic Tariff Pricing Formula:</span>
                  <div className="p-2.5 rounded-lg bg-background font-mono text-xs text-foreground">
                    Effective kWh Rate = (EPEX_Hourly_Spot_Price × Multiplier) + CPO_Fixed_Margin + Grid_Fee
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: 'tariff-rules',
            heading: '2. Tariff Element Matrix',
            body: (
              <div className="space-y-3">
                <p>Every tariff consists of four independently configurable cost components:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-card border border-border/70"><strong>1. Connection Fee (€):</strong> Fixed one-time charge applied when session initiates.</div>
                  <div className="p-2.5 rounded-lg bg-card border border-border/70"><strong>2. Energy Rate (€/kWh):</strong> Fixed or dynamic price per unit of electrical energy consumed.</div>
                  <div className="p-2.5 rounded-lg bg-card border border-border/70"><strong>3. Time Fee (€/min):</strong> Per-minute charge while charging is active.</div>
                  <div className="p-2.5 rounded-lg bg-card border border-border/70"><strong>4. Idle Fee (€/min):</strong> Penalty applied after battery reaches 100% SoC and remains plugged in.</div>
                </div>
              </div>
            ),
          },
        ],
      },
      {
        id: 'roaming-ocpi-oicp-admin',
        title: 'Roaming Hubs: OCPI 2.2.1 & Hubject OICP',
        category: 'Tariffs & Roaming',
        audience: 'admin',
        readTime: '8 min',
        summary: 'Setting up eMSP/CPO roaming partnerships, exchanging credentials, locations synchronization, CDR pushing, and tokens.',
        appUrl: '/roaming',
        appUrlLabel: 'Open Roaming Manager',
        tags: ['roaming', 'ocpi', 'hubject', 'oicp', 'emsp', 'cpo', 'cdr', 'tokens', 'interoperability'],
        sections: [
          {
            id: 'ocpi-endpoints',
            heading: '1. OCPI 2.2.1 Protocol Endpoints',
            body: (
              <div className="space-y-3">
                <p>
                  The platform implements full OCPI 2.2.1 CPO and eMSP roles for cross-network charging interoperability:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><code>/ocpi/cpo/2.2.1/credentials</code>: Secure token exchange and endpoint registration.</li>
                  <li><code>/ocpi/cpo/2.2.1/locations</code>: EVSE locations, status feeds, and connector specs push/pull.</li>
                  <li><code>/ocpi/cpo/2.2.1/tariffs</code>: Real-time tariff broadcast to roaming partners.</li>
                  <li><code>/ocpi/cpo/2.2.1/cdrs</code>: Charge Detail Record generation and financial reconciliation.</li>
                  <li><code>/ocpi/cpo/2.2.1/tokens</code>: Whitelisting roaming partner RFID tokens and authorization requests.</li>
                </ul>
              </div>
            ),
          },
        ],
      },
      {
        id: 'hardware-reliability-autoheal-admin',
        title: 'Hardware Reliability, Quirks & Auto-Heal Engine',
        category: 'Hardware & Maintenance',
        audience: 'admin',
        readTime: '7 min',
        summary: 'Vendor hardware quirks, automated health monitoring, offline watchdog rules, and automated reboot playbooks.',
        appUrl: '/auto-heal-playbooks',
        appUrlLabel: 'View Auto-Heal Playbooks',
        tags: ['hardware', 'auto heal', 'quirks', 'playbooks', 'watchdog', 'maintenance', 'reliability'],
        sections: [
          {
            id: 'auto-heal-engine',
            heading: '1. Automated Auto-Heal Playbooks',
            body: (
              <div className="space-y-3">
                <p>
                  The Auto-Heal background watchdog continuously evaluates fleet health against automated recovery rules:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Stuck in Preparing:</strong> If a connector remains in <code>Preparing</code> for &gt;10 minutes without starting a transaction, the system triggers <code>UnlockConnector</code>.</li>
                  <li><strong>Heartbeat Timeout:</strong> If a charger misses heartbeats for &gt;5 minutes, a WebSocket ping/pong cycle is forced before marking the unit offline.</li>
                  <li><strong>Connector Fault Self-Recovery:</strong> When a charger reports a non-critical ground error, the system executes an automated Soft Reset playbook after a 60-second cooldown.</li>
                </ul>
              </div>
            ),
          },
          {
            id: 'quirk-profiles',
            heading: '2. Hardware Quirk Profiles',
            body: (
              <div className="space-y-3">
                <p>
                  Different hardware manufacturers interpret the OCPP specification with slight variations. The CPMS includes pre-configured Quirk Profiles for:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-semibold">
                  <div className="p-2 rounded bg-card border border-border/70 text-center">Alfen Eve Single/Double</div>
                  <div className="p-2 rounded bg-card border border-border/70 text-center">ABB Terra 54/184 DC</div>
                  <div className="p-2 rounded bg-card border border-border/70 text-center">EVBox Elvi / Troniq</div>
                  <div className="p-2 rounded bg-card border border-border/70 text-center">Mennekes Amtron / Amedio</div>
                </div>
              </div>
            ),
          },
        ],
      },
      {
        id: 'ocpp-packet-inspector-admin',
        title: 'Live OCPP Packet Inspector & WebSocket Triggers',
        category: 'Protocols & Debugging',
        audience: 'admin',
        readTime: '6 min',
        summary: 'Dual-protocol WebSocket architecture (OCPP 1.6-J & 2.0.1/2.1), JSON-RPC packet logging, message filtering, and diagnostic triggers.',
        appUrl: '/ocpp',
        appUrlLabel: 'Open OCPP Diagnostic Console',
        tags: ['ocpp', 'websocket', 'json-rpc', 'diagnostics', 'logs', 'packet inspector', 'raw messages'],
        sections: [
          {
            id: 'ocpp-pipeline',
            heading: '1. WebSocket Dual-Protocol Architecture & Backend URLs',
            body: (
              <div className="space-y-3">
                <p>
                  The CPMS exposes a dedicated high-performance WebSocket server on port <strong>9220</strong> (RFC 6455) or via reverse proxy on port <strong>443 (WSS)</strong>:
                </p>
                <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-2">
                  <div className="text-xs font-bold text-primary">Unified Backend Endpoint (Recommended for all hardware):</div>
                  <div className="p-2 rounded bg-background font-mono text-xs text-foreground">
                    wss://ocpp.thechargegrid.com/OCPP/&#123;chargerId&#125;
                  </div>
                  <div className="text-xs text-muted-foreground">
                    The server inspects the <code>Sec-WebSocket-Protocol</code> header (<code>ocpp1.6</code>, <code>ocpp2.0.1</code>, <code>ocpp2.1</code>) and automatically routes traffic to the appropriate protocol handler.
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-card border border-border/70">
                    <span className="text-emerald-400 font-bold block mb-1">OCPP 1.6-J Legacy Path:</span>
                    wss://ocpp.thechargegrid.com/OCPP/1.6/&#123;id&#125;
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border/70">
                    <span className="text-sky-400 font-bold block mb-1">OCPP 2.0.1 / 2.1 Legacy Path:</span>
                    wss://ocpp.thechargegrid.com/OCPP/2.1/&#123;id&#125;
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: 'json-rpc-format',
            heading: '2. OCPP JSON-RPC Message Formats',
            body: (
              <div className="space-y-3">
                <p>Standard message types supported by the packet stream:</p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2 rounded bg-card border border-border/70">
                    <span className="text-primary font-bold">CALL (Type 2):</span> [2, &quot;msg-101&quot;, &quot;BootNotification&quot;, &#123; &quot;chargePointModel&quot;: &quot;Eve-Double&quot; &#125;]
                  </div>
                  <div className="p-2 rounded bg-card border border-border/70">
                    <span className="text-emerald-400 font-bold">CALLRESULT (Type 3):</span> [3, &quot;msg-101&quot;, &#123; &quot;status&quot;: &quot;Accepted&quot;, &quot;interval&quot;: 300 &#125;]
                  </div>
                  <div className="p-2 rounded bg-card border border-border/70">
                    <span className="text-rose-400 font-bold">CALLERROR (Type 4):</span> [4, &quot;msg-101&quot;, &quot;NotSupported&quot;, &quot;Action not recognized&quot;, &#123;&#125;]
                  </div>
                </div>
              </div>
            ),
          },
        ],
      },
      {
        id: 'backups-maintenance-admin',
        title: 'Database Backups, Restores & Scheduled Cron Jobs',
        category: 'System Architecture',
        audience: 'admin',
        readTime: '6 min',
        summary: 'Automated PostgreSQL database backups, point-in-time restore, migration management, and background scheduled maintenance routines.',
        appUrl: '/settings/environment',
        appUrlLabel: 'Environment & Maintenance',
        tags: ['backups', 'database', 'postgres', 'cron', 'scheduled tasks', 'restore', 'maintenance'],
        sections: [
          {
            id: 'backup-engine',
            heading: '1. Automated Database Backups',
            body: (
              <div className="space-y-3">
                <p>
                  The system includes a built-in database backup service with automatic daily scheduling:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Scheduled Backups:</strong> Daily automated snapshots stored in <code>Backend/data/backups/</code> with gzip compression.</li>
                  <li><strong>Manual On-Demand Backups:</strong> Trigger instant snapshots before performing major firmware updates or schema changes.</li>
                  <li><strong>Point-In-Time Restore:</strong> One-click database restoration with schema validation and rollback safety.</li>
                </ul>
              </div>
            ),
            codeSnippet: {
              language: 'bash',
              code: `# Manual PostgreSQL Backup Command
pg_dump -U postgres -h localhost -d ocpp_cpms -F c -b -v -f /var/backups/ocpp_manual_backup.dump`,
            },
          },
          {
            id: 'cron-schedules',
            heading: '2. Background Cron Schedules',
            body: (
              <div className="space-y-3">
                <p>Built-in background tasks managed by <code>node-cron</code>:</p>
                <ul className="space-y-1.5 text-xs text-foreground/90">
                  <li><code>*/5 * * * *</code>: Auto-Heal & Offline Watchdog (Runs every 5 minutes)</li>
                  <li><code>0 13 * * *</code>: EPEX Day-Ahead Spot Price Ingestion (Runs daily at 13:00 CET)</li>
                  <li><code>0 0 1 * *</code>: Monthly Reimbursement & Invoice Finalization (Runs 1st of every month)</li>
                </ul>
              </div>
            ),
          },
        ],
      },
      {
        id: 'installation-deployment-admin',
        title: 'Installation, Docker Deployment & Reverse Proxy',
        category: 'System Architecture',
        audience: 'admin',
        readTime: '9 min',
        summary: 'Production deployment architecture, Docker Compose topology, Nginx/Caddy reverse proxy with WSS headers, and environment variables.',
        tags: ['docker', 'deployment', 'nginx', 'caddy', 'reverse proxy', 'wss', 'installation', 'production'],
        sections: [
          {
            id: 'docker-topology',
            heading: '1. Production Architecture Topology',
            body: (
              <div className="space-y-3">
                <p>The standard enterprise topology consists of:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  <li><strong>Frontend:</strong> Next.js 16 App Router on Port 3002</li>
                  <li><strong>Backend REST API:</strong> Express TypeScript on Port 3000</li>
                  <li><strong>OCPP WebSocket Server:</strong> Low-level WS server on Port 9220</li>
                  <li><strong>Database:</strong> PostgreSQL 16 on Port 5432</li>
                  <li><strong>Cache / PubSub:</strong> Redis 7 on Port 6379</li>
                </ul>
              </div>
            ),
          },
          {
            id: 'nginx-wss-config',
            heading: '2. Nginx WebSocket Reverse Proxy Configuration',
            body: (
              <div className="space-y-3">
                <p>Sample Nginx configuration for routing OCPP WSS traffic:</p>
              </div>
            ),
            codeSnippet: {
              language: 'nginx',
              code: `server {
    listen 443 ssl http2;
    server_name ocpp.chargegrid.com;

    ssl_certificate /etc/letsencrypt/live/ocpp.chargegrid.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ocpp.chargegrid.com/privkey.pem;

    # OCPP 1.6 and 2.0.1 WebSocket Routing
    location /OCPP/ {
        proxy_pass http://127.0.0.1:9220;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}`,
            },
          },
        ],
      },
    ],
    []
  );

  // Filter articles based on User Role, Active Audience Filter, Category, and Search Query
  const filteredArticles = useMemo(() => {
    return allArticles.filter((article) => {
      // Role-Based Isolation: If user is not admin, strictly hide all admin audience articles
      if (!isAdmin && article.audience === 'admin') {
        return false;
      }

      // Audience Tab Filter (if admin)
      if (isAdmin && activeAudienceFilter !== 'all') {
        if (article.audience !== activeAudienceFilter) {
          return false;
        }
      }

      // Category Filter
      if (selectedCategoryId !== 'all' && article.category !== selectedCategoryId) {
        return false;
      }

      // Search Query Filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesTitle = article.title.toLowerCase().includes(query);
        const matchesSummary = article.summary.toLowerCase().includes(query);
        const matchesCategory = article.category.toLowerCase().includes(query);
        const matchesTags = article.tags.some((tag) => tag.toLowerCase().includes(query));
        const matchesSections = article.sections.some(
          (s) =>
            s.heading.toLowerCase().includes(query) ||
            (typeof s.body === 'string' && s.body.toLowerCase().includes(query))
        );
        return matchesTitle || matchesSummary || matchesCategory || matchesTags || matchesSections;
      }

      return true;
    });
  }, [allArticles, isAdmin, activeAudienceFilter, selectedCategoryId, searchQuery]);

  // Extract unique categories from visible articles
  const categories = useMemo(() => {
    const visiblePool = allArticles.filter((a) => (isAdmin ? true : a.audience === 'user'));
    const uniqueCats = Array.from(new Set(visiblePool.map((a) => a.category)));
    return ['all', ...uniqueCats];
  }, [allArticles, isAdmin]);

  // Currently active article
  const currentArticle = useMemo(() => {
    const found = filteredArticles.find((a) => a.id === selectedArticleId);
    if (found) return found;
    return filteredArticles[0] || allArticles[0];
  }, [filteredArticles, selectedArticleId, allArticles]);

  // Navigation: Previous and Next articles
  const { prevArticle, nextArticle } = useMemo(() => {
    const currentIndex = filteredArticles.findIndex((a) => a.id === currentArticle?.id);
    const prev = currentIndex > 0 ? filteredArticles[currentIndex - 1] : null;
    const next = currentIndex >= 0 && currentIndex < filteredArticles.length - 1 ? filteredArticles[currentIndex + 1] : null;
    return { prevArticle: prev, nextArticle: next };
  }, [filteredArticles, currentArticle]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Banner & Search Header */}
      <div className="border-b border-border/80 bg-card/60 backdrop-blur-md px-6 py-6 md:py-8 sticky top-16 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-md shadow-primary/20">
                  <BookOpen className="size-5" />
                </div>
                <h1 className="text-xl md:text-2xl font-bold font-heading tracking-tight text-foreground">
                  Documentation & Operational Manuals
                </h1>
                <Badge
                  variant={isAdmin ? 'soft-warning' : 'soft-info'}
                  className="gap-1 text-xs py-0.5"
                >
                  {isAdmin ? (
                    <>
                      <ShieldCheck className="size-3 text-amber-500" />
                      <span>Administrator Access (Full Manuals)</span>
                    </>
                  ) : (
                    <>
                      <User className="size-3 text-sky-500" />
                      <span>User Access (Operator & Driver Manual)</span>
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                {isAdmin
                  ? 'Comprehensive operational reference, system administration manuals, security whitepapers, and driver guidelines.'
                  : 'Complete user guide for finding chargers, managing RFID tags, tracking charging sessions, and invoicing.'}
              </p>
            </div>

            {/* Offline PDF Manual Downloads */}
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl border-border/80 bg-background/80 hover:bg-muted text-xs font-semibold shadow-xs"
                >
                  <a href="/manuals/OCPP_CPMS_Admin_Manual.pdf" download="OCPP_CPMS_Admin_Manual.pdf" target="_blank" rel="noopener noreferrer">
                    <Download className="size-3.5 text-amber-400" />
                    <span>Admin Manual (PDF)</span>
                  </a>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-2 rounded-xl border-border/80 bg-background/80 hover:bg-muted text-xs font-semibold shadow-xs"
              >
                <a href="/manuals/OCPP_CPMS_User_Manual.pdf" download="OCPP_CPMS_User_Manual.pdf" target="_blank" rel="noopener noreferrer">
                  <Download className="size-3.5 text-emerald-400" />
                  <span>User Manual (PDF)</span>
                </a>
              </Button>
            </div>
          </div>

          {/* Search Bar & Audience Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation, topics, error codes, protocols (e.g. 'OCPP 1.6', 'Unlock', '2FA', 'EPEX')..."
                className="pl-10 h-10 rounded-xl bg-background border-border/80 text-sm shadow-xs focus-visible:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Admin Audience Selector (Hidden for normal users) */}
            {isAdmin && (
              <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60 shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => setActiveAudienceFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 sm:flex-none",
                    activeAudienceFilter === 'all'
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Guides ({allArticles.length})
                </button>
                <button
                  onClick={() => setActiveAudienceFilter('admin')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 flex-1 sm:flex-none",
                    activeAudienceFilter === 'admin'
                      ? "bg-amber-500/15 text-amber-400 font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ShieldCheck className="size-3.5" />
                  Admin Only ({allArticles.filter((a) => a.audience === 'admin').length})
                </button>
                <button
                  onClick={() => setActiveAudienceFilter('user')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 flex-1 sm:flex-none",
                    activeAudienceFilter === 'user'
                      ? "bg-emerald-500/15 text-emerald-400 font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <User className="size-3.5" />
                  User & Driver ({allArticles.filter((a) => a.audience === 'user').length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Navigation Sidebar */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
          {/* Category Filter Pills */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Categories
            </h3>
            <div className="flex lg:flex-col flex-wrap gap-1.5">
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat;
                const count = allArticles.filter((a) => {
                  if (!isAdmin && a.audience === 'admin') return false;
                  if (isAdmin && activeAudienceFilter !== 'all' && a.audience !== activeAudienceFilter) return false;
                  return cat === 'all' ? true : a.category === cat;
                }).length;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategoryId(cat)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left w-full",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                        : "bg-card/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                    )}
                  >
                    <span className="capitalize">{cat === 'all' ? 'All Categories' : cat}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md font-semibold",
                        isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Article List within Category */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center justify-between">
              <span>Articles ({filteredArticles.length})</span>
            </h3>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredArticles.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/80 text-center space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">No matching articles</p>
                  <p className="text-[11px] text-muted-foreground/70">Try adjusting your search query</p>
                </div>
              ) : (
                filteredArticles.map((article) => {
                  const isActive = article.id === currentArticle?.id;
                  return (
                    <button
                      key={article.id}
                      onClick={() => setSelectedArticleId(article.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-all border group relative flex flex-col gap-1",
                        isActive
                          ? "bg-primary/10 border-primary/40 text-foreground shadow-xs"
                          : "bg-card/40 border-border/60 hover:bg-card hover:border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary" />
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                          {article.title}
                        </span>
                        {article.audience === 'admin' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 shrink-0">
                            Admin
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-muted-foreground/70 shrink-0">
                            {article.readTime}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground line-clamp-1">
                        {article.summary}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Center Main Article Viewer */}
        <main className="lg:col-span-8 xl:col-span-9 space-y-6">
          {currentArticle ? (
            <Card className="p-6 md:p-8 rounded-2xl bg-card border-border/80 shadow-md space-y-8">
              {/* Article Header */}
              <div className="space-y-4 border-b border-border/70 pb-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-semibold">
                      {currentArticle.category}
                    </Badge>
                    <Badge
                      variant={currentArticle.audience === 'admin' ? 'soft-warning' : 'soft-info'}
                      className="text-xs gap-1"
                    >
                      {currentArticle.audience === 'admin' ? (
                        <>
                          <ShieldCheck className="size-3 text-amber-400" />
                          <span>Admin Manual</span>
                        </>
                      ) : (
                        <>
                          <User className="size-3 text-sky-400" />
                          <span>User & Driver Guide</span>
                        </>
                      )}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {currentArticle.readTime} read
                    </span>
                    {currentArticle.appUrl && (
                      <Button asChild size="xs" variant="outline" className="gap-1.5 rounded-lg text-primary hover:text-primary">
                        <Link href={currentArticle.appUrl}>
                          <span>{currentArticle.appUrlLabel || 'Open in App'}</span>
                          <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-extrabold font-heading text-foreground tracking-tight">
                    {currentArticle.title}
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    {currentArticle.summary}
                  </p>
                </div>

                {/* Tags */}
                {currentArticle.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {currentArticle.tags.map((tag) => (
                      <span
                        key={tag}
                        onClick={() => setSearchQuery(tag)}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Article Content Sections */}
              <div className="space-y-8">
                {currentArticle.sections.map((section) => (
                  <section key={section.id} id={section.id} className="space-y-4">
                    <h3 className="text-lg md:text-xl font-bold text-foreground font-heading border-l-2 border-primary pl-3">
                      {section.heading}
                    </h3>

                    <div className="text-sm text-foreground/90 leading-relaxed space-y-3">
                      {section.body}
                    </div>

                    {/* Callout Box */}
                    {section.callout && (
                      <div
                        className={cn(
                          "p-4 rounded-xl border space-y-1.5 flex items-start gap-3",
                          section.callout.type === 'tip' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
                          section.callout.type === 'info' && "bg-blue-500/10 border-blue-500/30 text-blue-300",
                          section.callout.type === 'warning' && "bg-amber-500/10 border-amber-500/30 text-amber-300",
                          section.callout.type === 'security' && "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        )}
                      >
                        {section.callout.type === 'tip' && <Sparkles className="size-5 text-emerald-400 mt-0.5 shrink-0" />}
                        {section.callout.type === 'info' && <Info className="size-5 text-blue-400 mt-0.5 shrink-0" />}
                        {section.callout.type === 'warning' && <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />}
                        {section.callout.type === 'security' && <Lock className="size-5 text-rose-400 mt-0.5 shrink-0" />}
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-xs uppercase tracking-wider">
                            {section.callout.title}
                          </h5>
                          <p className="text-xs leading-relaxed text-foreground/90">
                            {section.callout.message}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Code Snippet with Copy Button */}
                    {section.codeSnippet && (
                      <div className="rounded-xl overflow-hidden border border-white/10 bg-[#171a1f] shadow-inner space-y-0">
                        <div className="px-4 py-2 bg-black/40 border-b border-white/5 flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold uppercase text-[#aab0bc]">
                            {section.codeSnippet.language}
                          </span>
                          <button
                            onClick={() => handleCopyCode(section.id, section.codeSnippet!.code)}
                            className="flex items-center gap-1 text-[11px] text-[#aab0bc] hover:text-white transition-colors"
                          >
                            {copiedCodeId === section.id ? (
                              <>
                                <Check className="size-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-semibold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto leading-relaxed">
                          <code>{section.codeSnippet.code}</code>
                        </pre>
                      </div>
                    )}
                  </section>
                ))}
              </div>

              {/* Navigation Footer (Prev / Next Article) */}
              <div className="border-t border-border/70 pt-6 flex items-center justify-between gap-4 flex-wrap">
                {prevArticle ? (
                  <button
                    onClick={() => setSelectedArticleId(prevArticle.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/70 hover:border-primary/50 bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all group"
                  >
                    <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
                    <div className="text-left">
                      <span className="block text-[10px] text-muted-foreground/70 uppercase">Previous</span>
                      <span className="font-bold text-foreground">{prevArticle.title}</span>
                    </div>
                  </button>
                ) : (
                  <div />
                )}

                {nextArticle && (
                  <button
                    onClick={() => setSelectedArticleId(nextArticle.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/70 hover:border-primary/50 bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all group ml-auto"
                  >
                    <div className="text-right">
                      <span className="block text-[10px] text-muted-foreground/70 uppercase">Next</span>
                      <span className="font-bold text-foreground">{nextArticle.title}</span>
                    </div>
                    <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center space-y-4 rounded-2xl bg-card border-border/80">
              <BookOpen className="size-12 text-muted-foreground mx-auto opacity-50" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">No article selected</h3>
                <p className="text-sm text-muted-foreground">Select an article from the left navigation to read the guide.</p>
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
