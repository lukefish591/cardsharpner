// Hand history parser (ported from Python hand_replayer.py)

import { HandReplay, PlayerState, ActionStep } from '../types/poker';

export class HandHistoryParser {
  private positions6max = ['Button', 'Small Blind', 'Big Blind', 'UTG', 'Hijack', 'Cutoff'];

  parseHandForReplay(handText: string): HandReplay | null {
    try {
      const handId = this.extractHandId(handText);
      const timestamp = this.extractTimestamp(handText);
      const tableName = this.extractTableName(handText);
      const stakes = this.extractStakes(handText);
      const buttonSeat = this.extractButtonSeat(handText);

      const players = this.extractPlayers(handText, buttonSeat);
      const { boardCards, flopCards, turnCard, riverCard } = this.extractBoardCards(handText);
      const actions = this.extractAllActions(handText, players);
      const { finalPot, rake, jackpot } = this.extractPotInfo(handText);
      const { winner, winningHand } = this.extractWinner(handText);

      return {
        handId,
        timestamp,
        tableName,
        stakes,
        buttonSeat,
        players,
        actions,
        finalPot,
        rake,
        jackpot,
        winner,
        winningHand,
        boardCards,
        flopCards,
        turnCard,
        riverCard,
      };
    } catch (error) {
      console.error('Error parsing hand:', error);
      return null;
    }
  }

  private extractHandId(handText: string): string {
    const match = handText.match(/Poker Hand #([A-Z0-9-]+)/);
    return match ? match[1] : '';
  }

  private extractTimestamp(handText: string): Date {
    const match = handText.match(/(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/);
    if (match) {
      const [datePart, timePart] = match[1].split(' ');
      const [year, month, day] = datePart.split('/');
      return new Date(`${year}-${month}-${day}T${timePart}`);
    }
    return new Date();
  }

  private extractTableName(handText: string): string {
    const match = handText.match(/Table '([^']+)'/);
    return match ? match[1] : '';
  }

  private extractStakes(handText: string): string {
    const match = handText.match(/\((\$[\d.]+\/\$[\d.]+)\)/);
    return match ? match[1] : '';
  }

  private extractButtonSeat(handText: string): number {
    const match = handText.match(/Seat #(\d+) is the button/);
    return match ? parseInt(match[1]) : 1;
  }

  private calculatePosition(seat: number, buttonSeat: number, numPlayers: number): string {
    const offset = (seat - buttonSeat) % numPlayers;
    return this.positions6max[Math.min(offset, this.positions6max.length - 1)];
  }

  private extractPlayers(handText: string, buttonSeat: number): PlayerState[] {
    const players: PlayerState[] = [];
    const lines = handText.split('\n');

    // Extract player seats and stacks
    for (const line of lines) {
      if (line.startsWith('Seat ') && line.includes('in chips')) {
        const match = line.match(/Seat (\d+): ([^(]+) \(\$([\d.]+) in chips\)/);
        if (match) {
          const seat = parseInt(match[1]);
          const name = match[2].trim();
          const stack = parseFloat(match[3]);
          const isHero = name === 'Hero';

          const position = this.calculatePosition(seat, buttonSeat, players.length + 1);

          players.push({
            name,
            seat,
            stack,
            position,
            holeCards: [],
            isHero,
            isActive: true,
            isAllIn: false,
            currentBet: 0,
            totalInvested: 0,
            cardsVisible: false,
          });
        }
      }
    }

    // Extract hole cards
    let inHoleCards = false;
    for (const line of lines) {
      if (line.includes('*** HOLE CARDS ***')) {
        inHoleCards = true;
        continue;
      } else if (line.startsWith('***') && inHoleCards) {
        break;
      }

      if (inHoleCards && line.includes('Dealt to')) {
        const match = line.match(/Dealt to ([^\[]+)\s*\[([^\]]*)\]/);
        if (match) {
          const playerName = match[1].trim();
          const cardsStr = match[2].trim();

          const player = players.find((p) => p.name === playerName);
          if (player && cardsStr) {
            player.holeCards = cardsStr.split(' ');
            if (player.isHero) {
              player.cardsVisible = true;
            }
          }
        }
      }
    }

    return players;
  }

  private extractBoardCards(handText: string) {
    let boardCards: string[] = [];
    let flopCards: string[] = [];
    let turnCard = '';
    let riverCard = '';

    // Flop
    const flopMatch = handText.match(/\*\*\* (?:FIRST )?FLOP \*\*\*\s*\[([^\]]+)\]/i);
    if (flopMatch) {
      flopCards = flopMatch[1].trim().split(' ');
      boardCards = [...flopCards];
    }

    // Turn
    const turnMatch = handText.match(/\*\*\* (?:FIRST )?TURN \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]/i);
    if (turnMatch) {
      turnCard = turnMatch[1].trim();
      boardCards.push(turnCard);
    }

    // River
    const riverMatch = handText.match(/\*\*\* (?:FIRST )?RIVER \*\*\*\s*\[[^\]]+\]\s*\[([^\]]+)\]/i);
    if (riverMatch) {
      riverCard = riverMatch[1].trim();
      boardCards.push(riverCard);
    }

