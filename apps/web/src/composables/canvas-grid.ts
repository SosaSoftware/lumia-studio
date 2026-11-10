import { reactive, watch } from 'vue';

/** Side of a grid cell in `cqw`: the slide is 16 cells wide and 9 cells tall. */
export const GRID_SIZE = 6.25;

export const GRID_KEY = 'lumia.studio.canvas-grid';

function readGrid(storage: Storage = localStorage): boolean {
  try {
    return storage.getItem(GRID_KEY) === 'true';
  } catch {
    // An unreadable value means the grid stays hidden.
    return false;
  }
}

/** Whether the editor canvas shows the grid, remembered in `localStorage`: an editing aid of the person. */
export const canvasGrid = reactive({ visible: readGrid() });

watch(
  () => canvasGrid.visible,
  (visible) => {
    try {
      localStorage.setItem(GRID_KEY, String(visible));
    } catch {
      // Not persisting the grid is harmless.
    }
  },
);
