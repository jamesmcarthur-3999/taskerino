/**
 * Matrix Patterns - Animation patterns for matrix grid
 */

export interface PatternConfig {
  type: 'tetris' | 'wave' | 'spiral' | 'cascade';
  speed: 'slow' | 'medium' | 'fast';
  cycleMs: number;
}

export type MatrixPattern = 'tetris' | 'wave' | 'spiral' | 'cascade';
export type AnimationSpeed = 'slow' | 'medium' | 'fast';

/**
 * Speed to cycle time mapping (in milliseconds)
 */
const SPEED_CYCLES = {
  slow: 1200,
  medium: 1000,
  fast: 800,
} as const;

/**
 * Get cycle duration for a given speed
 */
export function getCycleDuration(speed: AnimationSpeed): number {
  return SPEED_CYCLES[speed];
}

// ============================================================================
// TETRIS TETROMINO DEFINITIONS
// ============================================================================

type TetrominoType = 'I' | 'O' | 'T' | 'L' | 'J' | 'S' | 'Z';

interface TetrominoShape {
  type: TetrominoType;
  cells: [number, number][]; // [row, col] offsets from anchor
}

// Classic Tetris piece shapes (in 0° rotation)
const TETROMINOS: Record<TetrominoType, [number, number][]> = {
  I: [[0, 0], [0, 1], [0, 2], [0, 3]], // Horizontal line
  O: [[0, 0], [0, 1], [1, 0], [1, 1]], // 2x2 square
  T: [[0, 1], [1, 0], [1, 1], [1, 2]], // T-shape
  L: [[0, 0], [1, 0], [2, 0], [2, 1]], // L-shape
  J: [[0, 1], [1, 1], [2, 0], [2, 1]], // J-shape
  S: [[0, 1], [0, 2], [1, 0], [1, 1]], // S-shape
  Z: [[0, 0], [0, 1], [1, 1], [1, 2]], // Z-shape
};

// Rotate piece 90° clockwise
function rotateTetromino(cells: [number, number][]): [number, number][] {
  return cells.map(([r, c]) => [c, -r] as [number, number]);
}

// Get rotated piece (0, 90, 180, 270 degrees)
function getRotatedPiece(type: TetrominoType, rotations: number): [number, number][] {
  let cells = TETROMINOS[type];
  for (let i = 0; i < rotations % 4; i++) {
    cells = rotateTetromino(cells);
  }
  return cells;
}

// Normalize piece coordinates (ensure all offsets are positive)
function normalizePiece(cells: [number, number][]): [number, number][] {
  const minRow = Math.min(...cells.map(([r]) => r));
  const minCol = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minRow, c - minCol] as [number, number]);
}

/**
 * Tetris Pattern: REAL falling tetromino pieces that rotate and stack
 *
 * @param rows - Number of rows in grid
 * @param cols - Number of columns in grid
 * @param progress - Animation progress (0-1)
 * @returns Array of cell states (0 = empty, 1 = active/falling, 2 = settled)
 */
