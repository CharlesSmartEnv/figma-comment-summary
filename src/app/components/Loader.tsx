import { useState, useEffect } from "react";
import { motion } from "motion/react";

export default function TextBlurTransition({
  text1 = "But, how does this work on mobile?",
  text2 = "This is perfect! Have you tried completely redesigning it though?",
  text3 = "Have you consulted senior stakeholders about this tooltip?",
  text4 = "Sorry, sometimes the model has to think for a bit...",
  animationDuration = 3,
  blurIntensity = 20,
  delayBetween = 2,
  stayDuration = 3,
  staggerDelay = 0.03
}) {
  const [currentSentence, setCurrentSentence] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [animationStates, setAnimationStates] = useState([
    { visible: false, dissolving: false },
    { visible: false, dissolving: false },
    { visible: false, dissolving: false },
    { visible: false, dissolving: false }
  ]);
  
  // Start the animation sequence
  useEffect(() => {
    // Initially show the first sentence
    setAnimationStates(prev => {
      const newState = [...prev];
      newState[0] = { visible: true, dissolving: false };
      return newState;
    });
  }, []);
  
  // Handle the animation sequence
  useEffect(() => {
    const current = currentSentence;
    
    // When a sentence becomes visible, schedule its dissolve
    if (animationStates[current]?.visible && !animationStates[current]?.dissolving) {
      const dissolveTimer = setTimeout(() => {
        setAnimationStates(prev => {
          const newState = [...prev];
          newState[current] = { visible: true, dissolving: true };
          return newState;
        });
      }, stayDuration * 1000);
      
      return () => clearTimeout(dissolveTimer);
    }
    
    // When a sentence is dissolving, prepare to show the next
    if (animationStates[current]?.dissolving) {
      const nextTimer = setTimeout(() => {
        const nextIndex = (current + 1) % 4;

        // reset current sentence back to its initial invisible state so it can animate from bottom next cycle
        setAnimationStates(prev => {
          const newState = [...prev];
          newState[current] = { visible: false, dissolving: false };
          newState[nextIndex] = { visible: true, dissolving: false };
          return newState;
        });

        setCurrentSentence(nextIndex);
        setCycle(c => c + 1); // trigger remount of the upcoming sentence
      }, (animationDuration + delayBetween) * 1000);
      
      return () => clearTimeout(nextTimer);
    }
  }, [animationStates, currentSentence, animationDuration, stayDuration, delayBetween]);
  
  const sentences = [text1, text2, text3, text4];
  
  // Function to render a sentence with character-by-character animation
  const renderCharacters = (text, index) => {
    const characters = text.split('');
    
    return (
      <motion.div
        key={`sentence-${index}-${cycle}`}
        className="absolute top-0 left-0 w-full text-center text-l md:text-xl font-medium text-gray-800"
        initial={{ 
          opacity: 0,
          y: 50
        }}
        animate={{ 
          opacity: animationStates[index]?.visible ? 1 : 0,
          y: animationStates[index]?.visible ? 0 : 50,
        }}
        transition={{ 
          duration: animationDuration / 2,
          ease: "easeInOut"
        }}
      >
        <div className="flex justify-center flex-wrap">
          {characters.map((char, charIndex) => {
            // Calculate delay so it starts from the right side
            const reverseIndex = characters.length - 1 - charIndex;
            const staggeredDelay = reverseIndex * staggerDelay;
            
            return (
              <motion.span
                key={`char-${charIndex}-${cycle}`}
                initial={{ 
                  filter: "blur(0px)",
                  opacity: 1
                }}
                animate={{ 
                  filter: animationStates[index]?.dissolving 
                    ? `blur(${blurIntensity}px)` 
                    : "blur(0px)",
                  opacity: animationStates[index]?.dissolving ? 0 : 1,
                  y: animationStates[index]?.dissolving ? -20 : 0
                }}
                transition={{ 
                  duration: animationDuration / 1.5,
                  delay: animationStates[index]?.dissolving ? staggeredDelay : 0,
                  ease: "easeInOut"
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </motion.span>
            );
          })}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-gray-50 p-4">
      <div className="max-w-2xl w-full relative h-36">
        {sentences.map((text, index) => renderCharacters(text, index))}
      </div>
    </div>
  );
}
