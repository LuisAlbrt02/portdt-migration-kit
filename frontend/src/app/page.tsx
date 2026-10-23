'use client';

import Link from 'next/link';
import { Database, Map } from 'lucide-react';

import { useTranslation } from '../hooks/useTranslation';
import PortEnergyOverview from '../components/PortEnergyOverview';

export default function Home() {
  const t = useTranslation();

  const cards = [
    {
      title: t.portMap,
      description: t.portMapDescription,
      icon: Map,
      href: '/map',
    },
    {
      title: t.historicalPortData,
      description: t.historicalPortDataDescription,
      icon: Database,
      href: '/historical-data',
    },
  ];

  return (
    <div className="p-6">
      {/* Dashboard title 
      <div className="mb-6 mt-3">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">
          {t.dashboard}
        </h1>

        <p className="text-xl mt-2 text-gray-600 dark:text-gray-400">
          {t.welcomeMessage}
        </p>
      </div>
      */}
      {/*
      <div className="max-w-2xl mx-auto">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="group block"
              >
                <div
                  className="
                    overflow-hidden
                    rounded-lg
                    border
                    border-gray-200
                    bg-white
                    shadow-sm
                    transition-all
                    hover:-translate-y-0.5
                    hover:shadow-md
                    dark:border-gray-700
                    dark:bg-gray-800
                  "
                >
                  <div className="bg-blue-600 px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Icon className="h-7 w-7 text-white" />

                      <h2 className="text-xl font-bold text-white">
                        {card.title}
                      </h2>
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="text-base leading-6 text-gray-600 dark:text-gray-400 text-center">
                      {card.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      */}
      {/* Port Energy Overview */}
      <div className="">
        <PortEnergyOverview />
      </div>
    </div>
  );
}