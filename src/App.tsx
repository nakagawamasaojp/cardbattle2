import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Droplets,
  Leaf,
  Sword,
  Shield,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import './App.css';

type ElementType = 'fire' | 'water' | 'grass';

interface Card {
  id: string;
  weaponName: string;
  element: ElementType;
  attack: number;
}

interface Monster {
  name: string;
  hp: number;
  rank: 'C' | 'B' | 'A' | 'S';
}

interface BattleState {
  playerCard: Card;
  cpuCard: Card;
  playerBonus: number;
  cpuBonus: number;
  playerTotal: number;
  cpuTotal: number;
  outcome: 'win' | 'lose' | 'draw';
  damage: number;
}

const PLAYER_MAX_HP = 120;
const HAND_SIZE = 3;
const ELEMENT_BONUS = 25;

// ドラクエ風モンスター30種類（強さに応じてHP 50〜200）
const MONSTERS: Monster[] = [
  // Rank C (HP 50〜75)
  { name: 'スライム', hp: 50, rank: 'C' },
  { name: 'ドラキー', hp: 55, rank: 'C' },
  { name: 'おおありくい', hp: 60, rank: 'C' },
  { name: 'ホイミスライム', hp: 60, rank: 'C' },
  { name: 'がいこつ', hp: 65, rank: 'C' },
  { name: 'まほうつかい', hp: 65, rank: 'C' },
  { name: 'おばけきのこ', hp: 70, rank: 'C' },
  { name: 'リリパット', hp: 75, rank: 'C' },

  // Rank B (HP 80〜110)
  { name: 'スライムナイト', hp: 85, rank: 'B' },
  { name: 'キメラ', hp: 90, rank: 'B' },
  { name: 'ばくだんいわ', hp: 95, rank: 'B' },
  { name: 'おどるほうせき', hp: 95, rank: 'B' },
  { name: 'メタルスライム', hp: 80, rank: 'B' },
  { name: 'ミミック', hp: 100, rank: 'B' },
  { name: 'さまようよろい', hp: 105, rank: 'B' },
  { name: 'ベビーサタン', hp: 110, rank: 'B' },

  // Rank A (HP 120〜155)
  { name: 'ゴーレム', hp: 125, rank: 'A' },
  { name: 'キラーマシン', hp: 130, rank: 'A' },
  { name: 'アークデーモン', hp: 135, rank: 'A' },
  { name: 'うごくせきぞう', hp: 140, rank: 'A' },
  { name: 'ボストロール', hp: 145, rank: 'A' },
  { name: 'はぐれメタル', hp: 120, rank: 'A' },
  { name: 'しにがみきぞく', hp: 150, rank: 'A' },
  { name: 'ギガンテス', hp: 155, rank: 'A' },

  // Rank S (HP 170〜200)
  { name: 'キングスライム', hp: 170, rank: 'S' },
  { name: 'グレイトドラゴン', hp: 180, rank: 'S' },
  { name: 'バラモス', hp: 185, rank: 'S' },
  { name: 'ゾーマ', hp: 195, rank: 'S' },
  { name: 'りゅうおう', hp: 200, rank: 'S' },
  { name: 'ドラゴン', hp: 200, rank: 'S' },
];

const WEAPON_TEMPLATES: { name: string; element: ElementType; minAtk: number; maxAtk: number }[] = [
  { name: '紅蓮の大剣', element: 'fire', minAtk: 35, maxAtk: 55 },
  { name: 'フレイムランス', element: 'fire', minAtk: 30, maxAtk: 50 },
  { name: 'イフリートダガー', element: 'fire', minAtk: 25, maxAtk: 45 },
  { name: '蒼海のトライデント', element: 'water', minAtk: 35, maxAtk: 55 },
  { name: 'アクアセイバー', element: 'water', minAtk: 30, maxAtk: 50 },
  { name: 'ミストボウ', element: 'water', minAtk: 25, maxAtk: 45 },
  { name: '翠嵐の戦斧', element: 'grass', minAtk: 35, maxAtk: 55 },
  { name: 'リーフスピア', element: 'grass', minAtk: 30, maxAtk: 50 },
  { name: 'ソーンウィップ', element: 'grass', minAtk: 25, maxAtk: 45 },
];

