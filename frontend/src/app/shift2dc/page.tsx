'use client';

import {
  Building,
  Euro,
  ExternalLink,
  Factory,
  Globe,
  MapPin,
  Ship,
  Users,
  Zap,
} from 'lucide-react';
import ElectricalDiagram from '../../components/GridDocumentation/ElectricDiagram';
import { useTranslation } from '../../hooks/useTranslation';

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
      <div className="mb-8 mt-3">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
          {t.shift2dcProjectTitle}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {t.shift2dcProjectSubtitle}
        </p>
      </div>

      <div className="space-y-12">
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
          <p className="mx-auto max-w-3xl text-center text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            {t.shift2dcIntro}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center">
              <div className="rounded-lg bg-green-500 p-3 dark:bg-green-600">
                <Euro className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t.shift2dcProjectFunding}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">€11M+</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center">
              <div className="rounded-lg bg-blue-500 p-3 dark:bg-blue-600">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t.shift2dcPartners}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">33</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center">
              <div className="rounded-lg bg-purple-500 p-3 dark:bg-purple-600">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t.shift2dcCountries}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">12</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
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
                  <li key={feature} className="flex items-start">
                    <span className="mr-3 mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
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
                  demo.highlight ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                }`}
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${demo.color}`}>
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
                <p className="text-sm text-gray-600 dark:text-gray-400">{demo.description}</p>

                {demo.highlight && (
                  <div className="mt-3 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {t.shift2dcCurrentDemonstrator}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
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
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
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
                  <div key={index} className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
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
        </div>

        <ElectricalDiagram />

        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-6 flex items-center">
              <Users className="mr-3 h-6 w-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t.shift2dcLeadershipPartners}
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                  {t.shift2dcDemoLeadership}
                </h3>
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                  <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                    <strong>{t.shift2dcDemoLeader}:</strong> ITI (Instituto Tecnológico de Informática)
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>{t.shift2dcCoordination}:</strong> INESC-ID (Portuguese Research & Innovation Institute)
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                  {t.shift2dcKeyParticipants}
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {['APRAM', 'INESC ID', 'EDP NEW', 'FINCANTIERI', 'CIRCE', 'EDF'].map(partner => (
                    <div key={partner} className="rounded bg-gray-50 px-3 py-2 text-center dark:bg-gray-700">
                      <span className="font-medium text-gray-600 dark:text-gray-400">{partner}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
              {t.shift2dcImplementationPhases}
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <h3 className="mb-2 text-lg font-semibold text-green-800 dark:text-green-400">
                  {t.shift2dcPhase1Title}
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {t.shift2dcPhase1Description}
                </p>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <h3 className="mb-2 text-lg font-semibold text-blue-800 dark:text-blue-400">
                  {t.shift2dcPhase2Title}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t.shift2dcPhase2Description}
                </p>
              </div>

              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                <h3 className="mb-2 text-lg font-semibold text-purple-800 dark:text-purple-400">
                  {t.shift2dcValidationTitle}
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {t.shift2dcValidationDescription}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-md dark:border-gray-700 dark:bg-gray-800">
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
        </div>
      </div>
    </div>
  );
}