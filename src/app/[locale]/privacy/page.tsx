import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-4 h-16 flex items-center">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-4">
          <Link href={`/${locale}`} className="text-xl font-bold text-green-700">HoqueiManager</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <Link href={`/${locale}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-green-600 mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-400 mb-10">Última atualização: 19 de junho de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Responsável pelo Tratamento</h2>
            <p>
              O HoqueiManager é uma plataforma SaaS operada sob responsabilidade exclusiva de cada clube utilizador.
              O operador técnico é a entidade que disponibiliza a plataforma em <strong>hoqueimanager.com</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Dados Recolhidos</h2>
            <p>Recolhemos apenas os dados necessários para o funcionamento da plataforma:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Dados de identificação do clube (nome, email, país)</li>
              <li>Dados de utilizadores administrativos (nome, email)</li>
              <li>Dados de atletas e sócios inseridos pelo clube</li>
              <li>Dados de faturação processados pela Stripe (nunca armazenamos dados de cartão)</li>
              <li>Logs de auditoria para fins de segurança</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Finalidade do Tratamento</h2>
            <p>Os dados são tratados exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Prestação do serviço contratado</li>
              <li>Faturação e gestão da subscrição</li>
              <li>Segurança e prevenção de fraude</li>
              <li>Comunicações de serviço (nunca marketing sem consentimento)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Isolamento de Dados — Multi-Tenant</h2>
            <p>
              Cada clube é um tenant isolado. Os dados de um clube <strong>nunca são acessíveis</strong> por outros clubes.
              O isolamento é garantido a nível de base de dados através de um identificador único por clube
              aplicado em todas as consultas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Retenção de Dados</h2>
            <p>
              Os dados são retidos enquanto a subscrição estiver ativa. Após cancelamento, os dados são mantidos
              por 30 dias para recuperação eventual e depois eliminados permanentemente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Subprocessadores</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Neon / PostgreSQL</strong> — Base de dados (EU)</li>
              <li><strong>Vercel</strong> — Infraestrutura de hosting</li>
              <li><strong>Stripe</strong> — Processamento de pagamentos</li>
              <li><strong>Cloudflare R2</strong> — Armazenamento de ficheiros</li>
              <li><strong>Resend</strong> — Email transacional</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Direitos do Titular dos Dados (RGPD)</h2>
            <p>Tem direito a:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Aceder, corrigir ou apagar os seus dados pessoais</li>
              <li>Portabilidade dos dados (exportação CSV disponível)</li>
              <li>Oposição ao tratamento</li>
              <li>Apresentar queixa à CNPD (Portugal) ou à autoridade de supervisão do seu país</li>
            </ul>
            <p className="mt-3">Para exercer estes direitos, contacte: <a href="mailto:pedroricopaula@gmail.com" className="text-green-700 hover:underline">pedroricopaula@gmail.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Cookies</h2>
            <p>
              Utilizamos um cookie de sessão técnico (<code>hm_token</code>) estritamente necessário para
              a autenticação. Nas páginas públicas (fora do dashboard), usamos também o Google Analytics para
              perceber como o site é utilizado — que define cookies próprios de medição de audiência. Não
              utilizamos cookies de publicidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Contacto</h2>
            <p>
              Para questões de privacidade ou gerais: <a href="mailto:pedroricopaula@gmail.com" className="text-green-700 hover:underline">pedroricopaula@gmail.com</a>
            </p>
          </section>

        </div>
      </main>

      <footer className="py-8 px-4 bg-gray-900 text-gray-400 text-sm text-center space-y-1">
        <p>© {new Date().getFullYear()} HoqueiManager. Todos os direitos reservados.</p>
        <p>Feito por <a href="https://pedropaula.com/" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">Pedro Paula</a></p>
      </footer>
    </div>
  )
}
