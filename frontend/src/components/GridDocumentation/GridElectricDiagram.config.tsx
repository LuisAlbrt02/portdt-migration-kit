import React from 'react';
import { Handle, Position, BaseEdge, type Node, type Edge, type NodeProps, type EdgeProps } from '@xyflow/react';
import type { useTranslation } from '../../hooks/useTranslation';
export const COLORS = {
    emergency: '#22c55e',
    emergencyDark: '#15803d',
    emergencyBg: '#dcfce7',
    normal: '#f97316',
    normalDark: '#c2410c',
    normalBg: '#ffedd5',
    main: '#1e3a8a',
    transformer: '#7c3aed',
    demonstrator: '#0891b2',
    demonstratorDark: '#155e75',
    demonstratorBg: '#cffafe',
    utility: '#dc2626',
};
export const demonstratorEquipment = [
    { l: 'Q.BAT', i: 0 },
    { l: 'Q.Vload.P', i: 1 },
    { l: 'Q.lig.AC', i: 2 },
    { l: 'Q.Empilhador', i: 3 },
    { l: 'Q.Carregadores', i: 4 },
    { l: 'Q.PV', i: 5 },
];
export const emergencyCircuits = [
    { d: 'D15', p: 'Q.P.01' }, { d: 'D16', p: 'Q.P.02' }, { d: 'D17', p: 'Q.P.03' },
    { d: 'D18', p: 'Q.P.04' }, { d: 'D19', p: 'Q.P.05' }, { d: 'D20', p: 'Q.AVAC 2' },
    { d: 'D21', p: 'Q.P.07' }, { d: 'D22', p: 'Q.P.08' }, { d: 'D23', p: 'Q.P.1.1' },
    { d: 'D24', p: 'Q.P.1.2' }, { d: 'D25', p: 'Q.P.1.3' }, { d: 'D26', p: 'Q.P.1.4' },
    { d: 'D27', p: 'Q.P.N.R.O' }, { d: 'D28', p: 'CHILLER (E)' }, { d: 'D29', p: 'Q.E.S.I' },
    { d: 'D30', p: 'Q.BOMBAS' }, { d: 'D31', p: 'Q.SERVIDORES' },
];
export const normalCircuits = [
    { d: 'D1', p: 'Q.P.01' }, { d: 'D2', p: 'Q.P.02' }, { d: 'D3', p: 'Q.P.03' },
    { d: 'D4', p: 'Q.P.04' }, { d: 'D5', p: 'Q.P.05' }, { d: 'D6', p: 'Q.P.07' },
    { d: 'D7', p: 'Q.P.1.1' }, { d: 'D8', p: 'Q.P.1.2' }, { d: 'D9', p: 'Q.P.1.3' },
    { d: 'D10', p: 'Q.P.14' }, { d: 'D11', p: 'Q.P.N.P.G' }, { d: 'D12', p: 'Q.AVAC.0.2' },
    { d: 'D13', p: 'Q.AVAC 1' }, { d: 'D14', p: 'CHILLER (N)' },
];
const hiddenHandle: React.CSSProperties = {
    opacity: 0,
    width: 2,
    height: 2,
    minWidth: 0,
    minHeight: 0,
    border: 'none',
    background: 'transparent',
    pointerEvents: 'none',
};
interface GridData { label: string }
function GridNode({ data }: NodeProps) {
    const d = data as unknown as GridData;
    return (
        <div className="relative flex h-full w-full items-center justify-center rounded-lg border-2 bg-white px-3 shadow-sm" style={{ borderColor: COLORS.utility }}>
            <span className="whitespace-nowrap text-center text-[13px] font-bold" style={{ color: COLORS.utility }}>{d.label}</span>
            <Handle type="source" position={Position.Bottom} style={hiddenHandle} />
        </div>
    );
}
function TransformerNode({ data }: NodeProps) {
    const d = data as unknown as GridData;
    return (
        <div className="relative h-full w-full">
            <svg width="100%" height="100%" viewBox="0 0 44 64">
                <circle cx="22" cy="22" r="16" fill="white" stroke={COLORS.transformer} strokeWidth="2.5" />
                <circle cx="22" cy="42" r="16" fill="white" stroke={COLORS.transformer} strokeWidth="2.5" />
            </svg>
            <span
                className="absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold"
                style={{ color: COLORS.transformer }}
            >
                {d.label}
            </span>
            <Handle type="target" position={Position.Top} style={hiddenHandle} />
            <Handle type="source" position={Position.Bottom} style={hiddenHandle} />
        </div>
    );
}
function GeneratorNode({ data }: NodeProps) {
    const d = data as unknown as { label: string; backup: string };
    return (
        <div className="relative h-full w-full">
            <div className="flex h-full w-full items-center justify-center rounded-full border-[2.5px] bg-white text-2xl font-bold shadow-sm" style={{ borderColor: COLORS.emergency, color: COLORS.emergencyDark }}>G</div>
            <div className="pointer-events-none absolute left-1/2 top-full mt-2 flex -translate-x-1/2 flex-col items-center whitespace-nowrap text-[11px]" style={{ color: COLORS.emergencyDark }}>
                <span className="font-semibold">{d.label}</span><span>({d.backup})</span>
            </div>
            <Handle id="left" type="target" position={Position.Left} style={hiddenHandle} />
        </div>
    );
}
export interface BreakerData {
    label: string;
    sublabel?: string;
    color: string;
    size: 'small' | 'medium' | 'large';
    topHandles?: { id: string; left: string }[];
    sideHandles?: ('left' | 'right')[];
}
function BreakerNode({ data }: NodeProps) {
    const d = data as unknown as BreakerData;
    const textSize = d.size === 'large' ? 'text-[13px]' : d.size === 'medium' ? 'text-[11px]' : 'text-[10px]';
    const sublabelSize = d.size === 'large' ? 'text-[11px]' : d.size === 'medium' ? 'text-[10px]' : 'text-[9px]';
    return (
        <div className="relative h-full w-full cursor-pointer">
            <div className="relative h-full w-full overflow-hidden rounded-md bg-white shadow-sm transition-shadow hover:shadow-md" style={{ border: `2px solid ${d.color}` }}>
                <svg className="absolute inset-0" width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none">
                    <line x1="1" y1="9" x2="9" y2="1" stroke={d.color} strokeWidth="0.55" vectorEffect="non-scaling-stroke" opacity="0.8" />
                </svg>
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                    <span className={`${textSize} max-w-full rounded-md bg-white/90 px-1 text-center font-bold leading-tight`} style={{ color: d.color, overflowWrap: 'anywhere' }}>{d.label}</span>
                </div>
            </div>
            {d.sublabel && (
            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap">
                <div
                className={`${sublabelSize} rounded-md px-1 py-1 font-medium text-slate-500`}
                style={{
                    backgroundColor: '#f9fbfd',
                }}
                >
                {d.sublabel}
                </div>
            </div>
            )}
            {d.topHandles ? d.topHandles.map((h) => (
                <Handle key={h.id} id={h.id} type="target" position={Position.Top} style={{ ...hiddenHandle, left: h.left }} />
            )) : <Handle type="target" position={Position.Top} style={hiddenHandle} />}
            <Handle type="source" position={Position.Bottom} style={hiddenHandle} />
            {d.sideHandles?.includes('right') && <Handle id="right" type="source" position={Position.Right} style={hiddenHandle} />}
            {d.sideHandles?.includes('left') && <Handle id="left" type="source" position={Position.Left} style={hiddenHandle} />}
        </div>
    );
}
export interface BusData {
    color: string;
    ports: { id: string; x: number; type: 'source' | 'target' }[];
}
function BusNode({ data }: NodeProps) {
    const d = data as unknown as BusData;
    return (
        <div className="relative h-full w-full rounded-sm shadow" style={{ background: d.color }}>
            {d.ports.map((p) => (
                <Handle
                    key={`${p.type}-${p.id}`}
                    id={p.id}
                    type={p.type}
                    position={p.type === 'target' ? Position.Top : Position.Bottom}
                    style={{ ...hiddenHandle, left: p.x }}
                />
            ))}
        </div>
    );
}
export interface EndPanelData {
    label: string;
    power?: number;
    variant: 'emergency' | 'normal' | 'demonstrator';
}
export const VARIANTS = {
    emergency: { bg: COLORS.emergencyBg, stroke: COLORS.emergency, text: COLORS.emergencyDark },
    normal: { bg: COLORS.normalBg, stroke: COLORS.normal, text: COLORS.normalDark },
    demonstrator: { bg: COLORS.demonstratorBg, stroke: COLORS.demonstrator, text: COLORS.demonstratorDark },
};
function EndPanelNode({ data }: NodeProps) {
    const d = data as unknown as EndPanelData;
    const v = VARIANTS[d.variant];
    const hasPower = d.power !== undefined && d.power >= 0;
    return (
        <div
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-md border-[1.5px] shadow-sm transition hover:scale-105"
            style={{ background: v.bg, borderColor: v.stroke }}
        >
            <span className="text-[8px] font-semibold leading-none" style={{ color: v.text }}>
                {d.label}
            </span>
            {hasPower && (
                <span className="mt-0.5 text-[8px] font-bold leading-none text-slate-600">
                    {d.power!.toFixed(2)} kW
                </span>
            )}
            <Handle type="target" position={Position.Top} style={hiddenHandle} />
        </div>
    );
}

function BackupEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
    const busY = typeof data?.busY === 'number' ? data.busY : 322;
    const path = `M ${sourceX} ${sourceY} H ${sourceX - 12} V ${busY} H ${targetX} V ${targetY}`;
    return <BaseEdge id={id} path={path} style={{ stroke: COLORS.emergency, strokeWidth: 2.5}} />;
}
export const edgeTypes = { backup: BackupEdge };
export const nodeTypes = {
    grid: GridNode,
    transformer: TransformerNode,
    generator: GeneratorNode,
    breaker: BreakerNode,
    bus: BusNode,
    endPanel: EndPanelNode,
};
const CB_SPACING = 70;
function edge(
    id: string,
    source: string,
    target: string,
    color: string,
    opts: Partial<Edge> & { sourceHandle?: string; targetHandle?: string } = {},
): Edge {
    return {
        id,
        source,
        target,
        type: 'straight',
        animated: true,
        style: { stroke: color, strokeWidth: 2.5 },
        ...opts,
    };
}
export function buildGraph(
    getPower: (d?: string, p?: string) => number | undefined,
    t: ReturnType<typeof useTranslation>,
): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const emergencyStartX = 380;
    const emergencyCenterX = emergencyStartX + ((emergencyCircuits.length - 1) * CB_SPACING) / 2;
    const normalStartX = emergencyStartX + 17 * CB_SPACING + 180;
    const normalCenterX = normalStartX + (14 * CB_SPACING + 40) / 2;
    const centerX = (emergencyCenterX + normalCenterX) / 2;
    const demoX = normalStartX - 85;
    const Y = {
        grid: 30,
        transformer: 112,
        qgbt: 217,
        mainBus: 333,
        qged: 445,
        subBus: 555,
        cb: 645,
        end: 745,
        demoPanel: 870,
        demoBus: 980,
        demoEquip: 1050,
    };
    const place = (cx: number, cy: number, w: number, h: number) => ({ x: cx - w / 2, y: cy - h / 2 });
    /* Cabecera */
    nodes.push({
        id: 'grid', type: 'grid', position: place(centerX, Y.grid, 220, 44),
        data: { label: 'ELECTRICAL GRID' }, style: { width: 220, height: 44 }, draggable: false,
    });
    nodes.push({
        id: 'transformer', type: 'transformer', position: place(centerX, Y.transformer, 44, 64),
        data: { label: t.shift2dcTransformer }, style: { width: 44, height: 64 },
    });
    edges.push(edge('e-grid-tr', 'grid', 'transformer', COLORS.utility));
    /* QGBT + generador */
    nodes.push({
        id: 'qgbt', type: 'breaker', position: place(centerX, Y.qgbt, 82, 82),
        data: {
            label: 'QGBT (N+E)', sublabel: t.shift2dcMainSwitchboard, color: COLORS.main, size: 'large',
            sideHandles: ['right', 'left'],
        } satisfies BreakerData,
        style: { width: 82, height: 82 },
    });
    nodes.push({
        id: 'generator', type: 'generator', position: place(centerX + 260, Y.qgbt, 50, 50),
        data: { label: t.shift2dcEmergencyGenerator, backup: t.shift2dcBackup }, style: { width: 50, height: 50 },
    });
    edges.push(edge('e-tr-qgbt', 'transformer', 'qgbt', COLORS.transformer));
    edges.push(
        edge('e-qgbt-gen', 'qgbt', 'generator', COLORS.emergency, {
            sourceHandle: 'right', targetHandle: 'left', animated: false,
            style: { stroke: COLORS.emergency, strokeWidth: 2.5},
        }),
    );
    /* main ar */
    const mainBusLeft = emergencyCenterX - 40;
    const mainBusRight = normalCenterX + 40;
    nodes.push({
        id: 'mainBus', type: 'bus', position: { x: mainBusLeft, y: Y.mainBus - 3 },
        data: {
            color: COLORS.main,
            ports: [
                { id: 'in', x: centerX - mainBusLeft, type: 'target' },
                { id: 'e', x: emergencyCenterX - mainBusLeft, type: 'source' },
                { id: 'n', x: normalCenterX - mainBusLeft, type: 'source' },
            ],
        } satisfies BusData,
        style: { width: mainBusRight - mainBusLeft, height: 7 },
    });
    edges.push(edge('e-qgbt-bus', 'qgbt', 'mainBus', COLORS.main, { targetHandle: 'in', style: { stroke: COLORS.main, strokeWidth: 3 } }));
    /* QGED (E) */
    nodes.push({
        id: 'qged-e', type: 'breaker', position: place(emergencyCenterX, Y.qged, 82, 82),
        data: {
            label: 'QGED (E)', sublabel: t.shift2dcEmergencyPower, color: COLORS.emergency, size: 'large',
            topHandles: [{ id: 'main', left: '50%' }, { id: 'backup', left: '18%' }],
        } satisfies BreakerData,
        style: { width: 82, height: 82 },
    });
    edges.push(edge('e-bus-qgede', 'mainBus', 'qged-e', COLORS.emergency, { sourceHandle: 'e', targetHandle: 'main' }));
    edges.push(
        edge('e-backup', 'qgbt', 'qged-e', COLORS.emergency, {
            sourceHandle: 'left', targetHandle: 'backup', type: 'backup', animated: false,
            data: { busY: Y.mainBus - 11 },
        }),
    );
    /* QGED (N) */
    nodes.push({
        id: 'qged-n', type: 'breaker', position: place(normalCenterX, Y.qged, 82, 82),
        data: { label: 'QGED (N)', sublabel: t.shift2dcNormalPower, color: COLORS.normal, size: 'large' } satisfies BreakerData,
        style: { width: 82, height: 82 },
    });
    edges.push(edge('e-bus-qgedn', 'mainBus', 'qged-n', COLORS.normal, { sourceHandle: 'n' }));
  
    const buildBranch = (
        prefix: 'e' | 'n',
        circuits: { d: string; p: string }[],
        startX: number,
        centerXBus: number,
        color: string,
        variant: 'emergency' | 'normal',
        extraLeft = 0,
        extraPorts: BusData['ports'] = [],
    ) => {
        const busLeft = startX - 30 - extraLeft;
        const busRight = startX + (circuits.length - 1) * CB_SPACING + 30;
        const busId = `bus-${prefix}`;
        nodes.push({
            id: busId, type: 'bus', position: { x: busLeft, y: Y.subBus - 3 },
            data: {
                color,
                ports: [
                    { id: 'in', x: centerXBus - busLeft, type: 'target' },
                    ...circuits.map((c, i) => ({ id: c.d, x: startX + i * CB_SPACING - busLeft, type: 'source' as const })),
                    ...extraPorts.map((p) => ({ ...p, x: p.x - busLeft })),
                ],
            } satisfies BusData,
            style: { width: busRight - busLeft, height: 7 },
        });
        edges.push(edge(`e-qged-${prefix}-bus`, `qged-${prefix}`, busId, color, { targetHandle: 'in' }));
        circuits.forEach((c, i) => {
            const bx = startX + i * CB_SPACING;
            const cbId = `${prefix}-${c.d}`;
            const panelId = `${prefix}-${c.p}`;
            nodes.push({
                id: cbId, type: 'breaker', position: place(bx, Y.cb, 34, 42),
                data: { label: c.d, color, size: 'small' } satisfies BreakerData,
                style: { width: 34, height: 42 },
            });
            nodes.push({
                id: panelId, type: 'endPanel', position: place(bx, Y.end, 64, 30),
                data: { label: c.p, power: getPower(c.d, c.p), variant } satisfies EndPanelData,
                style: { width: 64, height: 30 },
            });
            edges.push(edge(`e-${busId}-${cbId}`, busId, cbId, color, { sourceHandle: c.d, style: { stroke: color, strokeWidth: 2 } }));
            edges.push(edge(`e-${cbId}-${panelId}`, cbId, panelId, color, { style: { stroke: color, strokeWidth: 2 } }));
        });
    };
    buildBranch('e', emergencyCircuits, emergencyStartX, emergencyCenterX, COLORS.emergency, 'emergency');
    buildBranch('n', normalCircuits, normalStartX, normalCenterX, COLORS.normal, 'normal', normalStartX - demoX + 0, [
        { id: 'demo', x: demoX, type: 'source' },
    ]);

    nodes.push({
        id: 'demonstrador', type: 'breaker', position: place(demoX, Y.demoPanel, 140, 62),
        data: { label: 'Q.DEMONSTRADOR', sublabel: t.shift2dcPhysical, color: COLORS.demonstrator, size: 'medium' } satisfies BreakerData,
        style: { width: 140, height: 62 },
    });
    edges.push(edge('e-n-demo', 'bus-n', 'demonstrador', COLORS.normal, { sourceHandle: 'demo' }));
    const demoSpacing = 108;
    const demoStartX = demoX - 10;
    const demoEndX = demoStartX + (demonstratorEquipment.length - 1) * demoSpacing;
    const demoBusLeft = demoStartX - 25;
    nodes.push({
        id: 'bus-demo', type: 'bus', position: { x: demoBusLeft, y: Y.demoBus - 3 },
        data: {
            color: COLORS.demonstrator,
            ports: [
                { id: 'in', x: demoX - demoBusLeft, type: 'target' },
                ...demonstratorEquipment.map((e) => ({
                    id: e.l, x: demoStartX + e.i * demoSpacing - demoBusLeft, type: 'source' as const,
                })),
            ],
        } satisfies BusData,
        style: { width: demoEndX - demoStartX + 50, height: 7 },
    });
    edges.push(edge('e-demo-bus', 'demonstrador', 'bus-demo', COLORS.demonstrator, { targetHandle: 'in' }));
    demonstratorEquipment.forEach((e) => {
        const px = demoStartX + e.i * demoSpacing;
        nodes.push({
            id: e.l, type: 'endPanel', position: place(px, Y.demoEquip, 72, 30),
            data: { label: e.l, power: getPower(undefined, e.l), variant: 'demonstrator' } satisfies EndPanelData,
            style: { width: 72, height: 30 },
        });
        edges.push(edge(`e-demo-${e.l}`, 'bus-demo', e.l, COLORS.demonstrator, { sourceHandle: e.l, style: { stroke: COLORS.demonstrator, strokeWidth: 2 } }));
    });
    return { nodes, edges };
}
