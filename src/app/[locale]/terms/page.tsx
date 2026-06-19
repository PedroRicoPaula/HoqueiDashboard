import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 px-4 h-16 flex items-center">
        <div className="max-w-3xl mx-auto w-full">
          <Link href={`/${locale}`} className="text-xl font-bold text-green-700">HoqueiManager</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <Link href={`/${locale}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-green-600 mb-8">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Termos de Utilização</h1>
        <p className="text-sm text-gray-400 mb-10">Última atualização: 19 de junho de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao registar um clube e utilizar o HoqueiManager, o utilizador aceita integralmente os presentes
              Termos de Utilização. Se não concordar, não deve utilizar o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Descrição do Serviço</h2>
            <p>
              O HoqueiManager é uma plataforma SaaS de gestão para clubes de hóquei em patins, disponível mediante
              subscrição mensal ou anual. O serviço inclui todos os módulos descritos na página de preços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Conta e Responsabilidade</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>O administrador do clube é responsável por todas as atividades realizadas na conta</li>
              <li>As credenciais de acesso são confidenciais e não devem ser partilhadas</li>
              <li>O utilizador deve notificar imediatamente em caso de acesso não autorizado</li>
              <li>O HoqueiManager não se responsabiliza por dados inseridos incorretamente pelos utilizadores</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Pagamento e Faturação</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Os pagamentos são processados pela Stripe de forma segura</li>
              <li>A subscrição renova automaticamente no fim de cada período</li>
              <li>O cancelamento pode ser efetuado a qualquer momento; o acesso mantém-se até ao fim do período pago</li>
              <li>Não há reembolsos proporcionais por cancelamento antecipado, exceto durante os 14 dias de garantia</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Garantia de 14 Dias</h2>
            <p>
              Se não ficar satisfeito com o serviço nos primeiros 14 dias após a subscrição, poderá solicitar
              o reembolso total através de <strong>suporte@hoqueimanager.com</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Utilização Aceitável</h2>
            <p>É proibido utilizar o HoqueiManager para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Atividades ilegais ou fraudulentas</li>
              <li>Inserir dados de terceiros sem consentimento</li>
              <li>Tentar aceder a dados de outros clubes</li>
              <li>Utilizar o serviço de forma a prejudicar outros utilizadores ou a infraestrutura</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Disponibilidade do Serviço</h2>
            <p>
              O HoqueiManager esforça-se por manter uma disponibilidade de 99,9%. Manutenções programadas
              serão comunicadas com antecedência. Não nos responsabilizamos por interrupções causadas por
              terceiros (fornecedores de cloud, operadoras de internet, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Propriedade dos Dados</h2>
            <p>
              Os dados inseridos pelo clube pertencem exclusivamente ao clube. O HoqueiManager não utiliza
              esses dados para fins comerciais, publicidade ou partilha com terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Limitação de Responsabilidade</h2>
            <p>
              O HoqueiManager não se responsabiliza por perdas de dados causadas por ações do utilizador,
              danos indiretos ou lucros cessantes. A responsabilidade máxima está limitada ao valor pago
              nos últimos 3 meses de subscrição.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Alterações aos Termos</h2>
            <p>
              Reservamo-nos o direito de alterar estes termos com aviso prévio de 30 dias por email.
              A continuação da utilização do serviço após esse prazo constitui aceitação das alterações.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Lei Aplicável</h2>
            <p>
              Estes termos são regidos pela lei portuguesa. Qualquer litígio será submetido aos tribunais
              competentes em Portugal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contacto</h2>
            <p><strong>suporte@hoqueimanager.com</strong></p>
          </section>

        </div>
      </main>

      <footer className="py-8 px-4 bg-gray-900 text-gray-400 text-sm text-center">
        © {new Date().getFullYear()} HoqueiManager. Todos os direitos reservados.
      </footer>
    </div>
  )
}
