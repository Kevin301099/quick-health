import { useMemo } from 'react';
import { useStore } from '@/agent/store';
import { PRODUCTS } from '@/domain/visas';
import { approveSponsor, chooseFile, continueAfterSponsor, downloadPermit, openStatus, payAmount, setCheck, setField, submitPage } from './logic';
import { PortalView, type PortalActions } from './PortalView';

const actions: PortalActions = {
  setField,
  setCheck,
  submit: (page) => void submitPage(page),
  chooseFile: (slot) => void chooseFile(slot),
  openStatus,
  download: downloadPermit,
  approveSponsor,
  continueSponsor: () => void continueAfterSponsor(),
  testCard: () => {
    const p = useStore.getState().profile;
    setField('payment:card', '4242 4242 4242 4242');
    setField('payment:exp', '12/30');
    setField('payment:cvc', '123');
    setField('payment:name', `${p.given} ${p.surname}`.trim() || 'Test Traveller');
  },
};

/** The sandbox portal wired to the application store. A person can use it whenever they hold the controls. */
export function ConnectedPortal() {
  const portal = useStore((s) => s.portal);
  const visa = useStore((s) => s.answers.visa);
  const days = useStore((s) => s.answers.days);
  const data = useMemo(() => ({ visa, days, slots: PRODUCTS[visa].slots, payAmount: payAmount() }), [visa, days]);
  return <PortalView state={portal} data={data} actions={actions} interactive={portal.controller === 'user'} />;
}