// --- Web Audio API サウンドエンジン（SE & 軽快なバトルBGM） ---
class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmTimer: number | null = null;
  private step = 0;
  public isBgmPlaying = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 攻撃ヒット音（斬撃＋インパクト）
  playAttackSE(type: 'win' | 'lose' | 'draw') {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (type === 'win') {
      // 鋭い斬撃音（周波数スイープ）＋打撃音
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);

      // 追加のクリティカルヒット音
      const hitOsc = this.ctx.createOscillator();
      const hitGain = this.ctx.createGain();
      hitOsc.type = 'square';
      hitOsc.frequency.setValueAtTime(523.25, now + 0.08);
      hitOsc.frequency.setValueAtTime(783.99, now + 0.14);
      hitGain.gain.setValueAtTime(0.18, now + 0.08);
      hitGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      hitOsc.connect(hitGain);
      hitGain.connect(this.ctx.destination);
      hitOsc.start(now + 0.08);
      hitOsc.stop(now + 0.28);
    } else if (type === 'lose') {
      // 被ダメージ音（重低音ショック）
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.28);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // 引き分け（剣が弾き合う金属音）
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  }

  // 勝利・敗北ジングル
  playGameOverSE(isWin: boolean) {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = isWin ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 311.13, 261.63];

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.15, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.25);
    });
  }

  // カードバトルに合う軽快なチップチューンBGM
  startBgm() {
    this.initContext();
    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    this.step = 0;

    // 軽快なアップテンポ・メロディ（Aマイナー〜Cメジャー進行）
    const melody = [
      440, 0, 523.25, 659.25, 587.33, 523.25, 493.88, 392.0,
      440, 0, 523.25, 659.25, 783.99, 659.25, 587.33, 0,
      698.46, 659.25, 587.33, 523.25, 659.25, 587.33, 523.25, 493.88,
      440, 493.88, 523.25, 587.33, 659.25, 0, 783.99, 0,
    ];
    const bass = [
      220, 220, 220, 220, 196, 196, 196, 196,
      220, 220, 220, 220, 261.63, 261.63, 196, 196,
      174.61, 174.61, 174.61, 174.61, 164.81, 164.81, 164.81, 164.81,
      220, 220, 196, 196, 164.81, 164.81, 220, 0,
    ];

    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || !this.isBgmPlaying) return;
      const now = this.ctx.currentTime;
      const idx = this.step % melody.length;

      // メロディパート
      const mFreq = melody[idx];
      if (mFreq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(mFreq, now);
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      }

      // ベースパート
      const bFreq = bass[idx];
      if (bFreq > 0) {
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'triangle';
        bOsc.frequency.setValueAtTime(bFreq / 2, now);
        bGain.gain.setValueAtTime(0.07, now);
        bGain.gain.exponentialRampToValueAtTime(0.005, now + 0.15);
        bOsc.connect(bGain);
        bGain.connect(this.ctx.destination);
        bOsc.start(now);
        bOsc.stop(now + 0.15);
      }

      this.step++;
    }, 165);
  }

  stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

const soundEngine = new SoundEngine();

const getRandomMonster = (): Monster => {
  return MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
};

const drawRandomCard = (): Card => {
  const tpl = WEAPON_TEMPLATES[Math.floor(Math.random() * WEAPON_TEMPLATES.length)];
  const atk = Math.floor(Math.random() * (tpl.maxAtk - tpl.minAtk + 1)) + tpl.minAtk;
  return {
    id: Math.random().toString(36).substring(2, 9),
    weaponName: tpl.name,
    element: tpl.element,
    attack: atk,
  };
};

const createInitialHand = (): Card[] => Array.from({ length: HAND_SIZE }, drawRandomCard);

// 属性相性判定: 1 = aが有利, -1 = bが有利, 0 = あいこ
const checkAdvantage = (a: ElementType, b: ElementType): number => {
  if (a === b) return 0;
  if (
    (a === 'fire' && b === 'grass') ||
    (a === 'grass' && b === 'water') ||
    (a === 'water' && b === 'fire')
  ) {
    return 1;
  }
  return -1;
};

