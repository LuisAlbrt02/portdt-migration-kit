'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { EnergyData } from '../../types/EnergyData';
import EnergyCharts from './EnergyCharts';
import { useTranslation } from '../../hooks/useTranslation';

interface DataDisplayProps {
  filteredData: EnergyData[];
  deviceList: { id: string; name: string }[];
  selectedDevice: string | null;
  selectedDate: string;
  isHistoricalView: boolean;
  isLoading: boolean;
}

export default function DataDisplay({
  filteredData,
  deviceList,
  selectedDevice,
  selectedDate,
  isHistoricalView,
  isLoading,
}: DataDisplayProps) {
  const t = useTranslation();

  // Table is the default view.
  const [activeTab, setActiveTab] = useState<'table' | 'charts'>('table');

  const PAGE_SIZE_OPTIONS = [100, 250, 500, 1000];
  const [pageSize, setPageSize] = useState<number>(250);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // When new data arrives, return to the first table page.
  // Do NOT force the charts tab.
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData]);

  const formatDeviceId = (deviceId: string): string => {
    if (deviceId.length > 20) {
      return `${deviceId.substring(0, 8)}...`;
    }

    return deviceId;
  };

  const safeRound = (value?: number): string => {
    if (value === undefined || value === null) {
      return t.na;
    }

    return Math.round(value).toString();
  };

  const totalPowerW = useMemo(() => {
    return filteredData.reduce((sum, item) => {
      const itemPower =
        (item.L1?.P || 0) +
        (item.L2?.P || 0) +
        (item.L3?.P || 0);

      return sum + itemPower;
    }, 0);
  }, [filteredData]);

  const averagePowerW =
    filteredData.length > 0
      ? totalPowerW / filteredData.length
      : 0;

  const totalPowerKW = totalPowerW / 1000;
  const averagePowerKW = averagePowerW / 1000;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredData.length / pageSize)
  );

  const visibleRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    return filteredData.slice(start, end);
  }, [filteredData, currentPage, pageSize]);

  const numberOfDevices = selectedDevice
    ? 1
    : new Set(filteredData.map(item => item.device)).size;

  const selectedDeviceName = selectedDevice
    ? deviceList.find(device => device.id === selectedDevice)?.name ||
      selectedDevice
    : null;

  const dataTable = (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">

      {/* Pagination and exports */}
      {filteredData.length > 0 && (
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 px-4 py-3 text-sm border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30">

          {/* Rows per page */}
          <div className="flex items-center text-base gap-2">
            <span className="text-gray-700 dark:text-gray-200">
              {t.rowsPerPage}
            </span>

            <select
              value={pageSize}
              onChange={event => {
                const newSize = Number(event.target.value);

                setPageSize(newSize);
                setCurrentPage(1);
              }}
              className="px-2 py-1 roundedborder border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Pagination */}
          <div className="flex items-center text-base gap-2 text-gray-700 dark:text-gray-200">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-2 py-1 rounded border border-gray-300 dark:border-gray-600 ${
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              aria-label={t.firstPage}
            >
              «
            </button>

            <button
              type="button"
              onClick={() =>
                setCurrentPage(page =>
                  Math.max(1, page - 1)
                )
              }
              disabled={currentPage === 1}
              className={`px-2 py-1 rounded border border-gray-300 dark:border-gray-600 ${
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              aria-label={t.previousPage}
            >
              ‹
            </button>

            <span>
              {t.page} {currentPage} {t.of} {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage(page =>
                  Math.min(totalPages, page + 1)
                )
              }
              disabled={currentPage === totalPages}
              className={`px-2 py-1 rounded border border-gray-300 dark:border-gray-600 ${
                currentPage === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              aria-label={t.nextPage}
            >
              ›
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 rounded border border-gray-300 dark:border-gray-600 ${
                currentPage === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              aria-label={t.lastPage}
            >
              »
            </button>
          </div>

          {/* Export */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-base text-gray-600 dark:text-gray-400">
              {t.export}:
            </span>

            <button
              type="button"
              onClick={() =>
                handleExportCsv(
                  visibleRows,
                  `energy-data_${selectedDate}_page-${currentPage}.csv`
                )
              }
              className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors font-medium shadow-sm hover:shadow-md"
              title={t.exportCurrentPageAsCsv}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>

              <span>{t.csvPage}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleExportCsv(
                  filteredData,
                  `energy-data_${selectedDate}_all.csv`
                )
              }
              className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors font-medium shadow-sm hover:shadow-md"
              title={t.exportAllDataAsCsv}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>

              <span>{t.csvAll}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleExportPdf(
                  visibleRows,
                  `energy-report_${selectedDate}_page-${currentPage}.pdf`,
                  selectedDevice,
                  deviceList
                )
              }
              className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium shadow-sm hover:shadow-md"
              title={t.exportCurrentPageAsPdf}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>

              <span>{t.pdfPage}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleExportPdf(
                  filteredData,
                  `energy-report_${selectedDate}_all.pdf`,
                  selectedDevice,
                  deviceList
                )
              }
              className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium shadow-sm hover:shadow-md"
              title={t.exportAllDataAsPdf}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>

              <span>{t.pdfAll}</span>
            </button>
          </div>
        </div>
      )}

      {/* Data table */}
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
        <thead className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-slate-700">
          <tr>
            <th className="px-6 py-4 text-left text-base font-bold text-gray-600 dark:text-gray-300 tracking-wider">
              {t.timestamp}
            </th>

            <th className="px-6 py-4 text-left text-base font-bold text-gray-600 dark:text-gray-300 tracking-wider">
              {t.device}
            </th>

            <th className="px-6 py-4 text-left text-base font-bold text-gray-600 dark:text-gray-300 tracking-wider">
              {t.totalConsumption}
            </th>

            <th className="px-6 py-4 text-left text-base font-bold text-gray-600 dark:text-gray-300 tracking-wider">
              {t.l1Power}
            </th>

            <th className="px-6 py-4 text-left text-base font-bold text-gray-600 dark:text-gray-300 tracking-wider">
              {t.l2Power}
            </th>

            <th className="px-6 py-4 text-left text-base font-bold text-gray-600 dark:text-gray-300 tracking-wider">
              {t.l3Power}
            </th>
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
          {visibleRows.map((item, index) => {
            const totalPower =
              (item.L1?.P || 0) +
              (item.L2?.P || 0) +
              (item.L3?.P || 0);

            return (
              <tr
                key={
                  item._id ||
                  `${item.device}-${item.timestamp}-${index}`
                }
                className={`${
                  index % 2 === 0
                    ? 'bg-gray-50 dark:bg-gray-700/50'
                    : 'bg-white dark:bg-gray-800'
                } hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-base font-medium text-gray-900 dark:text-gray-100">
                    {new Date(
                      item.timestamp
                    ).toLocaleDateString('pt-PT')}
                  </div>

                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(
                      item.timestamp
                    ).toLocaleTimeString('pt-PT')}
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3" />
                    <span className="text-base font-medium text-gray-900 dark:text-gray-100">
                      {deviceList.find(device => device.id === item.device)?.name ||
                        item.deviceName ||
                        formatDeviceId(item.device)}
                    </span>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {safeRound(totalPower)} W
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-base font-semibold text-red-600 dark:text-red-400">
                    {safeRound(item.L1?.P)} W
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-base font-semibold text-green-600 dark:text-green-400">
                    {safeRound(item.L2?.P)} W
                  </span>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-base font-semibold text-purple-600 dark:text-purple-400">
                    {safeRound(item.L3?.P)} W
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 relative z-0">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {selectedDevice
            ? `${t.dataFor} ${selectedDeviceName}`
            : t.allDevicesData}
        </h2>

        {isHistoricalView && (
          <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-md border border-blue-200 dark:border-blue-700">
            {t.viewingHistoricalData} (
            {filteredData.length.toLocaleString()} {t.records})
          </div>
        )}
      </div>

      {/* Summary */}
      {!isLoading && filteredData.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            <div className="text-center">
              <p className="text-base text-gray-600 dark:text-gray-400">
                {t.totalRecords}
              </p>

              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {filteredData.length.toLocaleString()}
              </p>
            </div>

            <div className="text-center">
              <p className="text-base text-gray-600 dark:text-gray-400">
                {t.totalPower}
              </p>

              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {totalPowerKW.toFixed(2)} kW
              </p>
            </div>

            <div className="text-center">
              <p className="text-base text-gray-600 dark:text-gray-400">
                {t.averagePowerLabel}
              </p>

              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {averagePowerKW.toFixed(2)} kW
              </p>
            </div>

            <div className="text-center">
              <p className="text-base text-gray-600 dark:text-gray-400">
                {t.devices}
              </p>

              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {numberOfDevices}
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />

          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t.loadingData}
          </p>
        </div>
      ) : filteredData.length === 0 ? (

        /* No data */
        <div className="text-center py-8">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            {t.noDataAvailable}
          </h3>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t.noDataAvailableForDevice}
          </p>
        </div>
      ) : (
        <div>

          {/* TABLE FIRST */}
          <div className="mb-4 border-b border-gray-200 dark:border-gray-600">
            <div className="flex space-x-8">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`py-2 px-4 font-medium text-lg transition-colors ${
                  activeTab === 'table'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t.table}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('charts')}
                className={`py-2 px-4 font-medium text-lg transition-colors ${
                  activeTab === 'charts'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {t.charts}
              </button>
            </div>
          </div>

          {activeTab === 'table' ? (
            dataTable
          ) : (
            <EnergyCharts
              filteredData={filteredData}
              selectedDevice={selectedDevice}
              isHistoricalView={isHistoricalView}
            />
          )}

        </div>
      )}
    </div>
  );
}

function handleExportCsv(
  rows: EnergyData[],
  filename: string
) {
  if (!rows.length) return;

  const headers = [
    'timestamp',
    'device',
    'deviceName',
    'totalPower_W',
    'L1_P_W',
    'L2_P_W',
    'L3_P_W',
  ];

  const escapeValue = (value: unknown) => {
    if (value === undefined || value === null) {
      return '';
    }

    const text = String(value);

    if (
      text.includes(',') ||
      text.includes('"') ||
      text.includes('\n')
    ) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  };

  const lines = [headers.join(',')];

  rows.forEach(row => {
    const totalPower =
      (row.L1?.P || 0) +
      (row.L2?.P || 0) +
      (row.L3?.P || 0);

    const line = [
      row.timestamp,
      row.device,
      row.deviceName || '',
      totalPower,
      row.L1?.P ?? '',
      row.L2?.P ?? '',
      row.L3?.P ?? '',
    ]
      .map(escapeValue)
      .join(',');

    lines.push(line);
  });

  const blob = new Blob(
    [lines.join('\n')],
    {
      type: 'text/csv;charset=utf-8;',
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function handleExportPdf(
  rows: EnergyData[],
  filename: string,
  selectedDevice: string | null,
  deviceList: { id: string; name: string }[]
) {
  if (!rows.length) return;

  const [
    { default: jsPDF },
    autoTableModule,
  ] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable =
    (autoTableModule as any).default ||
    autoTableModule;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const deviceName =
    selectedDevice
      ? deviceList.find(
          device =>
            device.id === selectedDevice
        )?.name || selectedDevice
      : null;

  const title =
    deviceName
      ? `Energy Report - ${deviceName}`
      : 'Energy Report - All Devices';

  doc.setFontSize(16);
  doc.text(title, 40, 40);

  doc.setFontSize(10);
  doc.text(
    `Generated at: ${new Date().toLocaleString()}`,
    40,
    58
  );

  doc.text(
    `Records: ${rows.length.toLocaleString()}`,
    40,
    72
  );

  const headers = [
    'Timestamp',
    'Device',
    'Total P (W)',
    'L1 P (W)',
    'L2 P (W)',
    'L3 P (W)',
  ];

  const body = rows.map(row => [
    new Date(
      row.timestamp
    ).toLocaleString(),

    row.deviceName ||
      deviceList.find(
        device =>
          device.id === row.device
      )?.name ||
      row.device,

    Math.round(
      (row.L1?.P || 0) +
      (row.L2?.P || 0) +
      (row.L3?.P || 0)
    ),

    Math.round(
      row.L1?.P || 0
    ),

    Math.round(
      row.L2?.P || 0
    ),

    Math.round(
      row.L3?.P || 0
    ),
  ]);

  autoTable(doc, {
    startY: 90,
    head: [headers],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [37, 99, 235],
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: {
      left: 40,
      right: 40,
    },
  });

  doc.save(filename);
}