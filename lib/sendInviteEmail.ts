import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInviteEmail({ to, inviteLink, orgName, invitedBy }: {
  to: string;
  inviteLink: string;
  orgName: string;
  invitedBy: string;
}) {
  return resend.emails.send({
    from: 'noreply@yourdomain.com',
    to,
    subject: `You are invited to join ${orgName}!`,
    html: `
      <h2>Welcome to ${orgName}!</h2>
      <p>Hello,</p>
      <p>${invitedBy} has invited you to join <b>${orgName}</b> on WalletOCR.</p>
      <p><a href="${inviteLink}">Click here to accept your invitation</a></p>
      <p>If you did not expect this, you can ignore this email.</p>
      <br/>
      <small>This invitation was sent via WalletOCR Admin.</small>
    `
  });
}
