import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { ArrowRight, RefreshCw, Github, Globe, Shield, Code, Eye, Users, Database, Scale } from 'lucide-react';
import { StatusSummary } from '@/components/StatusSummary';
import { getMonitorCollection } from '@/lib/mongodb';
import { formatRelativeTime } from '@/lib/utils';

async function getSummary() {
  try {
    const { checks } = await getMonitorCollection();
    const latestCheck = await checks.findOne({}, { sort: { checkedAt: -1 } });

    if (!latestCheck) {
      return null;
    }

    return {
      checkedAt: latestCheck.checkedAt,
      checkDuration: latestCheck.checkDuration,
      summary: latestCheck.summary,
    };
  } catch (error) {
    console.error('Failed to fetch summary:', error);
    return null;
  }
}

type Props = {
  params: Promise<{ locale: string }>;
};

export const revalidate = 60; // Revalidate every 60 seconds

export default async function OverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('overview');

  const data = await getSummary();

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-slate-900 dark:bg-slate-950">
        <div className="container mx-auto px-4 py-10 sm:py-12">
          <div className="flex flex-col items-center text-center sm:flex-row sm:text-left sm:justify-between sm:items-center gap-6">
            {/* Title & Subtitle */}
            <div>
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                {t('title')}
              </h1>
              <p className="text-slate-400 sm:text-lg">
                {t('subtitle')}
              </p>
              {/* Badges */}
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  <Globe className="h-3 w-3" />
                  {locale === 'es' ? 'Tiempo Real' : 'Real-time'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  <Code className="h-3 w-3" />
                  Open Source
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  <Shield className="h-3 w-3" />
                  {locale === 'es' ? 'Datos Públicos' : 'Public Data'}
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href={`/${locale}/domains`}
                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
              >
                {t('viewAll')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/giuseppegangi/venezuela-digital-observatory"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-8">
        {data ? (
          <>
            {/* Last Update */}
            <div className="mb-4 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <RefreshCw className="h-4 w-4" />
              <span>
                {t('lastUpdate')}: {formatRelativeTime(data.checkedAt, locale)}
              </span>
            </div>

            {/* Stats Summary */}
            <StatusSummary
              summary={{
                ...data.summary,
                checkDuration: data.checkDuration,
              }}
              className="mb-8"
            />
          </>
        ) : (
          <div className="card text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">
              {locale === 'es'
                ? 'No se pueden cargar los datos. Por favor, intenta más tarde.'
                : 'Unable to load data. Please try again later.'}
            </p>
          </div>
        )}
      </section>

      {/* About Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {/* Section Header */}
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">
              {locale === 'es' ? '¿Por qué este proyecto?' : 'Why this project?'}
            </h2>
            <p className="mx-auto max-w-2xl text-slate-500 dark:text-slate-400">
              {locale === 'es'
                ? 'Transparencia digital para una ciudadanía informada'
                : 'Digital transparency for an informed citizenry'}
            </p>
          </div>

          {/* Mission Statement */}
          <div className="card mb-8 border-l-4 border-l-[#00247D] bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
            <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300">
              {locale === 'es'
                ? 'En tiempos donde el acceso a la información pública es cada vez más difícil, creemos que monitorear la infraestructura digital del gobierno es un acto de transparencia ciudadana. Los sitios web gubernamentales son la puerta de entrada a servicios públicos, trámites y datos oficiales. Cuando estos sitios fallan o están inaccesibles, los ciudadanos pierden acceso a derechos fundamentales.'
                : 'In times where access to public information is increasingly difficult, we believe that monitoring the government\'s digital infrastructure is an act of civic transparency. Government websites are the gateway to public services, procedures, and official data. When these sites fail or become inaccessible, citizens lose access to fundamental rights.'}
            </p>
          </div>

          {/* Features Grid */}
          <div className="mb-8 grid gap-6 sm:grid-cols-2">
            <div className="card flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Eye className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold">
                  {locale === 'es' ? 'Monitoreo continuo' : 'Continuous monitoring'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {locale === 'es'
                    ? 'Verificamos cada dominio periódicamente, registrando disponibilidad, tiempos de respuesta y estado de certificados SSL.'
                    : 'We check each domain periodically, recording availability, response times, and SSL certificate status.'}
                </p>
              </div>
            </div>

            <div className="card flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Database className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold">
                  {locale === 'es' ? 'Datos abiertos' : 'Open data'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {locale === 'es'
                    ? 'Toda la información recopilada es de dominio público (CC0). Puedes descargar, analizar y reutilizar los datos libremente.'
                    : 'All collected information is public domain (CC0). You can download, analyze, and reuse the data freely.'}
                </p>
              </div>
            </div>

            <div className="card flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold">
                  {locale === 'es' ? 'Para todos' : 'For everyone'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {locale === 'es'
                    ? 'Periodistas, investigadores, organizaciones de sociedad civil y ciudadanos pueden usar estos datos para análisis e informes.'
                    : 'Journalists, researchers, civil society organizations, and citizens can use this data for analysis and reporting.'}
                </p>
              </div>
            </div>

            <div className="card flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Scale className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold">
                  {locale === 'es' ? 'Independiente' : 'Independent'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {locale === 'es'
                    ? 'Este proyecto no está afiliado a ningún partido político ni entidad gubernamental. Es una iniciativa ciudadana independiente.'
                    : 'This project is not affiliated with any political party or government entity. It is an independent civic initiative.'}
                </p>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="card bg-slate-50 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold">
              {locale === 'es' ? '¿Qué monitoreamos?' : 'What do we monitor?'}
            </h3>
            <ul className="grid gap-2 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {locale === 'es' ? 'Disponibilidad (online/offline)' : 'Availability (online/offline)'}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {locale === 'es' ? 'Códigos de respuesta HTTP' : 'HTTP response codes'}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {locale === 'es' ? 'Tiempos de respuesta' : 'Response times'}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {locale === 'es' ? 'Certificados SSL y su validez' : 'SSL certificates and validity'}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {locale === 'es' ? 'Cadenas de redirección' : 'Redirect chains'}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {locale === 'es' ? 'Cabeceras de servidor' : 'Server headers'}
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
