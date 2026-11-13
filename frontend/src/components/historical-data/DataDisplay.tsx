
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
  const [activeTab, setActiveTab] = useState<'table' | 'charts'>('table');
  const [pageSize, setPageSize] = useState(250);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));

  const visibleRows = useMemo(
    () => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredData, currentPage, pageSize]
  );

  const deviceNames = useMemo(
    () => new Map(deviceList.map(device => [device.id, device.name])),
    [deviceList]
  );

  const deviceCount = new Set(filteredData.map(item => item.device)).size;

  const averagePower = filteredData.length
    ? filteredData.reduce((sum, item) => sum + (item.measure_cons ?? 0), 0) / filteredData.length
    : 0;

  const peakPower = filteredData.length
    ? filteredData.reduce((max, item) => Math.max(max, item.measure_cons ?? 0), -Infinity)
    : 0;

  const selectedName = selectedDevice
    ? deviceNames.get(selectedDevice) || selectedDevice
    : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 relative z-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {selectedName ? `${t.dataFor} ${selectedName}` : t.allDevicesData}
        </h2>
        {isHistoricalView && (
          <span className="text-sm text-blue-600 dark:text-blue-400">
            {t.viewingHistoricalData} ({filteredData.length.toLocaleString()} {t.records})
          </span>
        )}
      </div>

      {!isLoading && filteredData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <Stat title={t.totalRecords} value={filteredData.length.toLocaleString()} />
          <Stat title={t.averagePowerW} value={`${averagePower.toFixed(2)} W`} />
          <Stat title={t.peakPowerW} value={`${peakPower.toFixed(2)} W`} />
          <Stat title={t.devices} value={String(deviceCount)} />
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-gray-600 dark:text-gray-300">
          {t.loadingData}
        </div>
      ) : filteredData.length === 0 ? (
        <div className="py-8 text-center text-gray-600 dark:text-gray-300">
          {t.noDataAvailableForDevice}
        </div>
      ) : (
        <>
          <div className="flex gap-6 border-b border-gray-200 dark:border-gray-600 mb-4">
            {(['table', 'charts'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 font-medium ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500'
                }`}
              >
                {tab === 'table' ? t.table : t.charts}
              </button>
            ))}
          </div>

          {activeTab === 'charts' ? (
            <EnergyCharts
              filteredData={filteredData}
              selectedDevice={selectedDevice}
              isHistoricalView={isHistoricalView}
            />
          ) : (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/30">
                <label className="text-sm text-gray-700 dark:text-gray-200">
                  {t.rowsPerPage}{' '}
                  <select
                    value={pageSize}
                    onChange={event => {
                      setPageSize(Number(event.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded border p-1 bg-white dark:bg-gray-800"
                  >
                    {[100, 250, 500, 1000].map(n => (
                      <option value={n} key={n}>{n}</option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center gap-2 text-sm">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>«</button>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                  <span>{t.page} {currentPage} {t.of} {totalPages}</span>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>»</button>
                </div>

                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 rounded border text-emerald-700"
                    onClick={() => exportCsv(visibleRows, deviceNames, `power_${selectedDate}_page-${currentPage}.csv`)}
                  >
                    {t.csvPage}
                  </button>
                  <button
                    className="px-3 py-1.5 rounded border text-emerald-700"
                    onClick={() => exportCsv(filteredData, deviceNames, `power_${selectedDate}_all.csv`)}
                  >
                    {t.csvAll}
                  </button>
                  <button
                    className="px-3 py-1.5 rounded border text-red-700"
                    onClick={() => void exportPdf(visibleRows, deviceNames, `power_${selectedDate}_page-${currentPage}.pdf`)}
                  >
                    {t.pdfPage}
                  </button>
                  <button
                    className="px-3 py-1.5 rounded border text-red-700"
                    onClick={() => void exportPdf(filteredData, deviceNames, `power_${selectedDate}_all.pdf`)}
                  >
                    {t.pdfAll}
                  </button>
                </div>
              </div>

              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <tr>
                    <th className="p-4">{t.timestamp}</th>
                    <th className="p-4">{t.device}</th>
                    <th className="p-4">{t.powerW}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleRows.map((item, index) => (
                    <tr
                      key={item._id || `${item.device}-${item.timestamp}-${index}`}
                      className="hover:bg-blue-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="p-4 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleString('pt-PT')}
                      </td>
                      <td className="p-4">
                        {deviceNames.get(item.device) || item.deviceName || item.device}
                      </td>
                      <td className="p-4 font-semibold">
                        {(item.measure_cons ?? 0).toFixed(2)} W
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function exportCsv(
  rows: EnergyData[],
  names: Map<string, string>,
  filename: string
) {
  if (!rows.length) return;

  const escape = (value: unknown) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const lines = [
    'timestamp,device,deviceName,power_W',
    ...rows.map(row =>
      [
        row.timestamp,
        row.device,
        names.get(row.device) || row.deviceName || '',
        row.measure_cons ?? '',
      ].map(escape).join(',')
    ),
  ];

  const url = URL.createObjectURL(
    new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  );

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function exportPdf(
  rows: EnergyData[],
  names: Map<string, string>,
  filename: string
) {
  if (!rows.length) return;

  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable = (autoTableModule as any).default || autoTableModule;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  doc.setFontSize(16);
  doc.text('Historical Power Report', 40, 40);
  doc.setFontSize(10);
  doc.text(`Records: ${rows.length.toLocaleString()}`, 40, 60);

  autoTable(doc, {
    startY: 80,
    head: [['Timestamp', 'Device', 'Power (W)']],
    body: rows.map(row => [
      new Date(row.timestamp).toLocaleString('pt-PT'),
      names.get(row.device) || row.deviceName || row.device,
      (row.measure_cons ?? 0).toFixed(2),
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save(filename);
}
