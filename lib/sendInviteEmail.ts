import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const ROLE_LABELS: Record<string, string> = {
  'org:transportista': 'Transportista',
  'org:verificador': 'Verificador',
  'org:sistema': 'Administrador del Sistema',
  'org:admin': 'Administrador',
};

function inviteHtml({ inviteLink, orgName, invitedBy, roleName }: {
  inviteLink: string; orgName: string; invitedBy: string; roleName: string;
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
          <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px">Digitalización de comprobantes de pago</p>
        </td></tr>
        <tr><td style="background:#fff;padding:36px 32px">
          <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">Has sido invitado!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px">
            <strong>${invitedBy}</strong> te ha invitado a unirte a <strong>${orgName}</strong>
            con el rol de <strong>${roleName}</strong>.
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 28px">
            Haz clic en el boton a continuacion para aceptar la invitacion y configurar tu cuenta.
          </p>
          <a href="${inviteLink}" style="display:inline-block;background:#1e40af;color:#fff;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:8px;text-decoration:none">
            Aceptar invitacion
          </a>
          <p style="color:#94a3b8;font-size:12px;margin:28px 0 0;line-height:1.5">
            Este enlace expira en 7 dias.<br>
            Si no esperabas esta invitacion, puedes ignorar este correo.
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

function welcomeHtml({ actionLink, actionLabel, actionMessage, footerMessage, orgName, firstName }: {
  actionLink: string;
  actionLabel: string;
  actionMessage: string;
  footerMessage: string;
  orgName: string;
  firstName: string;
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
          <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px">Bienvenido a VouChek, ${firstName}!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px">
            Tu cuenta ha sido creada en <strong>${orgName}</strong>.
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 28px">
            ${actionMessage}
          </p>
          <a href="${actionLink}" style="display:inline-block;background:#1e40af;color:#fff;font-size:15px;font-weight:bold;padding:14px 28px;border-radius:8px;text-decoration:none">
            ${actionLabel}
          </a>
          <p style="color:#94a3b8;font-size:12px;margin:28px 0 0;line-height:1.5">
            ${footerMessage}
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

export async function sendInviteEmail({ to, inviteLink, orgName, invitedBy, role }: {
  to: string;
  inviteLink: string;
  orgName: string;
  invitedBy: string;
  role: string;
}) {
  const roleName = ROLE_LABELS[role] ?? role;
  return resend.emails.send({
    from: process.env.RESEND_SENDER_EMAIL!,
    to,
    subject: `Invitacion a VouChek - ${orgName}`,
    html: inviteHtml({ inviteLink, orgName, invitedBy, roleName }),
  });
}

export async function sendWelcomeEmail({ to, setupLink, loginLink, orgName, firstName }: {
  to: string;
  setupLink?: string;
  loginLink?: string;
  orgName: string;
  firstName: string;
}) {
  const actionLink = setupLink ?? loginLink;

  if (!actionLink) {
    throw new Error('sendWelcomeEmail requires setupLink or loginLink');
  }

  const isSetupFlow = Boolean(setupLink);

  return resend.emails.send({
    from: process.env.RESEND_SENDER_EMAIL!,
    to,
    subject: `Bienvenido a VouChek - ${orgName}`,
    html: welcomeHtml({
      actionLink,
      actionLabel: isSetupFlow ? 'Configurar contrasena' : 'Iniciar sesion',
      actionMessage: isSetupFlow
        ? 'Haz clic en el boton a continuacion para configurar tu contrasena y activar tu acceso a la plataforma.'
        : 'Haz clic en el boton a continuacion para iniciar sesion y acceder a la plataforma.',
      footerMessage: isSetupFlow
        ? 'Este enlace expira en 24 horas. Despues de guardar tu contrasena, podras iniciar sesion en VouChek.'
        : 'Puedes usar este acceso para ingresar a VouChek.',
      orgName,
      firstName,
    }),
  });
}
