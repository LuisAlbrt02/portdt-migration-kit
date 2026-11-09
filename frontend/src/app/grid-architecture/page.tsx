
'use client';

import {
  Cable,
  CircuitBoard,
  Info,
  Network,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import ElectricalDiagram from '../../components/GridDocumentation/ElectricDiagram';
import { useTranslation } from '../../hooks/useTranslation';

const colorStyles: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
};

const borderStyles: Record<string, string> = {
  blue: 'border-l-blue-500',
  orange: 'border-l-orange-500',
  green: 'border-l-green-500',
  cyan: 'border-l-cyan-500',
};

export default function GridArchitecturePage() {
  const t = useTranslation();

  const gridSections = [
    {
      title: t.gridMainDistribution,
      description: t.gridMainDistributionDescription,
      icon: CircuitBoard,
      color: 'blue',
    },
    {
      title: t.gridNormalDistribution,
      description: t.gridNormalDistributionDescription,
      icon: Zap,
      color: 'orange',
    },
    {
      title: t.gridEmergencyDistribution,
      description: t.gridEmergencyDistributionDescription,
      icon: ShieldCheck,
      color: 'green',
    },
    {
      title: t.gridPhysicalDemonstrator,
      description: t.gridPhysicalDemonstratorDescription,
      icon: Cable,
      color: 'cyan',
    },
  ];

  const componentGroups = [
    {
      name: t.gridMainSwitchboard,
      identifier: 'QGBT (N+E)',
      description: t.gridMainSwitchboardDescription,
      color: 'blue',
    },
    {
      name: t.gridNormalDistribution,
      identifier: 'QGED (N)',
      description: t.gridNormalCircuitsDescription,
      color: 'orange',
    },
    {
      name: t.gridEmergencyDistribution,
      identifier: 'QGED (E)',
      description: t.gridEmergencyCircuitsDescription,
      color: 'green',
    },
    {
      name: t.gridPhysicalDemonstrator,
      identifier: 'Q.DEMONSTRADOR',
      description: t.gridDemonstratorCircuitsDescription,
      color: 'cyan',
    },
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Page header */}
      <header className="mt-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                <Network className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>

              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {t.gridArchitecture}
                </h1>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t.gridArchitectureSubtitle}
                </p>
              </div>
            </div>

            <p className="max-w-3xl text-gray-600 dark:text-gray-400">
              {t.gridArchitectureDescription}
            </p>
          </div>
        </div>
      </header>

      {/* Introduction */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />

          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {t.gridOverviewTitle}
          </h2>
        </div>

        <p className="leading-relaxed text-gray-600 dark:text-gray-400">
          {t.gridOverviewDescription}
        </p>
      </section>

      {/* Architecture summary */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {componentGroups.map((item) => (
          <div
            key={item.identifier}
            className={`rounded-xl border border-l-4 border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${borderStyles[item.color]}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {item.name}
            </p>

            <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
              {item.identifier}
            </h3>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {item.description}
            </p>
          </div>
        ))}
      </section>

      {/* Electrical diagram */}
      <section>
        <ElectricalDiagram />
      </section>

      {/* Component documentation */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 flex items-center gap-3">
          <CircuitBoard className="h-6 w-6 text-blue-600 dark:text-blue-400" />

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t.gridComponentsTitle}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {gridSections.map((section) => (
            <div
              key={section.color}
              className="rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-700/50"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className={`rounded-lg p-2 ${colorStyles[section.color]}`}>
                  <section.icon className="h-5 w-5" />
                </div>

                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {section.title}
                </h3>
              </div>

              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {section.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Data disclaimer */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t.gridDataDisclaimer}
      </p>
    </div>
  );
}
