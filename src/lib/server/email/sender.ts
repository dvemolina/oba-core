import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

export interface StaffInviteOptions {
	to: string;
	name: string;
	role: string;
	tempPassword: string;
}

const ROLE_LABELS: Record<string, string> = {
	admin: 'Administrator',
	owner: 'Owner',
	manager: 'Manager',
	instructor: 'Instructor'
};

export async function sendStaffInvite(opts: StaffInviteOptions): Promise<void> {
	if (!env.SMTP_USER || !env.SMTP_PASS) {
		console.warn('[EMAIL] SMTP not configured — skipping invite for', opts.to);
		return;
	}

	const transport = nodemailer.createTransport({
		host: 'smtp.zoho.com',
		port: 587,
		secure: false,
		auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
	});

	const roleLabel = ROLE_LABELS[opts.role] ?? opts.role;
	const loginUrl = `${env.ORIGIN}/auth/login`;

	const html = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a2e;">
  <h2 style="color:#0a3d62;margin-bottom:8px;">Welcome to OBA Core</h2>
  <p>Hi ${opts.name},</p>
  <p>You have been added as a <strong>${roleLabel}</strong> at Tipiti Surf School.</p>
  <table style="background:#f5f5f5;border-radius:8px;padding:16px;width:100%;margin:24px 0;">
    <tr><td style="padding:4px 8px;font-weight:600;">Email</td><td style="padding:4px 8px;">${opts.to}</td></tr>
    <tr><td style="padding:4px 8px;font-weight:600;">Password</td><td style="padding:4px 8px;font-family:monospace;">${opts.tempPassword}</td></tr>
  </table>
  <a href="${loginUrl}" style="display:inline-block;background:#0a3d62;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">Log in</a>
  <p style="margin-top:24px;font-size:13px;color:#666;">Please change your password in Settings after your first login.</p>
</body>
</html>`;

	await transport.sendMail({
		from: `OBA Core <${env.SMTP_USER}>`,
		to: opts.to,
		subject: 'You have been added to OBA Core',
		html
	});

	console.log('[EMAIL] Invite sent to', opts.to);
}

export function generateTempPassword(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
	return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
