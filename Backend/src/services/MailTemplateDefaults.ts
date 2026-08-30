/**
 * Default HTML and Plain Text Email Templates for OCPP-CPMS
 * Supported Languages: English (en), Dutch (nl), French (fr)
 * 
 * Supported Placeholders:
 * - {{name}}: User full name or display name
 * - {{userEmail}}: Recipient email address
 * - {{loginUrl}}: URL to the login page
 * - {{verificationUrl}}: URL to verify email address
 * - {{resetUrl}}: URL to reset password
 * - {{twoFactorCode}}: 6-digit TOTP / email authentication code
 * - {{password}}: Initial generated temporary password (if applicable)
 * - {{invoiceNumber}}: Fiscal invoice reference number
 * - {{totalAmount}}: Total billed amount formatted
 * - {{currency}}: Currency code (EUR, USD, GBP)
 * - {{dueDate}}: Invoice payment due date
 */

export interface MailTemplateDefinition {
  name: string;
  type: string;
  language: "en" | "nl" | "fr";
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

const baseHtmlLayout = (title: string, contentHtml: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f8;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .email-header {
      background: linear-gradient(135deg, #1e2228 0%, #2a303c 100%);
      padding: 28px 32px;
      text-align: center;
      border-bottom: 3px solid #54a8c7;
    }
    .email-logo {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .email-logo span {
      color: #54a8c7;
    }
    .email-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-top: 4px;
    }
    .email-body {
      padding: 36px 32px;
      line-height: 1.6;
    }
    .email-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .email-content {
      font-size: 15px;
      color: #334155;
      margin-bottom: 24px;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn-primary {
      display: inline-block;
      background-color: #3f78e0;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(63, 120, 224, 0.35);
    }
    .btn-primary:hover {
      background-color: #2b62cb;
    }
    .code-box {
      background-color: #f1f5f9;
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      margin: 24px 0;
    }
    .code-digits {
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 6px;
      color: #0f172a;
    }
    .info-card {
      background-color: #f8fafc;
      border-left: 4px solid #54a8c7;
      padding: 14px 16px;
      border-radius: 0 8px 8px 0;
      margin: 20px 0;
      font-size: 13px;
      color: #475569;
    }
    .email-footer {
      background-color: #f8fafc;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .email-footer a {
      color: #3f78e0;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="email-logo">GRID <span>OCPP-CPMS</span></div>
      <div class="email-subtitle">Centralized Charge Point Management System</div>
    </div>
    <div class="email-body">
      ${contentHtml}
    </div>
    <div class="email-footer">
      <p style="margin: 0 0 8px 0;">This is an automated system email from OCPP-CPMS Smart Energy Network.</p>
      <p style="margin: 0;">Secured with OCPP 1.6-J & 2.0.1 Protocol Engine • ISO 15118 Ready</p>
    </div>
  </div>
</body>
</html>
`;

export const DEFAULT_MAIL_TEMPLATES: MailTemplateDefinition[] = [
  // ==========================================
  // 1. ADMIN WELCOME (New user created by admin)
  // ==========================================
  {
    name: "Admin Welcome User (EN)",
    type: "admin_welcome",
    language: "en",
    subject: "Welcome to OCPP CPMS - Your Account Details",
    bodyHtml: baseHtmlLayout("Welcome to OCPP CPMS", `
      <h2 class="email-title">Welcome, {{name}}!</h2>
      <div class="email-content">
        <p>An administrator has created an account for you on the <strong>OCPP CPMS</strong> Charging Station Management Platform.</p>
        <div class="info-card">
          <strong>Your Login Credentials:</strong><br>
          Email: <strong>{{userEmail}}</strong><br>
          Temporary Password: <strong>{{password}}</strong>
        </div>
        <p>Please log in to your account and update your password immediately in Settings.</p>
      </div>
      <div class="btn-container">
        <a href="{{loginUrl}}" class="btn-primary">Log In to CPMS Dashboard</a>
      </div>
      <p class="email-content" style="font-size: 12px; color: #64748b;">
        If you have any questions or did not expect this invitation, please contact your organization administrator.
      </p>
    `),
    bodyText: `Welcome {{name}}!\n\nAn administrator has created an account for you on OCPP CPMS.\n\nYour Login Credentials:\nEmail: {{userEmail}}\nTemporary Password: {{password}}\n\nLog in here: {{loginUrl}}\n\nPlease change your password upon your first login.\n\nOCPP CPMS Team`,
  },
  {
    name: "Admin Welcome User (NL)",
    type: "admin_welcome",
    language: "nl",
    subject: "Welkom bij OCPP CPMS - Uw Accountgegevens",
    bodyHtml: baseHtmlLayout("Welkom bij OCPP CPMS", `
      <h2 class="email-title">Welkom, {{name}}!</h2>
      <div class="email-content">
        <p>Een beheerder heeft een account voor u aangemaakt op het <strong>OCPP CPMS</strong> Laadpaalbeheersysteem.</p>
        <div class="info-card">
          <strong>Uw Inloggegevens:</strong><br>
          E-mailadres: <strong>{{userEmail}}</strong><br>
          Tijdelijk Wachtwoord: <strong>{{password}}</strong>
        </div>
        <p>Log in op uw dashboard en wijzig uw wachtwoord direct via Instellingen.</p>
      </div>
      <div class="btn-container">
        <a href="{{loginUrl}}" class="btn-primary">Inloggen op CPMS Dashboard</a>
      </div>
      <p class="email-content" style="font-size: 12px; color: #64748b;">
        Heeft u vragen of verwachtte u deze uitnodiging niet? Neem dan contact op met uw wagenparkbeheerder.
      </p>
    `),
    bodyText: `Welkom {{name}}!\n\nEen beheerder heeft een account voor u aangemaakt op OCPP CPMS.\n\nUw Inloggegevens:\nE-mail: {{userEmail}}\nWachtwoord: {{password}}\n\nInloggen: {{loginUrl}}\n\nWijzig uw wachtwoord direct na het eerste inloggen.\n\nOCPP CPMS Team`,
  },
  {
    name: "Admin Welcome User (FR)",
    type: "admin_welcome",
    language: "fr",
    subject: "Bienvenue sur OCPP CPMS - Vos identifiants de connexion",
    bodyHtml: baseHtmlLayout("Bienvenue sur OCPP CPMS", `
      <h2 class="email-title">Bienvenue, {{name}} !</h2>
      <div class="email-content">
        <p>Un administrateur a créé un compte pour vous sur la plateforme de gestion de bornes <strong>OCPP CPMS</strong>.</p>
        <div class="info-card">
          <strong>Vos Identifiants :</strong><br>
          E-mail : <strong>{{userEmail}}</strong><br>
          Mot de passe temporaire : <strong>{{password}}</strong>
        </div>
        <p>Veuillez vous connecter et modifier votre mot de passe dès que possible dans vos Paramètres.</p>
      </div>
      <div class="btn-container">
        <a href="{{loginUrl}}" class="btn-primary">Accéder au Dashboard CPMS</a>
      </div>
      <p class="email-content" style="font-size: 12px; color: #64748b;">
        Si vous n'attendiez pas cet e-mail, veuillez contacter votre administrateur de flotte.
      </p>
    `),
    bodyText: `Bienvenue {{name}} !\n\nUn administrateur a créé votre compte sur OCPP CPMS.\n\nVos identifiants :\nE-mail : {{userEmail}}\nMot de passe : {{password}}\n\nConnexion : {{loginUrl}}\n\nVeuillez changer votre mot de passe après votre première connexion.\n\nL'équipe OCPP CPMS`,
  },

  // ==========================================
  // 2. REGISTRATION (Self Sign-up)
  // ==========================================
  {
    name: "User Registration (EN)",
    type: "registration",
    language: "en",
    subject: "Welcome to OCPP CPMS - Account Registered",
    bodyHtml: baseHtmlLayout("Account Registered", `
      <h2 class="email-title">Welcome to the Charging Network!</h2>
      <div class="email-content">
        <p>Thank you for registering on <strong>OCPP CPMS</strong> with email: <strong>{{userEmail}}</strong>.</p>
        <p>Your account is ready to manage EV charge points, configure dynamic smart charging tariffs, and monitor live charging sessions.</p>
      </div>
      <div class="btn-container">
        <a href="{{verificationUrl}}" class="btn-primary">Verify Email & Activate Account</a>
      </div>
      <p class="email-content" style="font-size: 12px; color: #64748b;">
        If you did not register for an account, you can safely ignore this email.
      </p>
    `),
    bodyText: `Welcome to OCPP CPMS!\n\nThank you for registering with email: {{userEmail}}.\n\nPlease verify your email and activate your account here:\n{{verificationUrl}}\n\nOCPP CPMS Team`,
  },
  {
    name: "User Registration (NL)",
    type: "registration",
    language: "nl",
    subject: "Welkom bij OCPP CPMS - Account Geregistreerd",
    bodyHtml: baseHtmlLayout("Account Geregistreerd", `
      <h2 class="email-title">Welkom op het Laadnetwerk!</h2>
      <div class="email-content">
        <p>Bedankt voor uw registratie op <strong>OCPP CPMS</strong> met e-mailadres: <strong>{{userEmail}}</strong>.</p>
        <p>Uw account is gereed voor het beheren van laadpunten, dynamische tarieven en live laadsessies.</p>
      </div>
      <div class="btn-container">
        <a href="{{verificationUrl}}" class="btn-primary">E-mail Verifiëren & Account Activeren</a>
      </div>
      <p class="email-content" style="font-size: 12px; color: #64748b;">
        Heeft u zich niet geregistreerd? Dan kunt u dit bericht negeren.
      </p>
    `),
    bodyText: `Welkom bij OCPP CPMS!\n\nBedankt voor uw registratie met e-mailadres: {{userEmail}}.\n\nVerifieer uw e-mailadres en activeer uw account hier:\n{{verificationUrl}}\n\nOCPP CPMS Team`,
  },
  {
    name: "User Registration (FR)",
    type: "registration",
    language: "fr",
    subject: "Bienvenue sur OCPP CPMS - Compte Enregistré",
    bodyHtml: baseHtmlLayout("Compte Enregistré", `
      <h2 class="email-title">Bienvenue sur le Réseau de Recharge !</h2>
      <div class="email-content">
        <p>Merci pour votre inscription sur <strong>OCPP CPMS</strong> avec l'adresse : <strong>{{userEmail}}</strong>.</p>
        <p>Votre compte est prêt pour superviser vos bornes, configurer les tarifs dynamiques et suivre les sessions en direct.</p>
      </div>
      <div class="btn-container">
        <a href="{{verificationUrl}}" class="btn-primary">Vérifier l'e-mail et Activer le Compte</a>
      </div>
      <p class="email-content" style="font-size: 12px; color: #64748b;">
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.
      </p>
    `),
    bodyText: `Bienvenue sur OCPP CPMS !\n\nMerci pour votre inscription avec l'e-mail : {{userEmail}}.\n\nVérifiez votre adresse et activez votre compte :\n{{verificationUrl}}\n\nL'équipe OCPP CPMS`,
  },

  // ==========================================
  // 3. EMAIL VERIFICATION
  // ==========================================
  {
    name: "Email Verification (EN)",
    type: "verification",
    language: "en",
    subject: "Verify your OCPP CPMS account email",
    bodyHtml: baseHtmlLayout("Verify your Email", `
      <h2 class="email-title">Verify Your Email Address</h2>
      <div class="email-content">
        <p>Hello,</p>
        <p>Please confirm your email address (<strong>{{userEmail}}</strong>) to ensure account security and receive transaction receipts and alerts.</p>
      </div>
      <div class="btn-container">
        <a href="{{verificationUrl}}" class="btn-primary">Verify Email Address</a>
      </div>
      <p class="email-content" style="font-size: 12px; color: #64748b;">
        Or paste this link into your browser: <br>
        <a href="{{verificationUrl}}" style="color: #3f78e0;">{{verificationUrl}}</a>
      </p>
    `),
    bodyText: `Verify Your Email Address\n\nPlease confirm your email address ({{userEmail}}) by opening the link below:\n{{verificationUrl}}\n\nThis link will expire in 24 hours.\n\nOCPP CPMS Team`,
  },
  {
    name: "Email Verification (NL)",
    type: "verification",
    language: "nl",
    subject: "Verifieer uw e-mailadres voor OCPP CPMS",
    bodyHtml: baseHtmlLayout("E-mailadres Verifiëren", `
      <h2 class="email-title">Verifieer uw E-mailadres</h2>
      <div class="email-content">
        <p>Hallo,</p>
        <p>Bevestig uw e-mailadres (<strong>{{userEmail}}</strong>) voor optimale accountbeveiliging en ontvangst van laadbonnen en notificaties.</p>
      </div>
      <div class="btn-container">
        <a href="{{verificationUrl}}" class="btn-primary">E-mailadres Bevestigen</a>
      </div>
      <p class="email-content" style="font-size: 12px; color: #64748b;">
        Of kopieer deze link in uw browser: <br>
        <a href="{{verificationUrl}}" style="color: #3f78e0;">{{verificationUrl}}</a>
      </p>
    `),
    bodyText: `Verifieer uw E-mailadres\n\nBevestig uw e-mailadres ({{userEmail}}) via onderstaande link:\n{{verificationUrl}}\n\nDeze link verloopt over 24 uur.\n\nOCPP CPMS Team`,
  },
  {
    name: "Email Verification (FR)",
    type: "verification",
    language: "fr",
    subject: "Vérifiez votre adresse e-mail OCPP CPMS",
    bodyHtml: baseHtmlLayout("Vérification d'e-mail", `
      <h2 class="email-title">Vérifiez votre adresse e-mail</h2>
      <div class="email-content">
        <p>Bonjour,</p>
        <p>Veuillez confirmer votre adresse e-mail (<strong>{{userEmail}}</strong>) pour sécuriser votre compte et recevoir vos reçus de charge.</p>
      </div>
      <div class="btn-container">
        <a href="{{verificationUrl}}" class="btn-primary">Confirmer mon e-mail</a>
      </div>
      <p class="email-content" style="font-size: 12px; color: #64748b;">
        Ou collez ce lien dans votre navigateur : <br>
        <a href="{{verificationUrl}}" style="color: #3f78e0;">{{verificationUrl}}</a>
      </p>
    `),
    bodyText: `Vérifiez votre adresse e-mail\n\nConfirmez votre adresse ({{userEmail}}) en ouvrant le lien suivant :\n{{verificationUrl}}\n\nCe lien expire dans 24 heures.\n\nL'équipe OCPP CPMS`,
  },

  // ==========================================
  // 4. PASSWORD RESET
  // ==========================================
  {
    name: "Password Reset (EN)",
    type: "password_reset",
    language: "en",
    subject: "Reset your OCPP CPMS Password",
    bodyHtml: baseHtmlLayout("Password Reset Request", `
      <h2 class="email-title">Password Reset Request</h2>
      <div class="email-content">
        <p>We received a request to reset the password for your <strong>OCPP CPMS</strong> account.</p>
        <p>Click the button below to choose a new, secure password. This link is valid for <strong>1 hour</strong>.</p>
      </div>
      <div class="btn-container">
        <a href="{{resetUrl}}" class="btn-primary">Reset Password</a>
      </div>
      <div class="info-card">
        <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email or contact support immediately. Your password remains unchanged.
      </div>
    `),
    bodyText: `Reset your OCPP CPMS Password\n\nYou requested a password reset for your account.\n\nClick the link below to set a new password (valid for 1 hour):\n{{resetUrl}}\n\nIf you did not request this, please ignore this message.\n\nOCPP CPMS Security Team`,
  },
  {
    name: "Password Reset (NL)",
    type: "password_reset",
    language: "nl",
    subject: "Wachtwoord herstellen voor OCPP CPMS",
    bodyHtml: baseHtmlLayout("Wachtwoord Herstellen", `
      <h2 class="email-title">Wachtwoord Herstellen</h2>
      <div class="email-content">
        <p>Wij hebben een verzoek ontvangen om het wachtwoord van uw <strong>OCPP CPMS</strong> account te resetten.</p>
        <p>Klik op de onderstaande knop om een nieuw wachtwoord in te stellen. Deze link is <strong>1 uur</strong> geldig.</p>
      </div>
      <div class="btn-container">
        <a href="{{resetUrl}}" class="btn-primary">Wachtwoord Resetten</a>
      </div>
      <div class="info-card">
        <strong>Beveiligingswaarschuwing:</strong> Heeft u dit verzoek niet ingediend? Negeer deze e-mail dan. Uw huidige wachtwoord blijft ongewijzigd.
      </div>
    `),
    bodyText: `Wachtwoord herstellen voor OCPP CPMS\n\nEr is een wachtwoordreset aangevraagd voor uw account.\n\nGebruik deze link om een nieuw wachtwoord in te stellen (1 uur geldig):\n{{resetUrl}}\n\nHeeft u dit niet aangevraagd? Negeer dan dit bericht.\n\nOCPP CPMS Security Team`,
  },
  {
    name: "Password Reset (FR)",
    type: "password_reset",
    language: "fr",
    subject: "Réinitialisation de votre mot de passe OCPP CPMS",
    bodyHtml: baseHtmlLayout("Réinitialisation de mot de passe", `
      <h2 class="email-title">Réinitialisation de votre Mot de Passe</h2>
      <div class="email-content">
        <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte <strong>OCPP CPMS</strong>.</p>
        <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien est valide pendant <strong>1 heure</strong>.</p>
      </div>
      <div class="btn-container">
        <a href="{{resetUrl}}" class="btn-primary">Réinitialiser le mot de passe</a>
      </div>
      <div class="info-card">
        <strong>Sécurité :</strong> Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail. Votre mot de passe actuel reste inchangé.
      </div>
    `),
    bodyText: `Réinitialisation de votre mot de passe OCPP CPMS\n\nUne réinitialisation a été demandée pour votre compte.\n\nUtilisez le lien suivant (valable 1 heure) :\n{{resetUrl}}\n\nSi vous n'avez pas fait cette demande, ignorez ce message.\n\nL'équipe Sécurité OCPP CPMS`,
  },

  // ==========================================
  // 5. 2FA LOGIN CODE
  // ==========================================
  {
    name: "2FA Login Verification Code (EN)",
    type: "2fa_login",
    language: "en",
    subject: "Your OCPP CPMS Two-Factor Login Code",
    bodyHtml: baseHtmlLayout("2FA Verification Code", `
      <h2 class="email-title">Two-Factor Authentication Code</h2>
      <div class="email-content">
        <p>Use the following 6-digit security code to complete your login to <strong>OCPP CPMS</strong>:</p>
      </div>
      <div class="code-box">
        <span class="code-digits">{{twoFactorCode}}</span>
      </div>
      <div class="info-card">
        This code expires in <strong>10 minutes</strong>. Never share this code with anyone.
      </div>
    `),
    bodyText: `Your OCPP CPMS 2FA Login Code is: {{twoFactorCode}}\n\nThis code will expire in 10 minutes. Never share this code.\n\nOCPP CPMS Security Team`,
  },
  {
    name: "2FA Login Verification Code (NL)",
    type: "2fa_login",
    language: "nl",
    subject: "Uw OCPP CPMS Tweestapsverificatie Inlogcode",
    bodyHtml: baseHtmlLayout("Tweestapsverificatie Code", `
      <h2 class="email-title">Tweestapsverificatie Beveiligingscode</h2>
      <div class="email-content">
        <p>Gebruik de onderstaande 6-cijferige verificatiecode om in te loggen op <strong>OCPP CPMS</strong>:</p>
      </div>
      <div class="code-box">
        <span class="code-digits">{{twoFactorCode}}</span>
      </div>
      <div class="info-card">
        Deze code is <strong>10 minuten</strong> geldig. Deel deze code nooit met derden.
      </div>
    `),
    bodyText: `Uw OCPP CPMS 2FA Inlogcode is: {{twoFactorCode}}\n\nDeze code is 10 minuten geldig. Deel deze code nooit.\n\nOCPP CPMS Security Team`,
  },
  {
    name: "2FA Login Verification Code (FR)",
    type: "2fa_login",
    language: "fr",
    subject: "Votre Code d'authentification à deux facteurs OCPP CPMS",
    bodyHtml: baseHtmlLayout("Code 2FA", `
      <h2 class="email-title">Code de Sécurité à Deux Facteurs</h2>
      <div class="email-content">
        <p>Utilisez le code de sécurité à 6 chiffres suivant pour finaliser votre connexion à <strong>OCPP CPMS</strong> :</p>
      </div>
      <div class="code-box">
        <span class="code-digits">{{twoFactorCode}}</span>
      </div>
      <div class="info-card">
        Ce code expire dans <strong>10 minutes</strong>. Ne communiquez jamais ce code.
      </div>
    `),
    bodyText: `Votre code 2FA OCPP CPMS est : {{twoFactorCode}}\n\nCe code expire dans 10 minutes.\n\nL'équipe Sécurité OCPP CPMS`,
  },

  // ==========================================
  // 6. 2FA SETUP CODE
  // ==========================================
  {
    name: "2FA Setup Code (EN)",
    type: "2fa_setup",
    language: "en",
    subject: "Your OCPP CPMS 2FA Setup Code",
    bodyHtml: baseHtmlLayout("2FA Setup", `
      <h2 class="email-title">Two-Factor Authentication Setup</h2>
      <div class="email-content">
        <p>You are enabling two-factor email authentication on your <strong>OCPP CPMS</strong> account.</p>
        <p>Enter the confirmation code below in your settings modal:</p>
      </div>
      <div class="code-box">
        <span class="code-digits">{{twoFactorCode}}</span>
      </div>
      <div class="info-card">
        This setup code is valid for <strong>10 minutes</strong>.
      </div>
    `),
    bodyText: `Your OCPP CPMS 2FA Setup Code is: {{twoFactorCode}}\n\nValid for 10 minutes.\n\nOCPP CPMS Team`,
  },
  {
    name: "2FA Setup Code (NL)",
    type: "2fa_setup",
    language: "nl",
    subject: "Uw OCPP CPMS 2FA Instelcode",
    bodyHtml: baseHtmlLayout("2FA Instellen", `
      <h2 class="email-title">Tweestapsverificatie Instellen</h2>
      <div class="email-content">
        <p>U activeert tweestapsverificatie via e-mail op uw <strong>OCPP CPMS</strong> account.</p>
        <p>Voer de onderstaande bevestigingscode in het instellingenvenster in:</p>
      </div>
      <div class="code-box">
        <span class="code-digits">{{twoFactorCode}}</span>
      </div>
      <div class="info-card">
        Deze verificatiecode is <strong>10 minuten</strong> geldig.
      </div>
    `),
    bodyText: `Uw OCPP CPMS 2FA Instelcode is: {{twoFactorCode}}\n\n10 minuten geldig.\n\nOCPP CPMS Team`,
  },
  {
    name: "2FA Setup Code (FR)",
    type: "2fa_setup",
    language: "fr",
    subject: "Votre code de configuration 2FA OCPP CPMS",
    bodyHtml: baseHtmlLayout("Configuration 2FA", `
      <h2 class="email-title">Configuration de la Double Authentification</h2>
      <div class="email-content">
        <p>Vous activez la double authentification par e-mail sur votre compte <strong>OCPP CPMS</strong>.</p>
        <p>Saisissez le code de confirmation ci-dessous dans vos paramètres :</p>
      </div>
      <div class="code-box">
        <span class="code-digits">{{twoFactorCode}}</span>
      </div>
      <div class="info-card">
        Ce code est valable pendant <strong>10 minutes</strong>.
      </div>
    `),
    bodyText: `Votre code de configuration 2FA OCPP CPMS est : {{twoFactorCode}}\n\nValable 10 minutes.\n\nL'équipe OCPP CPMS`,
  },

  // ==========================================
  // 7. INVOICE (Billing & PDF Receipt)
  // ==========================================
  {
    name: "Invoice Notification (EN)",
    type: "invoice",
    language: "en",
    subject: "Your OCPP CPMS Charging Invoice #{{invoiceNumber}}",
    bodyHtml: baseHtmlLayout("Charging Invoice", `
      <h2 class="email-title">Charging Session Invoice #{{invoiceNumber}}</h2>
      <div class="email-content">
        <p>Dear Customer,</p>
        <p>Please find attached your fiscal charging invoice <strong>#{{invoiceNumber}}</strong> for recent EV charging sessions.</p>
        <div class="info-card">
          <strong>Invoice Details:</strong><br>
          Invoice Number: <strong>#{{invoiceNumber}}</strong><br>
          Total Amount: <strong>€{{totalAmount}} {{currency}}</strong><br>
          Due Date: <strong>{{dueDate}}</strong>
        </div>
        <p>The detailed VAT PDF breakdown is attached to this email and is also accessible via your CPMS Invoices dashboard.</p>
      </div>
    `),
    bodyText: `Charging Invoice #{{invoiceNumber}}\n\nDear Customer,\n\nYour fiscal invoice #{{invoiceNumber}} is attached.\nTotal Amount: €{{totalAmount}} {{currency}}\nDue Date: {{dueDate}}\n\nOCPP CPMS Billing Team`,
  },
  {
    name: "Invoice Notification (NL)",
    type: "invoice",
    language: "nl",
    subject: "Uw OCPP CPMS Laadfactuur #{{invoiceNumber}}",
    bodyHtml: baseHtmlLayout("Laadfactuur", `
      <h2 class="email-title">Laadsessie Factuur #{{invoiceNumber}}</h2>
      <div class="email-content">
        <p>Beste Klant,</p>
        <p>In de bijlage vindt u uw fiscale laadfactuur <strong>#{{invoiceNumber}}</strong> voor recente EV-laadsessies.</p>
        <div class="info-card">
          <strong>Factuurgegevens:</strong><br>
          Factuurnummer: <strong>#{{invoiceNumber}}</strong><br>
          Totaalbedrag: <strong>€{{totalAmount}} {{currency}}</strong><br>
          Vervaldatum: <strong>{{dueDate}}</strong>
        </div>
        <p>De gedetailleerde btw-specificatie is als PDF bijgevoegd en tevens terug te vinden in uw CPMS Factuuroverzicht.</p>
      </div>
    `),
    bodyText: `Laadfactuur #{{invoiceNumber}}\n\nBeste Klant,\n\nUw factuur #{{invoiceNumber}} is bijgevoegd.\nTotaalbedrag: €{{totalAmount}} {{currency}}\nVervaldatum: {{dueDate}}\n\nOCPP CPMS Facturatie Team`,
  },
  {
    name: "Invoice Notification (FR)",
    type: "invoice",
    language: "fr",
    subject: "Votre Facture de recharge OCPP CPMS #{{invoiceNumber}}",
    bodyHtml: baseHtmlLayout("Facture de Recharge", `
      <h2 class="email-title">Facture de Recharge #{{invoiceNumber}}</h2>
      <div class="email-content">
        <p>Cher Client,</p>
        <p>Veuillez trouver ci-joint votre facture fiscale <strong>#{{invoiceNumber}}</strong> pour vos récentes sessions de recharge.</p>
        <div class="info-card">
          <strong>Détails de la Facture :</strong><br>
          Numéro de facture : <strong>#{{invoiceNumber}}</strong><br>
          Montant total : <strong>€{{totalAmount}} {{currency}}</strong><br>
          Date d'échéance : <strong>{{dueDate}}</strong>
        </div>
        <p>Le détail avec TVA est joint au format PDF et disponible sur votre tableau de bord CPMS.</p>
      </div>
    `),
    bodyText: `Facture de Recharge #{{invoiceNumber}}\n\nCher Client,\n\nVotre facture #{{invoiceNumber}} est jointe.\nMontant Total : €{{totalAmount}} {{currency}}\nÉchéance : {{dueDate}}\n\nL'équipe Facturation OCPP CPMS`,
  },
];

/**
 * Retrieve a default template fallback by type and language
 */
export function getDefaultMailTemplate(type: string, language: string = "en"): MailTemplateDefinition | undefined {
  const lang = (["en", "nl", "fr"].includes(language) ? language : "en") as "en" | "nl" | "fr";
  const match = DEFAULT_MAIL_TEMPLATES.find((t) => t.type === type && t.language === lang);
  if (match) return match;
  // Fallback to English if specific language missing
  return DEFAULT_MAIL_TEMPLATES.find((t) => t.type === type && t.language === "en");
}
