// Poker hand replayer types (ported from Python)

export interface PlayerState {
  name: string;
  seat: number;
  stack: number;
  position: string;
  holeCards: string[];
  isHero: boolean;
  isActive: boolean;
  isAllIn: boolean;
  currentBet: number;
  totalInvested: number;
  cardsVisible: boolean;
}

export interface ActionStep {
  actionNumber: number;
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  player: string;
  seat: number;
  actionType: 'fold' | 'call' | 'raise' | 'bet' | 'check' | 'post' | 'collect' | 'return';
  amount: number;
  totalBet: number;
  potBefore: number;
  potAfter: number;
  description: string;
  boardCards: string[];
}

export interface HandReplay {
  handId: string;
  timestamp: Date;
  tableName: string;
  stakes: string;
  buttonSeat: number;
  players: PlayerState[];
  actions: ActionStep[];
  finalPot: number;
  rake: number;
  jackpot: number;
  winner: string;
  winningHand: string;
  boardCards: string[];
  flopCards: string[];
  turnCard: string;
  riverCard: string;
}

export interface GameState {
  players: PlayerState[];
  pot: number;
  street: string;
  boardCards: string[];
  currentAction: ActionStep | null;
  actionIndex: number;
  totalActions: number;
}

