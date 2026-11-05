import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activityLabel, changesClass, executeSimpleTool, isFrontendTool, TOOL_DECLARATIONS } from './frontend-tools.ts';
import type { WorkspaceStore } from '../workspace/workspace-store.ts';
import { panels } from '../../composables/panels.ts';

describe('frontend tools', () => {
  it('knows the eight frontend tools of the contract', () => {
    expect(TOOL_DECLARATIONS.map((tool) => tool.name).sort()).toEqual(
      ['confirm_change', 'filter_tree', 'highlight_element', 'open_class', 'open_panel', 'select_element', 'select_slide', 'start_preview'].sort(),
    );
    for (const tool of TOOL_DECLARATIONS) {
      expect(tool.description).not.toBe('');
      expect(tool.parameters).toMatchObject({ type: 'object' });
    }
    expect(isFrontendTool('confirm_change')).toBe(true);
    expect(isFrontendTool('show_draft')).toBe(false);
    expect(isFrontendTool('studio-read___get_class')).toBe(false);
  });

  it('labels what Lumi is doing in Spanish', () => {
    expect(activityLabel('studio-slides___add_slides')).toBe('Agregando diapositivas…');
    expect(activityLabel('get_class')).toBe('Leyendo la clase…');
    expect(activityLabel('open_class')).toMatch(/clase/i);
    expect(activityLabel('otra_herramienta')).toBe('Lumi está trabajando…');
  });

  it('knows which tools of the Studio MCP change the class', () => {
    expect(changesClass('studio-elements___update_element')).toBe(true);
    expect(changesClass('generate_narration_audio')).toBe(true);
    expect(changesClass('studio-read___get_class')).toBe(false);
    expect(changesClass('select_slide')).toBe(false);
  });

  describe('executeSimpleTool', () => {
    const openClass = vi.fn<(nodeId: string) => Promise<boolean>>();
    const setFilters = vi.fn<(filters: Record<string, unknown>) => void>();
    const selectSlide = vi.fn<(id: string) => void>();
    const selectElement = vi.fn<(id: string) => void>();
    let workspace: WorkspaceStore;

    beforeEach(() => {
      openClass.mockReset().mockResolvedValue(true);
      setFilters.mockReset();
      selectSlide.mockReset();
      selectElement.mockReset();
      // Only the members the tools use; the store is a large reactive class.
      workspace = {
        openClass,
        setFilters,
        previewOpen: { value: false },
        activeClass: { value: { id: 'c1' } },
        catalog: { component: () => undefined },
        session: {
          selectSlide,
          selectElement,
          state: { slides: [{ id: 'sl1', elements: [{ id: 'el1' }] }] },
        },
        // The tools only use these members; a partial double keeps the test independent of the rest of the store.
      } as unknown as WorkspaceStore;
    });

    it('opens a class of the tree and reports when it does not exist', async () => {
      expect(await executeSimpleTool('open_class', { nodeId: 'abc' }, workspace)).toEqual({ opened: true });
      expect(openClass).toHaveBeenCalledWith('abc');
      openClass.mockResolvedValue(false);
      expect(await executeSimpleTool('open_class', { nodeId: 'x' }, workspace)).toMatchObject({ opened: false });
    });

    it('selects slides and elements that exist', async () => {
      expect(await executeSimpleTool('select_slide', { slideId: 'sl1' }, workspace)).toEqual({ selected: true });
      expect(selectSlide).toHaveBeenCalledWith('sl1');
      expect(await executeSimpleTool('select_slide', { slideId: 'nope' }, workspace)).toMatchObject({ selected: false });
      expect(await executeSimpleTool('select_element', { elementId: 'el1' }, workspace)).toEqual({ selected: true });
      expect(selectElement).toHaveBeenCalledWith('el1');
    });

    it('filters the tree by status and text and shows the explorer', async () => {
      panels.left = null;
      expect(await executeSimpleTool('filter_tree', { status: 'no_content', text: 'abc' }, workspace)).toEqual({ applied: true });
      expect(setFilters).toHaveBeenCalledWith({ status: 'no_content', text: 'abc' });
      expect(panels.left).toBe('explorer');
      await executeSimpleTool('filter_tree', { status: 'invalid' }, workspace);
      expect(setFilters).toHaveBeenLastCalledWith({});
    });

    it('opens panels by name and needs a class for the component groups', async () => {
      expect(await executeSimpleTool('open_panel', { panel: 'timeline' }, workspace)).toEqual({ opened: true });
      expect(panels.bottom).toBe('timeline');
      expect(await executeSimpleTool('open_panel', { panel: 'nope' }, workspace)).toMatchObject({ opened: false });
    });

    it('starts the preview of a class with slides', async () => {
      expect(await executeSimpleTool('start_preview', {}, workspace)).toEqual({ started: true });
      expect(workspace.previewOpen.value).toBe(true);
    });

    it('answers an error for an unknown tool', async () => {
      expect(await executeSimpleTool('unknown', {}, workspace)).toHaveProperty('error');
    });
  });
});
