const nodemailer = require("nodemailer");

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

const STATUS_LABELS = {
  ui:           "Interfaccia (UI)",
  funzionalita: "Funzionalità",
  performance:  "Performance",
  errore:       "Errore / Crash",
  altro:        "Altro",
};

async function sendBugReportEmail({ bug, reporterName, reporterEmail }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[Mailer] SMTP not configured — bug saved but email skipped");
    return;
  }
  const to = process.env.SEED_SUPERADMIN_EMAIL || "superadmin@fleetcc.dev";
  const catLabel = STATUS_LABELS[bug.category] || bug.category;
  await transporter.sendMail({
    from: `"FleetCC" <${process.env.SMTP_USER}>`,
    to,
    subject: `[FleetCC Bug] ${bug.title}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0a1628;color:#e2eaf5;padding:32px;border-radius:12px;">
        <h2 style="color:#60a5fa;margin-top:0;">🐛 Nuovo Bug Report — FleetCC</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="color:#7a9bbf;padding:6px 0;width:140px;font-size:13px;">Titolo</td><td style="color:#e2eaf5;font-weight:600;font-size:14px;">${bug.title}</td></tr>
          <tr><td style="color:#7a9bbf;padding:6px 0;font-size:13px;">Categoria</td><td style="color:#fb923c;font-size:13px;">${catLabel}</td></tr>
          <tr><td style="color:#7a9bbf;padding:6px 0;font-size:13px;">Segnalato da</td><td style="color:#e2eaf5;font-size:13px;">${reporterName} &lt;${reporterEmail}&gt;</td></tr>
          <tr><td style="color:#7a9bbf;padding:6px 0;font-size:13px;">Data</td><td style="color:#e2eaf5;font-size:13px;">${new Date(bug.createdAt).toLocaleString("it-IT")}</td></tr>
        </table>
        <div style="background:#1a2332;border-radius:8px;padding:16px;margin-bottom:16px;">
          <div style="color:#7a9bbf;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600;">Descrizione</div>
          <div style="color:#e2eaf5;font-size:13px;line-height:1.6;white-space:pre-wrap;">${bug.description}</div>
        </div>
        ${bug.steps ? `
        <div style="background:#1a2332;border-radius:8px;padding:16px;">
          <div style="color:#7a9bbf;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600;">Passi per riprodurre</div>
          <div style="color:#e2eaf5;font-size:13px;line-height:1.6;white-space:pre-wrap;">${bug.steps}</div>
        </div>` : ""}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #263d5a;font-size:11px;color:#3d5a7a;">
          Accedi al pannello SuperAdmin di FleetCC per gestire questo report.
        </div>
      </div>
    `,
  });
  console.log(`[Mailer] Bug report email sent to ${to}`);
}

module.exports = { sendBugReportEmail };