    return { boardCards, flopCards, turnCard, riverCard };
  }

  private extractAllActions(handText: string, players: PlayerState[]): ActionStep[] {
    const actions: ActionStep[] = [];
    const lines = handText.split('\n');
    let currentStreet: ActionStep['street'] = 'preflop';
    let potSize = 0;
    let actionNumber = 0;
    let currentBoard: string[] = [];

    const streetBets: { [key: string]: number } = {};
    players.forEach((p) => (streetBets[p.name] = 0));

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect street changes
      if (trimmed.includes('*** FLOP ***') || trimmed.includes('*** FIRST FLOP ***')) {
        currentStreet = 'flop';
        const match = trimmed.match(/\[([^\]]+)\]/);
        if (match) {
          currentBoard = match[1].trim().split(' ');
        }
        players.forEach((p) => (streetBets[p.name] = 0));
        continue;
      } else if (trimmed.includes('*** TURN ***') || trimmed.includes('*** FIRST TURN ***')) {
        currentStreet = 'turn';
        const match = trimmed.match(/\[[^\]]+\]\s*\[([^\]]+)\]/);
        if (match) {
          currentBoard.push(match[1].trim());
        }
        players.forEach((p) => (streetBets[p.name] = 0));
        continue;
      } else if (trimmed.includes('*** RIVER ***') || trimmed.includes('*** FIRST RIVER ***')) {
        currentStreet = 'river';
        const match = trimmed.match(/\[[^\]]+\]\s*\[([^\]]+)\]/);
        if (match) {
          currentBoard.push(match[1].trim());
        }
        players.forEach((p) => (streetBets[p.name] = 0));
        continue;
      } else if (trimmed.includes('*** SHOWDOWN ***')) {
        currentStreet = 'showdown';
        continue;
      } else if (trimmed.includes('*** SUMMARY ***')) {
        break;
      }

      // Parse actions
      if (
        trimmed.includes(':') &&
        (trimmed.includes('folds') ||
          trimmed.includes('calls') ||
          trimmed.includes('raises') ||
          trimmed.includes('bets') ||
          trimmed.includes('checks') ||
          trimmed.includes('posts') ||
          trimmed.includes('collected'))
      ) {
        const colonIndex = trimmed.indexOf(':');
        const playerName = trimmed.substring(0, colonIndex).trim();
        const actionText = trimmed.substring(colonIndex + 1).trim();

        const player = players.find((p) => p.name === playerName);
        if (!player) continue;

        let actionType: ActionStep['actionType'] = 'check';
        let amount = 0;
        let description = '';

        if (actionText.includes('posts small blind')) {
          actionType = 'post';
          const match = actionText.match(/\$([\d.]+)/);
          if (match) {
            amount = parseFloat(match[1]);
            streetBets[playerName] = amount;
            potSize += amount;
          }
          description = `posts small blind $${amount.toFixed(2)}`;
        } else if (actionText.includes('posts big blind')) {
          actionType = 'post';
          const match = actionText.match(/\$([\d.]+)/);
          if (match) {
            amount = parseFloat(match[1]);
            streetBets[playerName] = amount;
            potSize += amount;
          }
          description = `posts big blind $${amount.toFixed(2)}`;
        } else if (actionText.includes('folds')) {
          actionType = 'fold';
          description = 'folds';
        } else if (actionText.includes('calls')) {
          actionType = 'call';
          const match = actionText.match(/calls \$([\d.]+)/);
          if (match) {
            amount = parseFloat(match[1]);
            streetBets[playerName] += amount;
            potSize += amount;
          }
          description = `calls $${amount.toFixed(2)}`;
        } else if (actionText.includes('raises')) {
          actionType = 'raise';
          const match = actionText.match(/raises \$([\d.]+) to \$([\d.]+)/);
          if (match) {
            amount = parseFloat(match[1]);
            const totalRaise = parseFloat(match[2]);
            streetBets[playerName] = totalRaise;
            potSize += amount;
            description = `raises to $${totalRaise.toFixed(2)}`;
          }
        } else if (actionText.includes('bets')) {
          actionType = 'bet';
          const match = actionText.match(/bets \$([\d.]+)/);
          if (match) {
            amount = parseFloat(match[1]);
            streetBets[playerName] = amount;
            potSize += amount;
          }
          description = `bets $${amount.toFixed(2)}`;
        } else if (actionText.includes('checks')) {
          actionType = 'check';
          description = 'checks';
        } else if (actionText.includes('collected')) {
          actionType = 'collect';
          const match = actionText.match(/collected \$([\d.]+)/);
          if (match) {
            amount = parseFloat(match[1]);
          }
          description = `collected $${amount.toFixed(2)}`;
        }

        if (actionType) {
          actionNumber++;
          actions.push({
            actionNumber,
            street: currentStreet,
            player: playerName,
            seat: player.seat,
            actionType,
            amount,
            totalBet: streetBets[playerName],
            potBefore: potSize - amount,
            potAfter: potSize,
            description,
            boardCards: [...currentBoard],
          });
        }
      }

      // Handle uncalled bets
      if (trimmed.includes('Uncalled bet') && trimmed.includes('returned to')) {
        const match = trimmed.match(/Uncalled bet \$([\d.]+) returned to ([^$]+)/);
        if (match) {
          const amount = parseFloat(match[1]);
          const playerName = match[2].trim();
          potSize -= amount;

          const player = players.find((p) => p.name === playerName);
          if (player) {
            actionNumber++;
            actions.push({
              actionNumber,
              street: currentStreet,
              player: playerName,
              seat: player.seat,
              actionType: 'return',
              amount,
              totalBet: 0,
              potBefore: potSize + amount,
              potAfter: potSize,
              description: `uncalled bet $${amount.toFixed(2)} returned`,
              boardCards: [...currentBoard],
            });
          }
        }
      }
    }

    return actions;
  }

  private extractPotInfo(handText: string) {
    let finalPot = 0;
    let rake = 0;
    let jackpot = 0;

    const potMatch = handText.match(/Total pot \$([\d.]+)/);
    if (potMatch) {
      finalPot = parseFloat(potMatch[1]);
    }

    const rakeMatch = handText.match(/Rake \$([\d.]+)/);
    if (rakeMatch) {
      rake = parseFloat(rakeMatch[1]);
    }

    const jackpotMatch = handText.match(/Jackpot \$([\d.]+)/);
    if (jackpotMatch) {
      jackpot = parseFloat(jackpotMatch[1]);
    }

    return { finalPot, rake, jackpot };
  }

  private extractWinner(handText: string) {
    let winner = '';
    let winningHand = '';

    const summaryIndex = handText.indexOf('*** SUMMARY ***');
    if (summaryIndex !== -1) {
      const summaryText = handText.substring(summaryIndex);
      const lines = summaryText.split('\n');

      for (const line of lines) {
        if (line.includes('won') && line.includes('$')) {
          const match = line.match(/Seat \d+: ([^(]+).*?(?:with|showed) \[?([^\]]*)\]?.*?won/);
          if (match) {
            winner = match[1].trim();
            winningHand = match[2] ? match[2].trim() : '';
            break;
          } else {
            const simpleMatch = line.match(/Seat \d+: ([^(]+).*?won/);
            if (simpleMatch) {
              winner = simpleMatch[1].trim();
              break;
            }
          }
        }
      }
    }

    return { winner, winningHand };
  }

  getStateAtAction(replay: HandReplay, actionIndex: number) {
    const playerStates: { [key: string]: PlayerState } = {};

    replay.players.forEach((player) => {
      playerStates[player.name] = {
        ...player,
        currentBet: 0,
        totalInvested: 0,
        isActive: true,
      };
    });

    let pot = 0;
    let currentStreet: string = 'preflop';
    let boardCards: string[] = [];

    for (let i = 0; i < actionIndex && i < replay.actions.length; i++) {
      const action = replay.actions[i];
      currentStreet = action.street;
      boardCards = action.boardCards;

      const playerState = playerStates[action.player];

      if (action.actionType === 'fold') {
        playerState.isActive = false;
      } else if (['call', 'bet', 'raise', 'post'].includes(action.actionType)) {
        playerState.stack -= action.amount;
        playerState.currentBet = action.totalBet;
        playerState.totalInvested += action.amount;
      } else if (action.actionType === 'collect') {
        playerState.stack += action.amount;
      } else if (action.actionType === 'return') {
        playerState.stack += action.amount;
      }

      pot = action.potAfter;
    }

    const currentAction = actionIndex < replay.actions.length ? replay.actions[actionIndex] : null;

    return {
      players: Object.values(playerStates),
      pot,
      street: currentStreet,
      boardCards,
      currentAction,
      actionIndex,
      totalActions: replay.actions.length,
    };
  }
}

