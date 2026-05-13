import { describe, it, expect, beforeEach } from 'vitest';
import { useAdrStore } from '../adr-store';

describe('adr-store', () => {
  beforeEach(() => {
    useAdrStore.setState({ adrs: [] });
  });

  it('createADR appends a draft with next number', () => {
    useAdrStore.getState().createADR();
    useAdrStore.getState().createADR();
    const adrs = useAdrStore.getState().adrs;
    expect(adrs).toHaveLength(2);
    expect(adrs[0].number).toBe(1);
    expect(adrs[1].number).toBe(2);
    expect(adrs[0].status).toBe('proposed');
  });

  it('updateADR merges fields', () => {
    useAdrStore.getState().createADR();
    const id = useAdrStore.getState().adrs[0].id;
    useAdrStore.getState().updateADR(id, { title: 'choose-monolith' });
    expect(useAdrStore.getState().adrs[0].title).toBe('choose-monolith');
  });

  it('deleteADR removes by id', () => {
    useAdrStore.getState().createADR();
    const id = useAdrStore.getState().adrs[0].id;
    useAdrStore.getState().deleteADR(id);
    expect(useAdrStore.getState().adrs).toHaveLength(0);
  });

  it('addLink and removeLink edit links', () => {
    useAdrStore.getState().createADR();
    const id = useAdrStore.getState().adrs[0].id;
    useAdrStore.getState().addLink(id, { kind: 'node', targetId: 'n1' });
    useAdrStore.getState().addLink(id, { kind: 'node', targetId: 'n1' }); // dedup
    expect(useAdrStore.getState().adrs[0].links).toEqual([{ kind: 'node', targetId: 'n1' }]);
    useAdrStore.getState().removeLink(id, { kind: 'node', targetId: 'n1' });
    expect(useAdrStore.getState().adrs[0].links).toEqual([]);
  });

  it('supersede sets statuses on both ADRs', () => {
    useAdrStore.getState().createADR();
    useAdrStore.getState().createADR();
    const [a, b] = useAdrStore.getState().adrs;
    useAdrStore.getState().supersede(b.id, a.id);
    const updated = useAdrStore.getState().adrs;
    expect(updated.find((x) => x.id === a.id)!.status).toBe('superseded');
    expect(updated.find((x) => x.id === b.id)!.supersedes).toContain(a.id);
  });

  it('replaceAll swaps the full collection', () => {
    useAdrStore.getState().replaceAll([
      { id: 'x', number: 99, title: 'imported', status: 'accepted', date: '2020-01-01',
        context: 'c', decision: 'd', consequences: 'q', createdAt: 0, updatedAt: 0 },
    ]);
    expect(useAdrStore.getState().adrs).toHaveLength(1);
    expect(useAdrStore.getState().adrs[0].number).toBe(99);
  });

  it('onNodeDeleted drops links to that node', () => {
    useAdrStore.getState().createADR();
    const id = useAdrStore.getState().adrs[0].id;
    useAdrStore.getState().addLink(id, { kind: 'node', targetId: 'n1' });
    useAdrStore.getState().addLink(id, { kind: 'edge', targetId: 'e1' });
    useAdrStore.getState().onGraphElementDeleted('node', 'n1');
    expect(useAdrStore.getState().adrs[0].links).toEqual([{ kind: 'edge', targetId: 'e1' }]);
  });
});
