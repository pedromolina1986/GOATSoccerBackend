import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = SMTP_USER
  ? nodemailer.createTransport({
      host: SMTP_HOST ?? 'smtp.gmail.com',
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export async function sendInviteEmail(
  to: string,
  teamName: string,
  coachName: string
): Promise<void> {
  const html = buildInviteHtml(to, teamName, coachName);

  if (!transporter) {
    // No SMTP configured — print to console so it can be seen in dev
    console.log('\n' + '─'.repeat(60));
    console.log(`INVITE EMAIL -> ${to}`);
    console.log(`    Team  : ${teamName}`);
    console.log(`    Coach : ${coachName}`);
    console.log('─'.repeat(60) + '\n');
    return;
  }

  await transporter.sendMail({
    from: `"GoatSoccer Manager" <noreply@goatsoccer.com>`,
    to,
    subject: `You've been invited to join ${teamName} on GoatSoccer!`,
    html,
  });
}

function buildInviteHtml(email: string, teamName: string, coachName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>GoatSoccer Invitation</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f8; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px;
               overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header  { background: linear-gradient(135deg, #2e7d32, #43a047); padding: 36px 32px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 28px; letter-spacing: -0.5px; }
    .header p  { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .ball      { font-size: 48px; display: block; margin-bottom: 12px; }
    .body      { padding: 36px 32px; }
    .body p    { margin: 0 0 16px; color: #424242; font-size: 15px; line-height: 1.6; }
    .team-badge { display: inline-block; background: #e8f5e9; color: #2e7d32;
                  font-weight: 700; font-size: 16px; padding: 8px 20px;
                  border-radius: 24px; border: 2px solid #a5d6a7; margin: 8px 0 20px; }
    .cta-btn   { display: block; width: fit-content; margin: 24px auto 0;
                 background: #2e7d32; color: #fff; font-size: 16px; font-weight: 600;
                 padding: 14px 36px; border-radius: 8px; text-decoration: none;
                 text-align: center; letter-spacing: 0.3px; }
    .steps     { background: #f9f9f9; border-radius: 8px; padding: 20px 24px; margin: 24px 0; }
    .steps h3  { margin: 0 0 12px; font-size: 14px; color: #757575; text-transform: uppercase; letter-spacing: 0.5px; }
    .step      { display: flex; align-items: flex-start; margin-bottom: 10px; }
    .step-num  { background: #2e7d32; color: #fff; width: 22px; height: 22px; border-radius: 50%;
                 font-size: 12px; font-weight: 700; display: flex; align-items: center;
                 justify-content: center; flex-shrink: 0; margin-right: 12px; margin-top: 2px; }
    .step p    { margin: 0; color: #424242; font-size: 14px; }
    .footer    { border-top: 1px solid #f0f0f0; padding: 20px 32px; text-align: center;
                 color: #9e9e9e; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="ball"></span>
      <h1>You're invited!</h1>
      <p>GoatSoccer Manager</p>
    </div>
    <div class="body">
      <p>Hi there,</p>
      <p>
        <strong>${coachName}</strong> has added you as a player on
      </p>
      <div style="text-align:center">
        <span class="team-badge">${teamName}</span>
      </div>
      <p>
        To access your profile, view your schedule, and connect with your team,
        download the <strong>GoatSoccer Manager</strong> app and create your account
        using this email address&nbsp;(<strong>${email}</strong>).
      </p>

      <div class="steps">
        <h3>Getting started</h3>
        <div class="step">
          <div class="step-num">1</div>
          <p>Download <strong>GoatSoccer Manager</strong> on your Android device.</p>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <p>Register with this exact email: <strong>${email}</strong></p>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <p>Select the <strong>Player</strong> role and your team will be waiting for you.</p>
        </div>
      </div>

      <p style="color:#757575; font-size:13px;">
        If you were not expecting this invitation or believe it was sent by mistake,
        you can safely ignore this email.
      </p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} GoatSoccer Manager &nbsp;·&nbsp; Sent on behalf of ${coachName}
    </div>
  </div>
</body>
</html>`;
}
