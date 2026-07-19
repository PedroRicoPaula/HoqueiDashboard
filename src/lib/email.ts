function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

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

  const sender = from ?? (process.env.EMAIL_FROM ?? `HoqueiManager <onboarding@resend.dev>`)

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

function emailShell(opts: { title: string; badgeIcon: string; badgeColor: string; bodyHtml: string }): string {
  return `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(opts.title)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;margin:0;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto">
    <div style="text-align:center;margin-bottom:24px">
      <span style="color:#6b7280;font-size:13px;font-weight:600;letter-spacing:0.5px">HOQUEIMANAGER</span>
    </div>
    <div style="background:#fff;border-radius:16px;padding:40px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
      <div style="text-align:center;margin-bottom:28px">
        <div style="width:56px;height:56px;background:${opts.badgeColor};border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:24px;line-height:56px">
          ${opts.badgeIcon}
        </div>
        <h1 style="margin:0;font-size:21px;color:#111827;font-weight:700">${escHtml(opts.title)}</h1>
      </div>
      ${opts.bodyHtml}
    </div>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center">
      HoqueiManager · <a href="https://hoqueimanager.com" style="color:#9ca3af">hoqueimanager.com</a>
    </p>
  </div>
</body>
</html>`
}

export function resetPasswordEmailHtml(name: string, resetUrl: string): string {
  const body = `
    <p style="color:#374151;margin:0 0 20px;font-size:15px;line-height:1.6">Olá <strong>${escHtml(name)}</strong>,</p>
    <p style="color:#374151;margin:0 0 28px;font-size:15px;line-height:1.6">Recebemos um pedido para redefinir a palavra-passe da sua conta. Clique no botão abaixo para escolher uma nova.</p>
    <a href="${escHtml(resetUrl)}" style="display:block;background:#16a34a;color:#fff;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px">
      Redefinir Palavra-passe →
    </a>
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin-bottom:4px">
      <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.5">
        ⏱ Este link expira em <strong>1 hora</strong>. Se não pediu esta redefinição, pode ignorar este email — a sua palavra-passe actual mantém-se válida.
      </p>
    </div>`
  return emailShell({ title: 'Redefinir Palavra-passe', badgeIcon: '🔑', badgeColor: '#16a34a', bodyHtml: body })
}

export function paymentLinkEmailHtml(clubName: string, checkoutUrl: string, planLabel: string, priceText: string): string {
  const body = `
    <p style="color:#374151;margin:0 0 20px;font-size:15px;line-height:1.6">Olá <strong>${escHtml(clubName)}</strong>,</p>
    <p style="color:#374151;margin:0 0 20px;font-size:15px;line-height:1.6">Para continuar a usar o HoqueiManager, falta activar o pagamento da vossa subscrição. Escolhemos o seguinte plano para vocês:</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
      <span style="color:#166534;font-weight:600;font-size:15px">${escHtml(planLabel)}</span>
      <span style="color:#166534;font-weight:700;font-size:15px">${escHtml(priceText)}</span>
    </div>
    <a href="${escHtml(checkoutUrl)}" style="display:block;background:#16a34a;color:#fff;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:24px">
      Ativar Pagamento →
    </a>
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px">
      <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.5">
        🔒 Pagamento processado de forma segura pela Stripe. Depois de confirmado, é só entrar com o email e a palavra-passe que já usa.
      </p>
    </div>`
  return emailShell({ title: 'Ativar Pagamento', badgeIcon: '💳', badgeColor: '#16a34a', bodyHtml: body })
}

export function trialWelcomeEmailHtml(clubName: string, monthlyUrl: string, yearlyUrl: string): string {
  const body = `
    <p style="color:#374151;margin:0 0 20px;font-size:15px;line-height:1.6">Olá <strong>${escHtml(clubName)}</strong>,</p>
    <p style="color:#374151;margin:0 0 20px;font-size:15px;line-height:1.6">Bem-vindo ao HoqueiManager! Obrigado por experimentares a plataforma.</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 18px;margin-bottom:24px">
      <p style="color:#1e40af;font-weight:600;font-size:15px;margin:0">🎉 Tens 14 dias de acesso completo, sem cartão de crédito.</p>
    </div>
    <p style="color:#374151;margin:0 0 16px;font-size:15px;line-height:1.6">Se quiseres activar já um plano (a qualquer momento — inclusive depois, nas Definições do clube):</p>
    <a href="${escHtml(monthlyUrl)}" style="display:block;background:#16a34a;color:#fff;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:10px">
      Mensal — €59/mês →
    </a>
    <a href="${escHtml(yearlyUrl)}" style="display:block;background:#fff;color:#16a34a;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;border:2px solid #16a34a;margin-bottom:24px">
      Anual — €590/ano (2 meses grátis) →
    </a>
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px">
      <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.5">
        Obrigado por escolheres o HoqueiManager para o teu clube. Qualquer dúvida, é só responder a este email.
      </p>
    </div>`
  return emailShell({ title: 'Bem-vindo ao HoqueiManager', badgeIcon: '👋', badgeColor: '#2563eb', bodyHtml: body })
}

export function paidWelcomeEmailHtml(clubName: string, planLabel: string): string {
  const body = `
    <p style="color:#374151;margin:0 0 20px;font-size:15px;line-height:1.6">Olá <strong>${escHtml(clubName)}</strong>,</p>
    <p style="color:#374151;margin:0 0 20px;font-size:15px;line-height:1.6">Bem-vindo ao HoqueiManager! O teu pagamento foi confirmado com sucesso.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 18px;margin-bottom:24px;text-align:center">
      <span style="color:#166534;font-weight:600;font-size:15px">Plano activo: ${escHtml(planLabel)}</span>
    </div>
    <p style="color:#374151;margin:0 0 24px;font-size:15px;line-height:1.6">Obrigado por confiares no HoqueiManager para o dia-a-dia do teu clube. Já podes entrar e começar a usar tudo.</p>
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px">
      <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.5">
        Vais receber também um recibo de pagamento em separado, enviado pela Stripe. Qualquer dúvida, é só responder a este email.
      </p>
    </div>`
  return emailShell({ title: 'Pagamento confirmado', badgeIcon: '🎉', badgeColor: '#16a34a', bodyHtml: body })
}
