import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Tone from 'tone';

// 두더지 이미지 URL
const diglettImageURL = "https://assets.pokemon.com/assets/cms2/img/pokedex/full/050.png";

// 마우스 커서용 인라인 SVG 망치 (크기: 48x48)
const hammerSvgForCursor = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <g transform="rotate(15 24 24)">
    {/* Hammer Head (빨간색) */}
    <rect x="6" y="2" width="36" height="18" rx="6" ry="6" fill="#DC2626" /> 
    {/* Hammer Handle (갈색) */}
    <rect x="20" y="18" width="8" height="28" rx="3" ry="3" fill="#A16207" />
  </g>
</svg>`;
const hammerCursorDataURL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(hammerSvgForCursor)}`;


// 난이도별 두더지 출현 간격 (밀리초)
const DIFFICULTY_LEVELS = {
  easy: { label: "쉬움 😊", interval: 1200 },
  normal: { label: "보통 🙂", interval: 900 },
  hard: { label: "어려움 😠", interval: 600 },
};

// 퇴장하는 두더지를 맞출 수 있는 유예 시간 (밀리초)
const EXIT_GRACE_PERIOD = 450;

// 클릭 시 나타나는 애니메이션용 망치 아이콘
const AnimatedHammerIcon = () => (
  <svg width="60" height="60" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ transformOrigin: "bottom center" }}>
    <g transform="rotate(15 24 24)">
      <rect x="6" y="2" width="36" height="18" rx="6" ry="6" fill="#DC2626" />
      <rect x="20" y="18" width="8" height="28" rx="3" ry="3" fill="#A16207" />
    </g>
  </svg>
);

