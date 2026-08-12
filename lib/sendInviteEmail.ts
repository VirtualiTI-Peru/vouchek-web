import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function resetPasswordHtml({ changePasswordLink, firstName }: {
  changePasswordLink: string;
  firstName: string;
  orgName: string;
}) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <tr><td style="background:#1e40af;padding:28px 32px">
          <h1 style="margin:0;color:#fff;font-size:24px">VouChek</h1>
          <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px">Digitalizacion de comprobantes de pago</p>
        </td></tr>
        <tr><td style="background:#fff;padding:36px 32px">
          <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">Cambiar contrasena</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 28px">
            Hola ${firstName}, puedes cambiar tu contraseña haciendo clic en el boton a continuacion.
          </p>
          <a href="${changePasswordLink}" style="display:inline-block;background:#0f766e;color:#fff;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:8px;text-decoration:none;margin-bottom:10px">
            Cambiar contraseña
          </a>
          <p style="color:#94a3b8;font-size:12px;margin:28px 0 0;line-height:1.5">
            Este enlace expira en 24 horas.<br>
            Si no solicitaste cambiar tu contraseña, puedes ignorar este correo.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#64748b;font-size:12px">© ${year} VirtualiTI - VouChek</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail({ to, changePasswordLink, firstName, orgName }: {
  to: string;
  changePasswordLink: string;
  firstName: string;
  orgName: string;
}) {
  return resend.emails.send({
    from: process.env.RESEND_SENDER_EMAIL!,
    to,
    subject: `Cambiar contraseña en VouChek - ${orgName}`,
    html: resetPasswordHtml({ changePasswordLink, firstName, orgName }),
  });
}
