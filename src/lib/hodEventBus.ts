const bus = new EventTarget();

export type HodEvent = { type: 'approved' | 'disapproved' | 'updated'; orderId: string };

export const emitHodEvent = (event: HodEvent) => {
  bus.dispatchEvent(new CustomEvent('hod-event', { detail: event }));
};

export const onHodEvent = (handler: (e: HodEvent) => void) => {
  const listener = (ev: Event) => {
    const ce = ev as CustomEvent<HodEvent>;
    handler(ce.detail);
  };
  bus.addEventListener('hod-event', listener as EventListener);
  return () => bus.removeEventListener('hod-event', listener as EventListener);
};

export default bus;
