import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Header } from '../Header';
import { ControlPanel } from '../ControlPanel';
import { VoteTable } from '../VoteTable';
import { ArenaCanvas } from '../ArenaCanvas';
import { QueryResult } from '../../knn/types';

// Strip React SSR comment markers for clean text assertions
function cleanHtml(rawHtml: string): string {
  return rawHtml.replace(/<!--.*?-->/g, '');
}

describe('Redesigned UI Components', () => {
  it('renders Header with compact branding and version badge', () => {
    const html = cleanHtml(renderToString(<Header />));
    expect(html).toContain('KNN Arena');
    expect(html).toContain('kNN vs wkNN');
    expect(html).toContain('v1.2 Desktop');
    expect(html).toContain('Guide &amp; Math');
  });

  it('renders ControlPanel in Play mode with all controls', () => {
    const mockScores = {
      You: { correct: 3, total: 4 },
      kNN: { correct: 2, total: 4 },
      wkNN: { correct: 4, total: 4 },
    };

    const html = cleanHtml(
      renderToString(
        <ControlPanel
          mode="play"
          onSetMode={() => {}}
          dataset="Moons (2)"
          onSelectDataset={() => {}}
          noise={10}
          onSetNoise={() => {}}
          hardMode={true}
          onSetHardMode={() => {}}
          onNextRound={() => {}}
          onNewData={() => {}}
          onResetScores={() => {}}
          scores={mockScores}
          levelIndex={0}
          onSelectLevel={() => {}}
          onPrevLevel={() => {}}
          onNextLevel={() => {}}
          onUndoWedge={() => {}}
          onResetLevel={() => {}}
          onHint={() => {}}
          wedgeStars={{}}
          placedCount={0}
          par={1}
          brush={0}
          onSelectBrush={() => {}}
          currentPreds={null}
          k={7}
          onSetK={() => {}}
          metric="euclidean"
          onSetMetric={() => {}}
          scheme="inverse"
          onSetScheme={() => {}}
          boundary="none"
          onSetBoundary={() => {}}
          C={2}
          onClassClick={() => {}}
          statusText="Guess the mystery star class"
        />
      )
    );

    // Segmented mode buttons
    expect(html).toContain('Play');
    expect(html).toContain('Sandbox');
    expect(html).toContain('Wedge Puzzles');

    // Dataset and Noise
    expect(html).toContain('Moons (2)');
    expect(html).toContain('10%');

    // Hard mode
    expect(html).toContain('Prioritize contested / disagreement points');

    // Actions
    expect(html).toContain('Next (Space)');
    expect(html).toContain('New Data');
    expect(html).toContain('Reset Scores');

    // Scoreboard
    expect(html).toContain('SCOREBOARD');
    expect(html).toContain('75%');
    expect(html).toContain('100%');

    // Hyperparameters
    expect(html).toContain('k (Neighbours)');
    expect(html).toContain('Euclidean (L2)');
    expect(html).toContain('1 / distance');

    // Background boundary options
    expect(html).toContain('Diff (!)');

    // Class buttons
    expect(html).toContain('[1] Fire');
    expect(html).toContain('[2] Water');
  });

  it('renders ControlPanel in Wedge mode with level telemetry and brush', () => {
    const html = cleanHtml(
      renderToString(
        <ControlPanel
          mode="wedge"
          onSetMode={() => {}}
          dataset="Moons (2)"
          onSelectDataset={() => {}}
          noise={0}
          onSetNoise={() => {}}
          hardMode={false}
          onSetHardMode={() => {}}
          onNextRound={() => {}}
          onNewData={() => {}}
          onResetScores={() => {}}
          scores={{
            You: { correct: 0, total: 0 },
            kNN: { correct: 0, total: 0 },
            wkNN: { correct: 0, total: 0 },
          }}
          levelIndex={0}
          onSelectLevel={() => {}}
          onPrevLevel={() => {}}
          onNextLevel={() => {}}
          onUndoWedge={() => {}}
          onResetLevel={() => {}}
          onHint={() => {}}
          wedgeStars={{ 0: 3 }}
          placedCount={1}
          par={1}
          brush={0}
          onSelectBrush={() => {}}
          currentPreds={{ pk: 0, pw: 1 }}
          k={3}
          onSetK={() => {}}
          metric="euclidean"
          onSetMetric={() => {}}
          scheme="inverse"
          onSetScheme={() => {}}
          boundary="none"
          onSetBoundary={() => {}}
          C={2}
          onClassClick={() => {}}
          statusText="Placed Fire at d = 1.25"
        />
      )
    );

    // Level Header and Par
    expect(html).toContain('Level 1 of 7');
    expect(html).toContain('Close Call');
    expect(html).toContain('Par 1');
    expect(html).toContain('Protected Radius');

    // Actions
    expect(html).toContain('Undo');
    expect(html).toContain('Reset');
    expect(html).toContain('Hint');

    // Locked indicator for hyperparameters in Wedge
    expect(html).toContain('Locked by Level');

    // Decision Regions are preserved and active in Wedge mode!
    expect(html).toContain('Decision Regions');
    expect(html).toContain('Diff (!)');
  });

  it('renders ControlPanel in Sandbox mode with clear user points action', () => {
    const html = cleanHtml(
      renderToString(
        <ControlPanel
          mode="sandbox"
          onSetMode={() => {}}
          dataset="Blobs (3)"
          onSelectDataset={() => {}}
          noise={0}
          onSetNoise={() => {}}
          hardMode={false}
          onSetHardMode={() => {}}
          onNextRound={() => {}}
          onNewData={() => {}}
          onResetScores={() => {}}
          scores={{
            You: { correct: 0, total: 0 },
            kNN: { correct: 0, total: 0 },
            wkNN: { correct: 0, total: 0 },
          }}
          levelIndex={0}
          onSelectLevel={() => {}}
          onPrevLevel={() => {}}
          onNextLevel={() => {}}
          onUndoWedge={() => {}}
          onResetLevel={() => {}}
          onHint={() => {}}
          wedgeStars={{}}
          placedCount={0}
          par={null}
          brush={0}
          onSelectBrush={() => {}}
          currentPreds={null}
          k={7}
          onSetK={() => {}}
          metric="euclidean"
          onSetMetric={() => {}}
          scheme="inverse"
          onSetScheme={() => {}}
          boundary="none"
          onSetBoundary={() => {}}
          C={3}
          onClassClick={() => {}}
          statusText="Click to probe"
          onClearUserPoints={() => {}}
          userPointsCount={2}
        />
      )
    );

    expect(html).toContain('Clear (2)');
    expect(html).toContain('Add Point to Dataset');
    expect(html).toContain('[1] Fire');
    expect(html).toContain('[2] Water');
    expect(html).toContain('[3] Sun');
  });

  it('renders VoteTable in standby mode and revealed mode with full breakdown', () => {
    // 1. Standby mode (unrevealed)
    const standbyHtml = cleanHtml(
      renderToString(
        <VoteTable
          query={null}
          revealed={false}
          ytr={[]}
          nBase={0}
          C={2}
          hoverInfo="Cursor d = 1.45"
          baseTotals={null}
          isWedge={false}
        />
      )
    );
    expect(standbyHtml).toContain('Cursor d = 1.45');
    expect(standbyHtml).toContain('Choose your answer above');

    // 2. Revealed mode
    const mockQuery: QueryResult = {
      idx: [0, 1, 2],
      d: [0.5, 1.2, 2.0],
      w: [2.0, 0.833, 0.5],
      Pk: [0.67, 0.33],
      Pw: [0.6, 0.4],
      pk: 0,
      pw: 0,
    };

    const revealedHtml = cleanHtml(
      renderToString(
        <VoteTable
          query={mockQuery}
          revealed={true}
          ytr={[0, 1, 0]}
          nBase={2}
          C={2}
          hoverInfo="Cursor d = 0.5"
          baseTotals={null}
          isWedge={false}
        />
      )
    );

    expect(revealedHtml).toContain('kNN:');
    expect(revealedHtml).toContain('wkNN:');
    expect(revealedHtml).toContain('Fire');
    expect(revealedHtml).toContain('0.500');
    expect(revealedHtml).toContain('yours (✦)');
    expect(revealedHtml).toContain('base');
  });

  it('renders ArenaCanvas container element with canvas and responsive flex classes', () => {
    const html = cleanHtml(
      renderToString(
        <ArenaCanvas
          mode="play"
          Xtr={[[0, 0], [1, 1]]}
          ytr={[0, 1]}
          nBase={2}
          C={2}
          focus={{ point: [0.5, 0.5], truth: 0 }}
          revealed={false}
          k={3}
          metric="euclidean"
          scheme="inverse"
          boundary="none"
          bounds={{ lo: [-3, -3], hi: [3, 3] }}
          cachedQuery={null}
          onCanvasClick={() => {}}
          onHoverMove={() => {}}
        />
      )
    );

    expect(html).toContain('<canvas');
    expect(html).toContain('cursor-crosshair');
    expect(html).toContain('min-h-[300px]');
  });
});
