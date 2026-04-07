import React from 'react'
import './index.styles.css'

const AnimatedLoader = () => {
  return (
    <div className="text-center w-full max-w-[400px]">
            <div className="w-full h-[150px] flex justify-center items-center mb-4 relative">
              <svg
                className="w-full h-full"
                viewBox="0 0 300 100"
                preserveAspectRatio="xMidYMid meet"
              >
                <path
                  className="stroke-[#5551e3] stroke-[4] stroke-round fill-none opacity-10"
                  d="M0,50 L40,50 L50,35 L65,65 L80,50 L110,50 L120,20 L135,85 L150,50 L180,50 L190,40 L205,60 L220,50 L300,50"
                />
                <path
                  className="stroke-[#5551e3] stroke-[4] stroke-round fill-none animate-ekg"
                  d="M0,50 L40,50 L50,35 L65,65 L80,50 L110,50 L120,20 L135,85 L150,50 L180,50 L190,40 L205,60 L220,50 L300,50"
                />
              </svg>
            </div>
          </div>
  )
}

export default AnimatedLoader