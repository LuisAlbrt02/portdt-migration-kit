'use client';

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type Offset = {
  x: number;
  y: number;
};

export function useDraggablePanel() {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;

    if (target.closest('button, input, select, textarea, a')) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragStart.current) return;

    setOffset({
      x:
        dragStart.current.offsetX +
        event.clientX -
        dragStart.current.pointerX,

      y:
        dragStart.current.offsetY +
        event.clientY -
        dragStart.current.pointerY,
    });
  };

  const stopDragging = (event: ReactPointerEvent<HTMLElement>) => {
    dragStart.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    panelStyle: {
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
    },

    dragHandleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stopDragging,
      onPointerCancel: stopDragging,
      style: {
        touchAction: 'none' as const,
      },
    },
  };
}