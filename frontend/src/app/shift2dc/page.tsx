
'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Building,
  Euro,
  ExternalLink,
  Factory,
  Globe,
  MapPin,
  Network,
  Ship,
  Users,
  Zap,
} from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';

const partners = [
  { name: 'APRAM', src: '/partners/apram.svg' },
  { name: 'INESC-ID', src: '/partners/inesc-id.svg' },
  { name: 'EDP', src: '/partners/edp.svg' },
  { name: 'EDF', src: '/partners/edf.svg' },
  { name: 'Fincantieri', src: '/partners/fincantieri.svg' },
  { name: 'CIRCE', src: '/partners/circe.svg' },
];

export default function SHIFT2DCPage() {
  const t = useTranslation();

  const demonstrators = [
    {
      icon: Building,
      title: t.shift2dcDataCenters,
      description: t.shift2dcDataCentersDescription,
      color: 'bg-gray-500 dark:bg-gray-600',
    },
    {
      icon: Ship,
      title: t.shift2dcPorts,
      description: t.shift2dcPortsDescription,
      highlight: true,
      color: 'bg-blue-500 dark:bg-blue-600',
    },
    {
      icon: Factory,
      title: t.shift2dcIndustry,
      description: t.shift2dcIndustryDescription,
      color: 'bg-orange-500 dark:bg-orange-600',
    },
    {
      icon: Globe,
      title: t.shift2dcBuildings,
      description: t.shift2dcBuildingsDescription,
      color: 'bg-green-500 dark:bg-green-600',
    },
  ];

  const useCases = [
    { title: t.shift2dcUc1Title, description: t.shift2dcUc1Description },
    { title: t.shift2dcUc2Title, description: t.shift2dcUc2Description },
    { title: t.shift2dcUc3Title, description: t.shift2dcUc3Description },
    { title: t.shift2dcUc4Title, description: t.shift2dcUc4Description },
  ];

  return (
    <div className="p-6">
      {/* Page Header */}
      <header className="mb-8 mt-3">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
          {t.shift2dcProjectTitle}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {t.shift2dcProjectSubtitle}
        </p>
      </header>

      <div className="space-y-12">
        {/* Project Introduction */}
        <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <p className="mx-auto max-w-3xl text-center text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            {t.shift2dcIntro}
          </p>
        </section>

        {/* Project Indicators */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center">
              <div className="rounded-lg bg-green-500 p-3 dark:bg-green-600">
                <Euro className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                  {t.shift2dcProjectFunding}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  €11M+
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center">
              <div className="rounded-lg bg-blue-500 p-3 dark:bg-blue-600">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                  {t.shift2dcPartners}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  33
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center">
              <div className="rounded-lg bg-purple-500 p-3 dark:bg-purple-600">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                  {t.shift2dcCountries}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  12
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Project Overview */}
        <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-6 flex items-center">
            <Zap className="mr-3 h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.shift2dcProjectOverview}
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                {t.shift2dcMissionVision}
              </h3>
              <p className="mb-6 leading-relaxed text-gray-600 dark:text-gray-400">
                {t.shift2dcMissionParagraph1}
              </p>
              <p className="leading-relaxed text-gray-600 dark:text-gray-400">
                {t.shift2dcMissionParagraph2}
              </p>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                {t.shift2dcKeyFeatures}
              </h3>
              <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                {[
                  t.shift2dcFeature1,
                  t.shift2dcFeature2,
                  t.shift2dcFeature3,
                  t.shift2dcFeature4,
                ].map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-3 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white">
                      {index + 1}
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* European Demonstrators */}
        <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            {t.shift2dcFourDemonstrators}
          </h2>

          <p className="mb-8 text-gray-600 dark:text-gray-400">
            {t.shift2dcDemonstratorsDescription}
          </p>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {demonstrators.map((demo, index) => (
              <div
                key={index}
                className={`rounded-lg bg-gray-50 p-6 transition-all hover:shadow-md dark:bg-gray-700 ${
                  demo.highlight
                    ? 'ring-2 ring-blue-500 dark:ring-blue-400'
                    : ''
                }`}
              >
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${demo.color}`}
                >
                  <demo.icon className="h-6 w-6 text-white" />
                </div>

                <h3
                  className={`mb-2 text-lg font-semibold ${
                    demo.highlight
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {demo.title}
                </h3>

                <p className="text-base text-gray-600 dark:text-gray-400">
                  {demo.description}
                </p>

                {demo.highlight && (
                  <div className="mt-3 rounded bg-blue-100 px-2 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {t.shift2dcCurrentDemonstrator}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Port Demonstrator */}
        <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-6 flex items-center">
            <div className="mr-4 rounded-lg bg-blue-500 p-3 dark:bg-blue-600">
              <Ship className="h-6 w-6 text-white" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t.shift2dcPortDemonstrator}
              </h2>

              <div className="mt-1 flex items-center text-gray-600 dark:text-gray-400">
                <MapPin className="mr-1 h-4 w-4" />
                <span className="text-sm">{t.shift2dcLocation}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                {t.shift2dcDigitalTwinApplication}
              </h3>

              <p className="mb-6 leading-relaxed text-gray-600 dark:text-gray-400">
                {t.shift2dcDigitalTwinDescription}
              </p>

              <div className="mb-6 rounded-lg bg-gray-50 p-6 dark:bg-gray-700">
                <h4 className="mb-3 font-semibold text-gray-900 dark:text-white">
                  {t.shift2dcPortInfrastructure}
                </h4>

                <ul className="space-y-2 text-base text-gray-600 dark:text-gray-400">
                  <li>• {t.shift2dcCruiseTerminals}</li>
                  <li>• {t.shift2dcFerryTerminal}</li>
                  <li>• {t.shift2dcWarshipTerminal}</li>
                  <li>• {t.shift2dcYachtTerminal}</li>
                </ul>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                <h4 className="mb-2 font-semibold text-amber-800 dark:text-amber-200">
                  {t.shift2dcKeyChallenge}
                </h4>

                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t.shift2dcKeyChallengeDescription}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                {t.shift2dcFourUseCases}
              </h3>

              <div className="space-y-4">
                {useCases.map((useCase, index) => (
                  <div
                    key={index}
                    className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700"
                  >
                    <h4 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                      UC{index + 1}: {useCase.title}
                    </h4>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {useCase.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grid Architecture Link */}
          <div className="mt-8 flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-900/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Network className="mt-1 h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" />

              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  {t.shift2dcGridArchitectureTitle}
                </h3>

                <p className="mt-1 max-w-2xl text-base text-gray-600 dark:text-gray-400">
                  {t.shift2dcGridArchitectureDescription}
                </p>
              </div>
            </div>

            <Link
              href="/grid-architecture"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {t.shift2dcGridArchitectureLink}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Leadership & Partners */}
        <section className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-6 flex items-center">
            <Users className="mr-3 h-6 w-6 text-blue-600 dark:text-blue-400" />

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t.shift2dcLeadershipPartners}
            </h2>
          </div>

          <div className="space-y-8">
            {/* Demonstrator Leadership */}
            <div>
              <h3 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
                {t.shift2dcDemoLeadership}
              </h3>

              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-700">
                <p className="mb-2 text-lg text-gray-600 dark:text-gray-400">
                  <strong>{t.shift2dcDemoLeader}:</strong>{' '}
                  ITI (Instituto Tecnológico de Informática)
                </p>

                <p className="text-lg text-gray-600 dark:text-gray-400">
                  <strong>{t.shift2dcCoordination}:</strong>{' '}
                  INESC-ID (Portuguese Research & Innovation Institute)
                </p>
              </div>
            </div>

            
            {/* Partner Logos */}
            <div>
              <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                {t.shift2dcKeyParticipants}
              </h3>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                {partners.map((partner) => (
                  <div
                    key={partner.name}
                    className="flex min-h-[140px] items-center justify-center rounded-lg border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-blue-300 hover:shadow-md"
                  >
                    <div className="relative h-24 w-full">
                      <Image
                        src={partner.src}
                        alt={partner.name}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 16vw"
                        className="object-contain"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Sustainable Future */}
        <section className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-md dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            {t.shift2dcSustainableFuture}
          </h2>

          <p className="mx-auto mb-6 max-w-2xl text-gray-600 dark:text-gray-400">
            {t.shift2dcSustainableFutureDescription}
          </p>

          <a
            href="https://shift2dc.eu"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {t.shift2dcVisitWebsite}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </section>
      </div>
    </div>
  );
}