export default function App() {
  const [enemy, setEnemy] = useState<Monster>(() => getRandomMonster());
  const [cpuHp, setCpuHp] = useState<number>(() => enemy.hp);
  const [playerHp, setPlayerHp] = useState<number>(PLAYER_MAX_HP);

  const [playerHand, setPlayerHand] = useState<Card[]>(createInitialHand);
  const [cpuHand, setCpuHand] = useState<Card[]>(createInitialHand);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [logMessage, setLogMessage] = useState(`${enemy.name} があらわれた！手札から1枚選ぼう！`);
  const [shakeTarget, setShakeTarget] = useState<'player' | 'cpu' | null>(null);
  const [bgmOn, setBgmOn] = useState<boolean>(false);
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    return () => {
      soundEngine.stopBgm();
    };
  }, []);

  const toggleBgm = () => {
    hasInteractedRef.current = true;
    if (bgmOn) {
      soundEngine.stopBgm();
      setBgmOn(false);
    } else {
      soundEngine.startBgm();
      setBgmOn(true);
    }
  };

  const handleSelectCard = (selectedCard: Card) => {
    if (isAnimating || playerHp <= 0 || cpuHp <= 0) return;

    // 初回クリック時にBGMを自動スタート（ブラウザ制限対策）
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true;
      soundEngine.startBgm();
      setBgmOn(true);
    }

    setIsAnimating(true);

    // CPUの手札からランダムに1枚選択
    const cpuIndex = Math.floor(Math.random() * cpuHand.length);
    const cpuCard = cpuHand[cpuIndex];

    // 属性ボーナス計算
    const adv = checkAdvantage(selectedCard.element, cpuCard.element);
    const playerBonus = adv === 1 ? ELEMENT_BONUS : 0;
    const cpuBonus = adv === -1 ? ELEMENT_BONUS : 0;

    const playerTotal = selectedCard.attack + playerBonus;
    const cpuTotal = cpuCard.attack + cpuBonus;

    let outcome: 'win' | 'lose' | 'draw' = 'draw';
    let damage = 0;

    if (playerTotal > cpuTotal) {
      outcome = 'win';
      damage = playerTotal - cpuTotal;
      const nextCpuHp = Math.max(0, cpuHp - damage);
      setCpuHp(nextCpuHp);
      setShakeTarget('cpu');
      soundEngine.playAttackSE('win');
      setLogMessage(`${enemy.name} に ${damage} のダメージを与えた！`);

      if (nextCpuHp === 0) {
        setTimeout(() => soundEngine.playGameOverSE(true), 350);
      }
    } else if (cpuTotal > playerTotal) {
      outcome = 'lose';
      damage = cpuTotal - playerTotal;
      const nextPlayerHp = Math.max(0, playerHp - damage);
      setPlayerHp(nextPlayerHp);
      setShakeTarget('player');
      soundEngine.playAttackSE('lose');
      setLogMessage(`${enemy.name} の攻撃！ ${damage} のダメージを受けた！`);

      if (nextPlayerHp === 0) {
        setTimeout(() => soundEngine.playGameOverSE(false), 350);
      }
    } else {
      soundEngine.playAttackSE('draw');
      setLogMessage('互角の打ち合い！両者ダメージなし！');
    }

    setBattle({
      playerCard: selectedCard,
      cpuCard,
      playerBonus,
      cpuBonus,
      playerTotal,
      cpuTotal,
      outcome,
      damage,
    });

    // 使ったカードを補充して手札を3枚に保つ
    setTimeout(() => {
      setShakeTarget(null);
      setPlayerHand((prev) =>
        prev.map((c) => (c.id === selectedCard.id ? drawRandomCard() : c))
      );
      setCpuHand((prev) =>
        prev.map((c, idx) => (idx === cpuIndex ? drawRandomCard() : c))
      );
      setIsAnimating(false);
    }, 800);
  };

  const resetGame = () => {
    const nextEnemy = getRandomMonster();
    setEnemy(nextEnemy);
    setCpuHp(nextEnemy.hp);
    setPlayerHp(PLAYER_MAX_HP);
    setPlayerHand(createInitialHand());
    setCpuHand(createInitialHand());
    setBattle(null);
    setIsAnimating(false);
    setLogMessage(`${nextEnemy.name}（HP ${nextEnemy.hp}）があらわれた！`);
  };

  const renderElementBadge = (element: ElementType) => {
    switch (element) {
      case 'fire':
        return (
          <span className="element-tag" style={{ color: '#f87171' }}>
            <Flame size={13} /> 火属性
          </span>
        );
      case 'water':
        return (
          <span className="element-tag" style={{ color: '#60a5fa' }}>
            <Droplets size={13} /> 水属性
          </span>
        );
      case 'grass':
        return (
          <span className="element-tag" style={{ color: '#4ade80' }}>
            <Leaf size={13} /> 草属性
          </span>
        );
    }
  };

  const renderCard = (
    card: Card,
    options?: { interactive?: boolean; isCpuHand?: boolean; bonus?: number; total?: number }
  ) => {
    const { interactive = false, isCpuHand = false, bonus = 0, total } = options || {};
    return (
      <div
        key={card.id}
        onClick={() => interactive && handleSelectCard(card)}
        className={`card attr-${card.element} ${isCpuHand ? 'card-cpu-hand' : ''} ${
          interactive ? (isAnimating ? 'card-disabled' : 'card-interactive') : ''
        }`}
      >
        {bonus > 0 && <div className="bonus-badge">属性有利 +{bonus}!</div>}

        <div className="card-header">{renderElementBadge(card.element)}</div>

        <div className="card-icon-center">
          <Sword
            size={isCpuHand ? 26 : 34}
            color={
              card.element === 'fire'
                ? '#ef4444'
                : card.element === 'water'
                ? '#3b82f6'
                : '#22c55e'
            }
          />
          <div className="weapon-name">{card.weaponName}</div>
        </div>

        <div className="card-footer">
          <span className="atk-label">{total !== undefined ? 'TOTAL' : 'ATK'}</span>
          <span className="atk-value">{total !== undefined ? total : card.attack}</span>
        </div>
      </div>
    );
  };

  const isGameOver = playerHp <= 0 || cpuHp <= 0;

  return (
    <div className="game-container">
      {/* ヘッダー */}
      <header className="header">
        <div className="title-group">
          <h1>WEAPON & MAGIC DUEL</h1>
          <div className="rule-badge">属性有利 (+{ELEMENT_BONUS}): 火 ＞ 草 ＞ 水 ＞ 火</div>
        </div>
        <div className="header-actions">
          <button
            className={`icon-btn ${bgmOn ? 'bgm-active' : ''}`}
            onClick={toggleBgm}
            title="BGM切り替え"
          >
            {bgmOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {bgmOn ? 'BGM ON' : 'BGM OFF'}
          </button>
          <button className="icon-btn" onClick={resetGame}>
            <RotateCcw size={15} /> 次の相手
          </button>
        </div>
      </header>

      {/* CPU（モンスター）エリア */}
      <div>
        <div className={`status-bar ${shakeTarget === 'cpu' ? 'shake' : ''}`}>
          <div className="status-top">
            <div className="enemy-name-group">
              <span>{enemy.name}</span>
              <span className={`rank-tag rank-${enemy.rank}`}>RANK {enemy.rank}</span>
            </div>
            <span>
              HP {cpuHp} / {enemy.hp}
            </span>
          </div>
          <div className="hp-bar-bg">
            <div
              className="hp-bar-fill hp-cpu"
              style={{ width: `${(cpuHp / enemy.hp) * 100}%` }}
            />
          </div>
        </div>

        {/* 相手の手札3枚を公開表示 */}
        <div className="hand-row">
          {cpuHand.map((card) => renderCard(card, { isCpuHand: true }))}
        </div>
      </div>

      {/* 中央バトルフィールド */}
      <main className="arena">
        {battle ? (
          <>
            <div className="battle-stage">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>
                  あなた
                </div>
                {renderCard(battle.playerCard, {
                  bonus: battle.playerBonus,
                  total: battle.playerTotal,
                })}
              </div>

              <div className="vs-badge">VS</div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>
                  {enemy.name}
                </div>
                {renderCard(battle.cpuCard, {
                  bonus: battle.cpuBonus,
                  total: battle.cpuTotal,
                })}
              </div>
            </div>

            <div
              className={`result-banner ${
                battle.outcome === 'win'
                  ? 'result-win'
                  : battle.outcome === 'lose'
                  ? 'result-lose'
                  : 'result-draw'
              }`}
            >
              {battle.outcome === 'win' && `WIN! ${battle.damage} ダメージ！`}
              {battle.outcome === 'lose' && `LOSE... ${battle.damage} ダメージ`}
              {battle.outcome === 'draw' && 'DRAW (引き分け)'}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <Sparkles size={28} style={{ marginBottom: '6px', opacity: 0.6 }} />
            <p style={{ fontSize: '0.88rem' }}>
              {enemy.name} の手札を見て、有利な武器カードを出そう！
            </p>
          </div>
        )}
      </main>

      {/* プレイヤーエリア */}
      <div>
        <div className="hand-row">
          {playerHand.map((card) => renderCard(card, { interactive: true }))}
        </div>

        <div className={`status-bar ${shakeTarget === 'player' ? 'shake' : ''}`}>
          <div className="status-top">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={16} color="#34d399" /> あなた
            </span>
            <span>
              HP {playerHp} / {PLAYER_MAX_HP}
            </span>
          </div>
          <div className="hp-bar-bg">
            <div
              className="hp-bar-fill hp-player"
              style={{ width: `${(playerHp / PLAYER_MAX_HP) * 100}%` }}
            />
          </div>
        </div>

        <div className="battle-log">{logMessage}</div>
      </div>

      {/* 勝敗決着モーダル */}
      {isGameOver && (
        <div className="gameover-overlay">
          <div className="gameover-box">
            <h2 style={{ color: playerHp > 0 ? '#34d399' : '#f87171' }}>
              {playerHp > 0 ? 'VICTORY!' : 'DEFEAT...'}
            </h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>
              {playerHp > 0
                ? `${enemy.name} をたおした！`
                : `${enemy.name} にやられてしまった…`}
            </p>
            <button className="play-again-btn" onClick={resetGame}>
              次のモンスターと戦う
            </button>
          </div>
        </div>
      )}
    </div>
  );
}