export function tetrisPattern(rows: number, cols: number, progress: number): number[][] {
  const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));

  // Early stages: empty grid
  if (progress < 0.05) {
    return grid;
  }

  // Completion stage: full grid with pulse
  if (progress >= 0.95) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        grid[r][c] = 2; // All settled
      }
    }
    return grid;
  }

  // Active phase: pieces falling and stacking (0.05 - 0.95)
  const activeProgress = (progress - 0.05) / 0.9; // Normalize to 0-1

  // Determine how many pieces should be fully settled
  const totalPiecesNeeded = Math.ceil((rows * cols) / 4); // ~4 cells per piece
  const settledPiecesCount = Math.floor(activeProgress * totalPiecesNeeded);

  // Sequence of pieces (deterministic based on grid)
  const pieceSequence: TetrominoType[] = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];

  // Place settled pieces (bottom-up stacking)
  let cellsOccupied = 0;
  const occupiedCells = new Set<string>(); // "row,col" format

  for (let pieceIndex = 0; pieceIndex < settledPiecesCount; pieceIndex++) {
    const type = pieceSequence[pieceIndex % pieceSequence.length];
    const rotation = pieceIndex % 4; // Rotate progressively
    let pieceCells = normalizePiece(getRotatedPiece(type, rotation));

    // Find landing position (search from bottom up)
    let placed = false;
    for (let baseRow = rows - 1; baseRow >= 0 && !placed; baseRow--) {
      for (let baseCol = 0; baseCol <= cols - 3 && !placed; baseCol++) {
        // Check if piece can fit here
        const canFit = pieceCells.every(([r, c]) => {
          const absRow = baseRow + r;
          const absCol = baseCol + c;
          return (
            absRow >= 0 && absRow < rows &&
            absCol >= 0 && absCol < cols &&
            !occupiedCells.has(`${absRow},${absCol}`)
          );
        });

        if (canFit) {
          // Check if piece is resting on bottom or other pieces
          const isResting = pieceCells.some(([r, c]) => {
            const absRow = baseRow + r;
            return absRow === rows - 1 || occupiedCells.has(`${absRow + 1},${baseCol + c}`);
          });

          if (isResting) {
            // Place the piece
            pieceCells.forEach(([r, c]) => {
              const absRow = baseRow + r;
              const absCol = baseCol + c;
              grid[absRow][absCol] = 2; // Settled
              occupiedCells.add(`${absRow},${absCol}`);
            });
            placed = true;
          }
        }
      }
    }
  }

  // Add currently falling piece (animated)
  if (settledPiecesCount < totalPiecesNeeded) {
    const fallingType = pieceSequence[settledPiecesCount % pieceSequence.length];
    const fallingRotation = settledPiecesCount % 4;
    const fallingCells = normalizePiece(getRotatedPiece(fallingType, fallingRotation));

    // Interpolate falling animation
    const pieceProgress = (activeProgress * totalPiecesNeeded) % 1;
    const startRow = -2; // Start above grid
    const endRow = rows - 2; // End near bottom
    const currentRow = Math.floor(startRow + pieceProgress * (endRow - startRow));
    const currentCol = Math.floor((settledPiecesCount * 3) % (cols - 3)); // Shift column per piece

    // Draw falling piece (if in bounds)
    fallingCells.forEach(([r, c]) => {
      const absRow = currentRow + r;
      const absCol = currentCol + c;
      if (
        absRow >= 0 && absRow < rows &&
        absCol >= 0 && absCol < cols &&
        !occupiedCells.has(`${absRow},${absCol}`)
      ) {
        grid[absRow][absCol] = 1; // Active/falling
      }
    });
  }

  return grid;
}

/**
 * Wave Pattern: Animated wave effect across the grid
 */
export function wavePattern(rows: number, cols: number, progress: number): number[][] {
  const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));
  const wavePosition = progress * (cols + rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellPosition = row + col;
      const distance = Math.abs(cellPosition - wavePosition);

      if (distance < 2) {
        grid[row][col] = 1; // Active
      } else if (cellPosition < wavePosition) {
        grid[row][col] = 2; // Settled
      }
    }
  }

  return grid;
}

/**
 * Cascade Pattern: Diagonal cascade from top-left to bottom-right
 */
export function cascadePattern(rows: number, cols: number, progress: number): number[][] {
  const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));
  const maxDiagonal = rows + cols - 2;
  const currentDiagonal = Math.floor(progress * maxDiagonal);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const diagonal = row + col;

      if (diagonal < currentDiagonal) {
        grid[row][col] = 2; // Settled
      } else if (diagonal === currentDiagonal) {
        grid[row][col] = 1; // Active
      }
    }
  }

  return grid;
}

/**
 * Spiral Pattern: Spiral from outside to center
 */
export function spiralPattern(rows: number, cols: number, progress: number): number[][] {
  const grid: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));
  const totalCells = rows * cols;
  const filledCells = Math.floor(totalCells * progress);

  let top = 0, bottom = rows - 1, left = 0, right = cols - 1;
  let cellCount = 0;

  while (top <= bottom && left <= right && cellCount < filledCells) {
    // Top row
    for (let col = left; col <= right && cellCount < filledCells; col++) {
      grid[top][col] = cellCount < filledCells - 3 ? 2 : 1;
      cellCount++;
    }
    top++;

    // Right column
    for (let row = top; row <= bottom && cellCount < filledCells; row++) {
      grid[row][right] = cellCount < filledCells - 3 ? 2 : 1;
      cellCount++;
    }
    right--;

    // Bottom row
    if (top <= bottom) {
      for (let col = right; col >= left && cellCount < filledCells; col--) {
        grid[bottom][col] = cellCount < filledCells - 3 ? 2 : 1;
        cellCount++;
      }
      bottom--;
    }

    // Left column
    if (left <= right) {
      for (let row = bottom; row >= top && cellCount < filledCells; row--) {
        grid[row][left] = cellCount < filledCells - 3 ? 2 : 1;
        cellCount++;
      }
      left++;
    }
  }

  return grid;
}

/**
 * Get pattern function by name
 */
export function getPattern(pattern: MatrixPattern): (rows: number, cols: number, progress: number) => number[][] {
  switch (pattern) {
    case 'tetris':
      return tetrisPattern;
    case 'wave':
      return wavePattern;
    case 'cascade':
      return cascadePattern;
    case 'spiral':
      return spiralPattern;
    default:
      return tetrisPattern;
  }
}