export default function App() {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const savedHighScore = localStorage.getItem('whackADiglettHighScore');
    return savedHighScore ? parseInt(savedHighScore, 10) : 0;
  });
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [previousActiveIndexInfo, setPreviousActiveIndexInfo] = useState<{ index: number, deactivationTime: number } | null>(null);
  
  const [hitIndex, setHitIndex] = useState<number | null>(null);
  const [hammerState, setHammerState] = useState<{ holeIndex: number | null, key: number }>({ holeIndex: null, key: 0 });
  
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [currentMoleInterval, setCurrentMoleInterval] = useState(DIFFICULTY_LEVELS.normal.interval);

  const intervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const hitSound = useRef<Tone.Synth | null>(null);

  const HOLES = 16;
  const GAME_DURATION = 30;

  useEffect(() => {
    hitSound.current = new Tone.Synth().toDestination();
    return () => {
      intervalRef.current && clearInterval(intervalRef.current);
      timerRef.current && clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    setCurrentMoleInterval(DIFFICULTY_LEVELS[difficulty].interval);
  }, [difficulty]);

  const startGame = async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setRunning(true);
    setActiveIndex(null);
    setPreviousActiveIndexInfo(null);
    setHitIndex(null);
    setHammerState({ holeIndex: null, key: 0 });

    intervalRef.current && clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (activeIndex !== null) {
        setPreviousActiveIndexInfo({ index: activeIndex, deactivationTime: Date.now() });
      }
      setActiveIndex(Math.floor(Math.random() * HOLES));
    }, currentMoleInterval); 

    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          clearInterval(intervalRef.current!);
          setRunning(false);
          setActiveIndex(null);
          setPreviousActiveIndexInfo(null);
          // Check and update high score
          if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('whackADiglettHighScore', score.toString());
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const isMoleHit = (clickedIndex: number) => {
    if (activeIndex !== null && clickedIndex === activeIndex) {
      const hitIndex = activeIndex;
      setActiveIndex(null);
      setPreviousActiveIndexInfo(null);
      return { hit: true, index: hitIndex };
    }

    if (
      previousActiveIndexInfo &&
      clickedIndex === previousActiveIndexInfo.index &&
      Date.now() - previousActiveIndexInfo.deactivationTime < EXIT_GRACE_PERIOD
    ) {
      const hitIndex = previousActiveIndexInfo.index;
      setPreviousActiveIndexInfo(null);
      return { hit: true, index: hitIndex };
    }

    return { hit: false, index: -1 };
  };

  const triggerHitEffects = (hitMoleIndex: number) => {
    setScore((s) => s + 1);
    setHitIndex(hitMoleIndex);
    setHammerState({ holeIndex: hitMoleIndex, key: Date.now() });

    hitSound.current!.triggerAttackRelease("C3", "8n", Tone.now());
    setTimeout(() => setHitIndex(null), 300);
    setTimeout(() => {
      setHammerState((prevState) =>
        prevState.holeIndex === hitMoleIndex ? { holeIndex: null, key: 0 } : prevState
      );
    }, 600);
  };

  const bonk = (clickedIndex: number) => {
    if (!running || !hitSound.current) return;

    const { hit, index } = isMoleHit(clickedIndex);
    if (hit) {
      triggerHitEffects(index);
    }
  };

  const handleDifficultyChange = (level: 'easy' | 'normal' | 'hard') => {
    setDifficulty(level);
  };

  // Helper function for class names
  const classNames = (...classes: (string | boolean | undefined)[]) => {
    return classes.filter(Boolean).join(' ');
  }

  return (
    <>
      {/* 전체 컨테이너: 모바일에서는 p-2, sm 이상에서는 p-4 */}
      <div 
        className={classNames(
            "min-h-screen flex flex-col items-center justify-center gap-4 sm:gap-6 bg-gradient-to-br from-rose-100 to-amber-100 p-2 sm:p-4 font-sans"
        )}
        style={running ? { cursor: `url("${hammerCursorDataURL}") 24 38, auto` } : undefined}
      >
        {/* 타이틀: 모바일에서는 text-3xl, sm 이상에서는 text-4xl */}
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-700 mb-1 sm:mb-2 text-center">Whack-a-Diglett!</h1>

        {/* 난이도 선택 UI: 모바일에서는 mb-2, sm 이상에서는 mb-4. 버튼 간격 gap-1 또는 gap-2 */}
        {!running && (
          <div className="mb-2 sm:mb-4 p-3 sm:p-4 bg-white/70 rounded-lg shadow-md w-full max-w-xs sm:max-w-sm md:max-w-md">
            <h2 className="text-base sm:text-lg font-semibold text-amber-600 mb-2 text-center">난이도 선택:</h2>
            <div className="flex justify-center gap-1 sm:gap-2">
              {(Object.keys(DIFFICULTY_LEVELS) as Array<keyof typeof DIFFICULTY_LEVELS>).map((level) => (
                <button
                  key={level}
                  onClick={() => handleDifficultyChange(level)}
                  className={classNames(
                    "difficulty-button flex-grow sm:flex-grow-0",
                    difficulty === level ? 'bg-indigo-500 text-white difficulty-button-selected' : 'bg-slate-200 hover:bg-slate-300 text-slate-700',
                    level === 'easy' ? 'hover:bg-green-400' : level === 'normal' ? 'hover:bg-blue-400' : 'hover:bg-red-400'
                  )}
                >
                  {DIFFICULTY_LEVELS[level].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 점수판: 모바일에서는 text-lg, sm 이상에서는 text-xl. 패딩 p-3 sm:p-4 */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center text-lg sm:text-xl font-semibold bg-white/70 p-3 sm:p-4 rounded-lg shadow-md">
          <div className="text-amber-600">⏱️ 시간: <span className="text-blue-600 w-8 inline-block text-center">{timeLeft}초</span></div>
          <div className="text-amber-600">🎯 점수: <span className="text-red-600 w-8 inline-block text-center">{score}</span></div>
          <div className="text-amber-600">🏆 최고 점수: <span className="text-purple-600 w-8 inline-block text-center">{highScore}</span></div>
        </div>
        
        {/* 게임 보드: 모바일에서는 gap-1 또는 gap-2, sm 이상에서는 gap-2 또는 gap-4. 패딩 p-2 sm:p-4 */}
        {/* 게임 보드 컨테이너의 최대 너비를 제한하여 모바일에서 너무 커지지 않도록 함 */}
        {running && (
          <div className="w-full max-w-xs sm:max-w-sm md:max-w-md">
            <div className="grid grid-cols-4 gap-1 xxs:gap-2 xs:gap-2 sm:gap-3 p-2 sm:p-4 bg-green-300 rounded-2xl shadow-xl">
              {Array.from({ length: HOLES }).map((_, idx) => (
                // 구멍 크기: 기본 w-16 h-16, xs에서 w-16 h-16, sm에서 w-20 h-20, md에서 w-24 h-24
                // Tailwind JIT 모드에서는 xxs, xs 같은 커스텀 breakpoint를 설정해야 할 수 있습니다. 여기서는 기본 sm, md를 사용합니다.
                // 여기서는 w-full aspect-square를 사용하여 정사각형을 유지하도록 하고, 부모 grid의 크기에 따라 조절되도록 합니다.
                <div 
                  key={idx} 
                  onClick={() => bonk(idx)} 
                  // 패딩을 이용해 내부 컨텐츠 영역 확보 및 터치 영역 유지
                  className="hole-container p-0.5 xxs:p-1 xs:p-1 sm:p-1.5 rounded-full bg-yellow-600/80 shadow-inner relative select-none overflow-hidden border-2 sm:border-4 border-yellow-700/90 flex items-center justify-center group"
                  style={{ aspectRatio: '1 / 1' }} // 정사각형 비율 유지
                >
                  <div className="absolute inset-[10%] rounded-full bg-black/30 group-hover:bg-black/40 transition-colors"></div>
                  <AnimatePresence>
                    {idx === activeIndex && (
                      <motion.img
                        src={diglettImageURL} alt="Diglett"
                        initial={{ y: "100%", scale: 0.8 }} animate={{ y: "5%", scale: 1 }} exit={{ y: "100%", scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className="absolute bottom-0 w-[80%] h-[80%] object-contain z-10" />
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {idx === hitIndex && (
                      <motion.div
                        initial={{ scale: 0.6, opacity: 1 }} animate={{ scale: 1.4, opacity: 0 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        // 반짝임 효과 크기 반응형으로 조절
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        <span className="text-3xl sm:text-4xl md:text-5xl">✨</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {hammerState.holeIndex === idx && (
                      <motion.div
                        key={hammerState.key}
                        initial={{ y: -50, rotate: -45, scale: 0.7, opacity: 0 }}
                        animate={{ y: -5, rotate: 0, scale: 1, opacity: 1, transition: { type: "spring", stiffness: 500, damping: 12, mass: 0.8 } }}
                        exit={{ y: -30, rotate: 30, scale: 0.5, opacity: 0, transition: { duration: 0.25, ease: "easeOut" } }}
                        className="absolute z-30 pointer-events-none" 
                        style={{ top: '0%', left: '50%', x: '-50%' }} >
                        {/* 애니메이션 망치 아이콘 크기 반응형 조절 (SVG width/height를 %로 하거나, 부모 div 크기에 맞추는 방식 고려) */}
                        {/* 여기서는 AnimatedHammerIcon 내부 SVG 크기를 고정했으므로, scale로 조절하는 것이 더 적합할 수 있음 */}
                        <AnimatedHammerIcon />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 시작/재시작 버튼: 모바일에서는 px-6 py-2.5 text-base, sm 이상에서는 px-8 py-3 text-lg */}
        {!running && (
          <button 
            onClick={startGame} 
            className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl shadow-lg bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-bold text-base sm:text-lg transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95"
          >
            {timeLeft === 0 && score > 0 ? `${DIFFICULTY_LEVELS[difficulty].label}로 다시 시작 🏁` : `${DIFFICULTY_LEVELS[difficulty].label}로 시작 🏁`}
          </button>
        )}

        {/* 게임 종료 메시지: 모바일 text-xl, sm 이상 text-2xl */}
        {!running && timeLeft === 0 && score > 0 && (
          <div className="text-xl sm:text-2xl font-bold text-amber-800 mt-2 sm:mt-4">게임 종료! 최종 점수: {score}점</div>
          // Option 2 for high score display (can be chosen instead of Option 1)
          // <div className="text-lg sm:text-xl font-semibold text-purple-700 mt-1">최고 점수: {highScore}점</div>
        )}
      </div>
    </>
  );
}
