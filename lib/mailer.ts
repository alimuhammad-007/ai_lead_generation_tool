import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export async function sendLeadNotification(lead: {
  name: string;
  email: string;
  company: string;
  score: number;
  status: string;
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM!,
    to: process.env.SMTP_USER!,
    subject: `[${lead.status.toUpperCase()}] New lead: ${lead.name} @ ${lead.company}`,
    html: `
      <h2>New Lead Captured</h2>
      <table>
        <tr><td><b>Name</b></td><td>${lead.name}</td></tr>
        <tr><td><b>Email</b></td><td>${lead.email}</td></tr>
        <tr><td><b>Company</b></td><td>${lead.company}</td></tr>
        <tr><td><b>Score</b></td><td>${lead.score}/100</td></tr>
        <tr><td><b>Status</b></td><td>${lead.status}</td></tr>
      </table>
    `,
  });
}
