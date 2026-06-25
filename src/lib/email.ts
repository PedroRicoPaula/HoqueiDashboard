interface SendEmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — email skipped')
    return false
  }

  const sender = from ?? `HoqueiManager <noreply@hoqueimanager.com>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: sender, to, subject, html }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error('[email] Resend error:', res.status, body)
      return false
    }
    return true
  } catch (err) {
    console.error('[email] fetch error:', err)
    return false
  }
}

export function welcomeEmailHtml(clubName: string, email: string, setPasswordUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><title>Bem-vindo ao HoqueiManager</title></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
    <div style="text-align:center;margin-bottom:32px">
      <div style="width:56px;height:56px;background:#16a34a;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
        <span style="color:#fff;font-weight:700;font-size:18px">HM</span>
      </div>
      <h1 style="margin:0;font-size:22px;color:#111827">Bem-vindo ao HoqueiManager!</h1>
    </div>

    <p style="color:#374151;margin-bottom:8px">O clube <strong>${clubName}</strong> foi registado com sucesso.</p>
    <p style="color:#374151;margin-bottom:24px">O seu email de acesso é <strong>${email}</strong>. Clique no botão abaixo para definir a sua palavra-passe e entrar no dashboard.</p>

    <a href="${setPasswordUrl}" style="display:block;background:#16a34a;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px">
      Definir Palavra-passe →
    </a>

    <p style="color:#9ca3af;font-size:13px;margin-bottom:0">Este link expira em <strong>24 horas</strong>.</p>

    <p style="color:#9ca3af;font-size:12px;margin-top:32px;text-align:center">
      HoqueiManager · Gestão para clubes de hóquei em patins<br>
      <a href="https://hoqueimanager.com" style="color:#9ca3af">hoqueimanager.com</a>
    </p>
  </div>
</body>
</html>`
}

export function resetPasswordEmailHtml(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><title>Redefinir Palavra-passe</title></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
    <div style="text-align:center;margin-bottom:32px">
      <div style="width:56px;height:56px;background:#16a34a;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
        <span style="color:#fff;font-weight:700;font-size:18px">HM</span>
      </div>
      <h1 style="margin:0;font-size:22px;color:#111827">Redefinir Palavra-passe</h1>
    </div>

    <p style="color:#374151;margin-bottom:24px">Olá <strong>${name}</strong>,</p>
    <p style="color:#374151;margin-bottom:24px">Recebemos um pedido para redefinir a palavra-passe da sua conta. Clique no botão abaixo para continuar.</p>

    <a href="${resetUrl}" style="display:block;background:#16a34a;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px">
      Redefinir Palavra-passe →
    </a>

    <p style="color:#9ca3af;font-size:13px;margin-bottom:0">
      Este link expira em <strong>1 hora</strong>. Se não solicitou a redefinição, ignore este email.
    </p>

    <p style="color:#9ca3af;font-size:12px;margin-top:32px;text-align:center">
      HoqueiManager · <a href="https://hoqueimanager.com" style="color:#9ca3af">hoqueimanager.com</a>
    </p>
  </div>
</body>
</html>`
}
