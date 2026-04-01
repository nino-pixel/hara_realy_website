import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './Preloader.css'

const Preloader: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Simulate initial loading or just show for a fixed duration to wow the user
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, 2800) // 2.8s total duration

    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="preloader-overlay"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] }
          }}
        >
          <div className="preloader-content">
            <motion.h1
              className="preloader-text"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              CHara <span className="text-accent">Realty</span>
              <motion.div
                className="animated-underline"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{
                  delay: 0.6,
                  duration: 1.2,
                  ease: [0.65, 0, 0.35, 1]
                }}
              />
            </motion.h1>

            <motion.p
              className="preloader-subtext"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
            >
              Homes At Your Fingertips
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Preloader
