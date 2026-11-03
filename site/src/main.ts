/** Entry point: theme, sound controls, math, and every widget on the page. */
import './styles/main.css';
import { initTheme } from './ui/theme';
import { initSoundControls } from './ui/sound';
import { initChapterMenu } from './ui/chapters';
import { caterpillar, halving, knuth16, staircase, tree8 } from './engine/examples';
import { runAlgorithmH } from './engine/algorithmH';
import { basicRowLayout, genericLayout, halvingLayout, knuth16Layout, staircaseLayout, tree8Layout } from './widgets/layouts';
import { mountStepper } from './widgets/stepper';
import { mountRoundsChart } from './widgets/roundsChart';
import { mountSolitaire } from './widgets/solitaire';
import { mountKnuthMatrices } from './widgets/knuthMatrices';
import { mountHyperbola } from './widgets/hyperbola';
import { mountStaircase } from './widgets/staircase';
import { mountSplice } from './widgets/splice';
import { mountSixPair } from './widgets/sixPair';
import { mountCatalog } from './widgets/catalog';

const $ = (id: string) => document.getElementById(id)!;

initTheme($('theme-toggle') as HTMLButtonElement);
initSoundControls($('sound-toggle') as HTMLButtonElement, $('volume') as HTMLInputElement);

const g5 = staircase(5);
const g7 = staircase(7);
const half4 = halving(4);
const cat4 = caterpillar(4);

mountRoundsChart($('w-rounds'));

const stepper = mountStepper($('w-stepper'), [
  { id: 'g5', name: 'The 9-pair staircase graph Γ₅', graph: g5, layout: staircaseLayout(g5),
    blurb: 'Five rounds, one SAP each. A Tchoukaillon graph with s = 9 would need only four.' },
  { id: 'g7', name: 'Staircase graph Γ₇ (s = 16)', graph: g7, layout: staircaseLayout(g7, 0.9),
    blurb: 'Seven rounds at s = 16, one more than a Tchoukaillon graph.' },
  { id: 'knuth16', name: 'Knuth’s 16-pair graph', graph: knuth16, layout: knuth16Layout(),
    blurb: 'Girls carry Knuth’s logical names. The run follows the schedule 8, 5, 3, 2, 1, 0.' },
  { id: 'tree8', name: 'An 8-pair tree: two free girls, one SAP', graph: tree8, layout: tree8Layout(),
    blurb: 'After the round at level 2, two girls are free but only one SAP exists: the numbers follow the Tchoukaillon schedule for s = 8, but not with f disjoint SAPs in every round (chapter 2).' },
  { id: 'half4', name: 'Halving graph, f = 4 (chapter 5)', graph: half4, layout: halvingLayout(half4),
    blurb: 'Built so that every augmenting path always has the current shortest level, the property of chapter 5; the free girls go 4, 2, 1, 0.' },
  { id: 'cat4', name: 'Caterpillar tree, K = 4', graph: cat4, layout: genericLayout(cat4),
    blurb: 'Paths joined into one tree by links that never enter a dag. Path k has a single augmenting path, of level k, and the round at level k completes it.' },
]);

mountSolitaire($('w-solitaire'));
mountKnuthMatrices($('w-knuth'));
mountHyperbola($('w-hyperbola'));
mountStaircase($('w-staircase'));
mountSplice($('w-splice'));
mountSixPair($('w-sixpair'));
mountCatalog($('w-catalog'), (s, g) => {
  const run = runAlgorithmH(g, false);
  const layout = basicRowLayout(g, run.initialMatching, run.finalMatching) ?? genericLayout(g);
  stepper.loadGraph(g, `Computed realization, s = ${s}`, layout,
    'Each row is a basic path: a girl left free by H1, then alternately couples of the final matching (cells) and of the H1 matching.');
  $('w-stepper').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

mountStepper($('w-sandbox'), [{ id: 'tree8', name: 'The 8-pair tree', graph: tree8, layout: genericLayout(tree8) }], {
  editable: true,
  initialText: [
    '# One line per girl: her boys, in the order of her list.',
    '# A line with just - is a girl with an empty list.',
    '5 7', '3 5', '3', '1', '1 2', '3 4', '5 2 6', '7 8',
  ].join('\n'),
});

initChapterMenu();
